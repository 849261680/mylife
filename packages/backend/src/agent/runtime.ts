import OpenAI from 'openai'
import { nanoid } from 'nanoid'
import { startActiveObservation } from '@langfuse/tracing'
import type { LangfuseAgent } from '@langfuse/tracing'
import type { AgentChatResponse, AgentMessage, AgentPromptPreview } from '@mylife/shared'
import {
  DEFAULT_AGENT_SYSTEM_PROMPT,
  createAgentTrace,
  finishAgentToolRun,
  finishAgentTrace,
  getAgentSystemPromptConfig,
  listAgentActionsSince,
  logAgentEvent,
  listAgentMemory,
  listAgentMessages,
  saveAgentMessage,
  startAgentToolRun,
} from './store'
import { executeAgentTool, getDashboardContextForAgent, openAiToolDefinitions } from './tools'

const MAX_TOOL_ROUNDS = 8
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

let client: OpenAI | null = null

function getOpenAIClient() {
  if (!client) {
    if (process.env.OPENROUTER_API_KEY) {
      client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: OPENROUTER_BASE_URL,
        defaultHeaders: {
          ...(process.env.OPENROUTER_APP_URL ? { 'HTTP-Referer': process.env.OPENROUTER_APP_URL } : {}),
          ...(process.env.OPENROUTER_APP_NAME ? { 'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME } : {}),
        },
      })
    } else if (process.env.OPENAI_API_KEY) {
      client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    } else {
      throw new Error('OPENROUTER_API_KEY or OPENAI_API_KEY is not configured')
    }
  }
  return client
}

function getModel() {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_MODEL ?? 'openai/gpt-5-mini'
  }
  return process.env.OPENAI_MODEL ?? 'gpt-5-mini'
}

function formatMemory() {
  const memory = listAgentMemory()
  if (memory.length === 0) return '暂无长期记忆。'

  return memory
    .slice(0, 20)
    .map((item) => `- ${item.key}: ${item.value}`)
    .join('\n')
}

function formatConversation(history: AgentMessage[]) {
  return history
    .map((item) => `${item.role === 'user' ? '用户' : '助手'}: ${item.content}`)
    .join('\n\n')
}

function toResponseMessage(role: 'user' | 'assistant', text: string): OpenAI.Responses.EasyInputMessage {
  return {
    type: 'message',
    role,
    content: [
      {
        type: 'input_text',
        text,
      },
    ],
  }
}

function buildInstructions(dashboardContext: unknown, systemPrompt = DEFAULT_AGENT_SYSTEM_PROMPT) {
  return [
    systemPrompt,
    '',
    '长期记忆：',
    formatMemory(),
    '',
    '当前数据快照：',
    JSON.stringify(dashboardContext, null, 2),
  ].join('\n')
}

function getToolCalls(response: OpenAI.Responses.Response) {
  return response.output.filter((item): item is OpenAI.Responses.ResponseFunctionToolCall => item.type === 'function_call')
}

interface AgentTurnState {
  traceId: string
  turnStartedAt: string
  instructions: string
  observation: LangfuseAgent
  openai: OpenAI
  model: string
  sessionId: string
  startedAtMs: number
  inputHistory: Array<OpenAI.Responses.ResponseInputItem>
  nextStepIndex: number
}

function createInitialInputHistory(history: AgentMessage[], currentMessage?: string): Array<OpenAI.Responses.ResponseInputItem> {
  const items = history.map((item) => toResponseMessage(item.role, item.content))
  if (currentMessage) {
    items.push(toResponseMessage('user', currentMessage))
  }
  return items
}

function createResponseRequest(state: AgentTurnState) {
  return {
    model: state.model,
    store: false,
    instructions: state.instructions,
    input: state.inputHistory,
    tools: openAiToolDefinitions,
  } satisfies OpenAI.Responses.ResponseCreateParamsNonStreaming
}

function nextStep(state: AgentTurnState) {
  const stepIndex = state.nextStepIndex
  state.nextStepIndex += 1
  return {
    stepId: nanoid(),
    stepIndex,
  }
}

