# DayFlow

> **Everything in flow.**  
> *Your Personal Life & Productivity OS*

DayFlow is a high-performance personal productivity operating system built with Next.js 16 (App Router with Turbopack, Cache Components, and Partial Prefetching), React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL, and Supabase Auth.

---

## Architecture & Current Status

* **Phase 1**: Core Foundation, Supabase SSR Auth, 21-table database schema, and strict Row Level Security (RLS).
* **Phase 2**: Midnight Navy Design System, Application Shell, Projects, Tasks, Subtasks, Dependencies, and My Day Dashboard.
* **Phase 3**: Calendar Engine (Day, Week, Month views), Timezone & DST horizons, Meeting & Event CRUD, Canonical Task Time-Blocking, and Google Calendar architectural contracts.
* **Phase 4**: Multi-Reminder Engine, RFC 5545 Recurrence Engine, Reliable Server-Side Delivery with atomic job claiming (`claim_due_reminder_deliveries`), Exponential Backoff Retries, and Delivery History Audit Log.
* **Phase 5**: Google Calendar OAuth 2.0 & Reliable Two-Way Synchronization with AES-256-GCM token encryption, incremental sync with `syncToken`, HTTP 410 Gone full-sweep recovery, ETag sync loop prevention, canonical task protection (no deletion on external cancel), per-item sync overrides, and manual/auto sync controls.
* **Phase 6**: Daily Diary, Journal, Daily Checklist & Reflection: Local date boundary derivation across timezones, free-form markdown journaling, morning intentions, energy & mood tracking, canonical task focus list pinning via `diary_task_links`, overdue warnings, evening retrospectives, tomorrow planning, and debounced autosave.
* **Phase 7**: Training Courses, Reusable Checklists, Training Sessions & Student Assignment Reviews: Full course lifecycle, reusable checklist templates with offset scheduling, idempotent canonical task instantiation, training session time-blocking, privacy-preserving student assignment review queue, canonical follow-up action items, and manual external risk-tracker recurring reminders.
* **Phase 8**: Reports, Weekly Review, Cross-Module End-to-End QA & Production Readiness: Canonical productivity dashboards with timezone-aware presets and accessible table alternatives, structured Weekly Review workflows with immutable task preservation and diary synthesis, cross-module security and RLS verification, and complete production deployment documentation.

---

## Database Migrations

Database migrations are located in `supabase/migrations/`:
1. `20261027000000_initial_schema.sql`: Base 21 tables, triggers, indexes, and constraints.
2. `20261027000001_rls_policies.sql`: Row-level security policies enforcing user isolation.
3. `20261027000002_calendar_event_links.sql`: Project and task linking foreign keys on calendar events.
4. `20261027000003_reminder_engine_and_recurrence.sql`: Additive migration adding retry tracking (`attempt_count`, `max_attempts`, `next_retry_at`), task/event foreign keys, cached delivery titles/bodies, recurrence parent pointers, user reminder default preferences, and the atomic `claim_due_reminder_deliveries` PostgreSQL function (`FOR UPDATE SKIP LOCKED`).
5. `20261028000000_google_calendar_sync.sql`: Additive migration adding `sync_with_google` columns to `tasks` and `calendar_events`, `auto_sync_events_to_calendar` to `user_settings`, and lookup indexes on `calendar_event_mappings`.
6. `20261028000001_diary_journal_refinement.sql`: Additive migration adding `journal_content`, `wins`, `challenges`, `lessons_learned`, and `tomorrow_plan` to `diary_entries`, and performance lookup indexes on `diary_entries(user_id, entry_date DESC)` and `diary_task_links`.
7. `20261028000002_training_and_reviews_refinement.sql`: Additive migration refining `training_courses` (statuses, provider, notes), `training_templates` (offsets, archiving), `training_sessions` (calendar sync), `tasks` (course and session foreign keys), and `student_reviews` (course link, review states).
8. `20261029000000_weekly_reviews.sql`: Additive migration creating `weekly_reviews` with unique constraint `(user_id, week_start_date)`, updated_at triggers, and strict RLS policies.

---

## Multi-Reminder Engine

### Supported Items
* **Tasks**: Reminders can be relative to **Scheduled Start** or **Deadline**.
* **Calendar Events**: Reminders relative to **Event Start Time**.
* Multiple concurrent reminders per item (e.g., at time of item, 10m before, 1h before, 1d before, custom offset).

