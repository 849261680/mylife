import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import db from '../db/client'
import type { Notebook, NoteIndex, Note } from '@mylife/shared'

const app = new Hono()

const NOTES_DIR = path.resolve(process.cwd(), '../../data/notes')

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

// GET /notes/notebooks
app.get('/notebooks', (c) => {
  const rows = db.prepare('SELECT * FROM notebooks ORDER BY created_at ASC').all() as Notebook[]
  // Attach note count to each notebook
  const withCount = rows.map(nb => {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM note_index WHERE notebook_id = ?').get(nb.id) as { count: number }
    return { ...nb, count }
  })
  const total = db.prepare('SELECT COUNT(*) as count FROM note_index').get() as { count: number }
  return c.json({ notebooks: withCount, total: total.count })
})

// POST /notes/notebooks
app.post('/notebooks', zValidator('json', z.object({
  name: z.string().min(1),
  color: z.string().default('bg-indigo-500'),
})), async (c) => {
  const { name, color } = c.req.valid('json')
  const now = new Date().toISOString()
  const nb: Notebook = { id: nanoid(), name, color, created_at: now }
  db.prepare('INSERT INTO notebooks (id, name, color, created_at) VALUES (?, ?, ?, ?)').run(nb.id, nb.name, nb.color, nb.created_at)
  await ensureDir(path.join(NOTES_DIR, nb.id))
  return c.json(nb, 201)
})

// DELETE /notes/notebooks/:id
app.delete('/notebooks/:id', async (c) => {
  const { id } = c.req.param()
  const nb = db.prepare('SELECT * FROM notebooks WHERE id = ?').get(id) as Notebook | undefined
  if (!nb) return c.json({ error: 'not found' }, 404)

  const notes = db.prepare('SELECT * FROM note_index WHERE notebook_id = ?').all(id) as NoteIndex[]
  for (const note of notes) {
    await fs.unlink(path.join(NOTES_DIR, note.file_path)).catch(() => {})
  }

  db.prepare('DELETE FROM note_index WHERE notebook_id = ?').run(id)
  db.prepare('DELETE FROM notebooks WHERE id = ?').run(id)
  await fs.rm(path.join(NOTES_DIR, id), { recursive: true, force: true }).catch(() => {})

  return c.json({ ok: true })
})

// GET /notes?notebook_id=&q=
app.get('/', (c) => {
  const { notebook_id, q } = c.req.query()

  if (q) {
    // Full-text search via FTS5
    const rows = db.prepare(`
      SELECT ni.* FROM note_index ni
      JOIN note_fts fts ON ni.id = fts.rowid
      WHERE note_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `).all(q) as NoteIndex[]
    return c.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags as unknown as string) })))
  }

  let sql = 'SELECT * FROM note_index WHERE 1=1'
  const params: string[] = []
  if (notebook_id) { sql += ' AND notebook_id = ?'; params.push(notebook_id) }
  sql += ' ORDER BY pinned DESC, updated_at DESC'

  const rows = db.prepare(sql).all(...params) as NoteIndex[]
  return c.json(rows.map(r => ({ ...r, tags: JSON.parse(r.tags as unknown as string), pinned: Boolean(r.pinned) })))
})

// GET /notes/:id  (returns full note with content)
app.get('/:id', async (c) => {
  const { id } = c.req.param()
  const row = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as NoteIndex | undefined
  if (!row) return c.json({ error: 'not found' }, 404)

  const filePath = path.join(NOTES_DIR, row.file_path)
  const content = await fs.readFile(filePath, 'utf-8').catch(() => '')
  return c.json({ ...row, tags: JSON.parse(row.tags as unknown as string), pinned: Boolean(row.pinned), content })
})

// POST /notes
app.post('/', zValidator('json', z.object({
  notebook_id: z.string(),
  title: z.string().min(1),
  content: z.string().default(''),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
})), async (c) => {
  const input = c.req.valid('json')
  const now = new Date().toISOString()
  const id = nanoid()
  const fileName = `${id}.md`
  const relPath = `${input.notebook_id}/${fileName}`
  const filePath = path.join(NOTES_DIR, relPath)

  await ensureDir(path.join(NOTES_DIR, input.notebook_id))
  await fs.writeFile(filePath, input.content, 'utf-8')

  const wordCount = input.content.length
  db.prepare(`
    INSERT INTO note_index (id, notebook_id, title, tags, pinned, file_path, word_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.notebook_id, input.title, JSON.stringify(input.tags),
         input.pinned ? 1 : 0, relPath, wordCount, now, now)

  return c.json({ id, ...input, file_path: relPath, word_count: wordCount, created_at: now, updated_at: now }, 201)
})

// PATCH /notes/:id
app.patch('/:id', async (c) => {
  const { id } = c.req.param()
  const row = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as NoteIndex | undefined
  if (!row) return c.json({ error: 'not found' }, 404)

  const body = await c.req.json() as { title?: string; content?: string; tags?: string[]; pinned?: boolean }
  const now = new Date().toISOString()

  if (body.content !== undefined) {
    const filePath = path.join(NOTES_DIR, row.file_path)
    await fs.writeFile(filePath, body.content, 'utf-8')
    db.prepare('UPDATE note_index SET word_count = ?, updated_at = ? WHERE id = ?')
      .run(body.content.length, now, id)
  }
  if (body.title !== undefined) {
    db.prepare('UPDATE note_index SET title = ?, updated_at = ? WHERE id = ?').run(body.title, now, id)
  }
  if (body.tags !== undefined) {
    db.prepare('UPDATE note_index SET tags = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(body.tags), now, id)
  }
  if (body.pinned !== undefined) {
    db.prepare('UPDATE note_index SET pinned = ?, updated_at = ? WHERE id = ?').run(body.pinned ? 1 : 0, now, id)
  }

  const updated = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as NoteIndex
  return c.json({ ...updated, tags: JSON.parse(updated.tags as unknown as string), pinned: Boolean(updated.pinned) })
})

// DELETE /notes/:id
app.delete('/:id', async (c) => {
  const { id } = c.req.param()
  const row = db.prepare('SELECT * FROM note_index WHERE id = ?').get(id) as NoteIndex | undefined
  if (!row) return c.json({ error: 'not found' }, 404)

  await fs.unlink(path.join(NOTES_DIR, row.file_path)).catch(() => {})
  db.prepare('DELETE FROM note_index WHERE id = ?').run(id)
  return c.json({ ok: true })
})

export default app
