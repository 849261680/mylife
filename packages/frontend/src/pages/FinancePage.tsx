import { useEffect, useState, type FormEvent } from 'react'
import { Plus, TrendingDown, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { financeApi } from '../lib/api'
import { useApi } from '../lib/useApi'
import type { TransactionType } from '@mylife/shared'

interface PageProps { darkMode: boolean }

const CATEGORY_COLORS = ['bg-[#ff4f00]', 'bg-amber-500', 'bg-rose-400', 'bg-sky-400', 'bg-emerald-400', 'bg-violet-400']

export default function FinancePage({ darkMode }: PageProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [isCreating, setIsCreating] = useState(false)
  const [type, setType] = useState<TransactionType>('expense')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [createError, setCreateError] = useState<string | null>(null)

  const textH   = darkMode ? 'text-[#f0ebe3]'    : 'text-[#201515]'
  const subText = darkMode ? 'text-[#7a756c]' : 'text-[#939084]'
  const text    = darkMode ? 'text-[#c5c0b1]' : 'text-[#36342e]'
  const cardBg  = darkMode ? 'bg-[#2a2424] border-[#4a4440]' : 'bg-[#fffefb] border-[#c5c0b1]'
  const hoverBg = darkMode ? 'hover:bg-[#3a3434]' : 'hover:bg-[#eceae3]'
  const rowBg   = darkMode ? 'bg-[#1e1a1a]' : 'bg-[#eceae3]'

  const thisMonth = new Date().toISOString().slice(0, 7)
  const { data: summary, refetch: refetchSummary } = useApi(() => financeApi.summary(thisMonth))
  const { data: transactions, loading, refetch: refetchTransactions } = useApi(() => financeApi.transactions(thisMonth))

  useEffect(() => {
    const handleGlobalNew = () => startCreate('expense')
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [])

  const startCreate = (nextType: TransactionType) => {
    setType(nextType)
    setCategory(nextType === 'income' ? '工资' : '餐饮')
    setCreateError(null)
    setIsCreating(true)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const yuan = Number(amount)
    if (!Number.isFinite(yuan) || yuan <= 0 || !category.trim()) return

    try {
      setCreateError(null)
      await financeApi.create({
        type,
        amount: Math.round(yuan * 100),
        category: category.trim(),
        note: note.trim() || undefined,
        date,
      })
      setAmount('')
      setNote('')
      setIsCreating(false)
      refetchSummary()
      refetchTransactions()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '记账失败')
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`rounded-[5px] border p-5 ${cardBg}`}>
          <div className={`text-xs ${subText} mb-1`}>本月收入</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-emerald-600">
              +¥{summary ? (summary.income / 100).toLocaleString() : '—'}
            </div>
          </div>
        </div>
        <div className={`rounded-[5px] border p-5 ${cardBg}`}>
          <div className={`text-xs ${subText} mb-1`}>本月支出</div>
          <div className="flex items-end justify-between">
            <div className="text-2xl font-bold text-rose-600">
              -¥{summary ? (summary.expense / 100).toLocaleString() : '—'}
            </div>
            <div className={`flex items-center gap-1 text-xs ${subText}`}>
              <TrendingDown size={13} />
              {transactions?.length ?? 0} 笔
            </div>
          </div>
        </div>
        <div className={`rounded-[5px] border p-5 ${cardBg}`}>
          <div className={`text-xs ${subText} mb-1`}>本月结余</div>
          <div className="flex items-end justify-between">
            <div className={`text-2xl font-bold ${textH}`}>
              {summary ? `¥${(summary.balance / 100).toLocaleString()}` : '—'}
            </div>
            {summary && (
              <div className={`text-xs px-2 py-1 rounded-full ${summary.balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {summary.balance >= 0 ? '盈余' : '超支'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Budget breakdown */}
        <div className={`rounded-[5px] border p-5 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-sm font-semibold ${textH}`}>支出分类</h2>
          </div>
          {!summary || summary.by_category.length === 0 ? (
            <div className={`text-center py-8 text-sm ${subText}`}>暂无支出数据</div>
          ) : (
            <div className="space-y-4">
              {summary.by_category.slice(0, 5).map((cat, i) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm ${text}`}>{cat.category}</span>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${cat.over_budget ? 'text-rose-500' : textH}`}>
                        ¥{(cat.amount / 100).toLocaleString()}
                      </span>
                      {cat.budget && (
                        <span className={`text-xs ml-1 ${subText}`}>/ ¥{(cat.budget / 100).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`}>
                    <div
                      className={`h-full rounded-full ${cat.over_budget ? 'bg-rose-400' : CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                      style={{ width: `${Math.min(cat.pct_of_total * 2, 100)}%` }}
                    />
                  </div>
                  {cat.over_budget && cat.budget && (
                    <p className="text-xs text-rose-500 mt-1">
                      超出预算 ¥{((cat.amount - cat.budget) / 100).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Transactions */}
        <div className={`col-span-2 rounded-[5px] border ${cardBg}`}>
          <div className={`flex items-center justify-between px-5 py-4 border-b ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
            <h2 className={`text-sm font-semibold ${textH}`}>本月流水</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => startCreate('expense')}
                className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-[#fffefb] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
              >
                <Plus size={13} />支出
              </button>
              <button
                onClick={() => startCreate('income')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-[#fffefb] text-xs font-semibold px-3 py-1.5 rounded-[4px] transition-colors"
              >
                <Plus size={13} />收入
              </button>
            </div>
          </div>

          {isCreating && (
            <form onSubmit={handleCreate} className={`grid grid-cols-2 gap-3 px-5 py-4 border-b ${darkMode ? 'border-[#4a4440]' : 'border-[#c5c0b1]'}`}>
              <div className={`rounded-[5px] border px-3 py-2 text-sm ${type === 'income' ? 'text-emerald-600' : 'text-rose-600'} ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440]' : 'bg-[#eceae3] border-[#c5c0b1]'}`}>
                {type === 'income' ? '收入' : '支出'}
              </div>
              <input value={amount} onChange={event => setAmount(event.target.value)} inputMode="decimal" placeholder="金额（元）" className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'}`} />
              <input value={category} onChange={event => setCategory(event.target.value)} placeholder="分类" className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'}`} />
              <input type="date" value={date} onChange={event => setDate(event.target.value)} className={`rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515]'}`} />
              <input value={note} onChange={event => setNote(event.target.value)} placeholder="备注（可选）" className={`col-span-2 rounded-[5px] border px-3 py-2 text-sm outline-none focus:border-[#ff4f00] ${darkMode ? 'bg-[#1e1a1a] border-[#4a4440] text-[#f0ebe3] placeholder-[#7a756c]' : 'bg-[#fffdf9] border-[#c5c0b1] text-[#201515] placeholder-[#939084]'}`} />
              {createError && <div className="col-span-2 text-xs text-red-500">{createError}</div>}
              <div className="col-span-2 flex gap-2">
                <button type="submit" disabled={!amount || !category.trim()} className="rounded-[4px] bg-[#ff4f00] px-3 py-1.5 text-xs text-[#fffefb] font-semibold disabled:opacity-50">保存</button>
                <button type="button" onClick={() => setIsCreating(false)} className={`rounded-[4px] border px-3 py-1.5 text-xs font-semibold ${darkMode ? 'border-[#4a4440] text-[#939084]' : 'border-[#c5c0b1] text-[#36342e]'}`}>取消</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`h-12 rounded-[5px] animate-pulse ${darkMode ? 'bg-[#3a3434]' : 'bg-[#eceae3]'}`} />
              ))}
            </div>
          ) : (transactions?.length ?? 0) === 0 ? (
            <div className={`py-16 text-center text-sm ${subText}`}>
              <div className="text-4xl mb-3">💰</div>
              本月还没有记录，点击「支出」或「收入」开始吧
            </div>
          ) : (
            <div className={`divide-y ${darkMode ? 'divide-[#4a4440]' : 'divide-[#c5c0b1]'}`}>
              {(transactions ?? []).slice(0, 10).map(t => (
                <div key={t.id} className={`flex items-center gap-4 px-5 py-3 transition-colors ${hoverBg}`}>
                  <div className={`w-9 h-9 rounded-[5px] ${rowBg} flex items-center justify-center text-lg flex-shrink-0`}>
                    {t.type === 'income' ? '💰' : t.category === '餐饮' ? '🍽️' : t.category === '交通' ? '🚇' : t.category === '购物' ? '🛍️' : '💸'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${textH}`}>{t.note || t.category}</div>
                    <div className={`text-xs ${subText}`}>{t.category} · {t.date}</div>
                  </div>
                  <div className={`text-sm font-semibold flex items-center gap-1 ${
                    t.type === 'income' ? 'text-emerald-600' : t.type === 'expense' ? 'text-rose-600' : 'text-amber-500'
                  }`}>
                    {t.type === 'income' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                    {t.type === 'income' ? '+' : '-'}¥{Math.abs(t.amount / 100).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
