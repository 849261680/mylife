import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import type { AgentStreamChunk } from '@mylife/shared'
import {
  getAgentSystemPromptConfig,
  listAgentEvents,
  getAgentTrace,
  listAgentActionsByTrace,
  listAgentMessages,
  listAgentToolRuns,
  listAgentTraces,
  resetAgentSystemPrompt,
  updateAgentSystemPrompt,
} from '../agent/store'
import { getAgentPromptPreview, runAgentTurn, runAgentTurnStream } from '../agent/runtime'

const app = new Hono()
const promptSchema = z.object({
  prompt: z.string().min(1),
})

function ensureDebugAccess() {
  return process.env.NODE_ENV !== 'production'
}

app.post('/chat', zValidator('json', z.object({
  session_id: z.string().min(1).optional(),
  message: z.string().min(1),
})), async (c) => {
  const { session_id, message } = c.req.valid('json')
  const resolvedSessionId = session_id ?? nanoid()

  try {
    const result = await runAgentTurn(resolvedSessionId, message)
    return c.json(result)
  } catch (error) {
    const messageText = error instanceof Error ? error.message : 'agent runtime failed'
    const status = messageText.includes('API_KEY') ? 503 : 500
    return c.json({ error: messageText }, status)
  }
})

app.post('/chat/stream', zValidator('json', z.object({
  session_id: z.string().min(1).optional(),
  message: z.string().min(1),
})), async (c) => {
  const { session_id, message } = c.req.valid('json')
  const resolvedSessionId = session_id ?? nanoid()
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (chunk: AgentStreamChunk) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`))
      }

      try {
        const result = await runAgentTurnStream(
          resolvedSessionId,
          message,
          (delta) => {
            write({ type: 'delta', delta })
          },
          (traceId) => {
            write({ type: 'session', session_id: resolvedSessionId, trace_id: traceId })
          },
        )

        write({
          type: 'done',
          session_id: result.session_id,
          trace_id: result.trace_id,
          reply: result.reply,
          actions: result.actions,
        })
      } catch (error) {
        const messageText = error instanceof Error ? error.message : 'agent runtime failed'
        write({ type: 'error', error: messageText })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

app.get('/sessions/:id/messages', (c) => {
  const { id } = c.req.param()
  return c.json(listAgentMessages(id, 200))
})

app.get('/sessions/:id/traces', (c) => {
  const { id } = c.req.param()
  return c.json(listAgentTraces(id, 100))
})

app.get('/traces/:id', (c) => {
  const { id } = c.req.param()
  const trace = getAgentTrace(id)
  if (!trace) {
    return c.json({ error: 'trace not found' }, 404)
  }

  return c.json({
    trace,
    tool_runs: listAgentToolRuns(id),
    actions: listAgentActionsByTrace(id),
    events: listAgentEvents(id),
  })
})

app.get('/prompt', (c) => {
  if (!ensureDebugAccess()) {
    return c.json({ error: 'not found' }, 404)
  }
  return c.json(getAgentSystemPromptConfig())
})

app.put('/prompt', zValidator('json', promptSchema), (c) => {
  if (!ensureDebugAccess()) {
    return c.json({ error: 'not found' }, 404)
  }
  const { prompt } = c.req.valid('json')
  return c.json(updateAgentSystemPrompt(prompt))
})

app.delete('/prompt', (c) => {
  if (!ensureDebugAccess()) {
    return c.json({ error: 'not found' }, 404)
  }
  return c.json(resetAgentSystemPrompt())
})

app.get('/prompt/preview', async (c) => {
  if (!ensureDebugAccess()) {
    return c.json({ error: 'not found' }, 404)
  }
  const sessionId = c.req.query('session_id') || undefined
  return c.json(await getAgentPromptPreview(sessionId))
})

app.post('/traces/:id/rerun', async (c) => {
  if (!ensureDebugAccess()) {
    return c.json({ error: 'not found' }, 404)
  }
  const { id } = c.req.param()
  const trace = getAgentTrace(id)
  if (!trace) {
    return c.json({ error: 'trace not found' }, 404)
  }

  const rerunSessionId = nanoid()
  const result = await runAgentTurn(rerunSessionId, trace.user_message)
  return c.json({
    source_trace_id: id,
    ...result,
  })
})

export default app
