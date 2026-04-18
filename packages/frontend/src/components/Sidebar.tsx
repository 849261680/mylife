import {
  LayoutDashboard,
  Target,
  CheckSquare,
  Calendar,
  Flame,
  Wallet,
  Heart,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { PageId } from '../App'

interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '今日概览', icon: LayoutDashboard },
  { id: 'goals', label: '目标', icon: Target },
  { id: 'tasks', label: '任务', icon: CheckSquare },
  { id: 'calendar', label: '日历', icon: Calendar },
  { id: 'habits', label: '习惯', icon: Flame },
  { id: 'finance', label: '记账', icon: Wallet },
  { id: 'health', label: '健康', icon: Heart },
  { id: 'notes', label: '笔记', icon: FileText },
]

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  collapsed: boolean
  onToggle: () => void
  darkMode: boolean
}

export default function Sidebar({ activePage, onNavigate, collapsed, onToggle, darkMode }: SidebarProps) {
  const [showSettings, setShowSettings] = useState(false)
  const base = darkMode
    ? 'bg-[#2a2424] border-[#4a4440] text-[#c5c0b1]'
    : 'bg-[#fffefb] border-[#c5c0b1] text-[#36342e]'

  return (
    <aside
      className={`flex flex-col border-r transition-all duration-300 ${base} ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-[#ff4f00] rounded-[4px] flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-[#fffefb]" />
            </div>
            <span className={`font-semibold text-sm truncate ${darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'}`}>
              我的工作台
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-[#ff4f00] rounded-[4px] flex items-center justify-center mx-auto">
            <Zap size={14} className="text-[#fffefb]" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = activePage === id
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? `${darkMode ? 'text-[#ff4f00]' : 'text-[#ff4f00]'} font-semibold`
                  : darkMode
                    ? 'text-[#939084] hover:text-[#f0ebe3]'
                    : 'text-[#36342e] hover:text-[#201515]'
              } ${collapsed ? 'justify-center' : ''}`}
              style={isActive ? { boxShadow: 'rgb(255, 79, 0) 0px -4px 0px 0px inset' } : undefined}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget.style.boxShadow = 'rgb(197, 192, 177) 0px -4px 0px 0px inset') }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.boxShadow = '' }}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t py-3 px-2 space-y-0.5 ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sm transition-colors ${darkMode ? 'text-[#939084] hover:text-[#f0ebe3]' : 'text-[#36342e] hover:text-[#201515]'} ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? '设置' : undefined}
        >
          <Settings size={17} className="flex-shrink-0" />
          {!collapsed && <span>设置</span>}
        </button>
        {showSettings && !collapsed && (
          <div className={`mx-1 rounded-[5px] border p-3 text-xs ${darkMode ? 'border-[#4a4440] bg-[#1e1a1a] text-[#7a756c]' : 'border-[#c5c0b1] bg-[#eceae3] text-[#939084]'}`}>
            设置面板还没有独立页面；深色模式和侧边栏收起已在当前界面可用。
          </div>
        )}
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sm transition-colors ${darkMode ? 'text-[#939084] hover:text-[#f0ebe3]' : 'text-[#36342e] hover:text-[#201515]'} ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? <ChevronRight size={17} /> : (
            <>
              <ChevronLeft size={17} className="flex-shrink-0" />
              <span>收起侧边栏</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
