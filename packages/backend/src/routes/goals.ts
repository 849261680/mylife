import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { Goal } from '@myweight/shared'

const app = new Hono()

const createGoalSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  goal_type: z.enum(['short', 'long']).default('long'),
  target_date: z.string().nullable().optional(),
})

const updateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  goal_type: z.enum(['short', 'long']).optional(),
  status: z.enum(['active', 'done']).optional(),
  target_date: z.string().nullable().optional(),
})

app.get('/', (c) => {
  const goals = db.prepare('SELECT * FROM goals ORDER BY goal_type DESC, status ASC, created_at DESC').all() as Goal[]
  return c.json(goals)
})

app.post('/', zValidator('json', createGoalSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const goal: Goal = {
    id: nanoid(),
    title: input.title,
    description: input.description ?? null,
    goal_type: input.goal_type,
    status: 'active',
    target_date: input.target_date ?? null,
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO goals (id, title, description, goal_type, status, target_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(goal.id, goal.title, goal.description, goal.goal_type, goal.status, goal.target_date, goal.created_at, goal.updated_at)

  return c.json(goal, 201)
})

app.patch('/:id', zValidator('json', updateGoalSchema), (c) => {
  const { id } = c.req.param()
  const updates = c.req.valid('json')
  const fields = Object.keys(updates)
  if (fields.length === 0) return c.json({ error: 'no fields' }, 400)

  const setClauses = fields.map(field => `${field} = ?`).join(', ')
  const values = fields.map(field => (updates as Record<string, unknown>)[field] ?? null)
  const now = new Date().toISOString()

  db.prepare(`UPDATE goals SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  const goal = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | undefined
  if (!goal) return c.json({ error: 'not found' }, 404)

  return c.json(goal)
})

app.delete('/:id', (c) => {
  const { id } = c.req.param()
  db.prepare('DELETE FROM goals WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default app
