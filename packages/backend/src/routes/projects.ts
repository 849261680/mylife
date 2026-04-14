import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { Project } from '@myweight/shared'

const app = new Hono()

const createProjectSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).default('indigo'),
  icon: z.string().optional(),
})

app.get('/', (c) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[]
  return c.json(projects)
})

app.post('/', zValidator('json', createProjectSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const project: Project = {
    id: nanoid(),
    name: input.name,
    color: input.color,
    icon: input.icon,
    created_at: now,
  }

  db.prepare(`
    INSERT INTO projects (id, name, color, icon, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(project.id, project.name, project.color, project.icon ?? null, project.created_at)

  return c.json(project, 201)
})

export default app
