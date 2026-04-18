import { useState, type FormEvent } from 'react'
import { Search, Bell, Sun, Moon, Plus } from 'lucide-react'
import type { PageId } from '../App'

const pageNames: Record<PageId, string> = {
  dashboard: '今日概览',
  goals: '目标',
  tasks: '任务',
  calendar: '日历',
  habits: '习惯',
  finance: '记账',
  health: '健康',
  notes: '笔记',
  agent: 'Agent',
}

const greetings = (): string => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了，注意休息'
  if (h < 12) return '早上好'
  if (h < 18) return '下午好'
  return '晚上好'
}

const formatDate = (): string => {
  const d = new Date()
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${days[d.getDay()]}`
}

interface TopBarProps {
  activePage: PageId
  darkMode: boolean
  onToggleDark: () => void
  onNavigate: (page: PageId) => void
  onSearch: (query: string) => void
}

export default function TopBar({ activePage, darkMode, onToggleDark, onNavigate, onSearch }: TopBarProps) {
  const [searchQ, setSearchQ] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)

  const border = darkMode ? 'border-[#4a4440] bg-[#2a2424]' : 'border-[#c5c0b1] bg-[#fffefb]'
  const textH = darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'
  const text = darkMode ? 'text-[#939084]' : 'text-[#36342e]'
  const inputBg = darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#c5c0b1] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'
  const btnHover = darkMode ? 'hover:bg-[#3a3434] text-[#7a756c] hover:text-[#f0ebe3]' : 'hover:bg-[#eceae3] text-[#939084] hover:text-[#201515]'

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = searchQ.trim()
    if (!query) return
    onSearch(query)
  }

  const handleNew = () => {
    if (activePage === 'dashboard') {
      onNavigate('tasks')
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mylife:new', { detail: { page: 'tasks' } }))
      }, 0)
      return
    }
    window.dispatchEvent(new CustomEvent('mylife:new', { detail: { page: activePage } }))
  }

  return (
    <header className={`flex items-center gap-4 h-16 px-6 border-b flex-shrink-0 ${border}`}>
      {/* Left: page title + greeting */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <h1 className={`text-base font-semibold leading-none ${textH}`}>
            {pageNames[activePage]}
          </h1>
          {activePage === 'dashboard' && (
            <span className={`text-xs ${text}`}>
              {greetings()}，{formatDate()}
            </span>
          )}
        </div>
      </div>

      {/* Center: search */}
      <div className="w-64">
        <form onSubmit={handleSearch} className="relative">
          <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${darkMode ? 'text-[#7a756c]' : 'text-[#939084]'}`} />
          <input
            type="text"
            placeholder="搜索任务、笔记..."
            value={searchQ}
            onChange={event => setSearchQ(event.target.value)}
            className={`w-full pl-8 pr-3 py-1.5 text-sm rounded-[5px] border outline-none focus:border-[#ff4f00] focus:ring-1 focus:ring-[#ff4f00]/30 transition-colors ${inputBg}`}
          />
        </form>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowNotifications(v => !v)}
          className={`relative p-2 rounded-[5px] transition-colors ${btnHover}`}
        >
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#ff4f00] rounded-full" />
        </button>
        <button
          onClick={onToggleDark}
          className={`p-2 rounded-[5px] transition-colors ${btnHover}`}
        >
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button
          onClick={handleNew}
          className="ml-1 flex items-center gap-1.5 bg-[#ff4f00] hover:bg-[#e64700] text-[#fffefb] text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
        >
          <Plus size={15} />
          <span>新建</span>
        </button>
      </div>
      {showNotifications && (
        <div className={`absolute right-24 top-14 z-20 w-64 rounded-[5px] border p-3 text-sm ${darkMode ? 'border-[#4a4440] bg-[#2a2424] text-[#c5c0b1]' : 'border-[#c5c0b1] bg-[#fffefb] text-[#36342e]'}`}>
          <div className={`font-medium ${textH}`}>通知</div>
          <div className={`mt-2 text-xs ${text}`}>暂无新通知</div>
        </div>
      )}
    </header>
  )
}
