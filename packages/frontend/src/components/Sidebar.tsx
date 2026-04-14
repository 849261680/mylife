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
    ? 'bg-gray-900 border-gray-800 text-gray-300'
    : 'bg-white border-gray-200 text-gray-600'

  const activeClass = darkMode
    ? 'bg-indigo-600 text-white'
    : 'bg-indigo-50 text-indigo-600'

  const hoverClass = darkMode
    ? 'hover:bg-gray-800 hover:text-white'
    : 'hover:bg-gray-50 hover:text-gray-900'

  return (
    <aside
      className={`flex flex-col border-r transition-all duration-300 ${base} ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 px-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Zap size={14} className="text-white" />
            </div>
            <span className={`font-semibold text-sm truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              我的工作台
            </span>
          </div>
        )}
        {collapsed && (
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center mx-auto">
            <Zap size={14} className="text-white" />
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
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? activeClass : hoverClass
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className={`border-t py-3 px-2 space-y-0.5 ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverClass} ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? '设置' : undefined}
        >
          <Settings size={17} className="flex-shrink-0" />
          {!collapsed && <span>设置</span>}
        </button>
        {showSettings && !collapsed && (
          <div className={`mx-1 rounded-lg border p-3 text-xs ${darkMode ? 'border-gray-800 bg-gray-800 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
            设置面板还没有独立页面；深色模式和侧边栏收起已在当前界面可用。
          </div>
        )}
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${hoverClass} ${collapsed ? 'justify-center' : ''}`}
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
