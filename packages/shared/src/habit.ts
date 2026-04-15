export type HabitFrequency = 'daily' | 'weekdays' | 'weekends' | 'custom'

export interface Habit {
  id: string
  name: string
  icon: string            // emoji
  color: string
  frequency: HabitFrequency
  custom_days: number[] | null  // [1,2,3,4,5] = 周一到周五
  target_per_month: number
  archived: boolean
  created_at: string
}

export interface HabitLog {
  id: string
  habit_id: string
  date: string            // YYYY-MM-DD
  done: boolean
  note?: string
  created_at: string
}

export interface HabitHeatmapCell {
  date: string
  done: boolean
}

// 前端展示用的聚合类型
export interface HabitWithStats extends Habit {
  streak: number          // 当前连续打卡天数
  total_this_month: number
  week_data: boolean[]    // 本周7天打卡情况
  today_done: boolean
  heatmap: HabitHeatmapCell[]
}

export type CreateHabitInput = Omit<Habit, 'id' | 'archived' | 'created_at'>
