export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export interface Project {
  id: string
  name: string
  color: string
  icon?: string
  created_at: string
}

export interface Task {
  id: string
  project_id: string | null
  title: string
  priority: Priority
  status: TaskStatus
  due_date: string | null   // YYYY-MM-DD
  due_time: string | null   // HH:MM
  tags: string[]
  done_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskSubtask {
  id: string
  task_id: string
  title: string
  done: boolean
  created_at: string
  updated_at: string
}

export type CreateTaskInput = Pick<Task, 'title' | 'priority' | 'due_date' | 'due_time' | 'tags'> & {
  project_id?: string
}

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: TaskStatus
}

export type CreateTaskSubtaskInput = Pick<TaskSubtask, 'title'>
export type UpdateTaskSubtaskInput = Partial<Pick<TaskSubtask, 'title' | 'done'>>
