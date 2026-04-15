import { useState, useEffect, useRef } from 'react'
import { Plus, Search, FolderOpen, Trash2 } from 'lucide-react'
import type { Notebook, NoteIndex, Note } from '@mylife/shared'
import { notesApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface PageProps {
  darkMode: boolean
  globalSearch?: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function NotesPage({ darkMode, globalSearch = '' }: PageProps) {
  const [activeNotebook, setActiveNotebook] = useState<string>('all')
  const [activeNote, setActiveNote] = useState<Note | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [notebookError, setNotebookError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const textH = darkMode ? 'text-white' : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const text = darkMode ? 'text-gray-300' : 'text-gray-600'
  const cardBg = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'
  const hoverBg = darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-50'
  const activeBg = darkMode ? 'bg-gray-800 text-white' : 'bg-indigo-50 text-indigo-600'
  const inputBg = darkMode ? 'bg-gray-800 border-gray-700 text-gray-300 placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-700 placeholder-gray-400'

  const { data: nbData, refetch: refetchNbs } = useApi(() => notesApi.notebooks())
  const { data: noteList, refetch: refetchNotes } = useApi(
    () => notesApi.list(searchQ
      ? { q: searchQ }
      : activeNotebook === 'all' ? {} : { notebook_id: activeNotebook }
    ),
    [activeNotebook, searchQ]
  )

  const notebooks: (Notebook & { count: number })[] = nbData?.notebooks ?? []
  const total = nbData?.total ?? 0

  const openNote = async (idx: NoteIndex) => {
    const full = await notesApi.get(idx.id)
    setActiveNote(full)
    setEditTitle(full.title)
    setEditContent(full.content)
  }

  // Auto-save on edit with 800ms debounce
  useEffect(() => {
    if (!activeNote) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await notesApi.update(activeNote.id, { title: editTitle, content: editContent })
      refetchNotes()
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [editTitle, editContent])

  const handleNewNote = async () => {
    const nb = activeNotebook !== 'all' ? activeNotebook : notebooks[0]?.id
    if (!nb) {
      // Need to create a default notebook first
      const newNb = await notesApi.createNotebook('我的笔记', 'bg-indigo-500')
      const note = await notesApi.create({ notebook_id: newNb.id, title: '新建笔记', content: '' })
      setActiveNotebook(newNb.id)
      void openNote(note)
      refetchNbs()
      refetchNotes()
      return
    }
    const note = await notesApi.create({ notebook_id: nb, title: '新建笔记', content: '' })
    refetchNotes()
    openNote(note)
  }

  const handleCreateNotebook = async () => {
    const name = newNotebookName.trim()
    if (!name) return

    try {
      setNotebookError(null)
      const notebook = await notesApi.createNotebook(name, 'bg-indigo-500')
      setNewNotebookName('')
      setIsCreatingNotebook(false)
      setActiveNotebook(notebook.id)
      refetchNbs()
      refetchNotes()
    } catch (error) {
      setNotebookError(error instanceof Error ? error.message : '新建笔记本失败')
    }
  }

  const handleDeleteNotebook = async (notebook: Notebook & { count: number }) => {
    const message = notebook.count > 0
      ? `删除「${notebook.name}」会同时删除里面的 ${notebook.count} 篇笔记。确定删除吗？`
      : `确定删除「${notebook.name}」吗？`
    if (!confirm(message)) return

    try {
      setNotebookError(null)
      await notesApi.removeNotebook(notebook.id)
      if (activeNotebook === notebook.id) {
        setActiveNotebook('all')
        setActiveNote(null)
      }
      refetchNbs()
      refetchNotes()
    } catch (error) {
      setNotebookError(error instanceof Error ? error.message : '删除笔记本失败')
    }
  }

  useEffect(() => {
    if (globalSearch) setSearchQ(globalSearch)
  }, [globalSearch])

  useEffect(() => {
    const handleGlobalNew = () => { void handleNewNote() }
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [activeNotebook, notebooks])

  return (
    <div className="flex gap-4 max-w-6xl mx-auto h-[calc(100vh-9rem)]">
      {/* Notebook list */}
      <div className={`w-40 flex-shrink-0 rounded-xl border p-3 h-fit ${cardBg}`}>
        <div className={`text-xs font-semibold ${subText} px-2 mb-2 uppercase tracking-wide`}>笔记本</div>
        <div className="space-y-0.5">
          <button
            onClick={() => setActiveNotebook('all')}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
              activeNotebook === 'all' ? activeBg : `${text} ${hoverBg}`
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderOpen size={12} />
              <span className="truncate">所有笔记</span>
            </div>
            <span className={`text-xs ${activeNotebook === 'all' ? 'opacity-70' : subText}`}>{total}</span>
          </button>

          {notebooks.map(nb => (
            <button
              key={nb.id}
              onClick={() => setActiveNotebook(nb.id)}
              className={`group w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-sm transition-colors ${
                activeNotebook === nb.id ? activeBg : `${text} ${hoverBg}`
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2 h-2 rounded-full ${nb.color}`} />
                <span className="truncate">{nb.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className={`text-xs ${activeNotebook === nb.id ? 'opacity-70' : subText}`}>{nb.count}</span>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDeleteNotebook(nb)
                  }}
                  className={`rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 ${darkMode ? 'hover:bg-gray-700 hover:text-red-400' : 'hover:bg-white hover:text-red-500'}`}
                  aria-label={`删除${nb.name}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </button>
          ))}
        </div>
        <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          {isCreatingNotebook ? (
            <div className="space-y-2">
              <input
                autoFocus
                value={newNotebookName}
                onChange={event => setNewNotebookName(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') void handleCreateNotebook()
                  if (event.key === 'Escape') setIsCreatingNotebook(false)
                }}
                placeholder="笔记本名称"
                className={`w-full rounded-lg border px-2 py-1.5 text-xs outline-none ${inputBg}`}
              />
              {notebookError && <div className="text-xs text-red-500">{notebookError}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={handleCreateNotebook} className="rounded-lg bg-indigo-600 px-2 py-1 text-xs text-white">保存</button>
                <button type="button" onClick={() => setIsCreatingNotebook(false)} className={`rounded-lg border px-2 py-1 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>取消</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setIsCreatingNotebook(true); setNotebookError(null) }}
              className={`w-full flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs text-indigo-500 transition-colors ${darkMode ? 'hover:bg-indigo-900/20' : 'hover:bg-indigo-50'}`}
            >
              <Plus size={12} /><span>新建笔记本</span>
            </button>
          )}
        </div>
      </div>

      {/* Notes list */}
      <div className={`w-64 flex-shrink-0 rounded-xl border flex flex-col ${cardBg}`}>
        <div className={`p-3 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
          <div className="relative mb-2">
            <Search size={12} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
            <input
              type="text"
              placeholder="搜索笔记..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className={`w-full pl-7 pr-2 py-1.5 text-xs rounded-lg border outline-none ${inputBg}`}
            />
          </div>
          <button
            onClick={handleNewNote}
            className="w-full flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors justify-center"
          >
            <Plus size={12} />新建笔记
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {(noteList ?? []).length === 0 ? (
            <div className={`py-12 text-center text-xs ${subText}`}>
              <div className="text-3xl mb-2">📝</div>
              {searchQ ? '没有匹配的笔记' : '还没有笔记'}
            </div>
          ) : (noteList ?? []).map(note => (
            <button
              key={note.id}
              onClick={() => openNote(note)}
              className={`w-full text-left p-3 border-b transition-colors ${darkMode ? 'border-gray-800' : 'border-gray-50'} ${
                activeNote?.id === note.id
                  ? darkMode ? 'bg-gray-800' : 'bg-indigo-50'
                  : hoverBg
              }`}
            >
              <div className="flex items-start justify-between gap-1 mb-1">
                <span className={`text-xs font-medium truncate ${textH}`}>
                  {note.pinned && '📌 '}{note.title}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex gap-1">
                  {note.tags.slice(0, 2).map(tag => (
                    <span key={tag} className={`text-xs px-1 py-0.5 rounded ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      {tag}
                    </span>
                  ))}
                </div>
                <span className={`text-xs ${subText}`}>{timeAgo(note.updated_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note editor */}
      {activeNote ? (
        <div className={`flex-1 rounded-xl border flex flex-col ${cardBg}`}>
          <div className={`flex items-center justify-between px-6 py-4 border-b ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className={`text-lg font-semibold bg-transparent border-none outline-none ${textH} w-full`}
            />
            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
              <span className={`text-xs ${subText}`}>{timeAgo(activeNote.updated_at)}</span>
            </div>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder="开始写点什么..."
              className={`w-full h-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed ${text} placeholder-gray-400`}
            />
          </div>
        </div>
      ) : (
        <div className={`flex-1 rounded-xl border flex items-center justify-center ${cardBg}`}>
          <div className={`text-center ${subText}`}>
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">选择一篇笔记开始编辑</p>
          </div>
        </div>
      )}
    </div>
  )
}
