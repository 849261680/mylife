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
import { logAgentAction, rememberAgentMemory } from '../store'
import {
  AgentToolDefinition,
  NOTES_DIR,
  RawNoteIndex,
  RawTask,
  centsToYuan,
  ensureAgentNotebook,
  ensureDir,
  parseNoteIndex,
  parseTask,
} from './common'

export const writeTools: AgentToolDefinition[] = [
  {
    name: 'create_task',
    description: 'Create a new task for the user.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'low'] },
        due_date: { type: ['string', 'null'] },
        due_time: { type: ['string', 'null'] },
        tags: { type: 'array', items: { type: 'string' } },
        project_id: { type: ['string', 'null'] },
      },
      required: ['title'],
      additionalProperties: false,
    },
    execute: ({ title, priority, due_date, due_time, tags, project_id }, context) => {
      if (typeof title !== 'string' || !title.trim()) throw new Error('title is required')
      const now = new Date().toISOString()
      const task: Task = {
        id: nanoid(),
        project_id: typeof project_id === 'string' && project_id ? project_id : null,
        title: title.trim(),
        priority: priority === 'high' ? 'high' : 'low',
        status: 'todo',
        due_date: typeof due_date === 'string' && due_date ? due_date : null,
        due_time: typeof due_time === 'string' && due_time ? due_time : null,
        tags: Array.isArray(tags) ? tags.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
        done_at: null,
        created_at: now,
        updated_at: now,
      }

      db.prepare(`
        INSERT INTO tasks (id, project_id, title, priority, status, due_date, due_time, tags, done_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.project_id, task.title, task.priority, task.status, task.due_date, task.due_time, JSON.stringify(task.tags), task.done_at, task.created_at, task.updated_at)

      logAgentAction(context.sessionId, 'create_task', { input: { title, priority, due_date, due_time, tags, project_id }, after: task }, { traceId: context.traceId })
      return task
    },
  },
  {
    name: 'update_task',
    description: 'Update an existing task.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        priority: { type: 'string', enum: ['high', 'low'] },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'cancelled'] },
        due_date: { type: ['string', 'null'] },
        due_time: { type: ['string', 'null'] },
        tags: { type: 'array', items: { type: 'string' } },
        project_id: { type: ['string', 'null'] },
      },
      required: ['id'],
      additionalProperties: false,
    },
    execute: ({ id, ...updates }, context) => {
      if (typeof id !== 'string' || !id) throw new Error('id is required')
      const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTask | undefined
      if (!existing) throw new Error('task not found')

      const before = parseTask(existing)
      const now = new Date().toISOString()
      const normalized = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
      if ('priority' in normalized) {
        normalized.priority = normalized.priority === 'high' ? 'high' : 'low'
      }
      if ('status' in normalized && normalized.status === 'done' && !('done_at' in normalized)) {
        normalized.done_at = now
      }
      if ('status' in normalized && normalized.status !== 'done' && !('done_at' in normalized)) {
        normalized.done_at = null
      }

      const fields = Object.keys(normalized)
      if (fields.length === 0) return before

      const setClauses = fields.map((field) => `${field} = ?`).join(', ')
      const values = fields.map((field) => {
        const value = normalized[field]
        return field === 'tags' ? JSON.stringify(value) : value
      })

      db.prepare(`UPDATE tasks SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, now, id)
      const after = parseTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as RawTask)
      logAgentAction(context.sessionId, 'update_task', { input: { id, ...updates }, before, after }, { traceId: context.traceId })
      return after
    },
  },
  {
    name: 'create_goal',
    description: 'Create a new goal.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: ['string', 'null'] },
        goal_type: { type: 'string', enum: ['short', 'long'] },
        target_date: { type: ['string', 'null'] },
      },
      required: ['title'],
      additionalProperties: false,
    },
    execute: ({ title, description, goal_type, target_date }, context) => {
      if (typeof title !== 'string' || !title.trim()) throw new Error('title is required')
      const now = new Date().toISOString()
      const goal: Goal = {
        id: nanoid(),
        title: title.trim(),
        description: typeof description === 'string' && description ? description : null,
        goal_type: goal_type === 'short' ? 'short' : 'long',
        status: 'active',
        target_date: typeof target_date === 'string' && target_date ? target_date : null,
        created_at: now,
        updated_at: now,
      }

      db.prepare(`
        INSERT INTO goals (id, title, description, goal_type, status, target_date, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(goal.id, goal.title, goal.description, goal.goal_type, goal.status, goal.target_date, goal.created_at, goal.updated_at)

      logAgentAction(context.sessionId, 'create_goal', { input: { title, description, goal_type, target_date }, after: goal }, { traceId: context.traceId })
      return goal
    },
  },
  {
    name: 'update_goal',
    description: 'Update an existing goal.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: ['string', 'null'] },
        goal_type: { type: 'string', enum: ['short', 'long'] },
        status: { type: 'string', enum: ['active', 'done'] },
        target_date: { type: ['string', 'null'] },
      },
      required: ['id'],
      additionalProperties: false,
    },
    execute: ({ id, ...updates }, context) => {
      if (typeof id !== 'string' || !id) throw new Error('id is required')
      const before = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal | undefined
      if (!before) throw new Error('goal not found')

      const normalized = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined))
      const fields = Object.keys(normalized)
      if (fields.length === 0) return before
      const now = new Date().toISOString()
      const setClauses = fields.map((field) => `${field} = ?`).join(', ')
      const values = fields.map((field) => normalized[field] ?? null)

      db.prepare(`UPDATE goals SET ${setClauses}, updated_at = ? WHERE id = ?`).run(...values, now, id)
      const after = db.prepare('SELECT * FROM goals WHERE id = ?').get(id) as Goal
      logAgentAction(context.sessionId, 'update_goal', { input: { id, ...updates }, before, after }, { traceId: context.traceId })
      return after
    },
  },
  {
    name: 'create_habit',
    description: 'Create a new habit.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        icon: { type: 'string' },
        color: { type: 'string' },
        frequency: { type: 'string', enum: ['daily', 'weekdays', 'weekends', 'custom'] },
        custom_days: { type: ['array', 'null'], items: { type: 'number' } },
        target_per_month: { type: 'number' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    execute: ({ name, icon, color, frequency, custom_days, target_per_month }, context) => {
      if (typeof name !== 'string' || !name.trim()) throw new Error('name is required')
      const habit: Habit = {
        id: nanoid(),
        name: name.trim(),
        icon: typeof icon === 'string' && icon ? icon : '✅',
        color: typeof color === 'string' && color ? color : 'bg-orange-500',
        frequency: frequency === 'weekdays' || frequency === 'weekends' || frequency === 'custom' ? frequency : 'daily',
        custom_days: Array.isArray(custom_days) ? custom_days.filter((day): day is number => typeof day === 'number') : null,
        target_per_month: typeof target_per_month === 'number' && Number.isFinite(target_per_month) && target_per_month > 0 ? Math.round(target_per_month) : 30,
        archived: false,
        created_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO habits (id, name, icon, color, frequency, custom_days, target_per_month, archived, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(habit.id, habit.name, habit.icon, habit.color, habit.frequency, habit.custom_days ? JSON.stringify(habit.custom_days) : null, habit.target_per_month, 0, habit.created_at)

      logAgentAction(context.sessionId, 'create_habit', { input: { name, icon, color, frequency, custom_days, target_per_month }, after: habit }, { traceId: context.traceId })
      return habit
    },
  },
  {
    name: 'log_habit',
    description: 'Mark a habit as done or undone for a specific date.',
    parameters: {
      type: 'object',
      properties: {
        habit_id: { type: 'string' },
        date: { type: 'string' },
        done: { type: 'boolean' },
        note: { type: ['string', 'null'] },
      },
      required: ['habit_id', 'date', 'done'],
      additionalProperties: false,
    },
    execute: ({ habit_id, date, done, note }, context) => {
      if (typeof habit_id !== 'string' || !habit_id) throw new Error('habit_id is required')
      if (typeof date !== 'string' || !date) throw new Error('date is required')
      if (typeof done !== 'boolean') throw new Error('done must be boolean')
      const now = new Date().toISOString()

      db.prepare(`
        INSERT INTO habit_logs (id, habit_id, date, done, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(habit_id, date) DO UPDATE SET
          done = excluded.done,
          note = excluded.note
      `).run(nanoid(), habit_id, date, done ? 1 : 0, typeof note === 'string' && note ? note : null, now)

      const after = db.prepare(`SELECT date, done, note FROM habit_logs WHERE habit_id = ? AND date = ?`).get(habit_id, date) as { date: string; done: number; note: string | null }
      logAgentAction(context.sessionId, 'log_habit', { input: { habit_id, date, done, note }, after: { ...after, done: Boolean(after.done) } }, { traceId: context.traceId })
      return { ok: true, habit_id, date, done }
    },
  },
  {
    name: 'create_event',
    description: 'Create a calendar event.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        location: { type: ['string', 'null'] },
        color: { type: 'string' },
        is_all_day: { type: 'boolean' },
        recurrence: { type: ['string', 'null'] },
        notes: { type: ['string', 'null'] },
      },
      required: ['title', 'start_time', 'end_time'],
      additionalProperties: false,
    },
    execute: ({ title, start_time, end_time, location, color, is_all_day, recurrence, notes }, context) => {
      if (typeof title !== 'string' || !title.trim()) throw new Error('title is required')
      if (typeof start_time !== 'string' || typeof end_time !== 'string') throw new Error('start_time and end_time are required')

      const event: CalendarEvent = {
        id: nanoid(),
        title: title.trim(),
        start_time,
        end_time,
        location: typeof location === 'string' && location ? location : undefined,
        color: typeof color === 'string' && color ? color : '#6366f1',
        is_all_day: Boolean(is_all_day),
        recurrence: recurrence === 'daily' || recurrence === 'weekly' || recurrence === 'monthly' ? recurrence : null,
        notes: typeof notes === 'string' && notes ? notes : undefined,
        created_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO events (id, title, start_time, end_time, location, color, is_all_day, recurrence, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(event.id, event.title, event.start_time, event.end_time, event.location ?? null, event.color, event.is_all_day ? 1 : 0, event.recurrence ?? null, event.notes ?? null, event.created_at)

      logAgentAction(context.sessionId, 'create_event', { input: { title, start_time, end_time, location, color, is_all_day, recurrence, notes }, after: event }, { traceId: context.traceId })
      return event
    },
  },
  {
    name: 'delete_event',
    description: 'Delete an event when the user explicitly asks for it.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    execute: ({ id }, context) => {
      if (typeof id !== 'string' || !id) throw new Error('id is required')
      const before = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as CalendarEvent | undefined
      if (!before) throw new Error('event not found')
      db.prepare('DELETE FROM events WHERE id = ?').run(id)
      logAgentAction(context.sessionId, 'delete_event', { input: { id }, before }, { traceId: context.traceId })
      return { ok: true }
    },
  },
  {
    name: 'create_transaction',
    description: 'Create a finance transaction. The amount should be provided in yuan, for example 50 means CNY 50.00.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense', 'transfer'] },
        amount: { type: 'number' },
        category: { type: 'string' },
        note: { type: ['string', 'null'] },
        date: { type: 'string' },
      },
      required: ['type', 'amount', 'category', 'date'],
      additionalProperties: false,
    },
    execute: ({ type, amount, category, note, date }, context) => {
      if ((type !== 'income' && type !== 'expense' && type !== 'transfer') || typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || typeof category !== 'string' || !category.trim() || typeof date !== 'string') {
        throw new Error('invalid transaction input')
      }

      const transaction: Transaction = {
        id: nanoid(),
        type,
        amount: Math.round(amount * 100),
        category: category.trim(),
        note: typeof note === 'string' && note ? note : undefined,
        date,
        source: 'agent',
        created_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO transactions (id, type, amount, category, note, date, source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(transaction.id, transaction.type, transaction.amount, transaction.category, transaction.note ?? null, transaction.date, transaction.source, transaction.created_at)

      logAgentAction(context.sessionId, 'create_transaction', { input: { type, amount, category, note, date }, after: transaction }, { traceId: context.traceId })
      return {
        ...transaction,
        amount,
        amount_cents: transaction.amount,
        stored_amount_yuan: centsToYuan(transaction.amount),
      }
    },
  },
  {
    name: 'upsert_health',
    description: 'Create or update a health record by date.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string' },
        weight: { type: 'number' },
        sleep_minutes: { type: 'number' },
        breakfast: { type: ['string', 'null'] },
        lunch: { type: ['string', 'null'] },
        dinner: { type: ['string', 'null'] },
        steps: { type: 'number' },
        water_ml: { type: 'number' },
        calories: { type: 'number' },
        notes: { type: ['string', 'null'] },
      },
      required: ['date'],
      additionalProperties: false,
    },
    execute: ({ date, weight, sleep_minutes, breakfast, lunch, dinner, steps, water_ml, calories, notes }, context) => {
      if (typeof date !== 'string' || !date) throw new Error('date is required')
      const existing = db.prepare('SELECT * FROM health_records WHERE date = ?').get(date) as HealthRecord | undefined
      const record = {
        id: existing?.id ?? nanoid(),
        date,
        weight: typeof weight === 'number' && Number.isFinite(weight) ? Math.round(weight) : existing?.weight ?? null,
        sleep_start: existing?.sleep_start ?? null,
        sleep_end: existing?.sleep_end ?? null,
        sleep_minutes: typeof sleep_minutes === 'number' && Number.isFinite(sleep_minutes) ? Math.round(sleep_minutes) : existing?.sleep_minutes ?? null,
        breakfast: typeof breakfast === 'string' ? breakfast.trim() || null : existing?.breakfast ?? null,
        lunch: typeof lunch === 'string' ? lunch.trim() || null : existing?.lunch ?? null,
        dinner: typeof dinner === 'string' ? dinner.trim() || null : existing?.dinner ?? null,
        steps: typeof steps === 'number' && Number.isFinite(steps) ? Math.round(steps) : existing?.steps ?? null,
        water_ml: typeof water_ml === 'number' && Number.isFinite(water_ml) ? Math.round(water_ml) : existing?.water_ml ?? null,
        calories: typeof calories === 'number' && Number.isFinite(calories) ? Math.round(calories) : existing?.calories ?? null,
        notes: typeof notes === 'string' ? notes : existing?.notes ?? null,
        updated_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO health_records (id, date, weight, sleep_start, sleep_end, sleep_minutes, breakfast, lunch, dinner, steps, water_ml, calories, notes, updated_at)
        VALUES (@id, @date, @weight, @sleep_start, @sleep_end, @sleep_minutes, @breakfast, @lunch, @dinner, @steps, @water_ml, @calories, @notes, @updated_at)
        ON CONFLICT(date) DO UPDATE SET
          weight = excluded.weight,
          sleep_start = excluded.sleep_start,
          sleep_end = excluded.sleep_end,
          sleep_minutes = excluded.sleep_minutes,
          breakfast = excluded.breakfast,
          lunch = excluded.lunch,
          dinner = excluded.dinner,
          steps = excluded.steps,
          water_ml = excluded.water_ml,
          calories = excluded.calories,
          notes = excluded.notes,
          updated_at = excluded.updated_at
      `).run(record)

      const after = db.prepare('SELECT * FROM health_records WHERE date = ?').get(date) as HealthRecord
      logAgentAction(context.sessionId, 'upsert_health', { input: { date, weight, sleep_minutes, breakfast, lunch, dinner, steps, water_ml, calories, notes }, before: existing ?? null, after }, { traceId: context.traceId })
      return after
    },
  },
  {
    name: 'create_note',
    description: 'Create a note in a notebook. If notebook_id is omitted, use or create the Agent notebook.',
    parameters: {
      type: 'object',
      properties: {
        notebook_id: { type: ['string', 'null'] },
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean' },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
    execute: async ({ notebook_id, title, content, tags, pinned }, context) => {
      if (typeof title !== 'string' || !title.trim()) throw new Error('title is required')
      if (typeof content !== 'string') throw new Error('content is required')

      const notebook = typeof notebook_id === 'string' && notebook_id
        ? (db.prepare('SELECT * FROM notebooks WHERE id = ?').get(notebook_id) as Notebook | undefined)
        : await ensureAgentNotebook()

      if (!notebook) throw new Error('notebook not found')

      const now = new Date().toISOString()
      const id = nanoid()
      const fileName = `${id}.md`
      const relPath = `${notebook.id}/${fileName}`
      await ensureDir(path.join(NOTES_DIR, notebook.id))
      await fs.writeFile(path.join(NOTES_DIR, relPath), content, 'utf-8')

      const noteIndex: NoteIndex = {
        id,
        notebook_id: notebook.id,
        title: title.trim(),
        tags: Array.isArray(tags) ? tags.filter((item): item is string => typeof item === 'string') : [],
        pinned: Boolean(pinned),
        file_path: relPath,
        word_count: content.length,
        created_at: now,
        updated_at: now,
      }

      db.prepare(`
        INSERT INTO note_index (id, notebook_id, title, tags, pinned, file_path, word_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(noteIndex.id, noteIndex.notebook_id, noteIndex.title, JSON.stringify(noteIndex.tags), noteIndex.pinned ? 1 : 0, noteIndex.file_path, noteIndex.word_count, noteIndex.created_at, noteIndex.updated_at)

      logAgentAction(context.sessionId, 'create_note', { input: { notebook_id: notebook.id, title, content, tags, pinned }, after: noteIndex }, { traceId: context.traceId })
      return noteIndex
    },
  },
  {
    name: 'update_note',
    description: 'Update an existing note title, content, tags, or pinned state.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        pinned: { type: 'boolean' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    execute: async ({ id, title, content, tags, pinned }, context) => {
      if (typeof id !== 'string' || !id) throw new Error('id is required')
      const beforeRaw = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as RawNoteIndex | undefined
      if (!beforeRaw) throw new Error('note not found')
      const before = parseNoteIndex(beforeRaw)
      const now = new Date().toISOString()

      if (typeof content === 'string') {
        await fs.writeFile(path.join(NOTES_DIR, before.file_path), content, 'utf-8')
        db.prepare(`UPDATE note_index SET word_count = ?, updated_at = ? WHERE id = ?`).run(content.length, now, id)
      }
      if (typeof title === 'string') {
        db.prepare(`UPDATE note_index SET title = ?, updated_at = ? WHERE id = ?`).run(title.trim(), now, id)
      }
      if (Array.isArray(tags)) {
        db.prepare(`UPDATE note_index SET tags = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(tags.filter((item): item is string => typeof item === 'string')), now, id)
      }
      if (typeof pinned === 'boolean') {
        db.prepare(`UPDATE note_index SET pinned = ?, updated_at = ? WHERE id = ?`).run(pinned ? 1 : 0, now, id)
      }

      const after = parseNoteIndex(db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as RawNoteIndex)
      logAgentAction(context.sessionId, 'update_note', { input: { id, title, content, tags, pinned }, before, after }, { traceId: context.traceId })
      return after
    },
  },
  {
    name: 'remember_user_preference',
    description: 'Store a durable user preference or fact for future agent sessions.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['key', 'value'],
      additionalProperties: false,
    },
    execute: ({ key, value }, context) => {
      if (typeof key !== 'string' || !key.trim() || typeof value !== 'string' || !value.trim()) {
        throw new Error('key and value are required')
      }
      const memory = rememberAgentMemory(key.trim(), value.trim())
      logAgentAction(context.sessionId, 'remember_user_preference', { input: { key, value }, after: memory }, { traceId: context.traceId })
      return memory
    },
  },
]
