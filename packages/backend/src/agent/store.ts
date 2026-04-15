import { nanoid } from 'nanoid'
import type {
  AgentAction,
  AgentEvent,
  AgentMemory,
  AgentMessage,
  AgentPromptConfig,
  AgentToolRun,
  AgentTrace,
  MessageRole,
} from '@mylife/shared'
import db from '../db/client'

type RawAgentAction = Omit<AgentAction, 'payload'> & { payload: string }
type RawAgentEvent = Omit<AgentEvent, 'payload'> & { payload: string }
type RawAgentToolRun = Omit<AgentToolRun, 'arguments' | 'result'> & { arguments: string; result: string | null }
type RawAgentSetting = {
  key: string
  value: string
  updated_at: string
}

const AGENT_SYSTEM_PROMPT_KEY = 'system_prompt'

export const DEFAULT_AGENT_SYSTEM_PROMPT = [
  '你是 mylife 项目的内置个人运营 Agent。',
  '你可以读取用户的任务、目标、习惯、事件、财务、健康和笔记数据，也可以通过工具执行结构化写入。',
  '规则：',
  '1. 对事实和状态先查再说，不要编造数据。',
  '2. 能通过工具完成的操作，就调用工具，不要只给建议。',
  '3. 财务、删除、批量修改等高风险操作要保守，只有在用户明确要求时才执行。',
  '4. 输出简洁、直接，优先给结果，其次补充你做了什么。',
].join('\n')

function parseActionPayload(payload: string) {
  try {
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return {}
  }
}

function parseToolRunJson(value: string | null): unknown {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}

function diffMs(startedAt: string, finishedAt: string) {
  return Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime())
}

