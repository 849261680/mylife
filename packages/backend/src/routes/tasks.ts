import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { Task, Project, TaskSubtask } from '@mylife/shared'

const app = new Hono()

const createTaskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  due_date: z.string().nullable().default(null),
  due_time: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  project_id: z.string().nullable().default(null),
})

const createSubtaskSchema = z.object({
  title: z.string().min(1),
  priority: z.enum(['high', 'low']).default('low'),
})

const updateSubtaskSchema = z.object({
  title: z.string().min(1).optional(),
  done: z.boolean().optional(),
  priority: z.enum(['high', 'low']).optional(),
})

function parseSubtask(row: TaskSubtask & { done: number | boolean }): TaskSubtask {
  return { ...row, done: Boolean(row.done) }
}

// GET /tasks
app.get('/', (c) => {
  const { status, project_id } = c.req.query()
  let sql = 'SELECT * FROM tasks WHERE 1=1'
  const params: string[] = []

  if (status) { sql += ' AND status = ?'; params.push(status) }
  if (project_id) { sql += ' AND project_id = ?'; params.push(project_id) }
  sql += ' ORDER BY due_date ASC, created_at DESC'

  const rows = db.prepare(sql).all(...params) as Task[]
  const tasks = rows.map(t => ({ ...t, tags: JSON.parse(t.tags as unknown as string) }))
  return c.json(tasks)
})

// POST /tasks
app.post('/', zValidator('json', createTaskSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const task: Task = {
    id: nanoid(),
    project_id: input.project_id,
    title: input.title,
    priority: input.priority,
    status: 'todo',
    due_date: input.due_date,
    due_time: input.due_time,
    tags: input.tags,
    done_at: null,
    created_at: now,
    updated_at: now,
  }
  db.prepare(`
    INSERT INTO tasks (id, project_id, title, priority, status, due_date, due_time, tags, done_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(task.id, task.project_id, task.title, task.priority, task.status,
         task.due_date, task.due_time, JSON.stringify(task.tags), task.done_at,
         task.created_at, task.updated_at)
  return c.json(task, 201)
})

// GET /tasks/subtasks?task_id=
app.get('/subtasks', (c) => {
  const taskId = c.req.query('task_id')
  let sql = 'SELECT * FROM task_subtasks'
  const params: string[] = []
  if (taskId) {
    sql += ' WHERE task_id = ?'
    params.push(taskId)
  }
  sql += ' ORDER BY created_at ASC'

  const rows = db.prepare(sql).all(...params) as (TaskSubtask & { done: number })[]
  return c.json(rows.map(parseSubtask))
})

// POST /tasks/:id/subtasks
app.post('/:id/subtasks', zValidator('json', createSubtaskSchema), (c) => {
  const { id } = c.req.param()
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const subtask: TaskSubtask = {
    id: nanoid(),
    task_id: id,
    title: input.title,
    done: false,
    priority: input.priority,
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO task_subtasks (id, task_id, title, done, priority, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(subtask.id, subtask.task_id, subtask.title, 0, subtask.priority, subtask.created_at, subtask.updated_at)

  return c.json(subtask, 201)
})

// PATCH /tasks/subtasks/:id
app.patch('/subtasks/:id', zValidator('json', updateSubtaskSchema), (c) => {
  const { id } = c.req.param()
  const updates = c.req.valid('json')
  const fields = Object.keys(updates)
  if (fields.length === 0) return c.json({ error: 'no fields' }, 400)

  const setClauses = fields.map(field => `${field} = ?`).join(', ')
  const values = fields.map(field => {
    const value = (updates as Record<string, unknown>)[field]
    return field === 'done' ? (value ? 1 : 0) : value
  })
  const now = new Date().toISOString()

  db.prepare(`UPDATE task_subtasks SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, now, id)
  const updated = db.prepare('SELECT * FROM task_subtasks WHERE id = ?').get(id) as (TaskSubtask & { done: number }) | undefined
  if (!updated) return c.json({ error: 'not found' }, 404)

  return c.json(parseSubtask(updated))
})

// DELETE /tasks/subtasks/:id
app.delete('/subtasks/:id', (c) => {
  const { id } = c.req.param()
  db.prepare('DELETE FROM task_subtasks WHERE id = ?').run(id)
  return c.json({ ok: true })
})

// PATCH /tasks/:id
app.patch('/:id', (c) => {
  const { id } = c.req.param()
  const body = c.req.json()
  const now = new Date().toISOString()
  // 动态构建 SET 子句（只更新传入的字段）
  return body.then((updates: Partial<Task>) => {
    if (updates.status === 'done' && updates.done_at === undefined) {
      updates.done_at = now
    }
    if (updates.status && updates.status !== 'done' && updates.done_at === undefined) {
      updates.done_at = null
    }

    const fields = Object.keys(updates).filter(k => k !== 'id')
    if (fields.length === 0) return c.json({ error: 'no fields' }, 400)

    const setClauses = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => {
      const v = (updates as Record<string, unknown>)[f]
      return f === 'tags' ? JSON.stringify(v) : v
    })
    db.prepare(`UPDATE tasks SET ${setClauses}, updated_at = ? WHERE id = ?`)
      .run(...values, now, id)

    const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task
    return c.json({ ...updated, tags: JSON.parse(updated.tags as unknown as string) })
  })
})

// DELETE /tasks/:id
app.delete('/:id', (c) => {
  const { id } = c.req.param()
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default app
