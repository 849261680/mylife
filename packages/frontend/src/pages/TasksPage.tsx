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
  high:   { label: '高', dot: 'bg-[#ff4f00]' },
  low:    { label: '低', dot: 'bg-[#939084]' },
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

  const textH    = darkMode ? 'text-[#f0ebe3]'     : 'text-[#201515]'
  const subText  = darkMode ? 'text-[#7a756c]'  : 'text-[#939084]'
  const text     = darkMode ? 'text-[#c5c0b1]'  : 'text-[#36342e]'
  const cardBg   = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const hoverBg  = darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'
  const sidebarBg = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const divider  = darkMode ? 'divide-[#4a4440]' : 'divide-[#c5c0b1]'

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
      <div className={`w-48 flex-shrink-0 rounded-[5px] border p-3 h-fit ${sidebarBg}`}>
        <div className="space-y-0.5">
          <button onClick={() => setActiveProject('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-[5px] text-sm transition-all ${
              activeProject === 'all' ? 'text-[#ff4f00] font-semibold' : `${text} ${hoverBg}`
            }`}
            style={activeProject === 'all' ? { boxShadow: 'rgb(255, 79, 0) 0px -4px 0px 0px inset' } : undefined}
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
              className={`w-full flex items-center justify-between px-3 py-2 rounded-[5px] text-sm transition-all ${
                activeProject === project.id ? 'text-[#ff4f00] font-semibold' : `${text} ${hoverBg}`
              }`}
              style={activeProject === project.id ? { boxShadow: 'rgb(255, 79, 0) 0px -4px 0px 0px inset' } : undefined}
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
        <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
          {isCreatingProject ? (
            <form onSubmit={submitNewProject} className="space-y-2">
              <input
                autoFocus
                value={newProjectName}
                onChange={event => setNewProjectName(event.target.value)}
                placeholder="项目名称"
                className={`w-full rounded-[5px] border px-2 py-1.5 text-xs outline-none focus:border-[#ff4f00] ${
                  darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'
                }`}
              />
              {projectError && <div className="text-xs text-red-500">{projectError}</div>}
              <div className="flex gap-2">
                <button type="submit" className="rounded-[4px] bg-[#ff4f00] px-2 py-1 text-xs text-[#fffefb] font-semibold">保存</button>
                <button type="button" onClick={() => setIsCreatingProject(false)} className={`rounded-[4px] border px-2 py-1 text-xs ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => { setIsCreatingProject(true); setProjectError(null) }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-[5px] text-sm text-[#ff4f00] transition-colors ${darkMode ? 'hover:bg-[#3a2820]' : 'hover:bg-[#eceae3]'}`}
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
            <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#3a3434] text-[#939084]' : 'bg-[#eceae3] text-[#939084]'}`}>
              {filtered.length} 项
            </span>
            {searchQ && (
              <button
                onClick={() => setSearchQ('')}
                className={`text-xs px-2 py-1 rounded-[5px] ${darkMode ? 'bg-[#3a3434] text-[#939084] hover:bg-[#4a4440]' : 'bg-[#eceae3] text-[#939084] hover:bg-[#c5c0b1]'}`}
              >
                搜索：{searchQ} ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
            <button
              onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[5px] border transition-colors ${darkMode ? 'border-[#4a4440] text-[#939084] hover:bg-[#3a3434]' : 'border-[#c5c0b1] text-[#36342e] hover:bg-[#eceae3]'}`}
            >
              <Filter size={12} />筛选
            </button>
            {showFilters && (
              <div className={`absolute right-0 top-8 z-10 w-32 rounded-[5px] border p-1 ${darkMode ? 'border-[#4a4440] bg-[#2a2424]' : 'border-[#c5c0b1] bg-[#fffefb]'}`}>
                {([
                  ['all', '全部'],
                  ['todo', '待办'],
                  ['in_progress', '进行中'],
                  ['done', '已完成'],
                ] as [StatusFilter, string][]).map(([status, label]) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setShowFilters(false) }}
                    className={`w-full rounded-[4px] px-2 py-1.5 text-left text-xs ${statusFilter === status ? 'text-[#ff4f00] font-semibold' : `${text} ${hoverBg}`}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            </div>
            <div className={`flex rounded-[5px] border overflow-hidden ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
              {([['list', List], ['grid', LayoutGrid]] as [ViewMode, LucideIcon][]).map(([mode, Icon]) => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  className={`p-1.5 transition-colors ${viewMode === mode
                    ? darkMode ? 'bg-[#3a3434] text-[#f0ebe3]' : 'bg-[#eceae3] text-[#201515]'
                    : darkMode ? 'text-[#7a756c] hover:bg-[#3a3434]' : 'text-[#939084] hover:bg-[#eceae3]'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
            <button
              onClick={startNewTask}
              className="flex items-center gap-1.5 bg-[#ff4f00] hover:bg-[#e64700] text-[#fffefb] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
            >
              <Plus size={13} />新建任务
            </button>
          </div>
        </div>

        {loading ? (
          <div className={`rounded-[5px] border ${cardBg}`}>
            {[1,2,3,4,5].map(i => (
              <div key={i} className={`flex items-center gap-4 px-4 py-3 border-b last:border-0 ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
                <div className={`w-4 h-4 rounded-full animate-pulse ${darkMode ? 'bg-[#4a4440]' : 'bg-[#c5c0b1]'}`} />
                <div className={`h-4 flex-1 rounded-[4px] animate-pulse ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className={`rounded-[5px] border ${viewMode === 'list' ? `divide-y ${divider}` : `p-3 grid grid-cols-2 gap-3 ${cardBg}` } ${viewMode === 'list' ? cardBg : ''}`}>
            {isCreating && (
              <form onSubmit={submitNewTask} className={`flex flex-col gap-3 px-4 py-3 ${darkMode ? 'bg-[#2a2424]' : 'bg-[#fffefb]'} first:rounded-t-[5px]`}>
                <input
                  autoFocus
                  value={newTaskTitle}
                  onChange={event => setNewTaskTitle(event.target.value)}
                  placeholder="输入任务名称"
                  className={`w-full rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${
                    darkMode
                      ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]'
                      : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'
                  }`}
                />
                {createError && <div className="text-xs text-red-500">{createError}</div>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creating || !newTaskTitle.trim()}
                    className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold transition-colors hover:bg-[#e64700] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelNewTask}
                    className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      darkMode ? 'border-[#4a4440] text-[#939084] hover:bg-[#3a3434]' : 'border-[#c5c0b1] text-[#36342e] hover:bg-[#eceae3]'
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
                <div key={task.id} className={`flex items-center gap-4 px-4 py-3 transition-colors ${hoverBg} ${viewMode === 'grid' ? `rounded-[5px] border ${darkMode ? 'border-[#4a4440] bg-[#2a2424]' : 'border-[#c5c0b1] bg-[#fffefb]'}` : 'first:rounded-t-[5px] last:rounded-b-[5px]'}`}>
                  <button className="flex-shrink-0" onClick={() => toggleDone(task)}>
                    {task.status === 'done'
                      ? <CheckCircle2 size={17} className="text-[#ff4f00]" />
                      : <Circle size={17} className={subText} />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm ${task.status === 'done' ? `line-through ${subText}` : textH}`}>
                        {task.title}
                      </span>
                      {task.tags.map(tag => (
                        <span key={tag} className={`text-xs px-1.5 py-0.5 rounded-full ${darkMode ? 'bg-[#3a3434] text-[#939084]' : 'bg-[#eceae3] text-[#939084]'}`}>
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
                      className={`rounded-[5px] p-1.5 transition-colors ${darkMode ? 'text-[#7a756c] hover:bg-[#3a3434] hover:text-red-400' : 'text-[#939084] hover:bg-[#eceae3] hover:text-red-500'}`}
                      aria-label={`删除${task.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
            <div className={`px-4 py-3 last:rounded-b-[5px] ${hoverBg} transition-colors cursor-pointer`}>
              <button
                onClick={startNewTask}
                className={`flex items-center gap-2 text-sm ${subText} hover:text-[#ff4f00] transition-colors`}
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
