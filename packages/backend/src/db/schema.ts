// SQL 建表语句
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 项目
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'indigo',
  icon        TEXT,
  created_at  TEXT NOT NULL
);

-- 长期目标
CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  goal_type   TEXT NOT NULL DEFAULT 'long' CHECK(goal_type IN ('short','long')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','done')),
  target_date TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 任务
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'low' CHECK(priority IN ('high','low')),
  status      TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','done','cancelled')),
  due_date    TEXT,
  due_time    TEXT,
  tags        TEXT NOT NULL DEFAULT '[]',
  done_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 子任务
CREATE TABLE IF NOT EXISTS task_subtasks (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  done        INTEGER NOT NULL DEFAULT 0,
  priority    TEXT NOT NULL DEFAULT 'low' CHECK(priority IN ('high','low')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 日程事件
CREATE TABLE IF NOT EXISTS events (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  location    TEXT,
  color       TEXT NOT NULL DEFAULT 'indigo',
  is_all_day  INTEGER NOT NULL DEFAULT 0,
  recurrence  TEXT CHECK(recurrence IN ('daily','weekly','monthly') OR recurrence IS NULL),
  notes       TEXT,
  created_at  TEXT NOT NULL
);

-- 习惯定义
CREATE TABLE IF NOT EXISTS habits (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  icon             TEXT NOT NULL,
  color            TEXT NOT NULL DEFAULT 'orange',
  frequency        TEXT NOT NULL DEFAULT 'daily' CHECK(frequency IN ('daily','weekdays','weekends','custom')),
  custom_days      TEXT,
  target_per_month INTEGER NOT NULL DEFAULT 30,
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

-- 习惯打卡记录
CREATE TABLE IF NOT EXISTS habit_logs (
  id         TEXT PRIMARY KEY,
  habit_id   TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  done       INTEGER NOT NULL DEFAULT 1,
  note       TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(habit_id, date)
);

-- 记账流水
CREATE TABLE IF NOT EXISTS transactions (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
  amount     INTEGER NOT NULL,
  category   TEXT NOT NULL,
  note       TEXT,
  date       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'user' CHECK(source IN ('user','agent')),
  created_at TEXT NOT NULL
);

-- 月度预算
CREATE TABLE IF NOT EXISTS budgets (
  id       TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  amount   INTEGER NOT NULL,
  month    TEXT NOT NULL,
  UNIQUE(category, month)
);

-- 健康记录（每天一条）
CREATE TABLE IF NOT EXISTS health_records (
  id             TEXT PRIMARY KEY,
  date           TEXT NOT NULL UNIQUE,
  weight         INTEGER,
  sleep_start    TEXT,
  sleep_end      TEXT,
  sleep_minutes  INTEGER,
  breakfast      TEXT,
  lunch          TEXT,
  dinner         TEXT,
  steps          INTEGER,
  water_ml       INTEGER,
  calories       INTEGER,
  notes          TEXT,
  updated_at     TEXT NOT NULL
);

-- 笔记本
CREATE TABLE IF NOT EXISTS notebooks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT 'sky',
  created_at TEXT NOT NULL
);

-- 笔记索引（内容在 Markdown 文件）
CREATE TABLE IF NOT EXISTS note_index (
  id          TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',
  pinned      INTEGER NOT NULL DEFAULT 0,
  file_path   TEXT NOT NULL UNIQUE,
  word_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 笔记全文搜索（FTS5）
CREATE VIRTUAL TABLE IF NOT EXISTS note_fts USING fts5(
  id UNINDEXED,
  title,
  content,
  content='',
  tokenize='unicode61'
);

-- Agent 对话历史
CREATE TABLE IF NOT EXISTS agent_messages (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  trace_id   TEXT,
  role       TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Agent 长期记忆
CREATE TABLE IF NOT EXISTS agent_memory (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agent 可配置项（如系统提示词）
CREATE TABLE IF NOT EXISTS agent_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Agent 操作日志
CREATE TABLE IF NOT EXISTS agent_actions (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  trace_id    TEXT,
  action_type TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'done' CHECK(status IN ('pending','done','undone')),
  error       TEXT,
  created_at  TEXT NOT NULL
);

-- Agent trace 级别观测
CREATE TABLE IF NOT EXISTS agent_traces (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL,
  user_message TEXT NOT NULL,
  model       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
  error       TEXT,
  tool_rounds INTEGER NOT NULL DEFAULT 0,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER
);

-- Agent tool 调用观测
CREATE TABLE IF NOT EXISTS agent_tool_runs (
  id          TEXT PRIMARY KEY,
  trace_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  tool_name   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','done','error')),
  arguments   TEXT NOT NULL DEFAULT '{}',
  result      TEXT,
  error       TEXT,
  started_at  TEXT NOT NULL,
  finished_at TEXT,
  duration_ms INTEGER
);

-- Agent 事件流观测
CREATE TABLE IF NOT EXISTS agent_events (
  id          TEXT PRIMARY KEY,
  trace_id    TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  step_id     TEXT,
  step_index  INTEGER,
  event_type  TEXT NOT NULL CHECK(event_type IN (
    'run_started',
    'llm_request',
    'llm_response',
    'tool_call',
    'tool_result',
    'message',
    'run_finished',
    'run_failed'
  )),
  payload     TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL
);

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date   ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_goals_status     ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_type       ON goals(goal_type);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date  ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_health_date      ON health_records(date);
CREATE INDEX IF NOT EXISTS idx_note_notebook    ON note_index(notebook_id);
CREATE INDEX IF NOT EXISTS idx_agent_session    ON agent_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_trace ON agent_messages(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_trace ON agent_actions(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_traces_session ON agent_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_tool_runs_trace ON agent_tool_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_trace ON agent_events(trace_id);
`
