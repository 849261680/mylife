import { useEffect, useState, type FormEvent } from 'react'
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react'
import type { Goal } from '@mylife/shared'
import { goalsApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface PageProps {
  darkMode: boolean
}

export default function GoalsPage({ darkMode }: PageProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [goalType, setGoalType] = useState<Goal['goal_type']>('long')
  const [error, setError] = useState<string | null>(null)

  const textH = darkMode ? 'text-[#f0ebe3]' : 'text-[#201515]'
  const subText = darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
  const cardBg = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const inputBg = darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#c5c0b1] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'
  const hoverBg = darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'

  const { data: goals, loading, refetch } = useApi(() => goalsApi.list())
  const longGoals = (goals ?? []).filter(goal => goal.goal_type === 'long')
  const shortGoals = (goals ?? []).filter(goal => goal.goal_type === 'short')

  useEffect(() => {
    const handleGlobalNew = () => setIsCreating(true)
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [])

  const startCreate = (type: Goal['goal_type']) => {
    setGoalType(type)
    setIsCreating(true)
    setError(null)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) return

    try {
      setError(null)
      await goalsApi.create({
        title: nextTitle,
        description: description.trim() || null,
        goal_type: goalType,
        target_date: targetDate || null,
      })
      setTitle('')
      setDescription('')
      setTargetDate('')
      setGoalType('long')
      setIsCreating(false)
      refetch()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '添加长期目标失败')
    }
  }

  const toggleDone = async (goal: Goal) => {
    await goalsApi.update(goal.id, { status: goal.status === 'done' ? 'active' : 'done' })
    refetch()
  }

  const removeGoal = async (goal: Goal) => {
    if (!confirm(`确定删除「${goal.title}」吗？`)) return
    await goalsApi.remove(goal.id)
    refetch()
  }

  const renderGoalList = (items: Goal[], emptyText: string) => {
    if (loading) {
      return (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className={`h-14 rounded-[5px] animate-pulse ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`} />)}
        </div>
      )
    }

    if (items.length === 0) {
      return <div className={`py-10 text-center text-sm ${subText}`}>{emptyText}</div>
    }

    return (
      <div className={`divide-y rounded-[5px] border ${darkMode ? 'divide-[#4a4440] border-[#4a4440]' : 'divide-[#c5c0b1] border-[#c5c0b1]'}`}>
        {items.map(goal => (
          <div key={goal.id} className={`flex items-center gap-3 px-4 py-4 transition-colors ${hoverBg}`}>
            <button onClick={() => toggleDone(goal)} className="flex-shrink-0">
              {goal.status === 'done'
                ? <CheckCircle2 size={18} className="text-[#ff4f00]" />
                : <Circle size={18} className={subText} />
              }
            </button>
            <div className="min-w-0 flex-1">
              <div className={`text-sm font-medium ${goal.status === 'done' ? `line-through ${subText}` : textH}`}>{goal.title}</div>
              <div className={`mt-1 text-xs ${subText}`}>
                {goal.target_date ? `目标日期 ${goal.target_date}` : '未设置目标日期'}
                {goal.description ? ` · ${goal.description}` : ''}
              </div>
            </div>
            <button onClick={() => removeGoal(goal)} className={`rounded-[5px] p-2 transition-colors ${darkMode ? 'text-[#7a756c] hover:bg-[#3a3434] hover:text-red-400' : 'text-[#939084] hover:bg-[#eceae3] hover:text-red-500'}`}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className={`flex items-center justify-between rounded-[5px] border px-5 py-4 ${cardBg}`}>
        <h2 className={`text-sm font-semibold ${textH}`}>目标</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startCreate('long')}
            className="flex items-center gap-1.5 bg-[#ff4f00] hover:bg-[#e64700] text-[#fffefb] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
          >
            <Plus size={13} />添加长期目标
          </button>
          <button
            onClick={() => startCreate('short')}
            className={`flex items-center gap-1.5 rounded-[4px] border px-3 py-1.5 text-xs font-semibold transition-colors ${
              darkMode
                ? 'border-[#4a4440] text-[#c5c0b1] hover:bg-[#3a3434]'
                : 'border-[#c5c0b1] text-[#36342e] hover:bg-[#eceae3]'
            }`}
          >
            <Plus size={13} />添加短期目标
          </button>
        </div>
      </div>

      {isCreating && (
        <form onSubmit={handleCreate} className={`grid grid-cols-2 gap-3 rounded-[5px] border p-5 ${cardBg}`}>
          <div className={`col-span-2 flex rounded-[5px] border overflow-hidden ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
            {([
              ['long', '长期目标'],
              ['short', '短期目标'],
            ] as [Goal['goal_type'], string][]).map(([type, label]) => (
              <button
                key={type}
                type="button"
                onClick={() => setGoalType(type)}
                className={`flex-1 px-3 py-2 text-xs transition-colors ${
                  goalType === type
                    ? 'bg-[#ff4f00] text-[#fffefb]'
                    : darkMode ? 'text-[#939084] hover:bg-[#3a3434]' : 'text-[#36342e] hover:bg-[#eceae3]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            autoFocus
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="目标名称"
            className={`col-span-2 rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
          />
          <input
            type="date"
            value={targetDate}
            onChange={event => setTargetDate(event.target.value)}
            className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
          />
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="备注（可选）"
            className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${inputBg}`}
          />
          {error && <div className="col-span-2 text-xs text-red-500">{error}</div>}
          <div className="col-span-2 flex gap-2">
            <button type="submit" disabled={!title.trim()} className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold disabled:opacity-50">保存</button>
            <button type="button" onClick={() => setIsCreating(false)} className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
          </div>
        </form>
      )}

      <section className={`rounded-[5px] border p-5 ${cardBg}`}>
        <h3 className={`mb-3 text-sm font-semibold ${textH}`}>长期目标</h3>
        {renderGoalList(longGoals, '还没有长期目标')}
      </section>

      <section className={`rounded-[5px] border p-5 ${cardBg}`}>
        <h3 className={`mb-3 text-sm font-semibold ${textH}`}>短期目标</h3>
        {renderGoalList(shortGoals, '还没有短期目标')}
      </section>
    </div>
  )
}
