import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { SCHEMA_SQL } from './schema'

const DATA_DIR = path.resolve(process.cwd(), '../../data')
const DB_PATH = path.join(DATA_DIR, 'app.db')

// 确保 data 目录存在
fs.mkdirSync(DATA_DIR, { recursive: true })

const db = new Database(DB_PATH)

const ensureColumn = (table: string, column: string, ddl: string) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (columns.length > 0 && !columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}

ensureColumn('goals', 'goal_type', "goal_type TEXT NOT NULL DEFAULT 'long' CHECK(goal_type IN ('short','long'))")
ensureColumn('tasks', 'done_at', 'done_at TEXT')

// 初始化表结构
db.exec(SCHEMA_SQL)

export default db