export function saveAgentMessage(sessionId: string, role: MessageRole, content: string, traceId: string | null = null) {
  const message: AgentMessage = {
    id: nanoid(),
    session_id: sessionId,
    trace_id: traceId,
    role,
    content,
    created_at: new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO agent_messages (id, session_id, trace_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(message.id, message.session_id, message.trace_id, message.role, message.content, message.created_at)

  return message
}

export function listAgentMessages(sessionId: string, limit = 30) {
  return db.prepare(`
    SELECT * FROM (
      SELECT * FROM agent_messages
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    )
    ORDER BY created_at ASC
  `).all(sessionId, limit) as AgentMessage[]
}

export function listAgentMemory() {
  return db.prepare(`
    SELECT * FROM agent_memory
    ORDER BY updated_at DESC
  `).all() as AgentMemory[]
}

export function rememberAgentMemory(key: string, value: string) {
  const now = new Date().toISOString()
  const existing = db.prepare('SELECT * FROM agent_memory WHERE key = ?').get(key) as AgentMemory | undefined
  const id = existing?.id ?? nanoid()

  db.prepare(`
    INSERT INTO agent_memory (id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(id, key, value, now)

  return db.prepare('SELECT * FROM agent_memory WHERE key = ?').get(key) as AgentMemory
}

function getAgentSetting(key: string) {
  return db.prepare('SELECT * FROM agent_settings WHERE key = ?').get(key) as RawAgentSetting | undefined
}

function upsertAgentSetting(key: string, value: string) {
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO agent_settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, value, now)

  return getAgentSetting(key)
}

export function getAgentSystemPromptConfig(): AgentPromptConfig {
  const setting = getAgentSetting(AGENT_SYSTEM_PROMPT_KEY)
  const customPrompt = setting?.value?.trim() ? setting.value : null

  return {
    prompt: customPrompt ?? DEFAULT_AGENT_SYSTEM_PROMPT,
    custom_prompt: customPrompt,
    default_prompt: DEFAULT_AGENT_SYSTEM_PROMPT,
    is_custom: Boolean(customPrompt),
    updated_at: setting?.updated_at ?? null,
  }
}

export function updateAgentSystemPrompt(prompt: string): AgentPromptConfig {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new Error('prompt is required')
  }

  upsertAgentSetting(AGENT_SYSTEM_PROMPT_KEY, trimmedPrompt)
  return getAgentSystemPromptConfig()
}

export function resetAgentSystemPrompt(): AgentPromptConfig {
  db.prepare('DELETE FROM agent_settings WHERE key = ?').run(AGENT_SYSTEM_PROMPT_KEY)
  return getAgentSystemPromptConfig()
}

export function logAgentAction(
  sessionId: string,
  actionType: string,
  payload: Record<string, unknown>,
  options?: { traceId?: string | null; status?: AgentAction['status']; error?: string | null },
) {
  const action: AgentAction = {
    id: nanoid(),
    session_id: sessionId,
    trace_id: options?.traceId ?? null,
    action_type: actionType,
    payload,
    status: options?.status ?? 'done',
    error: options?.error ?? null,
    created_at: new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO agent_actions (id, session_id, trace_id, action_type, payload, status, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    action.id,
    action.session_id,
    action.trace_id,
    action.action_type,
    JSON.stringify(action.payload),
    action.status,
    action.error,
    action.created_at
  )

  return action
}

export function logAgentEvent(
  traceId: string,
  sessionId: string,
  eventType: AgentEvent['event_type'],
  payload: Record<string, unknown>,
  options?: { stepId?: string | null; stepIndex?: number | null; createdAt?: string },
) {
  const event: AgentEvent = {
    id: nanoid(),
    trace_id: traceId,
    session_id: sessionId,
    step_id: options?.stepId ?? null,
    step_index: options?.stepIndex ?? null,
    event_type: eventType,
    payload,
    created_at: options?.createdAt ?? new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO agent_events (id, trace_id, session_id, step_id, step_index, event_type, payload, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id,
    event.trace_id,
    event.session_id,
    event.step_id,
    event.step_index,
    event.event_type,
    JSON.stringify(event.payload),
    event.created_at,
  )

  return event
}

export function listAgentActionsSince(sessionId: string, createdAfter: string, traceId?: string) {
  const rows = (traceId
    ? db.prepare(`
      SELECT * FROM agent_actions
      WHERE session_id = ? AND trace_id = ?
      ORDER BY created_at ASC
    `).all(sessionId, traceId)
    : db.prepare(`
      SELECT * FROM agent_actions
      WHERE session_id = ? AND created_at >= ?
      ORDER BY created_at ASC
    `).all(sessionId, createdAfter)
  ) as RawAgentAction[]

  return rows.map((row) => ({
    ...row,
    payload: parseActionPayload(row.payload),
  })) as AgentAction[]
}

export function createAgentTrace(sessionId: string, userMessage: string, model: string) {
  const trace: AgentTrace = {
    id: nanoid(),
    session_id: sessionId,
    user_message: userMessage,
    model,
    status: 'running',
    error: null,
    tool_rounds: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
  }

  db.prepare(`
    INSERT INTO agent_traces (id, session_id, user_message, model, status, error, tool_rounds, started_at, finished_at, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    trace.id,
    trace.session_id,
    trace.user_message,
    trace.model,
    trace.status,
    trace.error,
    trace.tool_rounds,
    trace.started_at,
    trace.finished_at,
    trace.duration_ms,
  )

  return trace
}

export function finishAgentTrace(
  traceId: string,
  updates: { status: AgentTrace['status']; error?: string | null; toolRounds: number },
) {
  const existing = db.prepare('SELECT * FROM agent_traces WHERE id = ?').get(traceId) as AgentTrace | undefined
  if (!existing) return null

  const finishedAt = new Date().toISOString()
  db.prepare(`
    UPDATE agent_traces
    SET status = ?, error = ?, tool_rounds = ?, finished_at = ?, duration_ms = ?
    WHERE id = ?
  `).run(
    updates.status,
    updates.error ?? null,
    updates.toolRounds,
    finishedAt,
    diffMs(existing.started_at, finishedAt),
    traceId,
  )

  return db.prepare('SELECT * FROM agent_traces WHERE id = ?').get(traceId) as AgentTrace
}

export function listAgentTraces(sessionId: string, limit = 50) {
  return db.prepare(`
    SELECT * FROM agent_traces
    WHERE session_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(sessionId, limit) as AgentTrace[]
}

export function getAgentTrace(traceId: string) {
  return db.prepare('SELECT * FROM agent_traces WHERE id = ?').get(traceId) as AgentTrace | undefined
}

export function startAgentToolRun(traceId: string, sessionId: string, toolName: string, args: Record<string, unknown>) {
  const toolRun: AgentToolRun = {
    id: nanoid(),
    trace_id: traceId,
    session_id: sessionId,
    tool_name: toolName,
    status: 'running',
    arguments: args,
    result: null,
    error: null,
    started_at: new Date().toISOString(),
    finished_at: null,
    duration_ms: null,
  }

  db.prepare(`
    INSERT INTO agent_tool_runs (id, trace_id, session_id, tool_name, status, arguments, result, error, started_at, finished_at, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    toolRun.id,
    toolRun.trace_id,
    toolRun.session_id,
    toolRun.tool_name,
    toolRun.status,
    JSON.stringify(toolRun.arguments),
    toolRun.result,
    toolRun.error,
    toolRun.started_at,
    toolRun.finished_at,
    toolRun.duration_ms,
  )

  return toolRun
}

export function finishAgentToolRun(
  toolRunId: string,
  updates: { status: AgentToolRun['status']; result?: unknown; error?: string | null },
) {
  const existing = db.prepare('SELECT * FROM agent_tool_runs WHERE id = ?').get(toolRunId) as RawAgentToolRun | undefined
  if (!existing) return null

  const finishedAt = new Date().toISOString()
  db.prepare(`
    UPDATE agent_tool_runs
    SET status = ?, result = ?, error = ?, finished_at = ?, duration_ms = ?
    WHERE id = ?
  `).run(
    updates.status,
    updates.result === undefined ? null : JSON.stringify(updates.result),
    updates.error ?? null,
    finishedAt,
    diffMs(existing.started_at, finishedAt),
    toolRunId,
  )

  return getAgentToolRun(toolRunId)
}

export function getAgentToolRun(toolRunId: string) {
  const row = db.prepare('SELECT * FROM agent_tool_runs WHERE id = ?').get(toolRunId) as RawAgentToolRun | undefined
  if (!row) return null

  return {
    ...row,
    arguments: parseActionPayload(row.arguments),
    result: parseToolRunJson(row.result),
  } as AgentToolRun
}

export function listAgentToolRuns(traceId: string) {
  const rows = db.prepare(`
    SELECT * FROM agent_tool_runs
    WHERE trace_id = ?
    ORDER BY started_at ASC
  `).all(traceId) as RawAgentToolRun[]

  return rows.map((row) => ({
    ...row,
    arguments: parseActionPayload(row.arguments),
    result: parseToolRunJson(row.result),
  })) as AgentToolRun[]
}

export function listAgentActionsByTrace(traceId: string) {
  const rows = db.prepare(`
    SELECT * FROM agent_actions
    WHERE trace_id = ?
    ORDER BY created_at ASC
  `).all(traceId) as RawAgentAction[]

  return rows.map((row) => ({
    ...row,
    payload: parseActionPayload(row.payload),
  })) as AgentAction[]
}

export function listAgentEvents(traceId: string) {
  const rows = db.prepare(`
    SELECT * FROM agent_events
    WHERE trace_id = ?
    ORDER BY created_at ASC, rowid ASC
  `).all(traceId) as RawAgentEvent[]

  return rows.map((row) => ({
    ...row,
    payload: parseActionPayload(row.payload),
  })) as AgentEvent[]
}
