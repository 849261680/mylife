import { useState } from 'react'
import type { ComponentType } from 'react'
import Sidebar from './components/Sidebar'
import TopBar from './components/TopBar'
import Dashboard from './pages/Dashboard'
import TasksPage from './pages/TasksPage'
import CalendarPage from './pages/CalendarPage'
import HabitsPage from './pages/HabitsPage'
import FinancePage from './pages/FinancePage'
import HealthPage from './pages/HealthPage'
import NotesPage from './pages/NotesPage'
import GoalsPage from './pages/GoalsPage'
import AgentPage from './pages/AgentPage'
import './index.css'

export type PageId = 'dashboard' | 'goals' | 'tasks' | 'calendar' | 'habits' | 'finance' | 'health' | 'notes' | 'agent'

interface PageProps {
  darkMode: boolean
  onNavigate: (page: PageId) => void
  globalSearch: string
}

const pages: Record<PageId, ComponentType<PageProps>> = {
  dashboard: Dashboard,
  goals: GoalsPage,
  tasks: TasksPage,
  calendar: CalendarPage,
  habits: HabitsPage,
  finance: FinancePage,
  health: HealthPage,
  notes: NotesPage,
  agent: AgentPage,
}

export default function App() {
  const [activePage, setActivePage] = useState<PageId>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')

  const PageComponent = pages[activePage]

  return (
    <div className={`flex h-screen overflow-hidden ${darkMode ? 'bg-[#1e1a1a]' : 'bg-[#fffefb]'}`}>
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        darkMode={darkMode}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          activePage={activePage}
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(!darkMode)}
          onNavigate={setActivePage}
          onSearch={(query) => {
            setGlobalSearch(query)
            setActivePage(activePage === 'notes' ? 'notes' : 'tasks')
          }}
        />
        <main className={`flex-1 overflow-y-auto p-6 ${darkMode ? 'bg-[#1e1a1a]' : 'bg-[#fffefb]'}`}>
          <PageComponent darkMode={darkMode} onNavigate={setActivePage} globalSearch={globalSearch} />
        </main>
      </div>
    </div>
  )
}
