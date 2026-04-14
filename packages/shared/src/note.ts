export interface Notebook {
  id: string
  name: string
  color: string
  created_at: string
}

export interface NoteIndex {
  id: string
  notebook_id: string
  title: string
  tags: string[]
  pinned: boolean
  file_path: string       // 相对路径：work/abc123.md
  word_count: number
  created_at: string
  updated_at: string
}

// 带正文内容的完整笔记（读文件后组装）
export interface Note extends NoteIndex {
  content: string         // Markdown 正文
}

export type CreateNoteInput = {
  notebook_id: string
  title: string
  content: string
  tags?: string[]
  pinned?: boolean
}

export type UpdateNoteInput = Partial<Omit<CreateNoteInput, 'notebook_id'>>
