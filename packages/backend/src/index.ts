import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serve } from '@hono/node-server'
import { config as loadEnv } from 'dotenv'

import tasksRouter from './routes/tasks'
import healthRouter from './routes/health'
import habitsRouter from './routes/habits'
import financeRouter from './routes/finance'
import eventsRouter from './routes/events'
import notesRouter from './routes/notes'
import projectsRouter from './routes/projects'
import goalsRouter from './routes/goals'
import agentRouter from './routes/agent'
import { shutdownLangfuseInstrumentation, startLangfuseInstrumentation } from './instrumentation'

const currentDir = dirname(fileURLToPath(import.meta.url))
const rootEnvPath = resolve(currentDir, '../../../.env')
const packageEnvPath = resolve(currentDir, '../.env')

if (existsSync(rootEnvPath)) {
  loadEnv({ path: rootEnvPath })
} else if (existsSync(packageEnvPath)) {
  loadEnv({ path: packageEnvPath })
}

startLangfuseInstrumentation()

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
app.route('/api/agent', agentRouter)

const PORT = 3004

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`)
  if (process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY) {
    console.log(`🔎 Langfuse tracing enabled → ${process.env.LANGFUSE_BASE_URL ?? 'https://cloud.langfuse.com'}`)
  }
})

const handleShutdown = async () => {
  await shutdownLangfuseInstrumentation().catch(() => undefined)
  process.exit(0)
}

process.once('SIGINT', () => {
  void handleShutdown()
})

process.once('SIGTERM', () => {
  void handleShutdown()
})
