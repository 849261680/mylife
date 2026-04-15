import { promises as fs } from 'node:fs'
import path from 'node:path'
import { nanoid } from 'nanoid'
import type {
  CalendarEvent,
  Goal,
  Habit,
  HealthRecord,
  Notebook,
  NoteIndex,
  Task,
  Transaction,
} from '@mylife/shared'
import db from '../../db/client'

export const NOTES_DIR = path.resolve(process.cwd(), '../../data/notes')

export type JsonSchema = Record<string, unknown>

export interface AgentToolContext {
  sessionId: string
  traceId: string
}

export interface AgentToolDefinition {
  name: string
  description: string
  parameters: JsonSchema
  execute: (args: Record<string, unknown>, context: AgentToolContext) => Promise<unknown> | unknown
}

export type RawTask = Omit<Task, 'tags'> & { tags: string }
export type RawNoteIndex = Omit<NoteIndex, 'tags' | 'pinned'> & { tags: string; pinned: number | boolean }
export type RawHabit = Omit<Habit, 'custom_days' | 'archived'> & { custom_days: string | null; archived: number | boolean }

export function parseTask(row: RawTask): Task {
  return {
    ...row,
    priority: row.priority === 'high' ? 'high' : 'low',
    tags: JSON.parse(row.tags) as string[],
  }
}

export function parseNoteIndex(row: RawNoteIndex): NoteIndex {
  return {
    ...row,
    tags: JSON.parse(row.tags) as string[],
    pinned: Boolean(row.pinned),
  }
}

export function parseHabit(row: RawHabit): Habit {
  return {
    ...row,
    custom_days: row.custom_days ? JSON.parse(row.custom_days) as number[] : null,
    archived: Boolean(row.archived),
  }
}

export function getToday() {
  return new Date().toISOString().slice(0, 10)
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
}

export function centsToYuan(amount: number) {
  return Math.round(amount) / 100
}

export function toAgentTransaction(transaction: Transaction) {
  return {
    ...transaction,
    amount: centsToYuan(transaction.amount),
    amount_cents: transaction.amount,
  }
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

export async function ensureAgentNotebook() {
  const existing = db.prepare(`SELECT * FROM notebooks WHERE name = ?`).get('Agent') as Notebook | undefined
  if (existing) return existing

  const notebook: Notebook = {
    id: nanoid(),
    name: 'Agent',
    color: 'bg-emerald-500',
    created_at: new Date().toISOString(),
  }

  db.prepare(`
    INSERT INTO notebooks (id, name, color, created_at)
    VALUES (?, ?, ?, ?)
  `).run(notebook.id, notebook.name, notebook.color, notebook.created_at)

  await ensureDir(path.join(NOTES_DIR, notebook.id))
  return notebook
}

export async function buildDashboardContext() {
  const today = getToday()
  const month = getCurrentMonth()

  const tasks = (db.prepare(`
    SELECT * FROM tasks
    WHERE due_date = ?
    ORDER BY COALESCE(due_time, '23:59') ASC, created_at DESC
    LIMIT 10
  `).all(today) as RawTask[]).map(parseTask)

  const goals = db.prepare(`
    SELECT * FROM goals
    WHERE status = 'active'
    ORDER BY COALESCE(target_date, '9999-12-31') ASC, created_at DESC
    LIMIT 10
  `).all() as Goal[]

  const habits = (db.prepare(`
    SELECT * FROM habits
    WHERE archived = 0
    ORDER BY created_at DESC
    LIMIT 10
  `).all() as RawHabit[]).map(parseHabit)

  const events = db.prepare(`
    SELECT * FROM events
    WHERE date(start_time) BETWEEN ? AND ?
    ORDER BY start_time ASC
    LIMIT 10
  `).all(today, today) as CalendarEvent[]

  const recentNotes = (db.prepare(`
    SELECT * FROM note_index
    ORDER BY updated_at DESC
    LIMIT 5
  `).all() as RawNoteIndex[]).map(parseNoteIndex)

  const latestHealth = db.prepare(`
    SELECT * FROM health_records
    ORDER BY date DESC
    LIMIT 1
  `).get() as HealthRecord | undefined

  const financeSummaryRows = db.prepare(`
    SELECT type, SUM(amount) as total
    FROM transactions
    WHERE date LIKE ?
    GROUP BY type
  `).all(`${month}%`) as { type: string; total: number }[]

  const income = financeSummaryRows.find((row) => row.type === 'income')?.total ?? 0
  const expense = financeSummaryRows.find((row) => row.type === 'expense')?.total ?? 0

  return {
    today,
    month,
    tasks,
    goals,
    habits,
    events,
    recent_notes: recentNotes,
    latest_health: latestHealth ?? null,
    finance_summary: {
      month,
      income: centsToYuan(income),
      expense: centsToYuan(expense),
      balance: centsToYuan(income - expense),
      income_cents: income,
      expense_cents: expense,
      balance_cents: income - expense,
    },
  }
}
