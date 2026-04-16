import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Sparkles, ArrowRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentMessage, AgentStreamChunk } from '@mylife/shared'
import { agentApi } from '../lib/api'

const STORAGE_KEY = 'mylife-agent-session'

interface AgentPanelProps {
  darkMode: boolean
  compact?: boolean
  fillHeight?: boolean
  onOpenFullPage?: () => void
  onActionComplete?: () => void
  onTraceComplete?: (sessionId: string, traceId: string) => void
}

const QUICK_PROMPTS = [
  '帮我总结今天安排',
  '看看今天有哪些风险点',
  '把今天待办整理成优先级',
]

function MarkdownMessage({ content, darkMode }: { content: string; darkMode: boolean }) {
  return (
    <div className={`prose prose-sm max-w-none ${darkMode ? 'prose-invert' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-0 whitespace-pre-wrap leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-emerald-500 underline underline-offset-2">
              {children}
            </a>
          ),
          code: (props) => {
            const { children } = props
            return (props as { inline?: boolean }).inline
              ? <code className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${darkMode ? 'bg-gray-900 text-emerald-200' : 'bg-white/70 text-emerald-700'}`}>{children}</code>
              : <code className="font-mono text-[0.9em]">{children}</code>
          },
          pre: ({ children }) => (
            <pre className={`my-3 overflow-x-auto rounded-xl border p-3 ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white/80'}`}>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className={`my-3 border-l-2 pl-3 italic ${darkMode ? 'border-gray-600 text-gray-300' : 'border-gray-300 text-gray-600'}`}>
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default function AgentPanel({ darkMode, compact = false, fillHeight = false, onOpenFullPage, onActionComplete, onTraceComplete }: AgentPanelProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const textH = darkMode ? 'text-white' : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
  const assistantBubble = darkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
  const userBubble = compact ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'
  const visibleMessages = compact && fillHeight ? messages.slice(-2) : compact ? messages.slice(-4) : messages
  const messageAreaClass = fillHeight
    ? 'flex-1 min-h-0'
    : compact
    ? 'h-72'
    : 'h-[calc(100vh-16rem)] min-h-[28rem]'

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) setSessionId(stored)
  }, [])

  useEffect(() => {
    if (!sessionId) return

    agentApi.messages(sessionId)
      .then(setMessages)
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : '加载对话失败')
      })
  }, [sessionId])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [visibleMessages, sending])

  const sendMessage = async (messageText: string) => {
    const message = messageText.trim()
    if (!message) return

    const createdAt = new Date().toISOString()
    const userMessageId = `local-user-${Date.now()}`
    const assistantMessageId = `local-assistant-${Date.now()}`

    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        session_id: sessionId ?? 'pending',
        trace_id: null,
        role: 'user',
        content: message,
        created_at: createdAt,
      },
      {
        id: assistantMessageId,
        session_id: sessionId ?? 'pending',
        trace_id: null,
        role: 'assistant',
        content: '',
        created_at: createdAt,
      },
    ])

    try {
      setSending(true)
      setError(null)
      setDraft('')

      let resolvedSessionId = sessionId
      let finalChunk: Extract<AgentStreamChunk, { type: 'done' }> | null = null
      let streamedReply = ''

      for await (const chunk of agentApi.stream({
        session_id: sessionId ?? undefined,
        message,
      })) {
        if (chunk.type === 'session') {
          resolvedSessionId = chunk.session_id
          if (!sessionId) {
            setSessionId(chunk.session_id)
            window.localStorage.setItem(STORAGE_KEY, chunk.session_id)
          }
          continue
        }

        if (chunk.type === 'delta') {
          streamedReply += chunk.delta
          setMessages((current) => current.map((item) => (
            item.id === assistantMessageId
              ? { ...item, session_id: resolvedSessionId ?? item.session_id, content: streamedReply }
              : item.id === userMessageId && resolvedSessionId
              ? { ...item, session_id: resolvedSessionId }
              : item
          )))
          continue
        }

        if (chunk.type === 'done') {
          finalChunk = chunk
          setMessages((current) => current.map((item) => (
            item.id === assistantMessageId
              ? { ...item, session_id: chunk.session_id, content: chunk.reply }
              : item.id === userMessageId
              ? { ...item, session_id: chunk.session_id }
              : item
          )))
          continue
        }

        if (chunk.type === 'error') {
          throw new Error(chunk.error)
        }
      }

      if (finalChunk) {
        const nextMessages = await agentApi.messages(finalChunk.session_id)
        setMessages(nextMessages)
        onActionComplete?.()
        onTraceComplete?.(finalChunk.session_id, finalChunk.trace_id)
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : '发送失败')
      if (sessionId) {
        agentApi.messages(sessionId).then(setMessages).catch(() => undefined)
      }
    } finally {
      setSending(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await sendMessage(draft)
  }

  return (
    <div className={`rounded-xl border ${cardBg} ${fillHeight ? 'xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden' : ''}`}>
      <div className={`flex items-center justify-between border-b ${compact && fillHeight ? 'px-4 py-3' : 'px-5 py-4'} ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
            <Sparkles size={16} />
          </div>
          <div>
            <h2 className={`font-semibold ${textH} ${compact && fillHeight ? 'text-[13px]' : 'text-sm'}`}>{compact ? '今日助理' : 'Agent'}</h2>
            <p className={`text-xs ${subText}`}>
              {compact
                ? fillHeight
                  ? '先看当前这轮建议，需要更多历史再展开完整对话'
                  : '直接总结今天安排、整理待办，或替你执行结构化写入'
                : '可读取全量数据，当前支持任务 / 目标 / 习惯 / 事件 / 财务 / 健康 / 笔记查询与部分写入'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {sessionId && !fillHeight && <span className={`text-xs ${subText}`}>会话 {sessionId.slice(0, 8)}</span>}
          {compact && onOpenFullPage && (
            <button
              onClick={onOpenFullPage}
              className={`flex items-center gap-1 text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
            >
              完整视图 <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>

      <div className={`${fillHeight ? 'xl:flex xl:flex-1 xl:min-h-0 xl:flex-col' : ''}`}>
        <section className={`min-w-0 ${fillHeight ? 'xl:flex xl:flex-1 xl:min-h-0 xl:flex-col' : ''}`}>
          {compact && !fillHeight && visibleMessages.length === 0 && (
            <div className={`flex flex-wrap gap-2 ${fillHeight ? 'px-4 pt-3' : 'px-5 pt-4'}`}>
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => { sendMessage(prompt).catch(() => undefined) }}
                  disabled={sending}
                  className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${darkMode ? 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600' : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'}`}
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {compact && fillHeight && messages.length > visibleMessages.length && (
            <div className={`px-4 pt-3 text-xs ${subText}`}>
              已折叠更早的 {messages.length - visibleMessages.length} 条历史，只保留当前轮对话。
            </div>
          )}

          <div ref={scrollRef} className={`${messageAreaClass} ${compact && fillHeight ? 'space-y-2 px-4 py-3' : 'space-y-3 px-5 py-4'} overflow-y-auto`}>
            {visibleMessages.length === 0 ? (
              <div className={`py-12 text-center text-sm ${subText}`}>
                <div className="mb-3 text-4xl">🤖</div>
                {compact
                  ? '试试让它总结今天安排、指出风险点，或者直接帮你建任务。'
                  : '试试：帮我总结今天安排；把这段想法整理成笔记；创建一个明天下午的事件。'}
              </div>
            ) : visibleMessages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-3xl rounded-2xl ${compact && fillHeight ? 'px-3.5 py-2.5' : 'px-4 py-3'} text-sm leading-relaxed ${
                  message.role === 'user' ? userBubble : assistantBubble
                }`}>
                  {message.role === 'assistant'
                    ? (
                      message.content
                        ? <MarkdownMessage content={message.content} darkMode={darkMode} />
                        : <span className={subText}>思考中…</span>
                    )
                    : <div className="whitespace-pre-wrap">{message.content}</div>}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className={`border-t ${compact && fillHeight ? 'px-4 py-3' : 'px-5 py-4'} ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="relative">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={compact ? '让今日助理整理安排、补任务或创建事件…' : '给 Agent 下达指令，比如：帮我创建一个明天 14:00 的事件，并整理今天的待办。'}
                className={`${compact ? (fillHeight ? 'h-20' : 'h-24') : 'h-28'} w-full resize-none rounded-xl border px-3 py-3 pr-28 text-sm outline-none ${inputBg}`}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="absolute bottom-3 right-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? '生成中...' : '发送'}
              </button>
            </div>
            {error && <div className="mt-2 text-xs text-red-500">{error}</div>}
          </form>
        </section>
      </div>
    </div>
  )
}
