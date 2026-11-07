# Google Calendar Bidirectional Integration Architecture

This document defines the production integration architecture for bidirectional synchronization between Workday OS and Google Calendar.

---

## 1. Schema & Mapping Architecture

Workday OS uses three dedicated database tables created in Phase 1:

1. **`calendar_connections`**: Stores user OAuth credentials per provider (`provider = 'google'`), account email, AES-256 encrypted access and refresh tokens, scopes, and expiration timestamps.
2. **`calendar_event_mappings`**: Connects internal entity IDs (`calendar_event_id` or `task_id`) with Google Calendar entities (`google_calendar_id`, `google_event_id`, `etag`). Enforces mutual exclusivity:
   ```sql
   CONSTRAINT chk_mapping_target CHECK (
       (task_id IS NOT NULL AND calendar_event_id IS NULL) OR
       (task_id IS NULL AND calendar_event_id IS NOT NULL)
   )
   ```
3. **`calendar_sync_state`**: Stores sync tokens (`sync_token`), Google Push Webhook subscription metadata (`channel_id`, `resource_id`, `channel_expiration`), and error/health states.

---

## 2. Source and Ownership Metadata

- **Workday Origin**: Created in Workday OS with `sync_status = 'pending_push'`. Pushed to Google via `events.insert()`, storing Google's returned `id` and `etag` in `calendar_event_mappings`.
- **Google Origin**: Imported via Google webhook push or incremental poll. Inserted into `calendar_events` with `event_type = 'external'`, and mapped in `calendar_event_mappings` with `sync_status = 'synced'`.
- **Task vs Event Separation**: Standalone calendar meetings map to `calendar_event_id`. Time-blocked tasks map to `task_id`. A task is never duplicated to appear in Google Calendar; its mapping record references `task_id`.

---

## 3. Idempotency & Duplicate Prevention

- **Unique Constraint**: `CONSTRAINT uq_google_event UNIQUE (calendar_connection_id, google_calendar_id, google_event_id)` ensures that a single Google Calendar event cannot be mapped multiple times.
- **Lookup Before Create**: During incoming sync, Workday checks `calendar_event_mappings` by `(calendar_connection_id, google_calendar_id, google_event_id)`. If present, it executes an `UPDATE` rather than `INSERT`.
- **Outbound Idempotency**: Workday tracks the Google `id` in the mapping table. Any subsequent update sends an `events.patch()` with the target `google_event_id`.

---

## 4. Concurrent-Edit & Conflict Resolution Rules

When an event or time-blocked task is modified in both Workday OS and Google Calendar concurrently:
1. **ETag Verification**: Google returns an `ETag` on every read and write. Workday OS stores `etag` in `calendar_event_mappings`.
2. **Detection**:
   - If Google's incoming event has an updated `etag`, but Workday OS has local changes made since `last_synced_at`, a **Conflict** is flagged (`sync_status = 'conflict'`).
3. **Resolution Policy**:
   - **Default**: *Last-Write-Wins (LWW)* based on max of `calendar_events.updated_at` and Google's RFC3339 `updated` timestamp.
   - **Critical Meetings**: In high-contention scenarios, the record is marked `conflict` and surfaced in the UI for user review without destroying either record.

---

## 5. Deletion & Cancellation Semantics

- **Google Event Deleted**: When Google returns `status: "cancelled"` in the sync feed:
  - If linked to `calendar_event_id`: Deletes the local event or marks `archived` per user retention preferences.
  - If linked to `task_id`: Clears `scheduled_start_at` and `scheduled_end_at` from the task, but **never deletes the task** or its `deadline_at`!
- **Workday Event Deleted**: Sends `events.delete(google_calendar_id, google_event_id)` to Google Calendar. On HTTP 204 or HTTP 410 (Already gone), removes the mapping record.

---

## 6. Recurrence Mapping Strategy

- **Master vs Instances**:
  - Google Calendar represents recurring events with a single Master Event (holding `recurrence: ["RRULE:..."]`) and individual instance exceptions sharing the same base ID with a recurrence timestamp suffix.
  - In Phase 3, recurring event rules (`recurrence_rule`) are stored on `calendar_events` as an RFC5545 RRULE string.
  - Full recurrence expansion and exception synchronization will be implemented in the later reminders & sync engine phase.

---

## 7. Timezone-Safe RFC3339 Serialization

- Google Calendar API requires timestamps formatted in RFC3339:
  - Timed events: `{ "dateTime": "2026-10-28T09:00:00-04:00", "timeZone": "America/New_York" }`
  - All-day events: `{ "date": "2026-10-28" }`
- Workday OS preserves the original IANA timezone and validates start/end boundaries with `localPartsToUtc` and `shiftLocalCalendarDay` to avoid UTC clock drift during Daylight Saving Time (DST) changes.

---

## 8. Incremental Sync & Error Recovery

1. **Incremental Sync**: Workday requests changes using Google's `syncToken` parameter (`events.list(calendarId, syncToken=...)`). Only new, updated, or deleted events are transferred.
2. **Sync Token Invalidation (HTTP 410)**:
   - If Google's sync token expires (typically after a few weeks of inactivity), Google returns `HTTP 410 Gone`.
   - **Recovery Protocol**:
     1. Discard the expired `sync_token`.
     2. Initiate a full reconciliation sweep of the current calendar window (last 30 days to next 90 days).
     3. Match existing records by `google_event_id`.
     4. Store the new `nextSyncToken` in `calendar_sync_state`.