### Lifecycle & Scheduling Flow
1. **Creation / Update**: Adding or editing reminders inserts/updates `reminder_rules` and computes `scheduled_for = base_time - offset_minutes`.
2. **Idempotency**: Deliveries are created in `reminder_deliveries` with a unique `idempotency_key = `${itemType}_${itemId}_rule_${ruleId}_${scheduledFor}``.
3. **Rescheduling / Timeline Shifts**: When an item's scheduled start time or deadline changes, `recalculateDeliveriesForScheduleChange` automatically updates all pending delivery records.
4. **Completion & Deletion**: When an item is marked completed, cancelled, or deleted, all pending deliveries are immediately transitioned to `status = 'cancelled'`. Historical delivery records remain preserved for auditability.

---

## Recurrence Engine

DayFlow implements an RFC 5545 compliant recurrence engine in `src/lib/recurrence/`:
* **Frequencies**: `daily`, `weekly`, `monthly`.
* **Interval**: Custom intervals (every N days, weeks, months).
* **Weekly Weekdays**: Selected weekday bitmasks (`MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU`).
* **Month-End Semantics**: When a monthly recurrence lands on day 31, it automatically clamps to the actual last day on shorter months (e.g. Feb 28/29 or April 30).
* **DST Safety**: Preserves the local wall-clock time in the user's configured timezone across Daylight Saving Time boundaries using `src/lib/timezone.ts`.
* **Bounded Generation**: Occurrences are generated within a bounded horizon (max 50 instances) or on-demand when the previous recurring instance is completed.
* **Series vs Instance**: Each occurrence has a stable identity and its own completion/cancellation state, linking to the series parent via `recurrence_parent_id`.

---

## Reliable Server-Side Delivery & Schedulers

### Delivery Route Handler
`GET/POST /api/cron/reminders`:
* Protected via `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`.
* Invokes `claim_due_reminder_deliveries(batch_size = 50)` which locks and transitions due records to `processing` atomically using PostgreSQL's `FOR UPDATE SKIP LOCKED`.
* Prevents concurrent scheduler workers from delivering duplicate notifications.
* Retries transient errors using exponential backoff (1 min, 5 min, 15 min up to `max_attempts = 3`).

### Scheduler Setup
* **Vercel Cron**: Configured in `vercel.json` (`schedule: "* * * * *"`). Automatically passes `CRON_SECRET`.
* **External Cron (GitHub Actions / Cloudflare Workers / cron-job.org)**:
  ```bash
  curl -X POST "https://your-domain.com/api/cron/reminders" \
       -H "Authorization: Bearer your-secure-cron-trigger-secret"
  ```

### Notification Providers
* **In-App Notifications**: Active out-of-the-box. Written to the database and displayed in the Delivery History view.
* **Web Push Notifications**: Standard VAPID push protocol. Active when `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are provided.
* **Email Notifications**: Adapter ready for Resend / SendGrid / SMTP when `EMAIL_PROVIDER_API_KEY` is provided.

---

## Google Calendar OAuth 2.0 & Bidirectional Synchronization

### Architecture & Security
* **OAuth 2.0**: Server-side authorization code flow (`/api/auth/google` and `/api/auth/callback/google`). Minimum required scopes (`https://www.googleapis.com/auth/calendar.events` and `https://www.googleapis.com/auth/userinfo.email`). Single-use CSRF tokens bound to the initiating authenticated user session (`<userId>.<nonce>`), validated with `SameSite=Lax` and production `Secure` flags. All sensitive codes, tokens, and callback params are strictly excluded from logs.
* **Token Encryption at Rest**: Access and refresh tokens are encrypted using AES-256-GCM (`v1:<iv>:<tag>:<ciphertext>`) via `CALENDAR_ENCRYPTION_KEY` with unique 12-byte random nonces per encryption. Fails closed if the key is missing or invalid (< 32 chars). Supports seamless key rotation via `rotateTokenEncryption`. Tokens and secrets are never exposed to client components or browsers.
* **Automatic Refresh & Reconnect**: Refreshes expired access tokens transparently with a 5-minute pre-expiry buffer. If reconnecting an already authorized account where Google omits a new refresh token, existing refresh credentials are safely retained without accidental disconnection.

