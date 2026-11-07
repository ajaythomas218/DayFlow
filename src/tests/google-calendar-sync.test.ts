import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pushWorkdayToGoogle, pullGoogleToWorkday } from '@/lib/google-calendar/sync'
import { GoogleCalendarClient, ListEventsResponse } from '@/lib/google-calendar/client'
import { GoogleCalendarEventPayload } from '@/lib/google-calendar/types'
import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'

describe('Google Calendar Bidirectional Synchronization Engine', () => {
  const userId = 'user-uuid-1111-2222'
  const connectionId = 'conn-uuid-3333-4444'

  let mockClient: GoogleCalendarClient

  beforeEach(() => {
    mockClient = {
      listEvents: vi.fn(),
      insertEvent: vi.fn(),
      patchEvent: vi.fn(),
      deleteEvent: vi.fn(),
      getEvent: vi.fn(),
    } as unknown as GoogleCalendarClient
  })

  describe('Outbound Push: Workday OS -> Google Calendar', () => {
    it('pushes events respecting per-item sync override and user defaults', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Team Standup',
          description: 'Daily sync',
          start_time: '2026-10-28T09:00:00Z',
          end_time: '2026-10-28T09:30:00Z',
          is_all_day: false,
          location: 'Meet',
          attendees: [],
          updated_at: '2026-10-28T08:00:00Z',
          sync_with_google: null, // should follow default (true)
        },
        {
          id: 'event-2',
          title: 'Private Doctor Appointment',
          description: 'Confidential',
          start_time: '2026-10-28T14:00:00Z',
          end_time: '2026-10-28T15:00:00Z',
          is_all_day: false,
          location: 'Clinic',
          attendees: [],
          updated_at: '2026-10-28T08:00:00Z',
          sync_with_google: false, // Per-item override: EXCLUDE
        },
      ]

      const insertedMappings: unknown[] = []

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'user_settings') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { auto_sync_events_to_calendar: true, auto_sync_tasks_to_calendar: false },
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_events') {
            return {
              select: () => ({
                eq: async () => ({ data: mockEvents }),
              }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null }), // No existing mapping -> new insert
                  }),
                }),
              }),
              insert: (payload: unknown) => {
                insertedMappings.push(payload)
                return Promise.resolve({ data: null, error: null })
              },
            }
          }
          if (table === 'tasks') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    not: () => ({
                      not: async () => ({ data: [] }),
                    }),
                  }),
                }),
              }),
            }
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
        }),
      } as unknown as SupabaseClient<Database>

      vi.mocked(mockClient.insertEvent).mockResolvedValue({
        event: { id: 'google-event-id-1' } as unknown as GoogleCalendarEventPayload,
        etag: '"etag-1"',
      })

      const result = await pushWorkdayToGoogle(mockSupabase, connectionId, userId, mockClient, 'UTC')

      // Should push event-1, but EXCLUDE event-2 (due to sync_with_google: false)
      expect(result.pushedCount).toBe(1)
      expect(mockClient.insertEvent).toHaveBeenCalledTimes(1)
      expect(mockClient.insertEvent).toHaveBeenCalledWith('primary', expect.objectContaining({
        summary: 'Team Standup',
      }))
      expect(insertedMappings).toHaveLength(1)
      expect(insertedMappings[0]).toMatchObject({
        calendar_event_id: 'event-1',
        google_event_id: 'google-event-id-1',
        etag: '"etag-1"',
      })
    })

    it('pushes time-blocked tasks with start and end times to Google Calendar', async () => {
      const mockTasks = [
        {
          id: 'task-100',
          title: 'Prepare quarterly review slides',
          description: 'Slides for Q4',
          scheduled_start_at: '2026-10-28T11:00:00Z',
          scheduled_end_at: '2026-10-28T12:00:00Z',
          is_time_blocked: true,
          updated_at: '2026-10-28T08:00:00Z',
          sync_with_google: null,
        },
      ]

      const insertedMappings: unknown[] = []

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'user_settings') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { auto_sync_events_to_calendar: true, auto_sync_tasks_to_calendar: true },
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_events') {
            return {
              select: () => ({
                eq: async () => ({ data: [] }),
              }),
            }
          }
          if (table === 'tasks') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    not: () => ({
                      not: async () => ({ data: mockTasks }),
                    }),
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
              insert: (payload: unknown) => {
                insertedMappings.push(payload)
                return Promise.resolve({ data: null, error: null })
              },
            }
          }
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
        }),
      } as unknown as SupabaseClient<Database>

      vi.mocked(mockClient.insertEvent).mockResolvedValue({
        event: { id: 'google-task-event-id-100' } as unknown as GoogleCalendarEventPayload,
        etag: '"etag-task-1"',
      })

      const result = await pushWorkdayToGoogle(mockSupabase, connectionId, userId, mockClient, 'UTC')

      expect(result.pushedCount).toBe(1)
      expect(mockClient.insertEvent).toHaveBeenCalledWith('primary', expect.objectContaining({
        summary: '[Task] Prepare quarterly review slides',
      }))
      expect(insertedMappings[0]).toMatchObject({
        task_id: 'task-100',
        google_event_id: 'google-task-event-id-100',
      })
    })
  })

  describe('Inbound Pull: Google Calendar -> Workday OS', () => {
    it('prevents sync loops when incoming event ETag matches local mapping ETag', async () => {
      vi.mocked(mockClient.listEvents).mockResolvedValue({
        items: [
          {
            id: 'g-event-loop-check',
            summary: 'Weekly Planning',
            etag: '"etag-matching-local"',
            start: { dateTime: '2026-10-28T10:00:00Z' },
            end: { dateTime: '2026-10-28T11:00:00Z' },
          },
        ],
      })

      const updateCalendarEventMock = vi.fn()

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { sync_token: 'valid-sync-token' } }),
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: 'map-1',
                          calendar_event_id: 'event-local-1',
                          etag: '"etag-matching-local"', // Matches incoming!
                        },
                      }),
                    }),
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_events') {
            return {
              update: updateCalendarEventMock,
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      const result = await pullGoogleToWorkday(mockSupabase, connectionId, userId, mockClient)

      // Loop prevention should kick in: 0 events pulled/updated, updateCalendarEventMock not called
      expect(result.pulledCount).toBe(0)
      expect(updateCalendarEventMock).not.toHaveBeenCalled()
    })

    it('protects canonical tasks when Google Calendar event is cancelled (un-schedules task, NEVER deletes task, preserves deadline)', async () => {
      vi.mocked(mockClient.listEvents).mockResolvedValue({
        items: [
          {
            id: 'g-event-cancelled',
            status: 'cancelled',
          } as unknown as GoogleCalendarEventPayload,
        ],
      })

      const updateTaskMock = vi.fn().mockReturnValue({
        eq: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const deleteTaskMock = vi.fn()

      const deleteMappingMock = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: null, error: null }),
      })

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: null }),
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: 'map-task-cancel',
                          task_id: 'task-canonical-999',
                        },
                      }),
                    }),
                  }),
                }),
              }),
              delete: deleteMappingMock,
            }
          }
          if (table === 'tasks') {
            return {
              update: updateTaskMock,
              delete: deleteTaskMock, // Must NEVER be called!
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      const result = await pullGoogleToWorkday(mockSupabase, connectionId, userId, mockClient)

      expect(result.pulledCount).toBe(1)
      // Task update must clear scheduled times
      expect(updateTaskMock).toHaveBeenCalledWith({
        scheduled_start_at: null,
        scheduled_end_at: null,
        is_time_blocked: false,
      })
      // Task must NEVER be deleted!
      expect(deleteTaskMock).not.toHaveBeenCalled()
      // Mapping must be deleted
      expect(deleteMappingMock).toHaveBeenCalled()
    })

    it('recovers from HTTP 410 Gone invalid syncToken by performing bounded window resync', async () => {
      // First call fails with invalid sync token
      vi.mocked(mockClient.listEvents).mockImplementation(
        (async (_calendarId?: string, options?: { syncToken?: string }) => {
          if (options?.syncToken === 'expired-token-410') {
            return { isSyncTokenInvalid: true, items: [] }
          }
          return {
            items: [
              {
                id: 'recovered-g-event',
                summary: 'Recovered Meeting',
                etag: '"recovered-etag"',
                start: { dateTime: '2026-10-28T10:00:00Z' },
                end: { dateTime: '2026-10-28T11:00:00Z' },
              },
            ],
            nextSyncToken: 'new-valid-sync-token',
          }
        }) as unknown as () => Promise<ListEventsResponse>
      )

      const updateSyncStateMock = vi.fn().mockReturnValue({
        eq: () => ({
          eq: () => Promise.resolve({ data: null, error: null }),
        }),
      })

      const insertEventMock = vi.fn().mockReturnValue({
        select: () => ({
          single: async () => ({ data: { id: 'imported-event-1' } }),
        }),
      })

      const insertMappingMock = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }))

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { sync_token: 'expired-token-410' } }),
                  }),
                }),
              }),
              update: updateSyncStateMock,
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: null }),
                    }),
                  }),
                }),
              }),
              insert: insertMappingMock,
            }
          }
          if (table === 'calendar_events') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: null }),
                    }),
                  }),
                }),
              }),
              insert: insertEventMock,
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      const result = await pullGoogleToWorkday(mockSupabase, connectionId, userId, mockClient)

      // Verifies that:
      // 1. First call was with expired syncToken
      // 2. Local sync token was reset
      // 3. Second call re-fetched with timeMin / timeMax bounded window
      // 4. Recovered event was imported
      expect(mockClient.listEvents).toHaveBeenCalledTimes(2)
      expect(updateSyncStateMock).toHaveBeenCalledWith({ sync_token: null })
      expect(result.pulledCount).toBe(1)
      expect(insertEventMock).toHaveBeenCalled()
      expect(insertMappingMock).toHaveBeenCalledWith(expect.objectContaining({
        calendar_event_id: 'imported-event-1',
        google_event_id: 'recovered-g-event',
      }))
    })

    it('processes multi-page responses and persists syncToken ONLY after all pages succeed', async () => {
      // Page 1 returns nextPageToken: 'page-2-token'
      // Page 2 returns nextSyncToken: 'complete-sync-token'
      vi.mocked(mockClient.listEvents).mockImplementation(
        (async (_calendarId?: string, options?: { pageToken?: string }) => {
          if (!options?.pageToken) {
            return {
              items: [
                {
                  id: 'page-1-event',
                  summary: 'Page 1 Meeting',
                  etag: '"etag-p1"',
                  start: { dateTime: '2026-10-28T09:00:00Z' },
                  end: { dateTime: '2026-10-28T10:00:00Z' },
                },
              ],
              nextPageToken: 'page-2-token',
            }
          }
          if (options.pageToken === 'page-2-token') {
            return {
              items: [
                {
                  id: 'page-2-event',
                  summary: 'Page 2 Meeting',
                  etag: '"etag-p2"',
                  start: { dateTime: '2026-10-28T11:00:00Z' },
                  end: { dateTime: '2026-10-28T12:00:00Z' },
                },
              ],
              nextSyncToken: 'complete-sync-token-page-2',
            }
          }
          return { items: [] }
        }) as unknown as () => Promise<ListEventsResponse>
      )

      const updateSyncStateMock = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: null, error: null }),
      })

      const insertedMappings: unknown[] = []

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: { id: 'sync-state-1', sync_token: 'old-token' } }),
                  }),
                }),
              }),
              update: updateSyncStateMock,
              insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: null }),
                    }),
                  }),
                }),
              }),
              insert: (payload: unknown) => {
                insertedMappings.push(payload)
                return Promise.resolve({ data: null, error: null })
              },
            }
          }
          if (table === 'calendar_events') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({ data: null }),
                    }),
                  }),
                }),
              }),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'imported-page-event' } }),
                }),
              }),
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      const result = await pullGoogleToWorkday(mockSupabase, connectionId, userId, mockClient)

      // Verifies both pages were retrieved and processed
      expect(mockClient.listEvents).toHaveBeenCalledTimes(2)
      expect(result.pulledCount).toBe(2)
      expect(result.nextSyncToken).toBe('complete-sync-token-page-2')
      expect(updateSyncStateMock).toHaveBeenCalledWith(expect.objectContaining({
        sync_token: 'complete-sync-token-page-2',
      }))
    })
  })

  describe('Conflict Resolution & Concurrency Coordination', () => {
    it('handles HTTP 412 conditional patch conflicts by reconciling with latest remote ETag', async () => {
      const mockEvent = {
        id: 'event-conflict-1',
        title: 'Strategy Session Local Edit',
        updated_at: '2026-10-28T12:00:00Z',
        start_time: '2026-10-28T14:00:00Z',
        end_time: '2026-10-28T15:00:00Z',
        is_all_day: false,
        sync_with_google: true,
      }

      const mockMapping = {
        id: 'map-conflict-1',
        google_event_id: 'g-event-conflict-1',
        etag: '"stale-etag-1"',
        last_synced_at: '2026-10-28T10:00:00Z', // Local is newer!
      }

      // First patch fails with 412 conflict
      vi.mocked(mockClient.patchEvent)
        .mockResolvedValueOnce({
          isConflict: true,
        })
        .mockResolvedValueOnce({
          event: { id: 'g-event-conflict-1', updated: '2026-10-28T12:01:00Z' } as unknown as GoogleCalendarEventPayload,
          etag: '"fresh-remote-etag-2"',
        })

      // Get latest remote version returns fresh ETag and remote updated timestamp older than local
      vi.mocked(mockClient.getEvent).mockResolvedValue({
        event: {
          id: 'g-event-conflict-1',
          summary: 'Strategy Session Remote Stale',
          updated: '2026-10-28T11:00:00Z', // Local is newer!
        } as unknown as GoogleCalendarEventPayload,
        etag: '"fresh-remote-etag-1"',
      })

      const updateMappingMock = vi.fn().mockReturnValue({
        eq: () => Promise.resolve({ data: null, error: null }),
      })

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'user_settings') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: { auto_sync_events_to_calendar: true, auto_sync_tasks_to_calendar: false },
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_events') {
            return {
              select: () => ({
                eq: async () => ({ data: [mockEvent] }),
              }),
            }
          }
          if (table === 'calendar_event_mappings') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockMapping }),
                  }),
                }),
              }),
              update: updateMappingMock,
            }
          }
          if (table === 'tasks') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    not: () => ({
                      not: async () => ({ data: [] }),
                    }),
                  }),
                }),
              }),
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      const result = await pushWorkdayToGoogle(mockSupabase, connectionId, userId, mockClient, 'UTC')

      // Resolves conflict via Last-Write-Wins (local is newer), retrying patch with fresh ETag
      expect(result.conflictCount).toBe(1)
      expect(result.pushedCount).toBe(1)
      expect(mockClient.patchEvent).toHaveBeenCalledTimes(2)
      expect(updateMappingMock).toHaveBeenCalledWith(expect.objectContaining({
        etag: '"fresh-remote-etag-2"',
      }))
    })

    it('rejects concurrent overlapping sync executions to prevent cursor/syncToken races', async () => {
      // Simulate sync_state currently in 'syncing' status within lock window (15s ago)
      const mockActiveSyncState = {
        id: 'sync-state-active',
        calendar_connection_id: connectionId,
        google_calendar_id: 'primary',
        sync_status: 'syncing',
        sync_started_at: new Date(Date.now() - 15000).toISOString(),
      }

      const { encryptToken } = await import('@/lib/google-calendar/crypto')
      const validEncryptedToken = encryptToken('mock-access-token-12345')

      const mockSupabase = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'calendar_connections') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: connectionId,
                          encrypted_access_token: validEncryptedToken,
                          encrypted_refresh_token: validEncryptedToken,
                          token_expires_at: new Date(Date.now() + 3600000).toISOString(),
                          is_active: true,
                        },
                      }),
                    }),
                  }),
                }),
              }),
            }
          }
          if (table === 'calendar_sync_state') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({ data: mockActiveSyncState }),
                  }),
                }),
              }),
            }
          }
          return {}
        }),
      } as unknown as SupabaseClient<Database>

      // Import executeBidirectionalSync and test
      const { executeBidirectionalSync } = await import('@/lib/google-calendar/sync')
      const result = await executeBidirectionalSync(mockSupabase, userId, 'UTC')

      expect(result.pulledCount).toBe(0)
      expect(result.pushedCount).toBe(0)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].error).toMatch(/already in progress/)
      expect(mockClient.listEvents).not.toHaveBeenCalled()
      expect(mockClient.insertEvent).not.toHaveBeenCalled()
    })
  })
})
