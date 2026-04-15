import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { CalendarEvent, HabitLog, HealthRecord, Note, Transaction } from '@mylife/shared'
import db from '../../db/client'
import {
  AgentToolDefinition,
  NOTES_DIR,
  RawHabit,
  RawNoteIndex,
  RawTask,
  buildDashboardContext,
  toAgentTransaction,
  getCurrentMonth,
  getToday,
  parseHabit,
  parseNoteIndex,
  parseTask,
} from './common'

export const readTools: AgentToolDefinition[] = [
  {
    name: 'get_dashboard_context',
    description: 'Read a compact overview of the user’s current tasks, goals, habits, events, notes, health, and finance.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    execute: () => buildDashboardContext(),
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by status or project.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        project_id: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ status, project_id, limit }) => {
      let sql = 'SELECT * FROM tasks WHERE 1=1'
      const params: unknown[] = []
      if (typeof status === 'string' && status) {
        sql += ' AND status = ?'
        params.push(status)
      }
      if (typeof project_id === 'string' && project_id) {
        sql += ' AND project_id = ?'
        params.push(project_id)
      }
      sql += ' ORDER BY COALESCE(due_date, "9999-12-31") ASC, created_at DESC'
      sql += ` LIMIT ${typeof limit === 'number' ? Math.max(1, Math.min(limit, 50)) : 20}`
      return (db.prepare(sql).all(...params) as RawTask[]).map(parseTask)
    },
  },
  {
    name: 'list_goals',
    description: 'List goals, optionally filtered by status or type.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        goal_type: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ status, goal_type, limit }) => {
      let sql = 'SELECT * FROM goals WHERE 1=1'
      const params: unknown[] = []
      if (typeof status === 'string' && status) {
        sql += ' AND status = ?'
        params.push(status)
      }
      if (typeof goal_type === 'string' && goal_type) {
        sql += ' AND goal_type = ?'
        params.push(goal_type)
      }
      sql += ' ORDER BY COALESCE(target_date, "9999-12-31") ASC, created_at DESC'
      sql += ` LIMIT ${typeof limit === 'number' ? Math.max(1, Math.min(limit, 50)) : 20}`
      return db.prepare(sql).all(...params)
    },
  },
  {
    name: 'list_habits',
    description: 'List all active habits and the user’s recent log status.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    execute: () => {
      const habits = (db.prepare(`SELECT * FROM habits WHERE archived = 0 ORDER BY created_at DESC`).all() as RawHabit[]).map(parseHabit)
      const today = getToday()
      return habits.map((habit) => {
        const recentLogs = db.prepare(`
          SELECT date, done
          FROM habit_logs
          WHERE habit_id = ? AND date >= ?
          ORDER BY date DESC
          LIMIT 14
        `).all(habit.id, new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10)) as Pick<HabitLog, 'date' | 'done'>[]

        const todayDone = recentLogs.find((log) => log.date === today)?.done ?? false
        return {
          ...habit,
          recent_logs: recentLogs.map((log) => ({ ...log, done: Boolean(log.done) })),
          today_done: Boolean(todayDone),
        }
      })
    },
  },
  {
    name: 'list_events',
    description: 'List events within a date range.',
    parameters: {
      type: 'object',
      properties: {
        start: { type: 'string' },
        end: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ start, end, limit }) => {
      const today = getToday()
      const startDate = typeof start === 'string' && start ? start : today
      const endDate = typeof end === 'string' && end ? end : today
      const rows = db.prepare(`
        SELECT * FROM events
        WHERE date(start_time) BETWEEN ? AND ?
        ORDER BY start_time ASC
        LIMIT ?
      `).all(startDate, endDate, typeof limit === 'number' ? Math.max(1, Math.min(limit, 50)) : 20) as (Omit<CalendarEvent, 'is_all_day'> & { is_all_day: number })[]

      return rows.map((row) => ({ ...row, is_all_day: Boolean(row.is_all_day) }))
    },
  },
  {
    name: 'list_transactions',
    description: 'List transactions for a month. Amounts in the response are in yuan; amount_cents is included for raw storage value.',
    parameters: {
      type: 'object',
      properties: {
        month: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ month, limit }) => {
      const targetMonth = typeof month === 'string' && month ? month : getCurrentMonth()
      const rows = db.prepare(`
        SELECT * FROM transactions
        WHERE date LIKE ?
        ORDER BY date DESC, created_at DESC
        LIMIT ?
      `).all(`${targetMonth}%`, typeof limit === 'number' ? Math.max(1, Math.min(limit, 100)) : 30) as Transaction[]
      return rows.map(toAgentTransaction)
    },
  },
  {
    name: 'list_health_records',
    description: 'List health records within a date range.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ from, to, limit }) => {
      let sql = 'SELECT * FROM health_records'
      const params: unknown[] = []
      if (typeof from === 'string' && typeof to === 'string' && from && to) {
        sql += ' WHERE date BETWEEN ? AND ?'
        params.push(from, to)
      }
      sql += ' ORDER BY date DESC'
      sql += ` LIMIT ${typeof limit === 'number' ? Math.max(1, Math.min(limit, 100)) : 30}`
      return db.prepare(sql).all(...params) as HealthRecord[]
    },
  },
  {
    name: 'list_notes',
    description: 'List note metadata, optionally filtered by notebook.',
    parameters: {
      type: 'object',
      properties: {
        notebook_id: { type: 'string' },
        limit: { type: 'number' },
      },
      additionalProperties: false,
    },
    execute: ({ notebook_id, limit }) => {
      let sql = 'SELECT * FROM note_index WHERE 1=1'
      const params: unknown[] = []
      if (typeof notebook_id === 'string' && notebook_id) {
        sql += ' AND notebook_id = ?'
        params.push(notebook_id)
      }
      sql += ' ORDER BY pinned DESC, updated_at DESC'
      sql += ` LIMIT ${typeof limit === 'number' ? Math.max(1, Math.min(limit, 50)) : 20}`
      return (db.prepare(sql).all(...params) as RawNoteIndex[]).map(parseNoteIndex)
    },
  },
  {
    name: 'search_notes',
    description: 'Search notes by title or tags.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
      additionalProperties: false,
    },
    execute: ({ query, limit }) => {
      if (typeof query !== 'string' || !query.trim()) return []
      const like = `%${query.trim()}%`
      return (db.prepare(`
        SELECT * FROM note_index
        WHERE title LIKE ? OR tags LIKE ?
        ORDER BY pinned DESC, updated_at DESC
        LIMIT ?
      `).all(like, like, typeof limit === 'number' ? Math.max(1, Math.min(limit, 50)) : 20) as RawNoteIndex[]).map(parseNoteIndex)
    },
  },
  {
    name: 'get_note',
    description: 'Read a full note including markdown content.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    execute: async ({ id }) => {
      if (typeof id !== 'string' || !id) throw new Error('id is required')
      const row = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as RawNoteIndex | undefined
      if (!row) throw new Error('note not found')
      const parsed = parseNoteIndex(row)
      const content = await fs.readFile(path.join(NOTES_DIR, parsed.file_path), 'utf-8').catch(() => '')
      const note: Note = { ...parsed, content }
      return note
    },
  },
]
