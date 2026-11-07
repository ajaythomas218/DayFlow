'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Dumbbell,
  GraduationCap,
  Settings,
  Plus,
  ArrowRight,
} from 'lucide-react'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenCreateTask?: () => void
  onOpenCreateProject?: () => void
}

interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ReactNode
  category: 'Navigation' | 'Actions'
  action: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenCreateTask,
  onOpenCreateProject,
}: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const items: PaletteItem[] = useMemo(() => {
    return [
      {
        id: 'action-new-task',
        title: 'Create New Task',
        subtitle: 'Add a new task with deadlines or scheduled time',
        icon: <Plus className="w-4 h-4 text-[#8B7CFF]" />,
        category: 'Actions',
        action: () => {
          onClose()
          onOpenCreateTask?.()
        },
      },
      {
        id: 'action-new-project',
        title: 'Create New Project',
        subtitle: 'Start a new project container for your tasks',
        icon: <Plus className="w-4 h-4 text-[#22D3EE]" />,
        category: 'Actions',
        action: () => {
          onClose()
          onOpenCreateProject?.()
        },
      },
      {
        id: 'nav-dashboard',
        title: 'Dashboard — My Day',
        subtitle: 'View your daily focus, deadlines, and active projects',
        icon: <LayoutDashboard className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/dashboard')
          onClose()
        },
      },
      {
        id: 'nav-tasks',
        title: 'Tasks & Subtasks',
        subtitle: 'Manage all tasks, priorities, dependencies, and timelines',
        icon: <CheckSquare className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/tasks')
          onClose()
        },
      },
      {
        id: 'nav-projects',
        title: 'Projects',
        subtitle: 'Browse projects, milestone tracking, and completion progress',
        icon: <FolderKanban className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/projects')
          onClose()
        },
      },
      {
        id: 'nav-calendar',
        title: 'Calendar & Schedule',
        subtitle: 'Scheduled events and calendar timeblocks',
        icon: <Calendar className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/calendar')
          onClose()
        },
      },
      {
        id: 'nav-diary',
        title: 'Daily Diary',
        subtitle: 'Reflections and task linked work journaling',
        icon: <BookOpen className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/diary')
          onClose()
        },
      },
      {
        id: 'nav-training',
        title: 'Training Routines',
        subtitle: 'Structured workout blocks and session logging',
        icon: <Dumbbell className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/training')
          onClose()
        },
      },
      {
        id: 'nav-reviews',
        title: 'Student Reviews',
        subtitle: 'Academic progress notes and check-ins',
        icon: <GraduationCap className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/student-reviews')
          onClose()
        },
      },
      {
        id: 'nav-settings',
        title: 'Settings',
        subtitle: 'Preferences, timezones, and integrations',
        icon: <Settings className="w-4 h-4 text-slate-300" />,
        category: 'Navigation',
        action: () => {
          router.push('/settings')
          onClose()
        },
      },
    ]
  }, [router, onClose, onOpenCreateTask, onOpenCreateProject])

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    )
  }, [items, query])


  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
        }
      }
    },
    [filteredItems, selectedIndex]
  )

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4"
    >
      <div
        className="fixed inset-0 bg-[#090D16]/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-xl glass-panel rounded-2xl border border-white/15 bg-[#141B2D]/95 shadow-2xl overflow-hidden animate-in zoom-in-95 text-white">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search commands, navigate, or create..."
            className="w-full bg-transparent text-white placeholder-slate-500 text-sm focus:outline-none"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono font-medium text-slate-400 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-white/5">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              No commands or pages matching &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-colors ${
                    isSelected
                      ? 'bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 text-white'
                      : 'hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg border ${
                        isSelected
                          ? 'bg-[#8B7CFF]/20 border-[#8B7CFF]/40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                  </div>
                  {isSelected && <ArrowRight className="w-4 h-4 text-[#8B7CFF] shrink-0 ml-2" />}
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/20 border-t border-white/5 text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded border border-white/10">↑</kbd>{' '}
              <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded border border-white/10">↓</kbd> to
              navigate
            </span>
            <span>
              <kbd className="font-mono bg-white/5 px-1 py-0.5 rounded border border-white/10">↵</kbd> to
              select
            </span>
          </div>
          <span>DayFlow</span>
        </div>
      </div>
    </div>
  )
}
