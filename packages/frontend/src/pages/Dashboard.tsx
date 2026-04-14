import {
  CheckCircle2, Circle, Clock, Plus,
  ArrowRight, type LucideIcon,
} from 'lucide-react'
import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { tasksApi, notesApi } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { TaskSubtask } from '@myweight/shared'

type Priority = 'high' | 'medium' | 'low'
type SendStatus = 'idle' | 'sending' | 'sent' | 'error'

interface CardProps { children: ReactNode; className?: string; darkMode: boolean }
function Card({ children, className = '', darkMode }: CardProps) {
  return (
    <div className={`rounded-xl p-5 ${darkMode ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-100 shadow-sm'} ${className}`}>
      {children}
    </div>
  )
}

interface SectionHeaderProps {
  title: string; icon: LucideIcon; color: string; action?: string; onAction?: () => void; darkMode: boolean
}
function SectionHeader({ title, icon: Icon, color, action, onAction, darkMode }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className={`w-6 h-6 ${color} rounded-md flex items-center justify-center`}>
          <Icon size={13} className="text-white" />
        </div>
        <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className={`flex items-center gap-1 text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

function Skeleton({ darkMode, className = '' }: { darkMode: boolean; className?: string }) {
  return <div className={`rounded animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} ${className}`} />
}

const priorityColor: Record<Priority, string> = {
  high: 'bg-red-100 text-red-600', medium: 'bg-amber-100 text-amber-600', low: 'bg-gray-100 text-gray-500',
}
const priorityLabel: Record<Priority, string> = { high: '高', medium: '中', low: '低' }

interface PageProps {
  darkMode: boolean
  onNavigate: (page: 'dashboard' | 'tasks' | 'calendar' | 'habits' | 'finance' | 'health' | 'notes') => void
}

export default function Dashboard({ darkMode, onNavigate }: PageProps) {
  const textH = darkMode ? 'text-white' : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const divider = darkMode ? 'divide-gray-800' : 'divide-gray-50'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'

  const today = new Date().toISOString().slice(0, 10)
  const quickNotebookId = useRef<string | null>(null)
  const [quickNote, setQuickNote] = useState('')
  const [quickNoteStatus, setQuickNoteStatus] = useState<SendStatus>('idle')
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [taskError, setTaskError] = useState<string | null>(null)
  const [creatingTask, setCreatingTask] = useState(false)
  const [creatingSubtaskFor, setCreatingSubtaskFor] = useState<string | null>(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [subtaskError, setSubtaskError] = useState<string | null>(null)

  const { data: tasks, loading: tasksLoading, refetch: refetchTasks } = useApi(() => tasksApi.list())
  const { data: subtasks, refetch: refetchSubtasks } = useApi(() => tasksApi.subtasks())

  const todayTasks = tasks?.filter(t => t.due_date === today || t.status === 'todo') ?? []
  const doneTasks = todayTasks.filter(t => t.status === 'done').length
  const subtasksByTask = (subtasks ?? []).reduce<Record<string, TaskSubtask[]>>((acc, subtask) => {
    if (!acc[subtask.task_id]) acc[subtask.task_id] = []
    acc[subtask.task_id].push(subtask)
    return acc
  }, {})

  const toggleTask = async (id: string, done: boolean) => {
    await tasksApi.update(id, { status: done ? 'todo' : 'done' })
    refetchTasks()
  }

  const createTodayTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return

    try {
      setCreatingTask(true)
      setTaskError(null)
      await tasksApi.create({
        title,
        priority: 'medium',
        due_date: today,
        due_time: null,
        tags: [],
      })
      setNewTaskTitle('')
      setIsCreatingTask(false)
      refetchTasks()
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : '添加今日任务失败')
    } finally {
      setCreatingTask(false)
    }
  }

  const createSubtask = async (event: FormEvent<HTMLFormElement>, taskId: string) => {
    event.preventDefault()
    const title = newSubtaskTitle.trim()
    if (!title) return

    try {
      setSubtaskError(null)
      await tasksApi.createSubtask(taskId, { title })
      setNewSubtaskTitle('')
      setCreatingSubtaskFor(null)
      refetchSubtasks()
    } catch (error) {
      setSubtaskError(error instanceof Error ? error.message : '添加子任务失败')
    }
  }

  const toggleSubtask = async (subtask: TaskSubtask) => {
    await tasksApi.updateSubtask(subtask.id, { done: !subtask.done })
    refetchSubtasks()
  }

  const ensureQuickNotebook = async () => {
    if (quickNotebookId.current) return quickNotebookId.current

    const data = await notesApi.notebooks()
    const existing = data.notebooks.find(notebook => notebook.name === '快速笔记')
    if (existing) {
      quickNotebookId.current = existing.id
      return existing.id
    }

    const notebook = await notesApi.createNotebook('快速笔记', 'bg-sky-500')
    quickNotebookId.current = notebook.id
    return notebook.id
  }

  const sendQuickNote = async () => {
    const content = quickNote.trim()
    if (!content) return

    setQuickNoteStatus('sending')
    const notebookId = await ensureQuickNotebook()
    const firstLine = content.split('\n').find(line => line.trim())?.trim()
    const title = firstLine ? firstLine.slice(0, 30) : `快速笔记 ${today}`

    await notesApi.create({
      notebook_id: notebookId,
      title,
      content,
    })
    setQuickNote('')
    setQuickNoteStatus('sent')
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto">

      {/* Main grid */}
      <div className="grid grid-cols-2 gap-4">

        {/* Tasks */}
        <Card darkMode={darkMode}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-indigo-500 rounded-md flex items-center justify-center">
                <CheckCircle2 size={13} className="text-white" />
              </div>
              <h2 className={`text-sm font-semibold ${darkMode ? 'text-white' : 'text-gray-800'}`}>今日任务</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setIsCreatingTask(true); setTaskError(null) }}
                className="flex items-center gap-1 text-xs text-indigo-500 transition-colors hover:text-indigo-600"
              >
                <Plus size={12} />添加
              </button>
              <button onClick={() => onNavigate('tasks')} className={`flex items-center gap-1 text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}>
                查看全部 <ArrowRight size={11} />
              </button>
            </div>
          </div>
          {isCreatingTask && (
            <form onSubmit={createTodayTask} className={`mb-3 flex flex-col gap-2 rounded-lg border p-3 ${darkMode ? 'border-gray-800 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
              <input
                autoFocus
                value={newTaskTitle}
                onChange={event => setNewTaskTitle(event.target.value)}
                placeholder="输入今日任务"
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputBg}`}
              />
              {taskError && <div className="text-xs text-red-500">{taskError}</div>}
              <div className="flex gap-2">
                <button type="submit" disabled={creatingTask || !newTaskTitle.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">
                  {creatingTask ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => setIsCreatingTask(false)} className={`rounded-lg border px-3 py-1.5 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  取消
                </button>
              </div>
            </form>
          )}
          {tasksLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} darkMode={darkMode} className="h-10" />)}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className={`text-center py-8 text-sm ${subText}`}>今天没有任务 🎉</div>
          ) : (
            <div className={`space-y-0 divide-y ${divider}`}>
              {todayTasks.slice(0, 4).map(task => (
                <div key={task.id} className="py-2.5">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleTask(task.id, task.status === 'done')} className="mt-0.5 flex-shrink-0">
                      {task.status === 'done'
                        ? <CheckCircle2 size={16} className="text-indigo-500" />
                        : <Circle size={16} className={subText} />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${task.status === 'done' ? `line-through ${subText}` : textH}`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.due_time && (
                          <>
                            <Clock size={11} className={subText} />
                            <span className={`text-xs ${subText}`}>{task.due_time}</span>
                          </>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          task.status === 'done'
                            ? 'bg-gray-100 text-gray-400'
                            : darkMode ? 'bg-gray-800 text-gray-400' : priorityColor[task.priority as Priority]
                        }`}>
                          {priorityLabel[task.priority as Priority]}
                        </span>
                        <button
                          onClick={() => { setCreatingSubtaskFor(task.id); setSubtaskError(null); setNewSubtaskTitle('') }}
                          className="text-xs text-indigo-500 hover:text-indigo-600"
                        >
                          添加子任务
                        </button>
                      </div>
                      {(subtasksByTask[task.id] ?? []).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {(subtasksByTask[task.id] ?? []).map(subtask => (
                            <button
                              key={subtask.id}
                              onClick={() => toggleSubtask(subtask)}
                              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs ${darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}
                            >
                              {subtask.done
                                ? <CheckCircle2 size={13} className="text-indigo-500" />
                                : <Circle size={13} className={subText} />
                              }
                              <span className={subtask.done ? `line-through ${subText}` : textH}>{subtask.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {creatingSubtaskFor === task.id && (
                        <form onSubmit={(event) => createSubtask(event, task.id)} className="mt-2 space-y-2">
                          <input
                            autoFocus
                            value={newSubtaskTitle}
                            onChange={event => setNewSubtaskTitle(event.target.value)}
                            placeholder="输入子任务"
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${inputBg}`}
                          />
                          {subtaskError && <div className="text-xs text-red-500">{subtaskError}</div>}
                          <div className="flex gap-2">
                            <button type="submit" disabled={!newSubtaskTitle.trim()} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white disabled:opacity-50">保存</button>
                            <button type="button" onClick={() => setCreatingSubtaskFor(null)} className={`rounded-lg border px-2 py-1 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>取消</button>
                          </div>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!tasksLoading && todayTasks.length > 0 && (
            <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs ${subText}`}>今日进度</span>
                <span className={`text-xs font-medium ${textH}`}>{doneTasks}/{todayTasks.length}</span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                <div className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${(doneTasks / todayTasks.length) * 100}%` }} />
              </div>
            </div>
          )}
        </Card>

        <Card darkMode={darkMode}>
          <SectionHeader title="快速笔记" icon={CheckCircle2} color="bg-sky-500" action="所有笔记" onAction={() => onNavigate('notes')} darkMode={darkMode} />
          <textarea
            value={quickNote}
            onChange={event => {
              setQuickNote(event.target.value)
              if (quickNoteStatus !== 'idle') setQuickNoteStatus('idle')
            }}
            placeholder="写点什么..."
            className={`h-44 w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none ${inputBg}`}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className={`text-xs ${quickNoteStatus === 'error' ? 'text-red-500' : subText}`}>
              {quickNoteStatus === 'sending' && '发送中...'}
              {quickNoteStatus === 'error' && '发送失败'}
            </div>
            <button
              onClick={() => { sendQuickNote().catch(() => setQuickNoteStatus('error')) }}
              disabled={!quickNote.trim() || quickNoteStatus === 'sending'}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}