function responseUsage(response: OpenAI.Responses.Response) {
  return (response as unknown as { usage?: Record<string, unknown> }).usage ?? null
}

function responseStatus(response: OpenAI.Responses.Response) {
  const status = (response as unknown as { status?: string }).status
  const incomplete = (response as unknown as { incomplete_details?: Record<string, unknown> | null }).incomplete_details
  return {
    status: status ?? null,
    incomplete_details: incomplete ?? null,
  }
}

async function createAgentTurnState(sessionId: string, message: string, observation: LangfuseAgent): Promise<AgentTurnState> {
  const trimmedMessage = message.trim()
  if (!trimmedMessage) {
    throw new Error('message is required')
  }

  const model = getModel()
  const trace = createAgentTrace(sessionId, trimmedMessage, model)
  const history = listAgentMessages(sessionId, 20)
  const turnStartedAt = trace.started_at

  logAgentEvent(trace.id, sessionId, 'run_started', {
    input: trimmedMessage,
    model,
  }, {
    createdAt: turnStartedAt,
  })
  logAgentEvent(trace.id, sessionId, 'message', {
    role: 'user',
    content: trimmedMessage,
  }, {
    createdAt: turnStartedAt,
  })
  saveAgentMessage(sessionId, 'user', trimmedMessage, trace.id)

  const dashboardContext = await getDashboardContextForAgent()
  const promptConfig = getAgentSystemPromptConfig()
  const instructions = buildInstructions(dashboardContext, promptConfig.prompt)
  return {
    traceId: trace.id,
    turnStartedAt,
    instructions,
    observation,
    openai: getOpenAIClient(),
    model,
    sessionId,
    startedAtMs: Date.now(),
    inputHistory: createInitialInputHistory(history, trimmedMessage),
    nextStepIndex: 1,
  }
}

async function executeResponseRound(
  state: AgentTurnState,
  onTextDelta?: (delta: string) => void,
) {
  const request = createResponseRequest(state)
  const { stepId, stepIndex } = nextStep(state)
  const startedAt = Date.now()
  const llmObservation = state.observation.startObservation(`llm-round-${stepIndex}`, {
    input: request,
    model: request.model,
    metadata: {
      step_id: stepId,
      step_index: stepIndex,
      stream: Boolean(onTextDelta),
      trace_id: state.traceId,
    },
  }, { asType: 'generation' })

  logAgentEvent(state.traceId, state.sessionId, 'llm_request', {
    model: request.model,
    params: {
      store: request.store,
    },
    payload: request,
  }, {
    stepId,
    stepIndex,
  })

  try {
    if (!onTextDelta) {
      const response = await state.openai.responses.create(request)
      const latencyMs = Date.now() - startedAt
      const usage = responseUsage(response)
      const status = responseStatus(response)

      logAgentEvent(state.traceId, state.sessionId, 'llm_response', {
        content: response.output_text?.trim() || '',
        usage,
        latency_ms: latencyMs,
        ...status,
      }, {
        stepId,
        stepIndex,
      })
      llmObservation.update({
        output: response.output_text?.trim() || '',
        metadata: {
          step_id: stepId,
          step_index: stepIndex,
          latency_ms: latencyMs,
          usage,
          ...status,
        },
      })
      llmObservation.end()
      return response
    }

    const stream = state.openai.responses.stream(request)
    stream.on('response.output_text.delta', (event) => {
      if (event.delta) onTextDelta(event.delta)
    })
    const response = await stream.finalResponse()
    const latencyMs = Date.now() - startedAt
    const usage = responseUsage(response)
    const status = responseStatus(response)

    logAgentEvent(state.traceId, state.sessionId, 'llm_response', {
      content: response.output_text?.trim() || '',
      usage,
      latency_ms: latencyMs,
      ...status,
    }, {
      stepId,
      stepIndex,
    })
    llmObservation.update({
      output: response.output_text?.trim() || '',
      metadata: {
        step_id: stepId,
        step_index: stepIndex,
        latency_ms: latencyMs,
        usage,
        ...status,
      },
    })
    llmObservation.end()
    return response
  } catch (error) {
    llmObservation.update({
      level: 'ERROR',
      statusMessage: error instanceof Error ? error.message : 'llm round failed',
      metadata: {
        step_id: stepId,
        step_index: stepIndex,
        latency_ms: Date.now() - startedAt,
      },
      output: {
        error: error instanceof Error ? error.message : 'llm round failed',
      },
    })
    llmObservation.end()
    throw error
  }
}

