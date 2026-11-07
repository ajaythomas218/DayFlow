'use client'

import React, { useState } from 'react'
import { Bell, Plus, Trash2, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ReminderRuleInput } from '@/lib/validations/reminders'

interface ReminderEditorProps {
  reminders: ReminderRuleInput[]
  onChange: (reminders: ReminderRuleInput[]) => void
  hasScheduledStart: boolean
  hasDeadline?: boolean
  itemType?: 'task' | 'event'
}

const PRESETS = [
  { label: 'At time of item', offset: 0 },
  { label: '10 min before', offset: 10 },
  { label: '30 min before', offset: 30 },
  { label: '1 hour before', offset: 60 },
  { label: '1 day before', offset: 1440 },
]

export function ReminderEditor({
  reminders,
  onChange,
  hasScheduledStart,
  hasDeadline = false,
  itemType = 'task',
}: ReminderEditorProps) {
  const [customOffsetValue, setCustomOffsetValue] = useState<number>(15)
  const [customOffsetUnit, setCustomOffsetUnit] = useState<'minutes' | 'hours' | 'days'>('minutes')
  const [customReference, setCustomReference] = useState<'start' | 'deadline'>('start')
  const [customChannel, setCustomChannel] = useState<'in_app' | 'web_push' | 'email'>('in_app')
  const [showCustomForm, setShowCustomForm] = useState(false)

  const hasAnySchedule = hasScheduledStart || hasDeadline

  const handleAddPreset = (offsetMinutes: number) => {
    // Determine default reference: start if available, else deadline
    const isRelativeStart = hasScheduledStart || !hasDeadline

    // Check if identical already exists
    const exists = reminders.some(
      (r) =>
        r.offset_minutes === offsetMinutes &&
        r.is_relative_to_start === isRelativeStart &&
        r.channel === 'in_app'
    )

    if (exists) return

    onChange([
      ...reminders,
      {
        offset_minutes: offsetMinutes,
        is_relative_to_start: isRelativeStart,
        channel: 'in_app',
        is_active: true,
      },
    ])
  }

  const handleAddCustom = () => {
    let multiplier = 1
    if (customOffsetUnit === 'hours') multiplier = 60
    if (customOffsetUnit === 'days') multiplier = 1440

    const totalMinutes = Math.max(0, customOffsetValue * multiplier)
    const isRelativeStart = customReference === 'start'

    const exists = reminders.some(
      (r) =>
        r.offset_minutes === totalMinutes &&
        r.is_relative_to_start === isRelativeStart &&
        r.channel === customChannel
    )

    if (!exists) {
      onChange([
        ...reminders,
        {
          offset_minutes: totalMinutes,
          is_relative_to_start: isRelativeStart,
          channel: customChannel,
          is_active: true,
        },
      ])
    }

    setShowCustomForm(false)
  }

  const handleRemoveReminder = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index))
  }

  const handleToggleActive = (index: number) => {
    onChange(
      reminders.map((r, i) => (i === index ? { ...r, is_active: !r.is_active } : r))
    )
  }

  const formatOffsetLabel = (offsetMinutes: number, isRelativeStart: boolean) => {
    const refLabel = itemType === 'task' ? (isRelativeStart ? 'start' : 'deadline') : 'start'

    if (offsetMinutes === 0) return `At ${refLabel}`
    if (offsetMinutes < 60) return `${offsetMinutes}m before ${refLabel}`
    if (offsetMinutes < 1440 && offsetMinutes % 60 === 0) {
      return `${offsetMinutes / 60}h before ${refLabel}`
    }
    if (offsetMinutes % 1440 === 0) {
      return `${offsetMinutes / 1440}d before ${refLabel}`
    }
    return `${offsetMinutes}m before ${refLabel}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5 text-[#8B7CFF]" />
          Reminders ({reminders.length})
        </label>
        <span className="text-[11px] text-slate-400">Multiple reminders supported</span>
      </div>

      {!hasAnySchedule && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Relative reminders require a scheduled start time or deadline. Set a schedule above
            to enable delivery calculations.
          </p>
        </div>
      )}

      {/* Active reminders list */}
      {reminders.length > 0 && (
        <div className="space-y-2">
          {reminders.map((r, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                r.is_active
                  ? 'bg-white/[0.03] border-white/10'
                  : 'bg-white/[0.01] border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={r.is_active}
                  onChange={() => handleToggleActive(idx)}
                  className="rounded border-white/20 bg-slate-800 text-[#8B7CFF] focus:ring-0 w-4 h-4 cursor-pointer"
                  title="Toggle active"
                />
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm font-medium text-white">
                  {formatOffsetLabel(r.offset_minutes, r.is_relative_to_start)}
                </span>
                <Badge
                  variant={
                    r.channel === 'in_app'
                      ? 'violet'
                      : r.channel === 'web_push'
                      ? 'cyan'
                      : 'neutral'
                  }
                  className="text-[10px] py-0 px-1.5"
                >
                  {r.channel === 'in_app'
                    ? 'In-App'
                    : r.channel === 'web_push'
                    ? 'Web Push'
                    : 'Email'}
                </Badge>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveReminder(idx)}
                className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Remove reminder"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Preset pills */}
      <div className="space-y-2">
        <span className="text-xs text-slate-400">Quick Presets:</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.offset}
              type="button"
              disabled={!hasAnySchedule}
              onClick={() => handleAddPreset(p.offset)}
              className="px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + {p.label}
            </button>
          ))}
          <button
            type="button"
            disabled={!hasAnySchedule}
            onClick={() => setShowCustomForm(!showCustomForm)}
            className="px-2.5 py-1 text-xs rounded-lg bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-[#8B7CFF] hover:bg-[#8B7CFF]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Custom
          </button>
        </div>
      </div>

      {/* Custom reminder builder */}
      {showCustomForm && (
        <div className="p-3 rounded-xl bg-slate-900/80 border border-white/15 space-y-3 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 font-medium">Offset</label>
              <input
                type="number"
                min={0}
                max={43200}
                value={customOffsetValue}
                onChange={(e) => setCustomOffsetValue(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full mt-1 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-white text-xs"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium">Unit</label>
              <Select
                value={customOffsetUnit}
                onChange={(e) =>
                  setCustomOffsetUnit(e.target.value as 'minutes' | 'hours' | 'days')
                }
                className="mt-1 py-1 text-xs"
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </Select>
            </div>

            {itemType === 'task' && hasDeadline && hasScheduledStart && (
              <div>
                <label className="text-[11px] text-slate-400 font-medium">Relative to</label>
                <Select
                  value={customReference}
                  onChange={(e) => setCustomReference(e.target.value as 'start' | 'deadline')}
                  className="mt-1 py-1 text-xs"
                >
                  <option value="start">Scheduled Start</option>
                  <option value="deadline">Deadline</option>
                </Select>
              </div>
            )}

            <div>
              <label className="text-[11px] text-slate-400 font-medium">Channel</label>
              <Select
                value={customChannel}
                onChange={(e) =>
                  setCustomChannel(e.target.value as 'in_app' | 'web_push' | 'email')
                }
                className="mt-1 py-1 text-xs"
              >
                <option value="in_app">In-App Notification</option>
                <option value="web_push">Web Push</option>
                <option value="email">Email</option>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCustomForm(false)}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleAddCustom}>
              Add Reminder
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
