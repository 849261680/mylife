import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { HealthRecord } from '@myweight/shared'

const app = new Hono()

const upsertSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().int().optional(),       // 668 = 66.8kg
  sleep_start: z.string().optional(),
  sleep_end: z.string().optional(),
  sleep_minutes: z.number().int().optional(),
  steps: z.number().int().optional(),
  water_ml: z.number().int().optional(),
  calories: z.number().int().optional(),
  notes: z.string().optional(),
})

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
  const row = db.prepare('SELECT * FROM health_records ORDER BY date DESC LIMIT 1').get()
  return c.json(row ?? null)
})

// PUT /health  （upsert by date）
app.put('/', zValidator('json', upsertSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT id FROM health_records WHERE date = ?').get(input.date) as { id: string } | undefined

  const id = existing?.id ?? nanoid()
  db.prepare(`
    INSERT INTO health_records (id, date, weight, sleep_start, sleep_end, sleep_minutes, steps, water_ml, calories, notes, updated_at)
    VALUES (@id, @date, @weight, @sleep_start, @sleep_end, @sleep_minutes, @steps, @water_ml, @calories, @notes, @updated_at)
    ON CONFLICT(date) DO UPDATE SET
      weight        = excluded.weight,
      sleep_start   = excluded.sleep_start,
      sleep_end     = excluded.sleep_end,
      sleep_minutes = excluded.sleep_minutes,
      steps         = excluded.steps,
      water_ml      = excluded.water_ml,
      calories      = excluded.calories,
      notes         = excluded.notes,
      updated_at    = excluded.updated_at
  `).run({
    id,
    date: input.date,
    weight: input.weight ?? null,
    sleep_start: input.sleep_start ?? null,
    sleep_end: input.sleep_end ?? null,
    sleep_minutes: input.sleep_minutes ?? null,
    steps: input.steps ?? null,
    water_ml: input.water_ml ?? null,
    calories: input.calories ?? null,
    notes: input.notes ?? null,
    updated_at: now,
  })

  return c.json(db.prepare('SELECT * FROM health_records WHERE date = ?').get(input.date))
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
