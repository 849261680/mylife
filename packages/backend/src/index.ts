import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'

import tasksRouter from './routes/tasks'
import healthRouter from './routes/health'
import habitsRouter from './routes/habits'
import financeRouter from './routes/finance'
import eventsRouter from './routes/events'
import notesRouter from './routes/notes'
import projectsRouter from './routes/projects'
import goalsRouter from './routes/goals'

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'] }))

app.get('/', (c) => c.json({ status: 'ok', version: '0.1.0' }))

app.route('/api/tasks', tasksRouter)
app.route('/api/projects', projectsRouter)
app.route('/api/goals', goalsRouter)
app.route('/api/health', healthRouter)
app.route('/api/habits', habitsRouter)
app.route('/api/finance', financeRouter)
app.route('/api/events', eventsRouter)
app.route('/api/notes', notesRouter)

const PORT = 3004

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`)
})
