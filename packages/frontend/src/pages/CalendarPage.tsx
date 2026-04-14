import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Task } from '@myweight/shared'
import { tasksApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface PageProps {
  darkMode: boolean
}

const DAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function completedDate(task: Task): string | null {
  return task.done_at?.slice(0, 10) ?? null
}

export default function CalendarPage({ darkMode }: PageProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())

  const textH = darkMode ? 'text-white' : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const cellHover = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'

  const { data: tasks } = useApi(() => tasksApi.list())

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks ?? []) {
      if (task.status !== 'done') continue
      const dateKey = completedDate(task)
      if (!dateKey) continue
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(task)
    }
    return map
  }, [tasks])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    return day > 0 && day <= daysInMonth ? day : null
  })

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const selectedDateKey = formatDate(year, month, selectedDay)
  const selectedTasks = tasksByDate[selectedDateKey] ?? []

  return (
    <div className="flex gap-5 max-w-6xl mx-auto">
      <div className={`flex-1 rounded-xl border p-5 ${cardBg}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-base font-semibold ${textH}`}>
            {year}年 {MONTHS[month]}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()) }}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}
            >
              今天
            </button>
            <button onClick={nextMonth} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => (
            <div key={d} className={`text-center text-xs font-medium py-1 ${subText}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="min-h-20" />
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isSelected = day === selectedDay
            const dateKey = formatDate(year, month, day)
            const dayTasks = tasksByDate[dateKey] ?? []

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`flex min-h-20 flex-col items-stretch gap-1 rounded-lg px-2 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : isToday
                    ? darkMode ? 'bg-indigo-900/40 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                    : `${textH} ${cellHover}`
                }`}
              >
                <span className={`text-center text-sm font-medium leading-none ${isSelected ? 'text-white' : ''}`}>
                  {day}
                </span>
                {dayTasks.slice(0, 2).map(task => (
                  <span
                    key={task.id}
                    className={`truncate rounded px-1.5 py-0.5 text-xs ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : darkMode ? 'bg-gray-800 text-gray-300' : 'bg-indigo-50 text-indigo-600'
                    }`}
                  >
                    {task.title}
                  </span>
                ))}
                {dayTasks.length > 2 && (
                  <span className={`truncate rounded px-1.5 py-0.5 text-xs ${isSelected ? 'bg-white/20 text-white' : subText}`}>
                    +{dayTasks.length - 2}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`w-64 rounded-xl border p-5 ${cardBg}`}>
        <h3 className={`mb-4 text-sm font-semibold ${textH}`}>
          {month + 1}月{selectedDay}日
        </h3>

        {selectedTasks.length > 0 ? (
          <div className="space-y-2">
            {selectedTasks.map(task => (
              <div key={task.id} className={`rounded-lg px-3 py-2 text-sm ${darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-700'}`}>
                {task.title}
              </div>
            ))}
          </div>
        ) : (
          <div className={`py-10 text-center text-xs ${subText}`}>
            这一天没有完成任务
          </div>
        )}
      </div>
    </div>
  )
}
