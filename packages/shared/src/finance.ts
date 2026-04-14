export type TransactionType = 'income' | 'expense' | 'transfer'
export type DataSource = 'user' | 'agent'

export interface Transaction {
  id: string
  type: TransactionType
  amount: number          // 分为单位：2800 = ¥28.00
  category: string
  note?: string
  date: string            // YYYY-MM-DD
  source: DataSource
  created_at: string
}

export interface Budget {
  id: string
  category: string
  amount: number          // 分为单位
  month: string           // YYYY-MM
}

// 前端展示用
export interface CategorySummary {
  category: string
  amount: number
  budget: number | null
  pct_of_total: number
  over_budget: boolean
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  balance: number
  by_category: CategorySummary[]
}

export type CreateTransactionInput = Omit<Transaction, 'id' | 'created_at' | 'source'>
