import { useEffect, useState, type FormEvent } from 'react'
import { Flame, Award, TrendingUp, Plus } from 'lucide-react'
import { habitsApi } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { HabitHeatmapCell } from '@mylife/shared'

interface PageProps { darkMode: boolean }

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const HABIT_COLOR_MAP: Record<string, string> = {
  'bg-orange-500': '#f97316',
  'bg-indigo-500': '#6366f1',
  'bg-emerald-500': '#10b981',
  'bg-sky-500': '#0ea5e9',
  'bg-rose-500': '#f43f5e',
  'bg-amber-500': '#f59e0b',
  'bg-violet-500': '#8b5cf6',
}

function resolveHabitColor(colorClass: string) {
  return HABIT_COLOR_MAP[colorClass] ?? '#ff4f00'
}

function Heatmap({
  cells,
  colorClass,
  darkMode,
}: {
  cells: HabitHeatmapCell[]
  colorClass: string
  darkMode: boolean
}) {
  const columns: HabitHeatmapCell[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    columns.push(cells.slice(i, i + 7))
  }

  const baseColor = resolveHabitColor(colorClass)
  const emptyColor = darkMode ? '#3a3434' : '#eceae3'

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1">
        <div className="grid grid-rows-7 gap-1 pt-4">
          {['一', ' ', '三', ' ', '五', ' ', '日'].map((label, index) => (
            <div key={`${label}-${index}`} className={`h-2.5 text-[10px] leading-none ${subtleText(darkMode)}`}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-x-auto pb-1">
          <div className="inline-flex min-w-full gap-1">
            {columns.map((week, columnIndex) => (
              <div key={columnIndex} className="flex flex-col gap-1">
                {week.map((cell) => (
                  <div
                    key={cell.date}
                    title={`${cell.date} · ${cell.done ? '已完成' : '未完成'}`}
                    className="h-2.5 w-2.5 rounded-[2px]"
                    style={{ backgroundColor: cell.done ? baseColor : emptyColor, opacity: cell.done ? 1 : 1 }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 gap-1 overflow-hidden">
          {columns.map((week, columnIndex) => {
            const first = week[0]
            const monthLabel = first ? MONTH_LABELS[new Date(first.date).getMonth()] : ''
            const previous = columns[columnIndex - 1]?.[0]
            const previousMonth = previous ? new Date(previous.date).getMonth() : null
            const currentMonth = first ? new Date(first.date).getMonth() : null

            return (
              <div key={`month-${columnIndex}`} className="w-2.5 text-[10px] leading-none text-center">
                {columnIndex === 0 || currentMonth !== previousMonth ? (
                  <span className={subtleText(darkMode)}>{monthLabel}</span>
                ) : null}
              </div>
            )
          })}
        </div>
        <div className={`flex items-center gap-1 text-[10px] ${subtleText(darkMode)}`}>
          <span>少</span>
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: emptyColor }} />
          <div className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: baseColor }} />
          <span>多</span>
        </div>
      </div>
    </div>
  )
}

function subtleText(darkMode: boolean) {
  return darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
}

export default function HabitsPage({ darkMode }: PageProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('✅')
  const [createError, setCreateError] = useState<string | null>(null)

  const textH   = darkMode ? 'text-[#f0ebe3]'    : 'text-[#201515]'
  const subText = darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
  const cardBg  = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    return date
  })

  const { data: habits, loading, refetch } = useApi(() => habitsApi.list())

  const today = new Date().toISOString().slice(0, 10)

  const handleLog = async (habitId: string, currentDone: boolean) => {
    await habitsApi.log(habitId, today, !currentDone)
    refetch()
  }

  useEffect(() => {
    const handleGlobalNew = () => setIsCreating(true)
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) return

    try {
      setCreateError(null)
      await habitsApi.create({
        name,
        icon: newIcon.trim() || '✅',
        color: 'bg-orange-500',
        frequency: 'daily',
        custom_days: null,
        target_per_month: 30,
      })
      setNewName('')
      setNewIcon('✅')
      setIsCreating(false)
      refetch()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '添加习惯失败')
    }
  }

  const maxStreak = habits ? Math.max(...habits.map(h => h.streak), 0) : 0
  const topStreakHabit = habits?.find(h => h.streak === maxStreak)
  const totalLogs = habits?.reduce((s, h) => s + h.total_this_month, 0) ?? 0
  const avgCompletion = habits?.length
    ? Math.round((habits.reduce((s, h) => s + h.total_this_month / h.target_per_month, 0) / habits.length) * 100)
    : 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            icon: Flame, label: '最长连续', color: 'text-[#ff4f00]',
            bg: darkMode ? 'bg-[#3a2820]' : 'bg-[#eceae3]',
            value: maxStreak > 0 ? `${maxStreak} 天` : '—',
            sub: topStreakHabit?.name ?? '暂无数据',
          },
          {
            icon: TrendingUp, label: '本月完成率', color: 'text-[#ff4f00]',
            bg: darkMode ? 'bg-[#3a2820]' : 'bg-[#eceae3]',
            value: `${avgCompletion}%`,
            sub: '习惯平均完成率',
          },
          {
            icon: Award, label: '总打卡次数', color: 'text-[#ff4f00]',
            bg: darkMode ? 'bg-[#3a2820]' : 'bg-[#eceae3]',
            value: `${totalLogs} 次`,
            sub: `共 ${habits?.length ?? 0} 个习惯`,
          },
        ].map(({ icon: Icon, label, color, bg, value, sub }) => (
          <div key={label} className={`rounded-[5px] border p-4 ${cardBg}`}>
            <div className={`w-8 h-8 rounded-[5px] ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-xl font-bold ${textH}`}>{value}</div>
            <div className={`text-sm ${subText}`}>{label}</div>
            <div className={`text-xs mt-0.5 ${subText}`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Habits list */}
      <div className={`rounded-[5px] border ${cardBg}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
          <h2 className={`text-sm font-semibold ${textH}`}>我的习惯</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 bg-[#ff4f00] hover:bg-[#e64700] text-[#fffefb] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
          >
            <Plus size={13} />添加习惯
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className={`flex flex-col gap-3 px-5 py-4 border-b ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
            <div className="flex gap-2">
              <input
                value={newIcon}
                onChange={event => setNewIcon(event.target.value)}
                className={`w-14 rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515]'}`}
              />
              <input
                autoFocus
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="习惯名称"
                className={`flex-1 rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'}`}
              />
            </div>
            {createError && <div className="text-xs text-red-500">{createError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={!newName.trim()} className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold disabled:opacity-50">保存</button>
              <button type="button" onClick={() => setIsCreating(false)} className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="p-5 space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className={`h-24 rounded-[5px] animate-pulse ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`} />
            ))}
          </div>
        ) : (habits?.length ?? 0) === 0 ? (
          <div className={`py-16 text-center text-sm ${subText}`}>
            <div className="text-4xl mb-3">🌱</div>
            还没有习惯，点击「添加习惯」开始打卡吧
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-[#4a4440]' : 'divide-[#c5c0b1]'}`}>
            {(habits ?? []).map(habit => {
              const pct = Math.min(Math.round((habit.total_this_month / habit.target_per_month) * 100), 100)
              return (
                <div key={habit.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 ${habit.color} rounded-[5px] flex items-center justify-center text-lg`}>
                          {habit.icon}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textH}`}>{habit.name}</div>
                          <div className={`text-xs mt-0.5 ${subText}`}>
                            {habit.streak > 0
                              ? <span className="text-[#ff4f00] font-medium">🔥 连续 {habit.streak} 天</span>
                              : <span>连续已中断</span>
                            }
                            <span className="mx-1.5">·</span>
                            本月 {habit.total_this_month}/{habit.target_per_month} 天
                          </div>
                        </div>
                      </div>

                      <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`}>
                        <div className={`h-full rounded-full ${habit.color}`} style={{ width: `${pct}%` }} />
                      </div>

                      <div className="mb-3 flex items-center gap-2">
                        <span className={`text-xs ${subText}`}>最近7天</span>
                        <div className="flex gap-1.5">
                          {recentDays.map((day, i) => {
                            const weekdayLabel = WEEKDAY_LABELS[day.getDay()]
                            const dateLabel = `${day.getMonth() + 1}/${day.getDate()}`

                            return (
                              <div key={dateLabel} className="flex flex-col items-center gap-1">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                                  habit.week_data[i]
                                    ? `${habit.color} text-[#fffefb]`
                                    : darkMode ? 'bg-[#3a3434] text-[#7a756c]' : 'bg-[#eceae3] text-[#939084]'
                                }`}>
                                  {habit.week_data[i] ? '✓' : weekdayLabel}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <div className={`mb-2 text-xs ${subText}`}>打卡热力图</div>
                        <Heatmap cells={habit.heatmap} colorClass={habit.color} darkMode={darkMode} />
                      </div>
                    </div>

                    {/* Today check-in button */}
                    <button
                      onClick={() => handleLog(habit.id, habit.today_done)}
                      className={`flex-shrink-0 w-12 h-12 rounded-[8px] border-2 flex items-center justify-center text-xl transition-all ${
                        habit.today_done
                          ? `${habit.color} border-transparent`
                          : darkMode ? 'border-[#4a4440] hover:border-[#939084]' : 'border-[#c5c0b1] hover:border-[#939084]'
                      }`}
                    >
                      {habit.today_done ? '✓' : habit.icon}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
