export type RecurrenceRule = 'daily' | 'weekly' | 'monthly' | null

export interface CalendarEvent {
  id: string
  title: string
  start_time: string      // ISO 8601
  end_time: string        // ISO 8601
  location?: string
  color: string
  is_all_day: boolean
  recurrence: RecurrenceRule
  notes?: string
  created_at: string
}

export type CreateEventInput = Omit<CalendarEvent, 'id' | 'created_at'>
export type UpdateEventInput = Partial<CreateEventInput>
