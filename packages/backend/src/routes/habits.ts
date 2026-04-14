import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { Habit, HabitLog, HabitWithStats } from '@mylife/shared'

const app = new Hono()

const createHabitSchema = z.object({
  name: z.string().min(1),
  icon: z.string().min(1).default('✅'),
  color: z.string().min(1).default('bg-orange-500'),
  frequency: z.enum(['daily', 'weekdays', 'weekends', 'custom']).default('daily'),
  custom_days: z.array(z.number().int().min(0).max(6)).nullable().default(null),
  target_per_month: z.number().int().positive().default(30),
})

// GET /habits  返回所有习惯及本周统计
app.get('/', (c) => {
  const habits = db.prepare('SELECT * FROM habits WHERE archived = 0').all() as Habit[]
  const today = new Date().toISOString().slice(0, 10)

  // 计算本周7天日期
  const d = new Date()
  const weekDates: string[] = []
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d)
    dd.setDate(d.getDate() - i)
    weekDates.push(dd.toISOString().slice(0, 10))
  }

  const result: HabitWithStats[] = habits.map(habit => {
    // 本周打卡情况
    const logs = db.prepare(`
      SELECT date, done FROM habit_logs
      WHERE habit_id = ? AND date IN (${weekDates.map(() => '?').join(',')})
    `).all(habit.id, ...weekDates) as Pick<HabitLog, 'date' | 'done'>[]

    const logMap = new Map(logs.map(l => [l.date, l.done]))
    const week_data = weekDates.map(date => logMap.get(date) ?? false)

    // 连续打卡天数
    let streak = 0
    const checkDate = new Date()
    while (true) {
      const ds = checkDate.toISOString().slice(0, 10)
      const log = db.prepare('SELECT done FROM habit_logs WHERE habit_id = ? AND date = ?').get(habit.id, ds) as { done: boolean } | undefined
      if (!log?.done) break
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // 本月打卡次数
    const monthStart = today.slice(0, 7) + '-01'
    const { total } = db.prepare(`
      SELECT COUNT(*) as total FROM habit_logs
      WHERE habit_id = ? AND date >= ? AND done = 1
    `).get(habit.id, monthStart) as { total: number }

    return {
      ...habit,
      custom_days: habit.custom_days ? JSON.parse(habit.custom_days as unknown as string) : null,
      streak,
      total_this_month: total,
      week_data,
      today_done: logMap.get(today) ?? false,
    }
  })

  return c.json(result)
})

// POST /habits  创建习惯
app.post('/', zValidator('json', createHabitSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const habit: Habit = {
    id: nanoid(),
    name: input.name,
    icon: input.icon,
    color: input.color,
    frequency: input.frequency,
    custom_days: input.custom_days,
    target_per_month: input.target_per_month,
    archived: false,
    created_at: now,
  }

  db.prepare(`
    INSERT INTO habits (id, name, icon, color, frequency, custom_days, target_per_month, archived, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    habit.id, habit.name, habit.icon, habit.color, habit.frequency,
    habit.custom_days ? JSON.stringify(habit.custom_days) : null,
    habit.target_per_month, 0, habit.created_at
  )

  return c.json(habit, 201)
})

// POST /habits/:id/log  打卡 / 取消打卡
app.post('/:id/log', zValidator('json', z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.boolean(),
  note: z.string().optional(),
})), (c) => {
  const { id } = c.req.param()
  const { date, done, note } = c.req.valid('json')
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO habit_logs (id, habit_id, date, done, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(habit_id, date) DO UPDATE SET done = excluded.done, note = excluded.note
  `).run(nanoid(), id, date, done ? 1 : 0, note ?? null, now)

  return c.json({ ok: true, habit_id: id, date, done })
})

export default app
