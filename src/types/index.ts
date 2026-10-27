import { Database } from './database.types'

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type UserSettings = Tables<'user_settings'>
export type Project = Tables<'projects'>
export type Task = Tables<'tasks'>
export type TaskDependency = Tables<'task_dependencies'>
export type TaskRescheduleHistory = Tables<'task_reschedule_history'>
export type CalendarEvent = Tables<'calendar_events'>
export type CalendarConnection = Tables<'calendar_connections'>
export type CalendarEventMapping = Tables<'calendar_event_mappings'>
export type CalendarSyncState = Tables<'calendar_sync_state'>
export type ReminderRule = Tables<'reminder_rules'>
export type ReminderDelivery = Tables<'reminder_deliveries'>
export type DiaryEntry = Tables<'diary_entries'>
export type DiaryTaskLink = Tables<'diary_task_links'>
export type TrainingCourse = Tables<'training_courses'>
export type TrainingTemplate = Tables<'training_templates'>
export type TrainingTemplateTask = Tables<'training_template_tasks'>
export type TrainingSession = Tables<'training_sessions'>
export type StudentReview = Tables<'student_reviews'>
export type ActivityLog = Tables<'activity_logs'>
export type BackgroundJob = Tables<'background_jobs'>

export type TaskWithSubtasks = Task & {
  subtasks?: Task[]
  project?: Project | null
  reminders?: ReminderRule[]
}

export type ActionResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}
