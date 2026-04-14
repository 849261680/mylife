import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { CalendarEvent } from '@myweight/shared'

const app = new Hono()

const createEventSchema = z.object({
  title: z.string().min(1),
  start_time: z.string(),
  end_time: z.string(),
  location: z.string().optional(),
  color: z.string().default('#6366f1'),
  is_all_day: z.boolean().default(false),
  recurrence: z.enum(['daily', 'weekly', 'monthly']).nullable().default(null),
  notes: z.string().optional(),
})

// GET /events?start=YYYY-MM-DD&end=YYYY-MM-DD
app.get('/', (c) => {
  const { start, end } = c.req.query()
  let sql = 'SELECT * FROM events WHERE 1=1'
  const params: string[] = []

  if (start) { sql += ' AND date(start_time) >= ?'; params.push(start) }
  if (end)   { sql += ' AND date(start_time) <= ?'; params.push(end) }
  sql += ' ORDER BY start_time ASC'

  type RawEvent = Omit<CalendarEvent, 'is_all_day'> & { is_all_day: number }
  const rows = db.prepare(sql).all(...params) as RawEvent[]
  return c.json(rows.map(r => ({ ...r, is_all_day: Boolean(r.is_all_day) })))
})

// POST /events
app.post('/', zValidator('json', createEventSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const event: CalendarEvent = {
    id: nanoid(),
    title: input.title,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location,
    color: input.color,
    is_all_day: input.is_all_day,
    recurrence: input.recurrence,
    notes: input.notes,
    created_at: now,
  }
  db.prepare(`
    INSERT INTO events (id, title, start_time, end_time, location, color, is_all_day, recurrence, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event.id, event.title, event.start_time, event.end_time,
         event.location ?? null, event.color, event.is_all_day ? 1 : 0,
         event.recurrence ?? null, event.notes ?? null, event.created_at)
  return c.json(event, 201)
})

// DELETE /events/:id
app.delete('/:id', (c) => {
  const { id } = c.req.param()
  db.prepare('DELETE FROM events WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default app
