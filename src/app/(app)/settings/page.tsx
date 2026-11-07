import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings as SettingsIcon, User, Globe, Shield } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReminderSettings } from '@/components/settings/reminder-settings'
import { GoogleCalendarSettings } from '@/components/settings/google-calendar-settings'
import { getGoogleCalendarConnectionAction } from '@/lib/actions/google-calendar'
import { ReminderSettingsInput, ReminderRuleInput } from '@/lib/validations/reminders'
import { ReminderDeliveryWithDetails } from '@/lib/reminders/types'
import { ReminderRule } from '@/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: userSettings } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const { data: rawDeliveries } = await supabase
    .from('reminder_deliveries')
    .select('*, reminder_rules(*), tasks(id, title, status), calendar_events(id, title)')
    .eq('user_id', user.id)
    .order('scheduled_for', { ascending: false })
    .limit(20)

  type RawDeliveryRow = ReminderDeliveryWithDetails & {
    reminder_rules?: ReminderRule | null
    tasks?: { id: string; title: string; status: string } | null
    calendar_events?: { id: string; title: string } | null
  }

  const deliveries: ReminderDeliveryWithDetails[] = (
    (rawDeliveries as unknown as RawDeliveryRow[]) || []
  ).map((d) => {
    const { reminder_rules: r, tasks: t, calendar_events: e, ...rest } = d
    return {
      ...rest,
      rule: r || null,
      task: t || null,
      event: e || null,
    }
  })

  const reminderSettings: ReminderSettingsInput = {
    task_default_reminders: Array.isArray(userSettings?.task_default_reminders)
      ? (userSettings.task_default_reminders as ReminderRuleInput[])
      : [{ offset_minutes: 15, is_relative_to_start: true, channel: 'in_app', is_active: true }],
    event_default_reminders: Array.isArray(userSettings?.event_default_reminders)
      ? (userSettings.event_default_reminders as ReminderRuleInput[])
      : [{ offset_minutes: 10, is_relative_to_start: true, channel: 'in_app', is_active: true }],
    reminders_enabled_by_default: userSettings?.reminders_enabled_by_default ?? true,
  }

  const gcalRes = await getGoogleCalendarConnectionAction()
  const gcalStatus = gcalRes.data || {
    isConnected: false,
    accountEmail: null,
    tokenExpiresAt: null,
    lastSuccessfulSync: null,
    lastErrorMessage: null,
    autoSyncTasks: false,
    autoSyncEvents: true,
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30 text-[#7C3AED]">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Workspace Settings
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage your account, timezone configurations, and system preferences.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Profile Card */}
        <Card className="p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <User className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="text-base font-bold text-white">User Profile</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-400 font-medium">Display Name</span>
              <p className="text-white font-semibold mt-0.5">
                {profile?.display_name || user.user_metadata?.full_name || 'DayFlow User'}
              </p>
            </div>

            <div>
              <span className="text-xs text-slate-400 font-medium">Email Address</span>
              <p className="text-white font-mono mt-0.5">{user.email}</p>
            </div>
          </div>
        </Card>

        {/* Timezone & Localization */}
        <Card className="p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Globe className="w-5 h-5 text-[#06B6D4]" />
            <h3 className="text-base font-bold text-white">Timezone &amp; Regional Horizons</h3>
          </div>

          <div className="space-y-2">
            <span className="text-xs text-slate-400 font-medium">Configured Timezone</span>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm">
                {profile?.timezone || 'UTC'}
              </span>
              <Badge variant="cyan">Active Horizon</Badge>
            </div>
            <p className="text-xs text-slate-400 pt-1 leading-relaxed">
              Task horizons, daily deadlines, and overdue detection calculate precisely against this timezone.
            </p>
          </div>
        </Card>

        {/* Google Calendar Two-Way Sync Settings */}
        <GoogleCalendarSettings
          initialStatus={gcalStatus}
          userTimezone={profile?.timezone || 'UTC'}
        />

        {/* Multi-Reminder Engine Preferences & Delivery History */}
        <ReminderSettings
          initialSettings={reminderSettings}
          initialDeliveries={deliveries}
          userTimezone={profile?.timezone || 'UTC'}
        />

        {/* System & Architecture Info */}
        <Card className="p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Security &amp; Phase Status</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400">Row Level Security (RLS)</span>
              <p className="text-emerald-400 font-semibold mt-0.5">Enforced on All 21 Tables</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-slate-400">Implementation State</span>
              <p className="text-[#7C3AED] font-semibold mt-0.5">DayFlow v1.0 — Production</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
