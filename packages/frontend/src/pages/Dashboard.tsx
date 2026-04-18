import {
  CheckCircle2, Circle, Clock, Plus, Flag,
  ArrowRight, X, type LucideIcon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { goalsApi, tasksApi, notesApi } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { Goal, TaskSubtask } from '@mylife/shared'
import AgentPanel from '../components/AgentPanel'

type SendStatus = 'idle' | 'sending' | 'sent' | 'error'

interface CardProps { children: ReactNode; className?: string; darkMode: boolean }
function Card({ children, className = '', darkMode }: CardProps) {
  return (
    <div className={`rounded-[5px] p-5 ${darkMode ? 'bg-[#2a2424] border border-[#4a4440]' : 'bg-[#fffefb] border border-[#c5c0b1]'} ${className}`}>
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
        <div className={`w-6 h-6 ${color} rounded-[4px] flex items-center justify-center`}>
          <Icon size={13} className="text-[#fffefb]" />
        </div>
        <h2 className={`text-sm font-semibold ${darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'}`}>{title}</h2>
      </div>
      {action && (
        <button onClick={onAction} className={`flex items-center gap-1 text-xs transition-colors ${darkMode ? 'text-[#7a756c] hover:text-[#c5c0b1]' : 'text-[#939084] hover:text-[#36342e]'}`}>
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  )
}

function Skeleton({ darkMode, className = '' }: { darkMode: boolean; className?: string }) {
  return <div className={`rounded-[4px] animate-pulse ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'} ${className}`} />
}

const priorityDot: Record<string, string> = {
  high: 'bg-[#ff4f00]', low: 'bg-[#939084]',
}

interface PageProps {
  darkMode: boolean
  onNavigate: (page: 'dashboard' | 'goals' | 'tasks' | 'calendar' | 'habits' | 'finance' | 'health' | 'notes' | 'agent') => void
}

export default function Dashboard({ darkMode, onNavigate }: PageProps) {
  const textH = darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'
  const subText = darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
  const inputBg = darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#c5c0b1] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'

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
  const { data: goals, loading: goalsLoading, refetch: refetchGoals } = useApi(() => goalsApi.list())

  const todayTasks = (tasks?.filter(t => t.due_date === today) ?? [])
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1
      if (a.status !== 'done' && b.status === 'done') return -1
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (a.priority !== 'high' && b.priority === 'high') return 1
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time)
      return 0
    })
  const subtasksByTask = (subtasks ?? []).reduce<Record<string, TaskSubtask[]>>((acc, subtask) => {
    if (!acc[subtask.task_id]) acc[subtask.task_id] = []
    acc[subtask.task_id].push(subtask)
    return acc
  }, {})
  const progress = todayTasks.reduce(
    (acc, task) => {
      const taskSubtasks = subtasksByTask[task.id] ?? []

      if (taskSubtasks.length > 0) {
        acc.total += taskSubtasks.length
        acc.done += task.status === 'done'
          ? taskSubtasks.length
          : taskSubtasks.filter(subtask => subtask.done).length
        return acc
      }

      acc.total += 1
      if (task.status === 'done') acc.done += 1
      return acc
    },
    { done: 0, total: 0 }
  )
  const activeGoals = (goals ?? []).filter(goal => goal.status !== 'done')
  const longGoals = activeGoals
    .filter(goal => goal.goal_type === 'long')
    .sort((a, b) => (a.target_date ?? '9999-12-31').localeCompare(b.target_date ?? '9999-12-31'))
  const shortGoals = activeGoals
    .filter(goal => goal.goal_type === 'short')
    .sort((a, b) => (a.target_date ?? '9999-12-31').localeCompare(b.target_date ?? '9999-12-31'))

  const toggleTask = async (id: string, done: boolean) => {
    await tasksApi.update(id, { status: done ? 'todo' : 'done' })
    refetchTasks()
  }

  const togglePriority = async (id: string, current: string) => {
    const next = current === 'high' ? 'low' : 'high'
    await tasksApi.update(id, { priority: next })
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
        priority: 'low',
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

  const toggleSubtaskPriority = async (subtask: TaskSubtask) => {
    await tasksApi.updateSubtask(subtask.id, { priority: subtask.priority === 'high' ? 'low' : 'high' })
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

    const notebook = await notesApi.createNotebook('快速笔记', 'bg-[#ff4f00]')
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

  const toggleGoal = async (goal: Goal) => {
    await goalsApi.update(goal.id, { status: goal.status === 'done' ? 'active' : 'done' })
    refetchGoals()
  }

  const handleAgentActionComplete = () => {
    refetchTasks()
    refetchSubtasks()
    refetchGoals()
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 xl:h-[calc(100vh-8.5rem)] xl:overflow-hidden">
      <div className="grid gap-4 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(380px,460px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(420px,500px)_minmax(0,1fr)]">
        <div className="space-y-4 xl:grid xl:h-full xl:min-h-0 xl:grid-rows-[minmax(0,0.9fr)_minmax(0,1.05fr)_minmax(0,1fr)] xl:space-y-0">
          <Card darkMode={darkMode} className="xl:flex xl:min-h-0 xl:flex-col">
            <SectionHeader title="目标" icon={Flag} color="bg-emerald-600" action="所有目标" onAction={() => onNavigate('goals')} darkMode={darkMode} />
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              {goalsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} darkMode={darkMode} className="h-12" />)}
                </div>
              ) : activeGoals.length === 0 ? (
                <div className={`py-8 text-center text-sm ${subText}`}>还没有进行中的目标</div>
              ) : (
                <div className="space-y-4">
                  {([
                    ['长期目标', longGoals],
                    ['短期目标', shortGoals],
                  ] as [string, Goal[]][]).map(([label, items]) => (
                    <div key={label}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className={`text-xs font-medium ${textH}`}>{label}</h3>
                        <span className={`text-xs ${subText}`}>{items.length} 项</span>
                      </div>
                      {items.length === 0 ? (
                        <div className={`rounded-[5px] px-2 py-4 text-center text-xs ${darkMode ? 'bg-[#1e1a1a] text-[#7a756c]' : 'bg-[#eceae3] text-[#939084]'}`}>暂无{label}</div>
                      ) : (
                        <div className="space-y-1.5">
                          {items.slice(0, 3).map(goal => (
                            <button
                              key={goal.id}
                              onClick={() => toggleGoal(goal)}
                              className={`flex w-full items-start gap-3 rounded-[5px] px-2 py-2 text-left transition-colors ${darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'}`}
                            >
                              <span className="mt-0.5 flex-shrink-0">
                                {goal.status === 'done'
                                  ? <CheckCircle2 size={16} className="text-emerald-600" />
                                  : <Circle size={16} className={subText} />
                                }
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block truncate text-sm ${textH}`}>{goal.title}</span>
                                <span className={`mt-0.5 block truncate text-xs ${subText}`}>
                                  {goal.target_date ? `截止 ${goal.target_date}` : '未设置目标日期'}
                                </span>
                              </span>
                            </button>
                          ))}
                          {items.length > 3 && (
                            <button
                              onClick={() => onNavigate('goals')}
                              className={`px-2 text-xs transition-colors ${darkMode ? 'text-[#7a756c] hover:text-[#c5c0b1]' : 'text-[#939084] hover:text-[#36342e]'}`}
                            >
                              还有 {items.length - 3} 项，查看全部
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card darkMode={darkMode} className="xl:flex xl:min-h-0 xl:flex-col">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-[#ff4f00] rounded-[4px] flex items-center justify-center">
                  <CheckCircle2 size={13} className="text-[#fffefb]" />
                </div>
                <h2 className={`text-sm font-semibold ${darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'}`}>今日任务</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setIsCreatingTask(true); setTaskError(null) }}
                  className="flex items-center gap-1 text-xs text-[#ff4f00] transition-colors hover:text-[#e64700]"
                >
                  <Plus size={12} />添加
                </button>
                <button onClick={() => onNavigate('tasks')} className={`flex items-center gap-1 text-xs transition-colors ${darkMode ? 'text-[#7a756c] hover:text-[#c5c0b1]' : 'text-[#939084] hover:text-[#36342e]'}`}>
                  查看全部 <ArrowRight size={11} />
                </button>
              </div>
            </div>
            <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1">
              {isCreatingTask && (
                <form onSubmit={createTodayTask} className={`mb-3 flex flex-col gap-2 rounded-[5px] border p-3 ${darkMode ? 'border-[#4a4440] bg-[#1e1a1a]' : 'border-[#c5c0b1] bg-[#eceae3]'}`}>
                  <input
                    autoFocus
                    value={newTaskTitle}
                    onChange={event => setNewTaskTitle(event.target.value)}
                    placeholder="输入今日任务"
                    className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
                  />
                  {taskError && <div className="text-xs text-red-500">{taskError}</div>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={creatingTask || !newTaskTitle.trim()} className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold disabled:opacity-50">
                      {creatingTask ? '保存中...' : '保存'}
                    </button>
                    <button type="button" onClick={() => setIsCreatingTask(false)} className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>
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
                <div className={`text-center py-8 text-sm ${subText}`}>今天没有到期任务</div>
              ) : (
                <div className="space-y-0">
                  <AnimatePresence initial={false}>
                  {todayTasks.slice(0, 4).map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="py-2.5"
                    >
                      <div className="group flex items-start gap-3">
                        <button onClick={() => toggleTask(task.id, task.status === 'done')} className="mt-0.5 flex-shrink-0 cursor-pointer">
                          {task.status === 'done'
                            ? <CheckCircle2 size={16} className="text-[#ff4f00]" />
                            : <Circle size={16} className={subText} />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm leading-snug ${task.status === 'done' ? `line-through ${subText}` : textH}`}>
                              {task.title}
                            </p>
                            {task.status !== 'done' && (
                              <button
                                onClick={() => togglePriority(task.id, task.priority)}
                                title={task.priority === 'high' ? '高优先级，点击切换' : '低优先级，点击切换'}
                                className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 transition-colors ${priorityDot[task.priority] ?? 'bg-[#c5c0b1]'}`}
                              />
                            )}
                            <button
                              onClick={() => { setCreatingSubtaskFor(task.id); setSubtaskError(null); setNewSubtaskTitle('') }}
                              className="text-[#ff4f00] hover:text-[#e64700] opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              onClick={async () => { await tasksApi.remove(task.id); refetchTasks() }}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-[#7a756c] hover:text-red-400' : 'text-[#c5c0b1] hover:text-red-500'}`}
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {task.due_time && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock size={11} className={subText} />
                              <span className={`text-xs ${subText}`}>{task.due_time}</span>
                            </div>
                          )}
                          {(subtasksByTask[task.id] ?? []).length > 0 && (
                            <div className="mt-2 space-y-1">
                              <AnimatePresence initial={false}>
                              {[...(subtasksByTask[task.id] ?? [])].sort((a, b) => {
                                if (!a.done && b.done) return -1
                                if (a.done && !b.done) return 1
                                if (a.priority === 'high' && b.priority !== 'high') return -1
                                if (a.priority !== 'high' && b.priority === 'high') return 1
                                return 0
                              }).map(subtask => (
                                <motion.div
                                  key={subtask.id}
                                  layout
                                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                                  className={`group flex w-full items-center gap-2 rounded-[5px] px-2 py-1 text-xs ${darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'}`}
                                >
                                  <button
                                    onClick={() => toggleSubtask(subtask)}
                                    className="flex-shrink-0"
                                  >
                                    {subtask.done
                                      ? <CheckCircle2 size={13} className="text-[#ff4f00]" />
                                      : <Circle size={13} className={subText} />
                                    }
                                  </button>
                                  <div className="flex flex-1 items-center gap-1.5">
                                    <span className={subtask.done ? `line-through ${subText} text-xs` : `${textH} text-xs`}>{subtask.title}</span>
                                    {!subtask.done && (
                                      <button
                                        onClick={() => toggleSubtaskPriority(subtask)}
                                        className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${priorityDot[subtask.priority] ?? 'bg-[#c5c0b1]'}`}
                                      />
                                    )}
                                    <button
                                      onClick={async () => { await tasksApi.removeSubtask(subtask.id); refetchSubtasks() }}
                                      className={`opacity-0 group-hover:opacity-100 transition-opacity ${darkMode ? 'text-[#7a756c] hover:text-red-400' : 'text-[#c5c0b1] hover:text-red-500'}`}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                              </AnimatePresence>
                            </div>
                          )}
                          {creatingSubtaskFor === task.id && (
                            <form onSubmit={(event) => createSubtask(event, task.id)} className="mt-2 space-y-2">
                              <input
                                autoFocus
                                value={newSubtaskTitle}
                                onChange={event => setNewSubtaskTitle(event.target.value)}
                                placeholder="输入子任务"
                                className={`w-full rounded-[5px] border px-2 py-1.5 text-xs outline-none focus:border-[#ff4f00] ${inputBg}`}
                              />
                              {subtaskError && <div className="text-xs text-red-500">{subtaskError}</div>}
                              <div className="flex gap-2">
                                <button type="submit" disabled={!newSubtaskTitle.trim()} className="rounded-[4px] bg-[#ff4f00] px-2 py-1 text-xs text-[#fffefb] font-semibold disabled:opacity-50">保存</button>
                                <button type="button" onClick={() => setCreatingSubtaskFor(null)} className={`rounded-[4px] border px-2 py-1 text-xs ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
                              </div>
                            </form>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>
                </div>
              )}
              {!tasksLoading && todayTasks.length > 0 && (
                <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs ${subText}`}>今日进度</span>
                    <span className={`text-xs font-medium ${textH}`}>{progress.done}/{progress.total}</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`}>
                    <div className="h-full bg-[#ff4f00] rounded-full transition-all"
                      style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card darkMode={darkMode} className="xl:flex xl:min-h-0 xl:flex-col">
            <SectionHeader title="快速笔记" icon={CheckCircle2} color="bg-[#939084]" action="所有笔记" onAction={() => onNavigate('notes')} darkMode={darkMode} />
            <textarea
              value={quickNote}
              onChange={event => {
                setQuickNote(event.target.value)
                if (quickNoteStatus !== 'idle') setQuickNoteStatus('idle')
              }}
              placeholder="写点什么..."
              className={`h-44 w-full resize-none rounded-[5px] border px-3 py-2 text-sm leading-relaxed outline-none focus:border-[#ff4f00] xl:h-auto xl:min-h-0 xl:flex-1 ${inputBg}`}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className={`text-xs ${quickNoteStatus === 'error' ? 'text-red-500' : subText}`}>
                {quickNoteStatus === 'sending' && '发送中...'}
                {quickNoteStatus === 'error' && '发送失败'}
              </div>
              <button
                onClick={() => { sendQuickNote().catch(() => setQuickNoteStatus('error')) }}
                disabled={!quickNote.trim() || quickNoteStatus === 'sending'}
                className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold transition-colors hover:bg-[#e64700] disabled:cursor-not-allowed disabled:opacity-50"
              >
                发送
              </button>
            </div>
          </Card>
        </div>

        <AgentPanel
          darkMode={darkMode}
          fillHeight
          onOpenFullPage={() => onNavigate('agent')}
          onActionComplete={handleAgentActionComplete}
        />
      </div>
    </div>
  )
}
