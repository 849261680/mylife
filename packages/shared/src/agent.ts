export type MessageRole = 'user' | 'assistant'
export type ActionStatus = 'pending' | 'done' | 'undone'

export interface AgentMessage {
  id: string
  session_id: string
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
  action_type: string     // 'create_task' | 'log_weight' | 'create_event' ...
  payload: Record<string, unknown>
  status: ActionStatus
  created_at: string
}
