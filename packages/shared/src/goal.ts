export interface Goal {
  id: string
  title: string
  description: string | null
  goal_type: 'short' | 'long'
  status: 'active' | 'done'
  target_date: string | null
  created_at: string
  updated_at: string
}

export type CreateGoalInput = Pick<Goal, 'title' | 'goal_type'> & Partial<Pick<Goal, 'description' | 'target_date'>>
export type UpdateGoalInput = Partial<Pick<Goal, 'title' | 'description' | 'goal_type' | 'status' | 'target_date'>>
