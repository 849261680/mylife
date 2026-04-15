import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Circle, Plus, Clock, FolderOpen, Filter, LayoutGrid, List, Trash2, type LucideIcon } from 'lucide-react'
import type { Task } from '@mylife/shared'
import { projectsApi, tasksApi } from '../lib/api'
import { useApi } from '../lib/useApi'

type Priority = 'high' | 'low'
type ViewMode = 'list' | 'grid'
type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done'

interface PriorityConfig { label: string; dot: string }
const priorityConfig: Record<Priority, PriorityConfig> = {
  high:   { label: '高', dot: 'bg-red-400' },
  low:    { label: '低', dot: 'bg-blue-400' },
}

interface PageProps {
  darkMode: boolean
  globalSearch?: string
}

export default function TasksPage({ darkMode, globalSearch = '' }: PageProps) {
  const [activeProject, setActiveProject] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [isCreating, setIsCreating] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [searchQ, setSearchQ] = useState('')

  const textH    = darkMode ? 'text-white'     : 'text-gray-900'
  const subText  = darkMode ? 'text-gray-500'  : 'text-gray-400'
  const text     = darkMode ? 'text-gray-300'  : 'text-gray-600'
  const cardBg   = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const hoverBg  = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
  const sidebarBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const activeBg = darkMode ? 'bg-gray-800 text-white' : 'bg-indigo-50 text-indigo-600'
  const divider  = darkMode ? 'divide-gray-800' : 'divide-gray-50'

  const { data: tasks, loading, refetch } = useApi(() => tasksApi.list())
  const { data: projects, refetch: refetchProjects } = useApi(() => projectsApi.list())

  const filtered = tasks
    ? tasks.filter(t => (
        (activeProject === 'all' || t.project_id === activeProject) &&
        (statusFilter === 'all' || t.status === statusFilter) &&
        (!searchQ || t.title.includes(searchQ) || t.tags.some(tag => tag.includes(searchQ)))
      ))
    : []

  useEffect(() => {
    const handleGlobalNew = () => startNewTask()
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [])

  useEffect(() => {
    if (globalSearch) setSearchQ(globalSearch)
  }, [globalSearch])

  const toggleDone = async (task: Task) => {
    await tasksApi.update(task.id, { status: task.status === 'done' ? 'todo' : 'done' })
    refetch()
  }

  const removeTask = async (task: Task) => {
    if (!confirm(`确定删除「${task.title}」吗？`)) return
    await tasksApi.remove(task.id)
    refetch()
  }

  const startNewTask = () => {
    setIsCreating(true)
    setCreateError(null)
  }

  const cancelNewTask = () => {
    setIsCreating(false)
    setNewTaskTitle('')
    setCreateError(null)
  }

  const submitNewProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return

    try {
      setProjectError(null)
      const project = await projectsApi.create({ name, color: 'indigo' })
      setNewProjectName('')
      setIsCreatingProject(false)
      setActiveProject(project.id)
      refetchProjects()
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : '新建项目失败')
    }
  }

  const submitNewTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = newTaskTitle.trim()
    if (!title) return

    try {
      setCreating(true)
      setCreateError(null)
      await tasksApi.create({
        title,
        priority: 'low',
        due_date: null,
        due_time: null,
        tags: [],
        project_id: activeProject === 'all' ? undefined : activeProject,
      })
      setNewTaskTitle('')
      setIsCreating(false)
      refetch()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '新建任务失败')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex gap-5 max-w-6xl mx-auto">
      {/* Sidebar */}
      <div className={`w-48 flex-shrink-0 rounded-xl border p-3 h-fit ${sidebarBg}`}>
        <div className="space-y-0.5">
          <button onClick={() => setActiveProject('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              activeProject === 'all' ? activeBg : `${text} ${hoverBg}`
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderOpen size={13} /><span>所有任务</span>
            </div>
            <span className={`text-xs ${activeProject === 'all' ? '' : subText}`}>{tasks?.length ?? 0}</span>
          </button>
          {(projects ?? []).map(project => (
            <button
              key={project.id}
              onClick={() => setActiveProject(project.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                activeProject === project.id ? activeBg : `${text} ${hoverBg}`
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen size={13} />
                <span className="truncate">{project.name}</span>
              </div>
              <span className={`text-xs ${activeProject === project.id ? '' : subText}`}>
                {tasks?.filter(t => t.project_id === project.id).length ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          {isCreatingProject ? (
            <form onSubmit={submitNewProject} className="space-y-2">
              <input
                autoFocus
                value={newProjectName}
                onChange={event => setNewProjectName(event.target.value)}
                placeholder="项目名称"
                className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${
                  darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                }`}
              />
              {projectError && <div className="text-xs text-red-500">{projectError}</div>}
              <div className="flex gap-2">
                <button type="submit" className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white">保存</button>
                <button type="button" onClick={() => setIsCreatingProject(false)} className={`rounded-lg border px-2 py-1 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>取消</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setIsCreatingProject(true); setProjectError(null) }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-indigo-500 transition-colors ${darkMode ? 'hover:bg-indigo-900/20' : 'hover:bg-indigo-50'}`}
            >
              <Plus size={14} /><span>新建项目</span>
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className={`text-sm font-semibold ${textH}`}>所有任务</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
              {filtered.length} 项
            </span>
            {searchQ && (
              <button
                onClick={() => setSearchQ('')}
                className={`text-xs px-2 py-1 rounded-lg ${darkMode ? 'bg-gray-800 text-gray-400 hover:bg-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
              >
                搜索：{searchQ} ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              <Filter size={12} />筛选
            </button>
            {showFilters && (
              <div className={`absolute right-0 top-8 z-10 w-32 rounded-lg border p-1 shadow-lg ${darkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-100 bg-white'}`}>
                {([
                  ['all', '全部'],
                  ['todo', '待办'],
                  ['in_progress', '进行中'],
                  ['done', '已完成'],
                ] as [StatusFilter, string][]).map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setShowFilters(false) }}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${statusFilter === status ? activeBg : `${text} ${hoverBg}`}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            </div>
            <div className={`flex rounded-lg border overflow-hidden ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              {([['list', List], ['grid', LayoutGrid]] as [ViewMode, LucideIcon][]).map(([mode, Icon]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`p-1.5 transition-colors ${viewMode === mode
                    ? darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'
                    : darkMode ? 'text-gray-500 hover:bg-gray-800' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <button
              onClick={startNewTask}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} />新建任务
            </button>
          </div>
        </div>

        {loading ? (
          <div className={`rounded-xl border ${cardBg}`}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`flex items-center gap-4 px-4 py-3 border-b last:border-0 ${darkMode ? 'border-gray-800' : 'border-gray-50'}`}>
                <div className={`w-4 h-4 rounded-full animate-pulse ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`} />
                <div className={`h-4 flex-1 rounded animate-pulse ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-xl border ${viewMode === 'list' ? `divide-y ${divider}` : `p-3 grid grid-cols-2 gap-3 ${cardBg}` } ${viewMode === 'list' ? cardBg : ''}`}>
            {isCreating && (
              <form onSubmit={submitNewTask} className={`flex flex-col gap-3 px-4 py-3 ${darkMode ? 'bg-gray-900' : 'bg-white'} first:rounded-t-xl`}>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={event => setNewTaskTitle(event.target.value)}
                  placeholder="输入任务名称"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    darkMode
                      ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500'
                      : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-indigo-500'
                  }`}
                />
                {createError && <div className="text-xs text-red-500">{createError}</div>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creating || !newTaskTitle.trim()}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelNewTask}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      darkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    取消
                  </button>
                </div>
              </form>
            )}
            {filtered.length === 0 && !isCreating ? (
              <div className={`px-4 py-12 text-center text-sm ${subText}`}>
                还没有任务，点击「新建任务」开始吧
              </div>
            ) : filtered.map(task => {
              const pc = priorityConfig[task.priority as Priority] ?? priorityConfig.low
              return (
                <div key={task.id} className={`flex items-center gap-4 px-4 py-3 transition-colors ${hoverBg} ${viewMode === 'grid' ? `rounded-lg border ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}` : 'first:rounded-t-xl last:rounded-b-xl'}`}>
                  <button className="flex-shrink-0" onClick={() => toggleDone(task)}>
                    {task.status === 'done'
                      ? <CheckCircle2 size={17} className="text-indigo-500" />
                      : <Circle size={17} className={subText} />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${task.status === 'done' ? `line-through ${subText}` : textH}`}>
                        {task.title}
                      </span>
                      {task.tags.map(tag => (
                        <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                      <span className={`text-xs ${subText}`}>{pc.label}优先</span>
                    </div>
                    {task.due_date && (
                      <div className={`flex items-center gap-1 text-xs ${subText}`}>
                        <Clock size={11} />
                        <span>{task.due_date}{task.due_time ? ` ${task.due_time}` : ''}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeTask(task)}
                      className={`rounded-lg p-1.5 transition-colors ${darkMode ? 'text-gray-500 hover:bg-gray-800 hover:text-red-400' : 'text-gray-400 hover:bg-gray-50 hover:text-red-500'}`}
                      aria-label={`删除${task.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            <div className={`px-4 py-3 last:rounded-b-xl ${hoverBg} transition-colors cursor-pointer`}>
              <button
                onClick={startNewTask}
                className={`flex items-center gap-2 text-sm ${subText} hover:text-indigo-500 transition-colors`}
              >
                <Plus size={15} /><span>添加任务</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
