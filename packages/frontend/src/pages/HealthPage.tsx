import { useEffect, useState, type FormEvent } from 'react'
import { Plus, TrendingDown } from 'lucide-react'
import { healthApi } from '../lib/api'
import { useApi } from '../lib/useApi'

interface LineChartProps {
  data: { date: string; value: number }[]
  color: string
  min?: number
  max?: number
  height?: number
  darkMode: boolean
}

function LineChart({ data, color, min, max, height = 80, darkMode }: LineChartProps) {
  if (data.length < 2) return (
    <div className={`flex items-center justify-center text-xs ${darkMode ? 'text-gray-600' : 'text-gray-300'}`} style={{ height }}>
      暂无数据
    </div>
  )
  const vals = data.map(d => d.value)
  const minV = min ?? Math.min(...vals) - 0.5
  const maxV = max ?? Math.max(...vals) + 0.5
  const range = maxV - minV
  const w = 300, h = height
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w
    const y = h - ((v - minV) / range) * h
    return `${x},${y}`
  }).join(' ')
  const area = `0,${h} ` + pts + ` ${w},${h}`

  return (
    <svg width="100%" height={h + 24} viewBox={`0 0 ${w} ${h + 24}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = (i / (vals.length - 1)) * w
        const y = h - ((v - minV) / range) * h
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill={color} />
            <text x={x} y={h + 18} textAnchor="middle" fontSize="9" fill={darkMode ? '#6b7280' : '#9ca3af'}>
              {data[i].date.slice(5)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

interface PageProps { darkMode: boolean }
type RecordingType = 'weight' | 'sleep' | 'meal'
type MealType = 'breakfast' | 'lunch' | 'dinner'

export default function HealthPage({ darkMode }: PageProps) {
  const today = new Date().toISOString().slice(0, 10)
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null)
  const [mealType, setMealType] = useState<MealType | null>(null)
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState('')
  const [sleepHours, setSleepHours] = useState('')
  const [mealValue, setMealValue] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const textH   = darkMode ? 'text-white'    : 'text-gray-900'
  const subText = darkMode ? 'text-gray-500' : 'text-gray-400'
  const cardBg  = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100 shadow-sm'

  const thirtyDaysAgo = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)

  const { data: records, refetch: refetchRecords } = useApi(() => healthApi.list(thirtyDaysAgo, today))
  const { data: latestWeightRecord, refetch: refetchLatestWeight } = useApi(() => healthApi.latest('weight'))
  const { data: latestSleepRecord, refetch: refetchLatestSleep } = useApi(() => healthApi.latest('sleep'))

  const sorted = [...(records ?? [])].sort((a, b) => a.date.localeCompare(b.date))

  const weightData = sorted
    .filter(r => r.weight != null)
    .map(r => ({ date: r.date, value: r.weight! / 10 }))

  const sleepData = sorted
    .filter(r => r.sleep_minutes != null)
    .map(r => ({ date: r.date, value: r.sleep_minutes! / 60 }))

  const latestWeightValue = latestWeightRecord?.weight != null ? latestWeightRecord.weight / 10 : null
  const latestWeight = latestWeightValue != null ? latestWeightValue.toFixed(1) : null
  const latestSleepHours = latestSleepRecord?.sleep_minutes != null ? (latestSleepRecord.sleep_minutes / 60).toFixed(1) : null
  const mealRecords = [...(records ?? [])]
    .filter(r => r.breakfast || r.lunch || r.dinner)
    .sort((a, b) => b.date.localeCompare(a.date))
  const latestMealsRecord = mealRecords[0] ?? null
  const firstWeight = weightData[0]?.value
  const lastWeight = weightData[weightData.length - 1]?.value
  const weightDiff = firstWeight != null && lastWeight != null ? (lastWeight - firstWeight).toFixed(1) : null

  const TARGET_WEIGHT = 63
  const bmi = latestWeight ? (Number(latestWeight) / (1.72 * 1.72)).toFixed(1) : null

  useEffect(() => {
    const handleGlobalNew = () => setRecordingType('weight')
    window.addEventListener('mylife:new', handleGlobalNew)
    return () => window.removeEventListener('mylife:new', handleGlobalNew)
  }, [])

  const refetchHealth = () => {
    refetchRecords()
    refetchLatestWeight()
    refetchLatestSleep()
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextWeight = weight ? Math.round(Number(weight) * 10) : undefined
    const nextSleep = sleepHours ? Math.round(Number(sleepHours) * 60) : undefined
    const input =
      recordingType === 'weight'
        ? { date, weight: Number.isFinite(nextWeight) ? nextWeight : undefined }
        : recordingType === 'meal' && mealType
          ? {
              date,
              [mealType]: mealValue.trim() || null,
            }
        : { date, sleep_minutes: Number.isFinite(nextSleep) ? nextSleep : undefined }

    try {
      setCreateError(null)
      await healthApi.upsert(input)
      setWeight('')
      setSleepHours('')
      setMealValue('')
      setMealType(null)
      setRecordingType(null)
      refetchHealth()
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : '记录失败')
    }
  }

  const handleDeleteMetric = async (metric: 'weight' | 'sleep') => {
    const target = metric === 'weight' ? latestWeightRecord : latestSleepRecord
    if (!target) return
    if (!confirm(metric === 'weight' ? '确定删除最新体重记录吗？' : '确定删除最新睡眠记录吗？')) return

    try {
      setDeleteError(null)
      await healthApi.removeMetric(target.date, metric)
      refetchHealth()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败')
    }
  }

  const handleDeleteMeals = async () => {
    if (!latestMealsRecord) return
    if (!confirm(`确定清空 ${latestMealsRecord.date} 的三餐记录吗？`)) return

    try {
      setDeleteError(null)
      await healthApi.removeMetric(latestMealsRecord.date, 'meals')
      refetchHealth()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '删除失败')
    }
  }

  const startMealRecording = (type: MealType) => {
    const existingValue = latestMealsRecord?.date === date ? latestMealsRecord[type] ?? '' : ''
    setMealType(type)
    setMealValue(existingValue)
    setRecordingType('meal')
    setCreateError(null)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '当前体重', value: latestWeight ? `${latestWeight} kg` : '—', sub: latestWeightRecord?.date ?? '暂无体重记录', color: 'text-indigo-500', canDelete: Boolean(latestWeightRecord) },
          { label: '30天变化', value: weightDiff ? `${Number(weightDiff) > 0 ? '+' : ''}${weightDiff} kg` : '—', sub: weightData.length >= 2 ? '持续追踪中' : '数据不足', color: Number(weightDiff) <= 0 ? 'text-emerald-500' : 'text-rose-500' },
          { label: 'BMI', value: bmi ?? '—', sub: bmi ? (Number(bmi) < 18.5 ? '偏瘦' : Number(bmi) < 24 ? '正常' : '偏重') : '需要数据', color: 'text-emerald-500' },
          { label: '距目标', value: latestWeight ? `${(Number(latestWeight) - TARGET_WEIGHT).toFixed(1)} kg` : '—', sub: `目标 ${TARGET_WEIGHT} kg`, color: 'text-purple-500' },
        ].map(item => (
          <div key={item.label} className={`rounded-xl border p-4 ${cardBg}`}>
            <div className={`text-xs ${subText} mb-1`}>{item.label}</div>
            <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            <div className={`text-xs mt-1 ${subText}`}>{item.sub}</div>
            {item.canDelete && (
              <button
                onClick={() => handleDeleteMetric('weight')}
                className={`mt-3 text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
              >
                删除
              </button>
            )}
          </div>
        ))}
      </div>
      {deleteError && <div className="text-xs text-red-500">{deleteError}</div>}

      <div className="grid grid-cols-2 gap-5">
        {/* Weight chart */}
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className={`text-sm font-semibold ${textH}`}>体重记录</h2>
            <button onClick={() => { setRecordingType('weight'); setCreateError(null) }} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
              <Plus size={13} />记录
            </button>
          </div>
          {weightDiff && (
            <div className={`flex items-center gap-2 mb-4 text-xs ${subText}`}>
              <TrendingDown size={13} className="text-emerald-500" />
              <span>较30天前 {Number(weightDiff) > 0 ? '+' : ''}{weightDiff} kg</span>
            </div>
          )}
          <LineChart data={weightData} color="#6366f1" darkMode={darkMode} />
          <div className={`mt-4 pt-4 border-t grid grid-cols-3 gap-2 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            {[
              { label: '当前', value: latestWeight ? `${latestWeight} kg` : '—' },
              { label: '最低', value: weightData.length ? `${Math.min(...weightData.map(d => d.value)).toFixed(1)} kg` : '—' },
              { label: '最高', value: weightData.length ? `${Math.max(...weightData.map(d => d.value)).toFixed(1)} kg` : '—' },
            ].map(item => (
              <div key={item.label} className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className={`text-sm font-semibold ${textH}`}>{item.value}</div>
                <div className={`text-xs ${subText}`}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Sleep chart */}
        <div className={`rounded-xl border p-5 ${cardBg}`}>
          <div className="flex items-center justify-between mb-1">
            <h2 className={`text-sm font-semibold ${textH}`}>睡眠记录</h2>
            <div className="flex items-center gap-2">
              {latestSleepRecord && (
                <button
                  onClick={() => handleDeleteMetric('sleep')}
                  className={`text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                >
                  删除最新
                </button>
              )}
              <button onClick={() => { setRecordingType('sleep'); setCreateError(null) }} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                <Plus size={13} />记录
              </button>
            </div>
          </div>
          <div className={`mb-4 text-xs ${subText}`}>
            {sleepData.length > 0
              ? `近期均值 ${(sleepData.reduce((s, d) => s + d.value, 0) / sleepData.length).toFixed(1)} 小时${latestSleepRecord?.date ? ` · 最新 ${latestSleepRecord.date}` : ''}`
              : '暂无睡眠数据'
            }
          </div>
          <LineChart data={sleepData} color="#8b5cf6" min={4} max={10} darkMode={darkMode} />
          <div className={`mt-4 pt-4 border-t grid grid-cols-3 gap-2 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
            {[
              { label: '最近', value: latestSleepHours ? `${latestSleepHours} h` : '—' },
              { label: '最少', value: sleepData.length ? `${Math.min(...sleepData.map(d => d.value)).toFixed(1)} h` : '—' },
              { label: '最多', value: sleepData.length ? `${Math.max(...sleepData.map(d => d.value)).toFixed(1)} h` : '—' },
            ].map(item => (
              <div key={item.label} className={`text-center p-2 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <div className={`text-sm font-semibold ${textH}`}>{item.value}</div>
                <div className={`text-xs ${subText}`}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-xl border p-5 ${cardBg}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className={`text-sm font-semibold ${textH}`}>一日三餐</h2>
            <div className={`text-xs mt-1 ${subText}`}>
              {latestMealsRecord ? `最近记录 ${latestMealsRecord.date}` : '还没有三餐记录'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {latestMealsRecord && (
              <button
                onClick={handleDeleteMeals}
                className={`text-xs transition-colors ${darkMode ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
              >
                清空最新
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { key: 'breakfast', label: '早餐' },
            { key: 'lunch', label: '午餐' },
            { key: 'dinner', label: '晚餐' },
          ].map((meal) => (
            <button
              key={meal.key}
              onClick={() => startMealRecording(meal.key as MealType)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus size={13} />{meal.label}
            </button>
          ))}
        </div>
        {mealRecords.length === 0 ? (
          <div className={`text-sm ${subText}`}>今天吃了什么、哪一顿没吃、或者简单备注菜品，都可以记在这里。</div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div className={`rounded-xl p-4 ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
              <div className={`text-xs mb-3 ${subText}`}>最新一天</div>
              <div className={`text-xs mb-3 ${subText}`}>{latestMealsRecord?.date}</div>
              <div className="space-y-3">
                {[
                  { label: '早餐', value: latestMealsRecord?.breakfast },
                  { label: '午餐', value: latestMealsRecord?.lunch },
                  { label: '晚餐', value: latestMealsRecord?.dinner },
                ].map((meal) => (
                  <div key={meal.label}>
                    <div className={`text-xs ${subText}`}>{meal.label}</div>
                    <div className={`text-sm mt-1 ${textH}`}>{meal.value || '未记录'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {mealRecords.slice(0, 5).map((record) => (
                <div key={record.date} className={`rounded-xl border p-4 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
                  <div className={`text-xs mb-2 ${subText}`}>{record.date}</div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '早餐', value: record.breakfast },
                      { label: '午餐', value: record.lunch },
                      { label: '晚餐', value: record.dinner },
                    ].map((meal) => (
                      <div key={meal.label}>
                        <div className={`text-xs ${subText}`}>{meal.label}</div>
                        <div className={`text-sm mt-1 ${textH}`}>{meal.value || '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {recordingType && (
        <form onSubmit={handleCreate} className={`rounded-xl border p-5 ${cardBg}`}>
          <h2 className={`text-sm font-semibold ${textH} mb-4`}>
            {recordingType === 'weight' ? '记录体重' : recordingType === 'sleep' ? '记录睡眠' : `记录${mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : '晚餐'}`}
          </h2>
          <div className={`grid gap-3 ${recordingType === 'meal' ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <input type="date" value={date} onChange={event => setDate(event.target.value)} className={`rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
            {recordingType === 'weight' ? (
              <input autoFocus value={weight} onChange={event => setWeight(event.target.value)} inputMode="decimal" placeholder="体重 kg" className={`rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            ) : recordingType === 'meal' ? (
              <input
                autoFocus
                value={mealValue}
                onChange={event => setMealValue(event.target.value)}
                placeholder={`${mealType === 'breakfast' ? '早餐' : mealType === 'lunch' ? '午餐' : '晚餐'}吃了什么`}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`}
              />
            ) : (
              <input autoFocus value={sleepHours} onChange={event => setSleepHours(event.target.value)} inputMode="decimal" placeholder="睡眠小时" className={`rounded-lg border px-3 py-2 text-sm outline-none ${darkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'}`} />
            )}
          </div>
          {createError && <div className="mt-3 text-xs text-red-500">{createError}</div>}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={
                recordingType === 'weight'
                  ? !weight.trim()
                  : recordingType === 'sleep'
                    ? !sleepHours.trim()
                    : !mealValue.trim()
              }
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white disabled:opacity-50"
            >
              保存
            </button>
            <button type="button" onClick={() => { setRecordingType(null); setMealType(null); setMealValue('') }} className={`rounded-lg border px-3 py-1.5 text-xs ${darkMode ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-500'}`}>取消</button>
          </div>
        </form>
      )}

    </div>
  )
}
