import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { HealthRecord } from '@mylife/shared'

const app = new Hono()
const METRICS = ['weight', 'sleep', 'meals'] as const
const HEALTH_VALUE_FIELDS = ['weight', 'sleep_start', 'sleep_end', 'sleep_minutes', 'breakfast', 'lunch', 'dinner', 'steps', 'water_ml', 'calories', 'notes'] as const

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().int().optional(),       // 668 = 66.8kg
  sleep_start: z.string().optional(),
  sleep_end: z.string().optional(),
  sleep_minutes: z.number().int().optional(),
  breakfast: z.string().nullable().optional(),
  lunch: z.string().nullable().optional(),
  dinner: z.string().nullable().optional(),
  steps: z.number().int().optional(),
  water_ml: z.number().int().optional(),
  calories: z.number().int().optional(),
  notes: z.string().optional(),
})

function isEmptyRecord(record: Partial<HealthRecord>) {
  return HEALTH_VALUE_FIELDS.every((field) => record[field] == null)
}

// GET /health?from=YYYY-MM-DD&to=YYYY-MM-DD
app.get('/', (c) => {
  const { from, to } = c.req.query()
  let sql = 'SELECT * FROM health_records'
  const params: string[] = []
  if (from && to) {
    sql += ' WHERE date BETWEEN ? AND ?'
    params.push(from, to)
  }
  sql += ' ORDER BY date DESC'
  return c.json(db.prepare(sql).all(...params))
})

// GET /health/latest
app.get('/latest', (c) => {
  const metric = c.req.query('field')
  let sql = 'SELECT * FROM health_records'

  if (metric === 'weight') {
    sql += ' WHERE weight IS NOT NULL'
  } else if (metric === 'sleep') {
    sql += ' WHERE sleep_minutes IS NOT NULL'
  } else if (metric === 'meals') {
    sql += ' WHERE breakfast IS NOT NULL OR lunch IS NOT NULL OR dinner IS NOT NULL'
  }

  sql += ' ORDER BY date DESC LIMIT 1'

  const row = db.prepare(sql).get()
  return c.json(row ?? null)
})

// PUT /health  （upsert by date）
app.put('/', zValidator('json', upsertSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM health_records WHERE date = ?').get(input.date) as HealthRecord | undefined

  const merged = {
    id: existing?.id ?? nanoid(),
    date: input.date,
    weight: 'weight' in input ? input.weight ?? null : existing?.weight ?? null,
    sleep_start: 'sleep_start' in input ? input.sleep_start ?? null : existing?.sleep_start ?? null,
    sleep_end: 'sleep_end' in input ? input.sleep_end ?? null : existing?.sleep_end ?? null,
    sleep_minutes: 'sleep_minutes' in input ? input.sleep_minutes ?? null : existing?.sleep_minutes ?? null,
    breakfast: 'breakfast' in input ? input.breakfast?.trim() || null : existing?.breakfast ?? null,
    lunch: 'lunch' in input ? input.lunch?.trim() || null : existing?.lunch ?? null,
    dinner: 'dinner' in input ? input.dinner?.trim() || null : existing?.dinner ?? null,
    steps: 'steps' in input ? input.steps ?? null : existing?.steps ?? null,
    water_ml: 'water_ml' in input ? input.water_ml ?? null : existing?.water_ml ?? null,
    calories: 'calories' in input ? input.calories ?? null : existing?.calories ?? null,
    notes: 'notes' in input ? input.notes ?? null : existing?.notes ?? null,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO health_records (id, date, weight, sleep_start, sleep_end, sleep_minutes, breakfast, lunch, dinner, steps, water_ml, calories, notes, updated_at)
    VALUES (@id, @date, @weight, @sleep_start, @sleep_end, @sleep_minutes, @breakfast, @lunch, @dinner, @steps, @water_ml, @calories, @notes, @updated_at)
    ON CONFLICT(date) DO UPDATE SET
      weight        = excluded.weight,
      sleep_start   = excluded.sleep_start,
      sleep_end     = excluded.sleep_end,
      sleep_minutes = excluded.sleep_minutes,
      breakfast     = excluded.breakfast,
      lunch         = excluded.lunch,
      dinner        = excluded.dinner,
      steps         = excluded.steps,
      water_ml      = excluded.water_ml,
      calories      = excluded.calories,
      notes         = excluded.notes,
      updated_at    = excluded.updated_at
  `).run(merged)

  return c.json(db.prepare('SELECT * FROM health_records WHERE date = ?').get(input.date))
})

// DELETE /health/:date/metric/:metric
app.delete('/:date/metric/:metric', (c) => {
  const { date, metric } = c.req.param()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'invalid date' }, 400)
  }
  if (!METRICS.includes(metric as typeof METRICS[number])) {
    return c.json({ error: 'invalid metric' }, 400)
  }

  const existing = db.prepare('SELECT * FROM health_records WHERE date = ?').get(date) as HealthRecord | undefined
  if (!existing) {
    return c.json({ error: 'not found' }, 404)
  }

  if (metric === 'weight') {
    db.prepare('UPDATE health_records SET weight = NULL, updated_at = ? WHERE date = ?').run(new Date().toISOString(), date)
  } else if (metric === 'sleep') {
    db.prepare(`
      UPDATE health_records
      SET sleep_start = NULL, sleep_end = NULL, sleep_minutes = NULL, updated_at = ?
      WHERE date = ?
    `).run(new Date().toISOString(), date)
  } else {
    db.prepare(`
      UPDATE health_records
      SET breakfast = NULL, lunch = NULL, dinner = NULL, updated_at = ?
      WHERE date = ?
    `).run(new Date().toISOString(), date)
  }

  const updated = db.prepare('SELECT * FROM health_records WHERE date = ?').get(date) as HealthRecord | undefined
  if (updated && isEmptyRecord(updated)) {
    db.prepare('DELETE FROM health_records WHERE date = ?').run(date)
  }

  return c.json({ ok: true })
})

// DELETE /health/:date
app.delete('/:date', (c) => {
  const { date } = c.req.param()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'invalid date' }, 400)
  }

  db.prepare('DELETE FROM health_records WHERE date = ?').run(date)
  return c.json({ ok: true })
})

export default app
