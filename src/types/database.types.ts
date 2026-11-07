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
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          default_task_duration_minutes: number
          auto_sync_tasks_to_calendar: boolean
          auto_sync_events_to_calendar: boolean
          default_calendar_id: string | null
          week_start_day: number
          theme_preference: 'dark' | 'light' | 'system'
          notification_web_push: boolean
          notification_in_app: boolean
          notification_email: boolean
          task_default_reminders: Json
          event_default_reminders: Json
          reminders_enabled_by_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          default_task_duration_minutes?: number
          auto_sync_tasks_to_calendar?: boolean
          auto_sync_events_to_calendar?: boolean
          default_calendar_id?: string | null
          week_start_day?: number
          theme_preference?: 'dark' | 'light' | 'system'
          notification_web_push?: boolean
          notification_in_app?: boolean
          notification_email?: boolean
          task_default_reminders?: Json
          event_default_reminders?: Json
          reminders_enabled_by_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          default_task_duration_minutes?: number
          auto_sync_tasks_to_calendar?: boolean
          auto_sync_events_to_calendar?: boolean
          default_calendar_id?: string | null
          week_start_day?: number
          theme_preference?: 'dark' | 'light' | 'system'
          notification_web_push?: boolean
          notification_in_app?: boolean
          notification_email?: boolean
          task_default_reminders?: Json
          event_default_reminders?: Json
          reminders_enabled_by_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
          sync_with_google: boolean | null
          course_id: string | null
          training_session_id: string | null
          checklist_template_task_id: string | null
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
          sync_with_google?: boolean | null
          course_id?: string | null
          training_session_id?: string | null
          checklist_template_task_id?: string | null
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
          sync_with_google?: boolean | null
          course_id?: string | null
          training_session_id?: string | null
          checklist_template_task_id?: string | null
          estimated_duration_minutes?: number | null
          completed_at?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          recurrence_parent_id: string | null
          sync_with_google: boolean | null
          project_id: string | null
          task_id: string | null
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
          recurrence_parent_id?: string | null
          sync_with_google?: boolean | null
          project_id?: string | null
          task_id?: string | null
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
          recurrence_parent_id?: string | null
          sync_with_google?: boolean | null
          project_id?: string | null
          task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
          remote_updated_at: string | null
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
          remote_updated_at?: string | null
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
          remote_updated_at?: string | null
          sync_status?: 'synced' | 'pending_push' | 'pending_pull' | 'conflict' | 'orphaned'
        }
        Relationships: []
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
          sync_status: 'idle' | 'syncing' | 'error'
          sync_started_at: string | null
          last_pushed_count: number
          last_pulled_count: number
          last_conflict_count: number
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
          sync_status?: 'idle' | 'syncing' | 'error'
          sync_started_at?: string | null
          last_pushed_count?: number
          last_pulled_count?: number
          last_conflict_count?: number
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
          sync_status?: 'idle' | 'syncing' | 'error'
          sync_started_at?: string | null
          last_pushed_count?: number
          last_pulled_count?: number
          last_conflict_count?: number
          last_successful_sync?: string | null
          last_error_message?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reminder_rules: {
        Row: {
          id: string
          user_id: string
          task_id: string | null
          calendar_event_id: string | null
          offset_minutes: number
          is_relative_to_start: boolean
          channel: 'in_app' | 'web_push' | 'email' | 'google_calendar'
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
          channel?: 'in_app' | 'web_push' | 'email' | 'google_calendar'
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
          channel?: 'in_app' | 'web_push' | 'email' | 'google_calendar'
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      reminder_deliveries: {
        Row: {
          id: string
          user_id: string
          reminder_rule_id: string
          task_id: string | null
          calendar_event_id: string | null
          scheduled_for: string
          status: 'scheduled' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          attempt_count: number
          max_attempts: number
          last_attempt_at: string | null
          next_retry_at: string | null
          title: string | null
          body: string | null
          sent_at: string | null
          error_message: string | null
          idempotency_key: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reminder_rule_id: string
          task_id?: string | null
          calendar_event_id?: string | null
          scheduled_for: string
          status?: 'scheduled' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          attempt_count?: number
          max_attempts?: number
          last_attempt_at?: string | null
          next_retry_at?: string | null
          title?: string | null
          body?: string | null
          sent_at?: string | null
          error_message?: string | null
          idempotency_key: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reminder_rule_id?: string
          task_id?: string | null
          calendar_event_id?: string | null
          scheduled_for?: string
          status?: 'scheduled' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'dismissed'
          attempt_count?: number
          max_attempts?: number
          last_attempt_at?: string | null
          next_retry_at?: string | null
          title?: string | null
          body?: string | null
          sent_at?: string | null
          error_message?: string | null
          idempotency_key?: string
          created_at?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          id: string
          user_id: string
          entry_date: string
          morning_intentions: string | null
          journal_content: string | null
          evening_reflection: string | null
          wins: string | null
          challenges: string | null
          lessons_learned: string | null
          tomorrow_plan: string | null
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
          journal_content?: string | null
          evening_reflection?: string | null
          wins?: string | null
          challenges?: string | null
          lessons_learned?: string | null
          tomorrow_plan?: string | null
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
          journal_content?: string | null
          evening_reflection?: string | null
          wins?: string | null
          challenges?: string | null
          lessons_learned?: string | null
          tomorrow_plan?: string | null
          energy_level?: number | null
          mood_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
      training_courses: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          provider: string | null
          category: string | null
          target_hours: number | null
          status: 'planned' | 'active' | 'paused' | 'completed' | 'archived'
          start_date: string | null
          end_date: string | null
          personal_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          provider?: string | null
          category?: string | null
          target_hours?: number | null
          status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived'
          start_date?: string | null
          end_date?: string | null
          personal_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          provider?: string | null
          category?: string | null
          target_hours?: number | null
          status?: 'planned' | 'active' | 'paused' | 'completed' | 'archived'
          start_date?: string | null
          end_date?: string | null
          personal_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_templates: {
        Row: {
          id: string
          course_id: string
          template_name: string
          description: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          template_name: string
          description?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          template_name?: string
          description?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_template_tasks: {
        Row: {
          id: string
          template_id: string
          task_title: string
          estimated_duration_minutes: number
          sort_order: number
          is_mandatory: boolean
          due_offset_days: number
          relative_to: string
          is_archived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          template_id: string
          task_title: string
          estimated_duration_minutes?: number
          sort_order?: number
          is_mandatory?: boolean
          due_offset_days?: number
          relative_to?: string
          is_archived?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          template_id?: string
          task_title?: string
          estimated_duration_minutes?: number
          sort_order?: number
          is_mandatory?: boolean
          due_offset_days?: number
          relative_to?: string
          is_archived?: boolean
          created_at?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          id: string
          course_id: string
          template_id: string | null
          session_title: string
          scheduled_start: string
          scheduled_end: string | null
          timezone: string
          location: string | null
          meeting_url: string | null
          calendar_event_id: string | null
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
          scheduled_end?: string | null
          timezone?: string
          location?: string | null
          meeting_url?: string | null
          calendar_event_id?: string | null
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
          scheduled_end?: string | null
          timezone?: string
          location?: string | null
          meeting_url?: string | null
          calendar_event_id?: string | null
          actual_duration_minutes?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_reviews: {
        Row: {
          id: string
          user_id: string
          student_identifier: string
          assignment_title: string
          submission_date: string
          status: 'awaiting_review' | 'in_review' | 'feedback_ready' | 'completed' | 'pending' | 'needs_follow_up'
          feedback_notes: string | null
          score_or_grade: string | null
          course_id: string | null
          reviewed_at: string | null
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
          status?: 'awaiting_review' | 'in_review' | 'feedback_ready' | 'completed' | 'pending' | 'needs_follow_up'
          feedback_notes?: string | null
          score_or_grade?: string | null
          course_id?: string | null
          reviewed_at?: string | null
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
          status?: 'awaiting_review' | 'in_review' | 'feedback_ready' | 'completed' | 'pending' | 'needs_follow_up'
          feedback_notes?: string | null
          score_or_grade?: string | null
          course_id?: string | null
          reviewed_at?: string | null
          follow_up_due_at?: string | null
          follow_up_task_id?: string | null
          external_risk_check_prompted?: boolean
          external_system_link?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          id: string
          user_id: string
          week_start_date: string
          reflection_content: string | null
          wins: string | null
          challenges: string | null
          lessons_learned: string | null
          next_week_priorities: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          week_start_date: string
          reflection_content?: string | null
          wins?: string | null
          challenges?: string | null
          lessons_learned?: string | null
          next_week_priorities?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          week_start_date?: string
          reflection_content?: string | null
          wins?: string | null
          challenges?: string | null
          lessons_learned?: string | null
          next_week_priorities?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
