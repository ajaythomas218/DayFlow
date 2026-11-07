'use client'

import React, { useState } from 'react'
import { Repeat } from 'lucide-react'
import { Select } from '@/components/ui/input'
import {
  parseRecurrenceRule,
  serializeRecurrenceRule,
  RecurrenceConfig,
  Weekday,
} from '@/lib/recurrence'

interface RecurrenceEditorProps {
  value: string | null | undefined
  onChange: (rrule: string | null) => void
  itemDate?: Date
}

const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: 'MO', label: 'M' },
  { id: 'TU', label: 'T' },
  { id: 'WE', label: 'W' },
  { id: 'TH', label: 'Th' },
  { id: 'FR', label: 'F' },
  { id: 'SA', label: 'Sa' },
  { id: 'SU', label: 'Su' },
]

export function RecurrenceEditor({ value, onChange, itemDate = new Date() }: RecurrenceEditorProps) {
  const initialParsed = parseRecurrenceRule(value)

  const [isEnabled, setIsEnabled] = useState<boolean>(() => Boolean(value && value.trim()))
  const [frequency, setFrequency] = useState<RecurrenceConfig['frequency']>(
    () => initialParsed?.frequency || 'daily'
  )
  const [interval, setInterval] = useState<number>(() => initialParsed?.interval || 1)
  const [weekdays, setWeekdays] = useState<Weekday[]>(
    () => (initialParsed?.weekdays && initialParsed.weekdays.length > 0 ? initialParsed.weekdays : ['MO'])
  )
  const [monthDay] = useState<number>(() => initialParsed?.monthDay || itemDate.getDate() || 1)
  const [endType, setEndType] = useState<RecurrenceConfig['endType']>(() => initialParsed?.endType || 'never')
  const [untilDate, setUntilDate] = useState<string>(
    () => (initialParsed?.untilDate ? initialParsed.untilDate.slice(0, 10) : '')
  )
  const [count, setCount] = useState<number>(() => initialParsed?.count || 10)

  const handleToggle = (enabled: boolean) => {
    setIsEnabled(enabled)
    if (!enabled) {
      onChange(null)
    } else {
      emitRule({
        frequency,
        interval,
        weekdays: frequency === 'weekly' ? weekdays : undefined,
        monthDay: frequency === 'monthly' ? monthDay : undefined,
        endType,
        untilDate: endType === 'until_date' && untilDate ? new Date(untilDate).toISOString() : undefined,
        count: endType === 'count' ? count : undefined,
      })
    }
  }

  const emitRule = (cfg: RecurrenceConfig) => {
    const serialized = serializeRecurrenceRule(cfg)
    onChange(serialized)
  }

  const handleFrequencyChange = (f: RecurrenceConfig['frequency']) => {
    setFrequency(f)
    emitRule({
      frequency: f,
      interval,
      weekdays: f === 'weekly' ? weekdays : undefined,
      monthDay: f === 'monthly' ? monthDay : undefined,
      endType,
      untilDate: endType === 'until_date' && untilDate ? new Date(untilDate).toISOString() : undefined,
      count: endType === 'count' ? count : undefined,
    })
  }

  const handleWeekdayToggle = (w: Weekday) => {
    let nextWeekdays: Weekday[]
    if (weekdays.includes(w)) {
      if (weekdays.length === 1) return // Keep at least one
      nextWeekdays = weekdays.filter((d) => d !== w)
    } else {
      nextWeekdays = [...weekdays, w]
    }
    setWeekdays(nextWeekdays)
    emitRule({
      frequency,
      interval,
      weekdays: nextWeekdays,
      endType,
      untilDate: endType === 'until_date' && untilDate ? new Date(untilDate).toISOString() : undefined,
      count: endType === 'count' ? count : undefined,
    })
  }

  const handleIntervalChange = (val: number) => {
    const nextVal = Math.max(1, val)
    setInterval(nextVal)
    emitRule({
      frequency,
      interval: nextVal,
      weekdays: frequency === 'weekly' ? weekdays : undefined,
      monthDay: frequency === 'monthly' ? monthDay : undefined,
      endType,
      untilDate: endType === 'until_date' && untilDate ? new Date(untilDate).toISOString() : undefined,
      count: endType === 'count' ? count : undefined,
    })
  }

  const handleEndTypeChange = (eType: RecurrenceConfig['endType']) => {
    setEndType(eType)
    emitRule({
      frequency,
      interval,
      weekdays: frequency === 'weekly' ? weekdays : undefined,
      monthDay: frequency === 'monthly' ? monthDay : undefined,
      endType: eType,
      untilDate: eType === 'until_date' && untilDate ? new Date(untilDate).toISOString() : undefined,
      count: eType === 'count' ? count : undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Repeat className="w-3.5 h-3.5 text-[#22D3EE]" />
          Recurrence
        </label>
        <button
          type="button"
          onClick={() => handleToggle(!isEnabled)}
          className={`text-xs font-medium px-2 py-0.5 rounded transition-colors ${
            isEnabled
              ? 'bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          {isEnabled ? 'Repeats Active' : 'Does Not Repeat'}
        </button>
      </div>

      {isEnabled && (
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-slate-400 font-medium text-[11px]">Frequency</span>
              <Select
                value={frequency}
                onChange={(e) =>
                  handleFrequencyChange(e.target.value as RecurrenceConfig['frequency'])
                }
                className="mt-1 py-1 text-xs"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>

            <div>
              <span className="text-slate-400 font-medium text-[11px]">Every</span>
              <div className="flex items-center gap-1.5 mt-1">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={interval}
                  onChange={(e) => handleIntervalChange(parseInt(e.target.value) || 1)}
                  className="w-16 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-white text-xs font-mono"
                />
                <span className="text-slate-400 text-xs">
                  {frequency === 'daily'
                    ? interval > 1
                      ? 'days'
                      : 'day'
                    : frequency === 'weekly'
                    ? interval > 1
                      ? 'weeks'
                      : 'week'
                    : interval > 1
                    ? 'months'
                    : 'month'}
                </span>
              </div>
            </div>
          </div>

          {/* Weekday selector for weekly */}
          {frequency === 'weekly' && (
            <div className="space-y-1.5 pt-1">
              <span className="text-slate-400 font-medium text-[11px]">On weekdays:</span>
              <div className="flex gap-1">
                {WEEKDAYS.map((w) => {
                  const isSelected = weekdays.includes(w.id)
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => handleWeekdayToggle(w.id)}
                      className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                        isSelected
                          ? 'bg-[#22D3EE] text-slate-950 font-bold'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Monthly day indicator */}
          {frequency === 'monthly' && (
            <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-300">
              Repeats on day <strong>{monthDay}</strong> of each month. (Automatically clamps to
              the last day on shorter months, e.g. Feb 28/29 or April 30).
            </div>
          )}

          {/* End condition */}
          <div className="space-y-1.5 pt-1 border-t border-white/5">
            <span className="text-slate-400 font-medium text-[11px]">Ends</span>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={endType}
                onChange={(e) =>
                  handleEndTypeChange(e.target.value as RecurrenceConfig['endType'])
                }
                className="py-1 text-xs"
              >
                <option value="never">Never</option>
                <option value="until_date">On specific date</option>
                <option value="count">After N times</option>
              </Select>

              {endType === 'until_date' && (
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => {
                    setUntilDate(e.target.value)
                    emitRule({
                      frequency,
                      interval,
                      weekdays: frequency === 'weekly' ? weekdays : undefined,
                      monthDay: frequency === 'monthly' ? monthDay : undefined,
                      endType: 'until_date',
                      untilDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-800 border border-white/10 text-white text-xs"
                />
              )}

              {endType === 'count' && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={count}
                    onChange={(e) => {
                      const c = Math.max(1, parseInt(e.target.value) || 1)
                      setCount(c)
                      emitRule({
                        frequency,
                        interval,
                        weekdays: frequency === 'weekly' ? weekdays : undefined,
                        monthDay: frequency === 'monthly' ? monthDay : undefined,
                        endType: 'count',
                        count: c,
                      })
                    }}
                    className="w-16 px-2.5 py-1 rounded-lg bg-slate-800 border border-white/10 text-white text-xs font-mono"
                  />
                  <span className="text-slate-400 text-xs">occurrences</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