### Bidirectional Sync Mechanics & Conflict Policy
* **Outbound Push (DayFlow -> Google Calendar)**:
  * Syncs standalone calendar events and time-blocked tasks (`scheduled_start_at` and `scheduled_end_at`).
  * Pure tasks without calendar time blocks are never pushed to the calendar.
  * Conditional updates with Google ETags (`If-Match`).
  * **HTTP 412 Conflict Reconciliation**: When an ETag mismatch (412) occurs, the engine retrieves the latest remote event and resolves conflicts using true modification timestamps (`event.updated_at` vs Google's `item.updated`), never treating ETags as timestamps.
  * Completed tasks remain time-blocked in Google Calendar and are not deleted.
  * Supports per-item sync override (`sync_with_google = true | false | null`) as well as user default settings.
* **Inbound Pull (Google Calendar -> DayFlow)**:
  * Incremental synchronization via Google `syncToken` following full pagination rules. A new sync token is persisted ONLY after all pages are retrieved and processed successfully.
  * **Loop Prevention**: Compares incoming `item.etag` and `remote_updated_at` against stored mapping metadata to prevent outbound echo cycles.
  * **HTTP 410 Gone Recovery**: If a `syncToken` expires, the engine resets `sync_token` and triggers a full reconciliation sweep across a bounded window (-30 days to +90 days).
  * **Canonical Task Protection**: If an external Google Calendar event representing a DayFlow task is deleted or cancelled in Google Calendar, DayFlow clears the task's `scheduled_start_at` and `scheduled_end_at`, but **NEVER deletes the task** and preserves `deadline_at` and completion history intact.
* **Concurrency Coordination & Lock Leases**:
  * Atomically leases connection sync runs (`calendar_sync_state.sync_status = 'syncing'`) with an expiration window (90s) to prevent overlapping runs and cursor/token races.
  * Audits `last_pushed_count`, `last_pulled_count`, and `last_conflict_count` without storing secrets.

### Google Cloud Console Configuration
1. Navigate to [Google Cloud Console](https://console.cloud.google.com/) -> **APIs & Services** -> **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/callback/google` (local development)
   - `https://your-domain.com/api/auth/callback/google` (production)
4. Enable the **Google Calendar API** in API Library.
5. Populate `.env.local` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and `CALENDAR_ENCRYPTION_KEY`.

---

## Daily Diary, Journal & Reflection Engine

### Architecture & Daily Review Workflow
* **Local Date Boundaries Across Timezones**: The diary date is computed using the user's configured IANA timezone via `getDayRangeForDateString(dateString, timezone)` and `getLocalDateString(timezone)` in `src/lib/timezone.ts`, rather than relying on naïve UTC dates. Events and tasks near midnight are attributed to the exact local calendar date.
* **4-Step Daily Review Workflow**:
  1. **Morning Planning**: Record daily intention / primary goal (`morning_intentions`) and non-intrusive 5-point energy and mood ratings. Pin tasks to the primary focus list for the day.
  2. **Day Log & Checklist**: Free-form markdown journal (`journal_content`) for meeting notes, ideas, and running thoughts. Check off canonical tasks in-place, view scheduled calendar time-blocks, and check due dates.
  3. **Evening Retrospective**: Review completed work, celebrate wins (`wins`), diagnose challenges (`challenges`), and capture lessons learned (`lessons_learned`) and end-of-day reflection notes (`evening_reflection`).
  4. **Tomorrow Planning**: Formulate tomorrow's plan (`tomorrow_plan`) and carry-forward priorities.
* **Canonical Task Integrity**:
  * Pinned focus tasks link directly to `tasks` via `diary_task_links(diary_entry_id, task_id)`.
  * Saving diary entries **never mutates or deletes canonical tasks** and never alters deadlines or scheduled slots.
  * Overdue tasks are displayed with an amber warning badge for awareness without silently changing their deadlines.
* **Auto-Save & Status Protection**:
  * Debounced auto-save (1500ms after typing) coupled with an explicit manual "Save" button.
  * Real-time visible save status indicator: `Saved` (green check), `Saving...` (spinner), `Unsaved changes` (amber pulse), `Error` (red alert).

---

## Local Development & Testing

```bash
# Run typecheck
npm run typecheck

# Run linter
npm run lint

# Run all test suites
npm run test

# Run Next.js production build with Turbopack
npm run build
```

---

## Environment Variables (.env.local)

See `.env.example` for all configuration templates:
* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`
* `SUPABASE_SERVICE_ROLE_KEY`
* `CRON_SECRET`
* `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (optional)
* `VAPID_PRIVATE_KEY` (optional)
* `EMAIL_PROVIDER_API_KEY` (optional)
