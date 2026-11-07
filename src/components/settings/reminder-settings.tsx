'use client'

import React, { useState, useTransition } from 'react'
import {
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Send,
  History,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import { ReminderEditor } from '@/components/reminders/reminder-editor'
import {
  updateUserRemindersSettingsAction,
  getDeliveryHistoryAction,
} from '@/lib/actions/reminders'
import { ReminderSettingsInput, ReminderRuleInput } from '@/lib/validations/reminders'
import { ReminderDeliveryWithDetails } from '@/lib/reminders/types'

interface ReminderSettingsProps {
  initialSettings: ReminderSettingsInput
  initialDeliveries: ReminderDeliveryWithDetails[]
  userTimezone: string
}

export function ReminderSettings({
  initialSettings,
  initialDeliveries,
  userTimezone,
}: ReminderSettingsProps) {
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [enabledByDefault, setEnabledByDefault] = useState<boolean>(
    initialSettings.reminders_enabled_by_default
  )
  const [taskDefaults, setTaskDefaults] = useState<ReminderRuleInput[]>(
    initialSettings.task_default_reminders
  )
  const [eventDefaults, setEventDefaults] = useState<ReminderRuleInput[]>(
    initialSettings.event_default_reminders
  )
  const [deliveries, setDeliveries] = useState<ReminderDeliveryWithDetails[]>(initialDeliveries)

  const handleSaveDefaults = () => {
    startTransition(async () => {
      const res = await updateUserRemindersSettingsAction({
        reminders_enabled_by_default: enabledByDefault,
        task_default_reminders: taskDefaults,
        event_default_reminders: eventDefaults,
      })

      if (res.success) {
        toast({
          title: 'Preferences saved',
          message: 'Default reminder presets updated successfully.',
          type: 'success',
        })
      } else {
        toast({
          title: 'Update failed',
          message: res.error || 'Could not save reminder settings.',
          type: 'error',
        })
      }
    })
  }

  const handleRefreshHistory = async () => {
    setIsRefreshing(true)
    try {
      const res = await getDeliveryHistoryAction(30)
      if (res.success && res.data) {
        setDeliveries(res.data)
      }
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusBadge = (status: ReminderDeliveryWithDetails['status']) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="cyan" className="gap-1 text-[11px] bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Sent
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="violet" className="gap-1 text-[11px] animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Processing
          </Badge>
        )
      case 'scheduled':
      case 'pending':
        return (
          <Badge variant="cyan" className="gap-1 text-[11px]">
            <Clock className="w-3 h-3" />
            Scheduled
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="danger" className="gap-1 text-[11px]">
            <AlertTriangle className="w-3 h-3" />
            Failed
          </Badge>
        )
      case 'cancelled':
        return (
          <Badge variant="neutral" className="gap-1 text-[11px] text-slate-400">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        )
      default:
        return <Badge variant="neutral">{status}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Global & Default Preferences */}
      <Card className="p-6 border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-[#8B7CFF]" />
            <div>
              <h3 className="text-base font-bold text-white">Default Reminder Engine</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically pre-fill newly created items with your preferred reminders.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white">
            <input
              type="checkbox"
              checked={enabledByDefault}
              onChange={(e) => setEnabledByDefault(e.target.checked)}
              className="rounded border-white/20 bg-slate-800 text-[#8B7CFF] focus:ring-[#8B7CFF]"
            />
            <span>Enabled by default</span>
          </label>
        </div>

        {/* Task Defaults */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-white">Task Defaults</h4>
          <p className="text-xs text-slate-400">
            Presets automatically applied when adding tasks with deadlines or scheduled times.
          </p>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <ReminderEditor
              reminders={taskDefaults}
              onChange={setTaskDefaults}
              hasScheduledStart={true}
              hasDeadline={true}
              itemType="task"
            />
          </div>
        </div>

        {/* Event Defaults */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <h4 className="text-sm font-semibold text-white">Calendar Event Defaults</h4>
          <p className="text-xs text-slate-400">
            Presets automatically applied to new meetings, appointments, and focus blocks.
          </p>
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <ReminderEditor
              reminders={eventDefaults}
              onChange={setEventDefaults}
              hasScheduledStart={true}
              itemType="event"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-white/5">
          <Button
            type="button"
            variant="primary"
            onClick={handleSaveDefaults}
            isLoading={isPending}
          >
            Save Default Preferences
          </Button>
        </div>
      </Card>

      {/* 2. Channel Configuration Status */}
      <Card className="p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <Send className="w-5 h-5 text-[#22D3EE]" />
          <div>
            <h3 className="text-base font-bold text-white">Delivery Channel Infrastructure</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Current operational status of supported notification providers.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">In-App Notifications</span>
              <Badge variant="cyan" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                Active / Ready
              </Badge>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Durable in-database delivery. Toast alerts and activity horizon badge markers.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Web Push</span>
              <Badge variant="neutral" className="text-slate-400 border-white/10">
                Dev / Optional
              </Badge>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              VAPID keys configured in environment template. Free desktop/mobile browser push.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Email Provider</span>
              <Badge variant="neutral" className="text-slate-400 border-white/10">
                Unconfigured
              </Badge>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Requires external SMTP or Resend/SendGrid API key in production.
            </p>
          </div>
        </div>
      </Card>

      {/* 3. Delivery History & Audit Log */}
      <Card className="p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">Recent Delivery History</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of scheduled, processed, sent, and failed reminder notifications.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRefreshHistory}
            disabled={isRefreshing}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {deliveries.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No reminder deliveries recorded yet. Reminders created for upcoming tasks or events
            will appear here with their execution status.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Item / Title</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Scheduled For ({userTimezone})</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-mono">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-sans font-medium text-white max-w-[200px] truncate">
                      {d.title || d.task?.title || d.event?.title || 'Reminder'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="capitalize text-slate-300">
                        {d.rule?.channel || 'in_app'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {new Date(d.scheduled_for).toLocaleString('en-US', {
                        timeZone: userTimezone,
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-3 font-sans">{getStatusBadge(d.status)}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {d.attempt_count} / {d.max_attempts}
                      {d.error_message && (
                        <p className="text-[10px] text-rose-400 font-sans mt-0.5 truncate max-w-[180px]" title={d.error_message}>
                          {d.error_message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
