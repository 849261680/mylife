import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from 'lucide-react'
import type { CalendarEvent, Task } from '@mylife/shared'
import { eventsApi, tasksApi } from '../lib/api'
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

function formatTimeLabel(event: CalendarEvent): string {
  if (event.is_all_day) return '全天'
  const start = event.start_time.slice(11, 16)
  const end = event.end_time.slice(11, 16)
  return `${start} - ${end}`
}

function completedDate(task: Task): string | null {
  return task.done_at?.slice(0, 10) ?? null
}

export default function CalendarPage({ darkMode }: PageProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [isCreatingEvent, setIsCreatingEvent] = useState(false)
  const [eventTitle, setEventTitle] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)

  const textH = darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'
  const subText = darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
  const cardBg = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const cellHover = darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'
  const inputBg = darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'

  const { data: tasks } = useApi(() => tasksApi.list())
  const monthStart = formatDate(year, month, 1)
  const monthEnd = formatDate(year, month, getDaysInMonth(year, month))
  const { data: events, refetch: refetchEvents } = useApi(
    () => eventsApi.list(monthStart, monthEnd),
    [monthStart, monthEnd]
  )

  const dueTasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks ?? []) {
      const dateKey = task.due_date
      if (!dateKey) continue
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(task)
    }
    return map
  }, [tasks])

  const completedTasksByDate = useMemo(() => {
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

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of events ?? []) {
      const dateKey = event.start_time.slice(0, 10)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(event)
    }
    return map
  }, [events])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    return day > 0 && day <= daysInMonth ? day : null
  })

  useEffect(() => {
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth)
    }
  }, [daysInMonth, selectedDay])

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const selectedDateKey = formatDate(year, month, selectedDay)
  const selectedDueTasks = [...(dueTasksByDate[selectedDateKey] ?? [])].sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1
    if (a.status !== 'done' && b.status === 'done') return -1
    return (a.due_time ?? '').localeCompare(b.due_time ?? '')
  })
  const selectedCompletedTasks = completedTasksByDate[selectedDateKey] ?? []
  const selectedEvents = [...(eventsByDate[selectedDateKey] ?? [])].sort((a, b) => a.start_time.localeCompare(b.start_time))

  const handleCreateEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = eventTitle.trim()
    if (!title) return

    const date = formatDate(year, month, selectedDay)
    const eventStart = allDay ? `${date}T00:00:00` : `${date}T${startTime}:00`
    const eventEnd = allDay ? `${date}T23:59:00` : `${date}T${endTime}:00`

    if (!allDay && eventEnd <= eventStart) {
      setEventError('结束时间必须晚于开始时间')
      return
    }

    try {
      setEventError(null)
      await eventsApi.create({
        title,
        start_time: eventStart,
        end_time: eventEnd,
        location: eventLocation.trim() || undefined,
        color: '#ff4f00',
        is_all_day: allDay,
        recurrence: null,
        notes: undefined,
      })
      setEventTitle('')
      setEventLocation('')
      setStartTime('09:00')
      setEndTime('10:00')
      setAllDay(false)
      setIsCreatingEvent(false)
      refetchEvents()
    } catch (error) {
      setEventError(error instanceof Error ? error.message : '创建事件失败')
    }
  }

  const handleDeleteEvent = async (eventId: string) => {
    await eventsApi.remove(eventId)
    refetchEvents()
  }

  return (
    <div className="flex gap-5 max-w-6xl mx-auto">
      <div className={`flex-1 rounded-[5px] border p-5 ${cardBg}`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className={`text-base font-semibold ${textH}`}>
            {year}年 {MONTHS[month]}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className={`p-1.5 rounded-[5px] transition-colors ${darkMode ? 'hover:bg-[#3a3434] text-[#939084]' : 'hover:bg-[#eceae3] text-[#939084]'}`}>
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(today.getDate()) }}
              className={`px-2.5 py-1 text-xs rounded-[5px] transition-colors ${darkMode ? 'hover:bg-[#3a3434] text-[#939084]' : 'hover:bg-[#eceae3] text-[#939084]'}`}
            >
              今天
            </button>
            <button onClick={nextMonth} className={`p-1.5 rounded-[5px] transition-colors ${darkMode ? 'hover:bg-[#3a3434] text-[#939084]' : 'hover:bg-[#eceae3] text-[#939084]'}`}>
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
            const dayEvents = eventsByDate[dateKey] ?? []
            const dayDueTasks = dueTasksByDate[dateKey] ?? []
            const previewItems = [
              ...dayEvents.map(item => ({ id: item.id, label: item.title, kind: 'event' as const })),
              ...dayDueTasks.map(item => ({ id: item.id, label: item.title, kind: 'task' as const })),
            ].slice(0, 2)

            return (
              <button
                key={i}
                onClick={() => setSelectedDay(day)}
                className={`flex min-h-20 flex-col items-stretch gap-1 rounded-[5px] px-2 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-[#ff4f00] text-[#fffefb]'
                    : isToday
                    ? darkMode ? 'bg-[#3a2820] text-[#ff4f00]' : 'bg-[#eceae3] text-[#ff4f00]'
                    : `${textH} ${cellHover}`
                }`}
              >
                <span className={`text-center text-sm font-medium leading-none ${isSelected ? 'text-[#fffefb]' : ''}`}>
                  {day}
                </span>
                {previewItems.map(item => (
                  <span
                    key={item.id}
                    className={`truncate rounded-[3px] px-1.5 py-0.5 text-xs ${
                      isSelected
                        ? 'bg-[#fffefb]/20 text-[#fffefb]'
                        : item.kind === 'event'
                        ? darkMode ? 'bg-[#3a3434] text-[#c5c0b1]' : 'bg-[#eceae3] text-[#36342e]'
                        : darkMode ? 'bg-[#3a2820] text-[#ff4f00]' : 'bg-[#eceae3] text-[#ff4f00]'
                    }`}
                  >
                    {item.label}
                  </span>
                ))}
                {dayEvents.length + dayDueTasks.length > 2 && (
                  <span className={`truncate rounded-[3px] px-1.5 py-0.5 text-xs ${isSelected ? 'bg-[#fffefb]/20 text-[#fffefb]' : subText}`}>
                    +{dayEvents.length + dayDueTasks.length - 2}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className={`w-64 rounded-[5px] border p-5 ${cardBg}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className={`text-sm font-semibold ${textH}`}>
            {month + 1}月{selectedDay}日
          </h3>
          <button
            onClick={() => { setIsCreatingEvent(true); setEventError(null) }}
            className="flex items-center gap-1 rounded-[4px] bg-[#ff4f00] px-2.5 py-1 text-xs text-[#fffefb] font-semibold transition-colors hover:bg-[#e64700]"
          >
            <Plus size={12} />事件
          </button>
        </div>

        {isCreatingEvent && (
          <form onSubmit={handleCreateEvent} className={`mb-4 space-y-2 rounded-[5px] border p-3 ${darkMode ? 'border-[#4a4440] bg-[#1e1a1a]' : 'border-[#c5c0b1] bg-[#eceae3]'}`}>
            <input
              autoFocus
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="事件标题"
              className={`w-full rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
            />
            <input
              value={eventLocation}
              onChange={(event) => setEventLocation(event.target.value)}
              placeholder="地点（可选）"
              className={`w-full rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
            />
            <label className={`flex items-center gap-2 text-xs ${subText}`}>
              <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
              全天事件
            </label>
            {!allDay && (
              <div className="grid grid-cols-2 gap-2">
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`} />
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`} />
              </div>
            )}
            {eventError && <div className="text-xs text-red-500">{eventError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={!eventTitle.trim()} className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold disabled:opacity-50">保存</button>
              <button type="button" onClick={() => setIsCreatingEvent(false)} className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
            </div>
          </form>
        )}

        <div className="space-y-4">
          <section>
            <div className={`mb-2 text-xs font-medium ${subText}`}>事件</div>
            {selectedEvents.length > 0 ? (
              <div className="space-y-2">
                {selectedEvents.map((event) => (
                  <div key={event.id} className={`rounded-[5px] px-3 py-2 text-sm ${darkMode ? 'bg-[#1e1a1a] text-[#c5c0b1]' : 'bg-[#eceae3] text-[#36342e]'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate">{event.title}</div>
                        <div className={`mt-1 flex items-center gap-1 text-xs ${subText}`}>
                          <Clock size={11} />
                          <span>{formatTimeLabel(event)}</span>
                          {event.location && <span>· {event.location}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => { void handleDeleteEvent(event.id) }}
                        className={`rounded-[4px] p-1 transition-colors ${darkMode ? 'text-[#7a756c] hover:text-red-400' : 'text-[#939084] hover:text-red-500'}`}
                        aria-label={`删除${event.title}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-xs ${subText}`}>这一天没有事件</div>
            )}
          </section>

          <section>
            <div className={`mb-2 text-xs font-medium ${subText}`}>到期任务</div>
            {selectedDueTasks.length > 0 ? (
              <div className="space-y-2">
                {selectedDueTasks.map(task => (
                  <div key={task.id} className={`rounded-[5px] px-3 py-2 text-sm ${darkMode ? 'bg-[#1e1a1a] text-[#c5c0b1]' : 'bg-[#eceae3] text-[#36342e]'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`min-w-0 truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>{task.title}</span>
                      <span className={`text-xs ${subText}`}>{task.due_time ?? (task.status === 'done' ? '已完成' : '待处理')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-xs ${subText}`}>这一天没有到期任务</div>
            )}
          </section>

          <section>
            <div className={`mb-2 text-xs font-medium ${subText}`}>完成记录</div>
            {selectedCompletedTasks.length > 0 ? (
              <div className="space-y-2">
                {selectedCompletedTasks.map(task => (
                  <div key={task.id} className={`rounded-[5px] px-3 py-2 text-sm ${darkMode ? 'bg-[#1e1a1a] text-[#c5c0b1]' : 'bg-[#eceae3] text-[#36342e]'}`}>
                    {task.title}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`text-xs ${subText}`}>这一天没有完成记录</div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
