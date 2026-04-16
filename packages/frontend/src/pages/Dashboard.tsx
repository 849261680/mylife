import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Flag, ListTodo } from 'lucide-react'
import AgentPanel from '../components/AgentPanel'
import { goalsApi, tasksApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface PageProps {
  darkMode: boolean
  onNavigate: (page: 'dashboard' | 'goals' | 'tasks' | 'calendar' | 'habits' | 'finance' | 'health' | 'notes' | 'agent') => void
}

function Card({
  darkMode,
  children,
  className = '',
}: {
  darkMode: boolean
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-3xl border p-5 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white shadow-sm'} ${className}`}>
      {children}
    </div>
  )
}

function formatDateLabel(date: string | null) {
  if (!date) return '未设置日期'

  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return date
  return `${month}-${day}`
}

export default function Dashboard({ darkMode, onNavigate }: PageProps) {
  const textH = darkMode ? 'text-white' : 'text-gray-900'
  const subText = darkMode ? 'text-gray-400' : 'text-gray-500'
  const text = darkMode ? 'text-gray-300' : 'text-gray-600'
  const today = new Date().toISOString().slice(0, 10)
  const leftColumnRef = useRef<HTMLDivElement | null>(null)
  const [rightHeight, setRightHeight] = useState<number | null>(null)

  const { data: goals, loading: goalsLoading } = useApi(() => goalsApi.list())
  const { data: tasks, loading: tasksLoading } = useApi(() => tasksApi.list())

  const activeGoals = (goals ?? [])
    .filter(goal => goal.status !== 'done')
    .sort((a, b) => {
      if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date)
      if (a.target_date) return -1
      if (b.target_date) return 1
      return a.created_at.localeCompare(b.created_at)
    })
  const activeTasks = (tasks ?? [])
    .filter(task => task.status !== 'done' && task.status !== 'cancelled')
    .sort((a, b) => {
      const aDueToday = a.due_date === today
      const bDueToday = b.due_date === today
      if (aDueToday && !bDueToday) return -1
      if (!aDueToday && bDueToday) return 1
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (a.priority !== 'high' && b.priority === 'high') return 1
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      if (a.due_time && b.due_time) return a.due_time.localeCompare(b.due_time)
      if (a.due_time) return -1
      if (b.due_time) return 1
      return a.created_at.localeCompare(b.created_at)
    })
  const primaryGoal = activeGoals[0]
  const remainingGoalsCount = Math.max(activeGoals.length - 1, 0)
  const featuredTasks = activeTasks.slice(0, 3)

  useEffect(() => {
    const element = leftColumnRef.current
    if (!element || typeof ResizeObserver === 'undefined') return

    const syncHeight = () => {
      setRightHeight(element.getBoundingClientRect().height)
    }

    syncHeight()

    const observer = new ResizeObserver(() => syncHeight())
    observer.observe(element)
    window.addEventListener('resize', syncHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncHeight)
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="grid min-h-[calc(100vh-11.5rem)] items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div ref={leftColumnRef} className="space-y-5">
          <Card darkMode={darkMode} className={darkMode ? 'p-5 shadow-none' : 'p-5 shadow-[0_20px_50px_-36px_rgba(99,102,241,0.25)]'}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${darkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                  <Flag size={18} />
                </div>
                <div>
                  <div className={`text-xs font-medium uppercase tracking-[0.18em] ${subText}`}>主目标</div>
                  <h2 className={`mt-1 text-base font-semibold ${textH}`}>目标</h2>
                  <p className={`mt-1 text-sm ${text}`}>先只突出你现在最该推进的 1 个目标，其他目标退成次级入口。</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('goals')}
                className={`inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-sm transition-colors ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                查看目标 <ArrowRight size={14} />
              </button>
            </div>

            {goalsLoading ? (
              <div className={`text-sm ${subText}`}>读取中...</div>
            ) : !primaryGoal ? (
              <div className={`rounded-[24px] border px-4 py-6 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-100 bg-gray-50/80'}`}>
                <div className={`text-base font-medium ${textH}`}>还没有当前主目标</div>
                <p className={`mt-2 text-sm leading-6 ${text}`}>
                  去目标页设置一个正在推进的目标后，这里会直接突出它的阶段、截止时间和当前状态。
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-[24px] border px-4 py-4 ${darkMode ? 'border-emerald-900/50 bg-gradient-to-br from-emerald-950/40 to-gray-950' : 'border-emerald-100 bg-gradient-to-br from-emerald-50 to-white'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className={`text-xs font-medium uppercase tracking-[0.16em] ${subText}`}>当前主目标</div>
                      <div className={`mt-2 text-lg font-semibold ${textH}`}>{primaryGoal.title}</div>
                      {primaryGoal.description && (
                        <p className={`mt-2 max-w-xl text-sm leading-5 ${text}`}>{primaryGoal.description}</p>
                      )}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${darkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                      {primaryGoal.status === 'active' ? '进行中' : '已完成'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 ring-1 ring-gray-100'}`}>
                      {primaryGoal.goal_type === 'long' ? '长期目标' : '短期目标'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-600 ring-1 ring-gray-100'}`}>
                      截止 {formatDateLabel(primaryGoal.target_date)}
                    </span>
                  </div>
                </div>

                {remainingGoalsCount > 0 && (
                  <div className={`flex items-center justify-between rounded-2xl px-4 py-2.5 text-sm ${darkMode ? 'bg-gray-950/70 text-gray-300' : 'bg-gray-50 text-gray-600'}`}>
                    <span>还有 {remainingGoalsCount} 个目标处于进行中，已收成次级入口。</span>
                    <button
                      onClick={() => onNavigate('goals')}
                      className={`inline-flex items-center gap-1 font-medium ${darkMode ? 'text-emerald-300' : 'text-emerald-700'}`}
                    >
                      全部目标 <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card darkMode={darkMode} className={darkMode ? 'p-5 shadow-none' : 'p-5 shadow-[0_20px_50px_-36px_rgba(99,102,241,0.25)]'}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${darkMode ? 'bg-indigo-500/15 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                  <ListTodo size={18} />
                </div>
                <div>
                  <div className={`text-xs font-medium uppercase tracking-[0.18em] ${subText}`}>精选待办</div>
                  <h2 className={`mt-1 text-base font-semibold ${textH}`}>任务</h2>
                  <p className={`mt-1 text-sm ${text}`}>这里只露出最值得现在处理的 3 条任务，不把任务页整块搬回来。</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className={`inline-flex items-center gap-1 rounded-2xl px-4 py-2 text-sm transition-colors ${darkMode ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}
              >
                查看全部任务 <ArrowRight size={14} />
              </button>
            </div>

            {tasksLoading ? (
              <div className={`text-sm ${subText}`}>读取中...</div>
            ) : featuredTasks.length === 0 ? (
              <div className={`rounded-[24px] border px-4 py-6 ${darkMode ? 'border-gray-800 bg-gray-950/60' : 'border-gray-100 bg-gray-50/80'}`}>
                <div className={`text-base font-medium ${textH}`}>当前没有待处理任务</div>
                <p className={`mt-2 text-sm leading-6 ${text}`}>
                  你可以直接去任务页补任务，或者在右侧让助理帮你整理出下一步要执行的事项。
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {featuredTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className={`flex items-start justify-between gap-4 rounded-[20px] border px-4 py-3 ${darkMode ? 'border-gray-800 bg-gray-950/70' : 'border-gray-100 bg-gray-50/90'}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-500 ring-1 ring-gray-100'}`}>
                          {index + 1}
                        </span>
                        <div className={`truncate text-sm font-medium ${textH}`}>{task.title}</div>
                      </div>
                      <div className={`mt-1.5 pl-8 text-xs ${subText}`}>
                        {task.due_date === today
                          ? `今天${task.due_time ? ` · ${task.due_time}` : ''}`
                          : task.due_date
                          ? `${formatDateLabel(task.due_date)}${task.due_time ? ` · ${task.due_time}` : ''}`
                          : '未设置日期'}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                        task.due_date === today
                          ? darkMode
                            ? 'bg-amber-500/10 text-amber-300'
                            : 'bg-amber-50 text-amber-700'
                          : task.priority === 'high'
                          ? 'bg-red-500/10 text-red-500'
                          : darkMode
                          ? 'bg-gray-800 text-gray-300'
                          : 'bg-white text-gray-500 ring-1 ring-gray-100'
                      }`}>
                        {task.due_date === today ? '今天' : task.priority === 'high' ? '高优先级' : '待处理'}
                      </span>
                      <span className={`text-[11px] ${subText}`}>{task.status === 'in_progress' ? '进行中' : '待开始'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div
          className="min-h-0 overflow-hidden xl:self-start"
          style={rightHeight ? { height: `${rightHeight}px` } : undefined}
        >
          <AgentPanel darkMode={darkMode} compact fillHeight />
        </div>
      </div>
    </div>
  )
}
