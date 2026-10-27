export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          email: string
          avatar_url: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name: string
          email: string
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          email?: string
          avatar_url?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          default_task_duration_minutes: number
          auto_sync_tasks_to_calendar: boolean
          default_calendar_id: string | null
          week_start_day: number
          theme_preference: 'dark' | 'light' | 'system'
          notification_web_push: boolean
          notification_in_app: boolean
          notification_email: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_task_duration_minutes?: number
          auto_sync_tasks_to_calendar?: boolean
          default_calendar_id?: string | null
          week_start_day?: number
          theme_preference?: 'dark' | 'light' | 'system'
          notification_web_push?: boolean
          notification_in_app?: boolean
          notification_email?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_task_duration_minutes?: number
          auto_sync_tasks_to_calendar?: boolean
          default_calendar_id?: string | null
          week_start_day?: number
          theme_preference?: 'dark' | 'light' | 'system'
          notification_web_push?: boolean
          notification_in_app?: boolean
          notification_email?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          color_hex: string
          status: 'backlog' | 'active' | 'on_hold' | 'completed' | 'archived'
          target_completion_date: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          color_hex?: string
          status?: 'backlog' | 'active' | 'on_hold' | 'completed' | 'archived'
          target_completion_date?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          color_hex?: string
          status?: 'backlog' | 'active' | 'on_hold' | 'completed' | 'archived'
          target_completion_date?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          project_id: string | null
          parent_task_id: string | null
          title: string
          description: string | null
          status: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          priority: 'p1' | 'p2' | 'p3' | 'p4'
          deadline_at: string | null
          scheduled_start_at: string | null
          scheduled_end_at: string | null
          is_time_blocked: boolean
          recurrence_rule: string | null
          recurrence_parent_id: string | null
          estimated_duration_minutes: number | null
          completed_at: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id?: string | null
          parent_task_id?: string | null
          title: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'p1' | 'p2' | 'p3' | 'p4'
          deadline_at?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          is_time_blocked?: boolean
          recurrence_rule?: string | null
          recurrence_parent_id?: string | null
          estimated_duration_minutes?: number | null
          completed_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string | null
          parent_task_id?: string | null
          title?: string
          description?: string | null
          status?: 'todo' | 'in_progress' | 'completed' | 'cancelled'
          priority?: 'p1' | 'p2' | 'p3' | 'p4'
          deadline_at?: string | null
          scheduled_start_at?: string | null
          scheduled_end_at?: string | null
          is_time_blocked?: boolean
          recurrence_rule?: string | null
          recurrence_parent_id?: string | null
          estimated_duration_minutes?: number | null
          completed_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      task_dependencies: {
        Row: {
          id: string
          user_id: string
          blocking_task_id: string
          dependent_task_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          blocking_task_id: string
          dependent_task_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          blocking_task_id?: string
          dependent_task_id?: string
          created_at?: string
        }
      }
      task_reschedule_history: {
        Row: {
          id: string
          user_id: string
          task_id: string
          previous_scheduled_start: string | null
          new_scheduled_start: string | null
          previous_deadline: string | null
          new_deadline: string | null
          reason: string | null
          rescheduled_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id: string
          previous_scheduled_start?: string | null
          new_scheduled_start?: string | null
          previous_deadline?: string | null
          new_deadline?: string | null
          reason?: string | null
          rescheduled_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string
          previous_scheduled_start?: string | null
          new_scheduled_start?: string | null
          previous_deadline?: string | null
          new_deadline?: string | null
          reason?: string | null
          rescheduled_at?: string
        }
      }
      calendar_events: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          location: string | null
          event_type: 'meeting' | 'appointment' | 'focus_block' | 'reminder_block' | 'external'
          start_time: string
          end_time: string
          is_all_day: boolean
          meeting_url: string | null
          attendees: Json
          recurrence_rule: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          location?: string | null
          event_type?: 'meeting' | 'appointment' | 'focus_block' | 'reminder_block' | 'external'
          start_time: string
          end_time: string
          is_all_day?: boolean
          meeting_url?: string | null
          attendees?: Json
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          location?: string | null
          event_type?: 'meeting' | 'appointment' | 'focus_block' | 'reminder_block' | 'external'
          start_time?: string
          end_time?: string
          is_all_day?: boolean
          meeting_url?: string | null
          attendees?: Json
          recurrence_rule?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      calendar_connections: {
        Row: {
          id: string
          user_id: string
          provider: 'google'
          account_email: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          token_expires_at: string
          scopes: string[]
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: 'google'
          account_email: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          token_expires_at: string
          scopes: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: 'google'
          account_email?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string
          token_expires_at?: string
          scopes?: string[]
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      calendar_event_mappings: {
        Row: {
          id: string
          user_id: string
          calendar_connection_id: string
          task_id: string | null
          calendar_event_id: string | null
          google_calendar_id: string
          google_event_id: string
          etag: string | null
          sync_direction: 'bidirectional' | 'push_only' | 'pull_only'
          last_synced_at: string
          sync_status: 'synced' | 'pending_push' | 'pending_pull' | 'conflict' | 'orphaned'
        }
        Insert: {
          id?: string
          user_id: string
          calendar_connection_id: string
          task_id?: string | null
          calendar_event_id?: string | null
          google_calendar_id: string
          google_event_id: string
          etag?: string | null
          sync_direction?: 'bidirectional' | 'push_only' | 'pull_only'
          last_synced_at?: string
          sync_status?: 'synced' | 'pending_push' | 'pending_pull' | 'conflict' | 'orphaned'
        }
        Update: {
          id?: string
          user_id?: string
          calendar_connection_id?: string
          task_id?: string | null
          calendar_event_id?: string | null
          google_calendar_id?: string
          google_event_id?: string
          etag?: string | null
          sync_direction?: 'bidirectional' | 'push_only' | 'pull_only'
          last_synced_at?: string
          sync_status?: 'synced' | 'pending_push' | 'pending_pull' | 'conflict' | 'orphaned'
        }
      }
      calendar_sync_state: {
        Row: {
          id: string
          calendar_connection_id: string
          google_calendar_id: string
          sync_token: string | null
          channel_id: string | null
          resource_id: string | null
          channel_expiration: string | null
          last_successful_sync: string | null
          last_error_message: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          calendar_connection_id: string
          google_calendar_id: string
          sync_token?: string | null
          channel_id?: string | null
          resource_id?: string | null
          channel_expiration?: string | null
          last_successful_sync?: string | null
          last_error_message?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          calendar_connection_id?: string
          google_calendar_id?: string
          sync_token?: string | null
          channel_id?: string | null
          resource_id?: string | null
          channel_expiration?: string | null
          last_successful_sync?: string | null
          last_error_message?: string | null
          updated_at?: string
        }
      }
      reminder_rules: {
        Row: {
          id: string
          user_id: string
          task_id: string | null
          calendar_event_id: string | null
          offset_minutes: number
          is_relative_to_start: boolean
          channel: 'in_app' | 'web_push' | 'google_calendar'
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_id?: string | null
          calendar_event_id?: string | null
          offset_minutes: number
          is_relative_to_start?: boolean
          channel?: 'in_app' | 'web_push' | 'google_calendar'
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_id?: string | null
          calendar_event_id?: string | null
          offset_minutes?: number
          is_relative_to_start?: boolean
          channel?: 'in_app' | 'web_push' | 'google_calendar'
          is_active?: boolean
          created_at?: string
        }
      }
      reminder_deliveries: {
        Row: {
          id: string
          user_id: string
          reminder_rule_id: string
          scheduled_for: string
          status: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          sent_at: string | null
          error_message: string | null
          idempotency_key: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reminder_rule_id: string
          scheduled_for: string
          status?: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          sent_at?: string | null
          error_message?: string | null
          idempotency_key: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reminder_rule_id?: string
          scheduled_for?: string
          status?: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          sent_at?: string | null
          error_message?: string | null
          idempotency_key?: string
          created_at?: string
        }
      }
      diary_entries: {
        Row: {
          id: string
          user_id: string
          entry_date: string
          morning_intentions: string | null
          evening_reflection: string | null
          energy_level: number | null
          mood_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entry_date: string
          morning_intentions?: string | null
          evening_reflection?: string | null
          energy_level?: number | null
          mood_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entry_date?: string
          morning_intentions?: string | null
          evening_reflection?: string | null
          energy_level?: number | null
          mood_rating?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      diary_task_links: {
        Row: {
          id: string
          diary_entry_id: string
          task_id: string
          is_focus_task: boolean
          reflection_note: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          diary_entry_id: string
          task_id: string
          is_focus_task?: boolean
          reflection_note?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          diary_entry_id?: string
          task_id?: string
          is_focus_task?: boolean
          reflection_note?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      training_courses: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category: string | null
          target_hours: number | null
          status: 'active' | 'completed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category?: string | null
          target_hours?: number | null
          status?: 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category?: string | null
          target_hours?: number | null
          status?: 'active' | 'completed' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      training_templates: {
        Row: {
          id: string
          course_id: string
          template_name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          template_name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          template_name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      training_template_tasks: {
        Row: {
          id: string
          template_id: string
          task_title: string
          estimated_duration_minutes: number
          sort_order: number
          is_mandatory: boolean
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          task_title: string
          estimated_duration_minutes?: number
          sort_order?: number
          is_mandatory?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          task_title?: string
          estimated_duration_minutes?: number
          sort_order?: number
          is_mandatory?: boolean
          created_at?: string
        }
      }
      training_sessions: {
        Row: {
          id: string
          course_id: string
          template_id: string | null
          session_title: string
          scheduled_start: string
          actual_duration_minutes: number | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          template_id?: string | null
          session_title: string
          scheduled_start: string
          actual_duration_minutes?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          template_id?: string | null
          session_title?: string
          scheduled_start?: string
          actual_duration_minutes?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      student_reviews: {
        Row: {
          id: string
          user_id: string
          student_identifier: string
          assignment_title: string
          submission_date: string
          status: 'pending' | 'in_review' | 'completed' | 'needs_follow_up'
          feedback_notes: string | null
          score_or_grade: string | null
          follow_up_due_at: string | null
          follow_up_task_id: string | null
          external_risk_check_prompted: boolean
          external_system_link: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          student_identifier: string
          assignment_title: string
          submission_date: string
          status?: 'pending' | 'in_review' | 'completed' | 'needs_follow_up'
          feedback_notes?: string | null
          score_or_grade?: string | null
          follow_up_due_at?: string | null
          follow_up_task_id?: string | null
          external_risk_check_prompted?: boolean
          external_system_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          student_identifier?: string
          assignment_title?: string
          submission_date?: string
          status?: 'pending' | 'in_review' | 'completed' | 'needs_follow_up'
          feedback_notes?: string | null
          score_or_grade?: string | null
          follow_up_due_at?: string | null
          follow_up_task_id?: string | null
          external_risk_check_prompted?: boolean
          external_system_link?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          entity_type: string
          entity_id: string
          action: string
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          metadata?: Json
          created_at?: string
        }
      }
      background_jobs: {
        Row: {
          id: string
          job_type: string
          payload: Json
          status: 'queued' | 'processing' | 'completed' | 'failed' | 'dead_letter'
          attempts: number
          max_attempts: number
          next_run_at: string
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_type: string
          payload: Json
          status?: 'queued' | 'processing' | 'completed' | 'failed' | 'dead_letter'
          attempts?: number
          max_attempts?: number
          next_run_at?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_type?: string
          payload?: Json
          status?: 'queued' | 'processing' | 'completed' | 'failed' | 'dead_letter'
          attempts?: number
          max_attempts?: number
          next_run_at?: string
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