async function runAgentTurnInternal(
  sessionId: string,
  message: string,
  observation: LangfuseAgent,
  onTextDelta?: (delta: string) => void,
  onStart?: (traceId: string) => void,
): Promise<AgentChatResponse> {
  let state: AgentTurnState | null = null
  let toolRounds = 0

  try {
    state = await createAgentTurnState(sessionId, message, observation)
    observation.update({
      metadata: {
        session_id: sessionId,
        trace_id: state.traceId,
        stream: Boolean(onTextDelta),
      },
    })
    onStart?.(state.traceId)
    let streamedReply = ''
    const handleTextDelta = onTextDelta
      ? (delta: string) => {
          streamedReply += delta
          onTextDelta(delta)
        }
      : undefined

    let response = await executeResponseRound(state, handleTextDelta)

    while (toolRounds < MAX_TOOL_ROUNDS) {
      const toolCalls = getToolCalls(response)
      if (toolCalls.length === 0) break

      state.inputHistory.push(...toolCalls)
      const toolOutputs: Array<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> = []
      for (const call of toolCalls) {
        const { stepId, stepIndex } = nextStep(state)
        let args: Record<string, unknown> = {}
        try {
          args = call.arguments ? JSON.parse(call.arguments) as Record<string, unknown> : {}
        } catch {
          args = {}
        }

        logAgentEvent(state.traceId, sessionId, 'tool_call', {
          tool_name: call.name,
          call_id: call.call_id,
          input: args,
        }, {
          stepId,
          stepIndex,
        })

        const toolRun = startAgentToolRun(state.traceId, sessionId, call.name, {
          call_id: call.call_id,
          ...args,
        })
        const toolStartedAt = Date.now()
        const toolObservation = state.observation.startObservation(call.name, {
          input: args,
          metadata: {
            call_id: call.call_id,
            step_id: stepId,
            step_index: stepIndex,
            trace_id: state.traceId,
          },
        }, { asType: 'tool' })

        try {
          const result = await executeAgentTool(call.name, args, { sessionId, traceId: state.traceId })
          const latencyMs = Date.now() - toolStartedAt
          finishAgentToolRun(toolRun.id, { status: 'done', result })
          logAgentEvent(state.traceId, sessionId, 'tool_result', {
            tool_name: call.name,
            call_id: call.call_id,
            output: result,
            latency_ms: latencyMs,
            success: true,
          }, {
            stepId,
            stepIndex,
          })
          toolObservation.update({
            output: result,
            metadata: {
              call_id: call.call_id,
              step_id: stepId,
              step_index: stepIndex,
              latency_ms: latencyMs,
              success: true,
            },
          })
          toolObservation.end()
          toolOutputs.push({
            type: 'function_call_output' as const,
            id: `fc_output_${call.call_id}`,
            call_id: call.call_id,
            output: JSON.stringify(result),
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'tool execution failed'
          const latencyMs = Date.now() - toolStartedAt
          finishAgentToolRun(toolRun.id, { status: 'error', error: errorMessage })
          logAgentEvent(state.traceId, sessionId, 'tool_result', {
            tool_name: call.name,
            call_id: call.call_id,
            output: null,
            latency_ms: latencyMs,
            success: false,
            error: errorMessage,
          }, {
            stepId,
            stepIndex,
          })
          toolObservation.update({
            level: 'ERROR',
            statusMessage: errorMessage,
            output: {
              error: errorMessage,
            },
            metadata: {
              call_id: call.call_id,
              step_id: stepId,
              step_index: stepIndex,
              latency_ms: latencyMs,
              success: false,
            },
          })
          toolObservation.end()
          toolOutputs.push({
            type: 'function_call_output' as const,
            id: `fc_output_${call.call_id}`,
            call_id: call.call_id,
            output: JSON.stringify({
              error: errorMessage,
            }),
          })
        }
      }

      state.inputHistory.push(...toolOutputs)
      response = await executeResponseRound(state, handleTextDelta)

      toolRounds += 1
    }

    const reply = streamedReply.trim() || response.output_text?.trim() || '已处理。'
    saveAgentMessage(sessionId, 'assistant', reply, state.traceId)
    logAgentEvent(state.traceId, sessionId, 'message', {
      role: 'assistant',
      content: reply,
    })
    logAgentEvent(state.traceId, sessionId, 'run_finished', {
      final_output: reply,
      total_latency_ms: Date.now() - state.startedAtMs,
      tool_rounds: toolRounds,
    })
    finishAgentTrace(state.traceId, { status: 'done', toolRounds })

    return {
      session_id: sessionId,
      trace_id: state.traceId,
      reply,
      actions: listAgentActionsSince(sessionId, state.turnStartedAt, state.traceId),
    }
  } catch (error) {
    if (state) {
      logAgentEvent(state.traceId, sessionId, 'run_failed', {
        error: error instanceof Error ? error.message : 'agent runtime failed',
        total_latency_ms: Date.now() - state.startedAtMs,
      })
      finishAgentTrace(state.traceId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'agent runtime failed',
        toolRounds,
      })
    }
    throw error
  }
}

export async function runAgentTurn(sessionId: string, message: string): Promise<AgentChatResponse> {
  return startActiveObservation('agent-turn', async (observation) => {
    observation.update({
      input: { session_id: sessionId, message },
      metadata: { session_id: sessionId },
    })

    try {
      const result = await runAgentTurnInternal(sessionId, message, observation)
      observation.update({
        output: {
          reply: result.reply,
          trace_id: result.trace_id,
          action_count: result.actions.length,
        },
      })
      return result
    } catch (error) {
      observation.update({
        level: 'ERROR',
        output: {
          error: error instanceof Error ? error.message : 'agent runtime failed',
        },
      })
      throw error
    }
  }, { asType: 'agent' })
}

export async function runAgentTurnStream(
  sessionId: string,
  message: string,
  onTextDelta: (delta: string) => void,
  onStart?: (traceId: string) => void,
): Promise<AgentChatResponse> {
  return startActiveObservation('agent-turn', async (observation) => {
    observation.update({
      input: { session_id: sessionId, message, mode: 'stream' },
      metadata: { session_id: sessionId, stream: true },
    })

    try {
      const result = await runAgentTurnInternal(sessionId, message, observation, onTextDelta, onStart)
      observation.update({
        output: {
          reply: result.reply,
          trace_id: result.trace_id,
          action_count: result.actions.length,
        },
      })
      return result
    } catch (error) {
      observation.update({
        level: 'ERROR',
        output: {
          error: error instanceof Error ? error.message : 'agent runtime failed',
        },
      })
      throw error
    }
  }, { asType: 'agent' })
}

export async function getAgentPromptPreview(sessionId?: string): Promise<AgentPromptPreview> {
  const promptConfig = getAgentSystemPromptConfig()
  const dashboardContext = await getDashboardContextForAgent()
  const history = sessionId ? listAgentMessages(sessionId, 20) : []
  const conversation = formatConversation(history)
  const inputHistory = createInitialInputHistory(history)
  const requestPayload = {
    model: getModel(),
    store: false,
    instructions: buildInstructions(dashboardContext, promptConfig.prompt),
    input: inputHistory,
    tools: openAiToolDefinitions,
  }

  return {
    system_prompt: promptConfig.prompt,
    effective_instructions: requestPayload.instructions,
    dashboard_context: dashboardContext,
    conversation,
    request_payload: requestPayload,
    tools: openAiToolDefinitions,
  }
}
