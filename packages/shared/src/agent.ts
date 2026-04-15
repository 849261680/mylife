export type MessageRole = 'user' | 'assistant'
export type ActionStatus = 'pending' | 'done' | 'undone'
export type AgentTraceStatus = 'running' | 'done' | 'error'
export type AgentToolRunStatus = 'running' | 'done' | 'error'
export type AgentEventType =
  | 'run_started'
  | 'llm_request'
  | 'llm_response'
  | 'tool_call'
  | 'tool_result'
  | 'message'
  | 'run_finished'
  | 'run_failed'

export interface AgentMessage {
  id: string
  session_id: string
  trace_id: string | null
  role: MessageRole
  content: string
  created_at: string
}

export interface AgentMemory {
  id: string
  key: string
  value: string           // 自由文本或 JSON 字符串
  updated_at: string
}

export interface AgentAction {
  id: string
  session_id: string
  trace_id: string | null
  action_type: string     // 'create_task' | 'log_weight' | 'create_event' ...
  payload: Record<string, unknown>
  status: ActionStatus
  error: string | null
  created_at: string
}

export interface AgentTrace {
  id: string
  session_id: string
  user_message: string
  model: string
  status: AgentTraceStatus
  error: string | null
  tool_rounds: number
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export interface AgentToolRun {
  id: string
  trace_id: string
  session_id: string
  tool_name: string
  status: AgentToolRunStatus
  arguments: Record<string, unknown>
  result: unknown
  error: string | null
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export interface AgentEvent {
  id: string
  trace_id: string
  session_id: string
  step_id: string | null
  step_index: number | null
  event_type: AgentEventType
  payload: Record<string, unknown>
  created_at: string
}

export interface AgentTraceDetail {
  trace: AgentTrace
  tool_runs: AgentToolRun[]
  actions: AgentAction[]
  events: AgentEvent[]
}

export interface AgentPromptConfig {
  prompt: string
  custom_prompt: string | null
  default_prompt: string
  is_custom: boolean
  updated_at: string | null
}

export interface AgentInjectedToolDefinition {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
  strict: boolean
}

export interface AgentPromptPreview {
  system_prompt: string
  effective_instructions: string
  dashboard_context: unknown
  conversation: string
  request_payload: Record<string, unknown>
  tools: AgentInjectedToolDefinition[]
}

export interface AgentChatRequest {
  session_id?: string
  message: string
}

export interface AgentChatResponse {
  session_id: string
  trace_id: string
  reply: string
  actions: AgentAction[]
}

export interface AgentRerunResponse extends AgentChatResponse {
  source_trace_id: string
}

export interface AgentStreamSessionChunk {
  type: 'session'
  session_id: string
  trace_id: string
}

export interface AgentStreamDeltaChunk {
  type: 'delta'
  delta: string
}

export interface AgentStreamDoneChunk {
  type: 'done'
  session_id: string
  trace_id: string
  reply: string
  actions: AgentAction[]
}

export interface AgentStreamErrorChunk {
  type: 'error'
  error: string
}

export type AgentStreamChunk =
  | AgentStreamSessionChunk
  | AgentStreamDeltaChunk
  | AgentStreamDoneChunk
  | AgentStreamErrorChunk
