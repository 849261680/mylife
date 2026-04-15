import type {
  Task, TaskSubtask, CreateTaskInput, UpdateTaskInput, CreateTaskSubtaskInput, UpdateTaskSubtaskInput,
  Project,
  AgentChatRequest, AgentChatResponse, AgentMessage, AgentPromptConfig, AgentPromptPreview, AgentRerunResponse, AgentStreamChunk, AgentTrace, AgentTraceDetail,
  Goal, CreateGoalInput, UpdateGoalInput,
  CreateHabitInput,
  HabitWithStats,
  HealthRecord, UpsertHealthInput,
  Transaction, CreateTransactionInput, MonthlySummary,
  CalendarEvent, CreateEventInput,
  Notebook, NoteIndex, Note, CreateNoteInput, UpdateNoteInput,
} from '@mylife/shared'

const BASE = 'http://localhost:3004'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ── Tasks ──────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { status?: string; project_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)
  },
  create: (input: CreateTaskInput) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateTaskInput) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
  subtasks: (params?: { task_id?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<TaskSubtask[]>(`/api/tasks/subtasks${qs ? `?${qs}` : ''}`)
  },
  createSubtask: (taskId: string, input: CreateTaskSubtaskInput) =>
    request<TaskSubtask>(`/api/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify(input) }),
  updateSubtask: (id: string, input: UpdateTaskSubtaskInput) =>
    request<TaskSubtask>(`/api/tasks/subtasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  removeSubtask: (id: string) =>
    request<{ ok: boolean }>(`/api/tasks/subtasks/${id}`, { method: 'DELETE' }),
}

// ── Projects ───────────────────────────────────────────
export const projectsApi = {
  list: () => request<Project[]>('/api/projects'),
  create: (input: Pick<Project, 'name'> & Partial<Pick<Project, 'color' | 'icon'>>) =>
    request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
}

// ── Goals ──────────────────────────────────────────────
export const goalsApi = {
  list: () => request<Goal[]>('/api/goals'),
  create: (input: CreateGoalInput) =>
    request<Goal>('/api/goals', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateGoalInput) =>
    request<Goal>(`/api/goals/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/goals/${id}`, { method: 'DELETE' }),
}

// ── Habits ─────────────────────────────────────────────
export const habitsApi = {
  list: () => request<HabitWithStats[]>('/api/habits'),
  create: (input: CreateHabitInput) =>
    request<HabitWithStats>('/api/habits', { method: 'POST', body: JSON.stringify(input) }),
  log: (id: string, date: string, done: boolean) =>
    request<{ ok: boolean }>(`/api/habits/${id}/log`, {
      method: 'POST',
      body: JSON.stringify({ date, done }),
    }),
}

// ── Health ─────────────────────────────────────────────
export const healthApi = {
  list: (from: string, to: string) =>
    request<HealthRecord[]>(`/api/health?from=${from}&to=${to}`),
  latest: (field?: 'weight' | 'sleep') =>
    request<HealthRecord | null>(`/api/health/latest${field ? `?field=${field}` : ''}`),
  upsert: (input: UpsertHealthInput) =>
    request<HealthRecord>('/api/health', { method: 'PUT', body: JSON.stringify(input) }),
  removeMetric: (date: string, metric: 'weight' | 'sleep' | 'meals') =>
    request<{ ok: boolean }>(`/api/health/${date}/metric/${metric}`, { method: 'DELETE' }),
  remove: (date: string) =>
    request<{ ok: boolean }>(`/api/health/${date}`, { method: 'DELETE' }),
}

// ── Finance ────────────────────────────────────────────
export const financeApi = {
  transactions: (month?: string) => {
    const qs = month ? `?month=${month}` : ''
    return request<Transaction[]>(`/api/finance/transactions${qs}`)
  },
  create: (input: CreateTransactionInput) =>
    request<Transaction>('/api/finance/transactions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  summary: (month?: string) => {
    const qs = month ? `?month=${month}` : ''
    return request<MonthlySummary>(`/api/finance/summary${qs}`)
  },
}

// ── Events ─────────────────────────────────────────────
export const eventsApi = {
  list: (start: string, end: string) =>
    request<CalendarEvent[]>(`/api/events?start=${start}&end=${end}`),
  create: (input: CreateEventInput) =>
    request<CalendarEvent>('/api/events', { method: 'POST', body: JSON.stringify(input) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/events/${id}`, { method: 'DELETE' }),
}

// ── Notes ──────────────────────────────────────────────
export const notesApi = {
  notebooks: () =>
    request<{ notebooks: (Notebook & { count: number })[]; total: number }>('/api/notes/notebooks'),
  createNotebook: (name: string, color?: string) =>
    request<Notebook>('/api/notes/notebooks', { method: 'POST', body: JSON.stringify({ name, color }) }),
  removeNotebook: (id: string) =>
    request<{ ok: boolean }>(`/api/notes/notebooks/${id}`, { method: 'DELETE' }),
  list: (params?: { notebook_id?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString()
    return request<NoteIndex[]>(`/api/notes${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<Note>(`/api/notes/${id}`),
  create: (input: CreateNoteInput) =>
    request<NoteIndex>('/api/notes', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: UpdateNoteInput) =>
    request<NoteIndex>(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) =>
    request<{ ok: boolean }>(`/api/notes/${id}`, { method: 'DELETE' }),
}

// ── Agent ──────────────────────────────────────────────
export const agentApi = {
  chat: (input: AgentChatRequest) =>
    request<AgentChatResponse>('/api/agent/chat', { method: 'POST', body: JSON.stringify(input) }),
  messages: (sessionId: string) =>
    request<AgentMessage[]>(`/api/agent/sessions/${sessionId}/messages`),
  traces: (sessionId: string) =>
    request<AgentTrace[]>(`/api/agent/sessions/${sessionId}/traces`),
  traceDetail: (traceId: string) =>
    request<AgentTraceDetail>(`/api/agent/traces/${traceId}`),
  prompt: () =>
    request<AgentPromptConfig>('/api/agent/prompt'),
  promptPreview: (sessionId?: string) =>
    request<AgentPromptPreview>(`/api/agent/prompt/preview${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`),
  updatePrompt: (prompt: string) =>
    request<AgentPromptConfig>('/api/agent/prompt', { method: 'PUT', body: JSON.stringify({ prompt }) }),
  resetPrompt: () =>
    request<AgentPromptConfig>('/api/agent/prompt', { method: 'DELETE' }),
  rerunTrace: (traceId: string) =>
    request<AgentRerunResponse>(`/api/agent/traces/${traceId}/rerun`, { method: 'POST' }),
  stream: async function* (input: AgentChatRequest): AsyncGenerator<AgentStreamChunk> {
    const res = await fetch(`${BASE}/api/agent/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`API /api/agent/chat/stream → ${res.status}: ${text}`)
    }

    if (!res.body) {
      throw new Error('Agent stream is not available')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let newlineIndex = buffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim()
          buffer = buffer.slice(newlineIndex + 1)
          if (line) {
            yield JSON.parse(line) as AgentStreamChunk
          }
          newlineIndex = buffer.indexOf('\n')
        }
      }

      const remaining = buffer.trim()
      if (remaining) {
        yield JSON.parse(remaining) as AgentStreamChunk
      }
    } finally {
      reader.releaseLock()
    }
  },
}
