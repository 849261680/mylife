export interface HealthRecord {
  id: string
  date: string            // YYYY-MM-DD，唯一键
  weight?: number         // 0.1kg 单位：668 = 66.8kg
  sleep_start?: string    // HH:MM
  sleep_end?: string      // HH:MM
  sleep_minutes?: number  // 计算值，存冗余方便查询
  breakfast?: string | null
  lunch?: string | null
  dinner?: string | null
  steps?: number
  water_ml?: number
  calories?: number
  notes?: string
  updated_at: string
}

// upsert 输入（date 存在则更新，不存在则创建）
export type UpsertHealthInput = Omit<HealthRecord, 'id' | 'updated_at'>

// 前端展示用
export interface WeightDataPoint {
  date: string
  weight: number
}

export interface HealthSummary {
  latest_weight?: number
  weight_change_7d?: number   // 正数=增重，负数=减重
  avg_sleep_7d?: number       // 分钟
  avg_steps_7d?: number
  bmi?: number                // 需要身高，存在 user settings
}
