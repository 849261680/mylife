import { useEffect, useState, type FormEvent } from 'react'
import { Flame, Award, TrendingUp, Plus } from 'lucide-react'
import { habitsApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface PageProps { darkMode: boolean }

export default function HabitsPage({ darkMode }: PageProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('✅')
  const [createError, setCreateError] = useState<string | null>(null)

  const textH   = darkMode ? 'text-white'    : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const cardBg  = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const weekDays = ['一', '二', '三', '四', '五', '六', '日']

  const { data: habits, loading, refetch } = useApi(() => habitsApi.list())

  const today = new Date().toISOString().slice(0, 10)

  const handleLog = async (habitId: string, currentDone: boolean) => {
    await habitsApi.log(habitId, today, !currentDone)
    refetch()
  }

  useEffect(() => {
    const handleGlobalNew = () => setIsCreating(true)
    window.addEventListener('myweight:new', handleGlobalNew)
    return () => window.removeEventListener('myweight:new', handleGlobalNew)
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
            icon: Flame, label: '最长连续', color: 'text-orange-500',
            bg: darkMode ? 'bg-orange-900/20' : 'bg-orange-50',
            value: maxStreak > 0 ? `${maxStreak} 天` : '—',
            sub: topStreakHabit?.name ?? '暂无数据',
          },
          {
            icon: TrendingUp, label: '本月完成率', color: 'text-indigo-500',
            bg: darkMode ? 'bg-indigo-900/20' : 'bg-indigo-50',
            value: `${avgCompletion}%`,
            sub: '习惯平均完成率',
          },
          {
            icon: Award, label: '总打卡次数', color: 'text-emerald-500',
            bg: darkMode ? 'bg-emerald-900/20' : 'bg-emerald-50',
            value: `${totalLogs} 次`,
            sub: `共 ${habits?.length ?? 0} 个习惯`,
          },
        ].map(({ icon: Icon, label, color, bg, value, sub }) => (
          <div key={label} className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
              <Icon size={16} className={color} />
            </div>
            <div className={`text-xl font-bold ${textH}`}>{value}</div>
            <div className={`text-sm ${subText}`}>{label}</div>
            <div className={`text-xs mt-0.5 ${subText}`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Habits list */}
      <div className={`rounded-xl border ${cardBg}`}>
        <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <h2 className={`text-sm font-semibold ${textH}`}>我的习惯</h2>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />添加习惯
          </button>
        </div>

        {isCreating && (
          <form onSubmit={handleCreate} className={`flex flex-col gap-3 px-5 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <div className="flex gap-2">
              <input
                value={newIcon}
                onChange={event => setNewIcon(event.target.value)}
                className={`w-14 rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
              />
              <input
                autoFocus
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="习惯名称"
                className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
              />
            </div>
            {createError && <div className="text-xs text-red-500">{createError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={!newName.trim()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50">保存</button>
              <button type="button" onClick={() => setIsCreating(false)} className={`rounded-lg border px-3 py-1.5 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>取消</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="p-5 space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className={`h-24 rounded-xl animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
            ))}
          </div>
        ) : (habits?.length ?? 0) === 0 ? (
          <div className={`py-16 text-center text-sm ${subText}`}>
            <div className="text-4xl mb-3">🌱</div>
            还没有习惯，点击「添加习惯」开始打卡吧
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-50'}`}>
            {(habits ?? []).map(habit => {
              const pct = Math.min(Math.round((habit.total_this_month / habit.target_per_month) * 100), 100)
              return (
                <div key={habit.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 ${habit.color} rounded-xl flex items-center justify-center text-lg`}>
                          {habit.icon}
                        </div>
                        <div>
                          <div className={`text-sm font-medium ${textH}`}>{habit.name}</div>
                          <div className={`text-xs mt-0.5 ${subText}`}>
                            {habit.streak > 0
                              ? <span className="text-orange-500 font-medium">🔥 连续 {habit.streak} 天</span>
                              : <span>连续已中断</span>
                            }
                            <span className="mx-1.5">·</span>
                            本月 {habit.total_this_month}/{habit.target_per_month} 天
                          </div>
                        </div>
                      </div>

                      <div className={`h-1.5 rounded-full overflow-hidden mb-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <div className={`h-full rounded-full ${habit.color}`} style={{ width: `${pct}%` }} />
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${subText}`}>本周</span>
                        <div className="flex gap-1.5">
                          {weekDays.map((d, i) => (
                            <div key={d} className="flex flex-col items-center gap-1">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                                habit.week_data[i]
                                  ? `${habit.color} text-white`
                                  : darkMode ? 'bg-gray-800 text-gray-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {habit.week_data[i] ? '✓' : d}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Today check-in button */}
                    <button
                      onClick={() => handleLog(habit.id, habit.today_done)}
                      className={`flex-shrink-0 w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${
                        habit.today_done
                          ? `${habit.color} border-transparent`
                          : darkMode ? 'border-gray-700 hover:border-gray-500' : 'border-gray-200 hover:border-gray-300'
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
