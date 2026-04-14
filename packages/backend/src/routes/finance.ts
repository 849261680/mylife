import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import db from '../db/client'
import type { Transaction, MonthlySummary } from '@mylife/shared'

const app = new Hono()

const createSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number().int().positive(),   // 分为单位
  category: z.string().min(1),
  note: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

// GET /finance/transactions?month=YYYY-MM
app.get('/transactions', (c) => {
  const { month } = c.req.query()
  let sql = 'SELECT * FROM transactions'
  const params: string[] = []
  if (month) {
    sql += ' WHERE date LIKE ?'
    params.push(`${month}%`)
  }
  sql += ' ORDER BY date DESC, created_at DESC'
  return c.json(db.prepare(sql).all(...params))
})

// POST /finance/transactions
app.post('/transactions', zValidator('json', createSchema), (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const t: Transaction = { id: nanoid(), ...input, source: 'user', created_at: now }
  db.prepare(`
    INSERT INTO transactions (id, type, amount, category, note, date, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(t.id, t.type, t.amount, t.category, t.note ?? null, t.date, t.source, t.created_at)
  return c.json(t, 201)
})

// GET /finance/summary?month=YYYY-MM
app.get('/summary', (c) => {
  const month = c.req.query('month') ?? new Date().toISOString().slice(0, 7)

  const rows = db.prepare(`
    SELECT type, category, SUM(amount) as total
    FROM transactions WHERE date LIKE ?
    GROUP BY type, category
  `).all(`${month}%`) as { type: string; category: string; total: number }[]

  const income = rows.filter(r => r.type === 'income').reduce((s, r) => s + r.total, 0)
  const expense = rows.filter(r => r.type === 'expense').reduce((s, r) => s + r.total, 0)

  const budgets = db.prepare('SELECT category, amount FROM budgets WHERE month = ?').all(month) as { category: string; amount: number }[]
  const budgetMap = new Map(budgets.map(b => [b.category, b.amount]))

  const by_category = rows
    .filter(r => r.type === 'expense')
    .map(r => ({
      category: r.category,
      amount: r.total,
      budget: budgetMap.get(r.category) ?? null,
      pct_of_total: expense > 0 ? Math.round((r.total / expense) * 100) : 0,
      over_budget: budgetMap.has(r.category) ? r.total > budgetMap.get(r.category)! : false,
    }))

  const summary: MonthlySummary = { month, income, expense, balance: income - expense, by_category }
  return c.json(summary)
})

export default app
