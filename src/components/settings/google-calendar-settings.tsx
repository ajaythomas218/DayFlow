'use client'

import React, { useState, useTransition } from 'react'
import {
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Unlink,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  GoogleConnectionStatus,
  disconnectGoogleCalendarAction,
  triggerGoogleCalendarSyncAction,
  updateGoogleSyncPreferencesAction,
} from '@/lib/actions/google-calendar'

interface GoogleCalendarSettingsProps {
  initialStatus: GoogleConnectionStatus
  userTimezone: string
}

export function GoogleCalendarSettings({
  initialStatus,
  userTimezone,
}: GoogleCalendarSettingsProps) {
  const { toast } = useToast()
  const [status, setStatus] = useState<GoogleConnectionStatus>(initialStatus)
  const [isSyncing, startSyncTransition] = useTransition()
  const [isDisconnecting, startDisconnectTransition] = useTransition()

  const handleConnect = () => {
    // Navigate to server OAuth endpoint for external redirect
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/api/auth/google'
  }

  const handleDisconnect = () => {
    if (!confirm('Are you sure you want to disconnect Google Calendar? Local events and tasks will not be deleted.')) {
      return
    }

    startDisconnectTransition(async () => {
      const res = await disconnectGoogleCalendarAction()
      if (res.success) {
        setStatus((prev) => ({
          ...prev,
          isConnected: false,
          accountEmail: null,
          tokenExpiresAt: null,
          lastSuccessfulSync: null,
        }))
        toast({
          title: 'Disconnected',
          message: 'Google Calendar has been disconnected.',
          type: 'success',
        })
      } else {
        toast({
          title: 'Disconnect failed',
          message: res.error || 'Could not disconnect account.',
          type: 'error',
        })
      }
    })
  }

  const handleManualSync = () => {
    startSyncTransition(async () => {
      const res = await triggerGoogleCalendarSyncAction()
      if (res.success && res.data) {
        setStatus((prev) => ({
          ...prev,
          lastSuccessfulSync: new Date().toISOString(),
          lastErrorMessage: null,
        }))
        toast({
          title: 'Synchronization complete',
          message: `Pushed ${res.data.pushedCount} item(s), imported ${res.data.pulledCount} item(s).`,
          type: 'success',
        })
      } else {
        setStatus((prev) => ({
          ...prev,
          lastErrorMessage: res.error || 'Sync failed',
        }))
        toast({
          title: 'Sync failed',
          message: res.error || 'Synchronization could not be completed.',
          type: 'error',
        })
      }
    })
  }

  const handlePreferenceToggle = async (key: 'autoSyncTasks' | 'autoSyncEvents', val: boolean) => {
    setStatus((prev) => ({ ...prev, [key]: val }))
    await updateGoogleSyncPreferencesAction({
      [key]: val,
    })
  }

  return (
    <Card className="p-6 border border-white/10 space-y-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#06B6D4]/15 border border-[#06B6D4]/30 text-[#06B6D4]">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Google Calendar Two-Way Sync</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Bidirectional real-time synchronization with Google Calendar.
            </p>
          </div>
        </div>

        {status.isConnected ? (
          <Badge variant="cyan" className="gap-1 bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Connected
          </Badge>
        ) : (
          <Badge variant="neutral" className="text-slate-400">
            Disconnected
          </Badge>
        )}
      </div>

      {!status.isConnected ? (
        <div className="space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Connect your Google account to automatically synchronize meetings, appointments, and time-blocked tasks between DayFlow and Google Calendar.
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={handleConnect}
            className="gap-2 bg-[#06B6D4] text-slate-950 hover:bg-[#22D3EE] font-semibold"
          >
            <ExternalLink className="w-4 h-4" />
            Connect Google Calendar
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Connection Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-slate-400">Connected Account</span>
              <p className="text-white font-mono font-medium truncate">
                {status.accountEmail}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
              <span className="text-slate-400">Last Successful Sync</span>
              <p className="text-white font-mono font-medium">
                {status.lastSuccessfulSync
                  ? new Date(status.lastSuccessfulSync).toLocaleString('en-US', {
                      timeZone: userTimezone,
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Sync Error Notice if any */}
          {status.lastErrorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Sync Error: {status.lastErrorMessage}</span>
            </div>
          )}

          {/* Default Sync Preferences */}
          <div className="space-y-3 pt-2 border-t border-white/5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Automatic Synchronization Rules
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={status.autoSyncEvents}
                  onChange={(e) => handlePreferenceToggle('autoSyncEvents', e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-[#06B6D4] focus:ring-0"
                />
                <span>Automatically sync DayFlow calendar events to Google Calendar</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={status.autoSyncTasks}
                  onChange={(e) => handlePreferenceToggle('autoSyncTasks', e.target.checked)}
                  className="rounded border-white/20 bg-slate-800 text-[#06B6D4] focus:ring-0"
                />
                <span>Automatically sync time-blocked tasks to Google Calendar</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDisconnect}
              isLoading={isDisconnecting}
              className="text-rose-400 hover:text-rose-300 border-rose-500/30 gap-1.5"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleManualSync}
              isLoading={isSyncing}
              className="gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              Sync Now
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
