'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Calendar,
  BookOpen,
  Dumbbell,
  GraduationCap,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DayFlowLogo } from '@/components/brand/dayflow-logo'

interface SidebarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
}

const navItems = [
  { href: '/dashboard', label: 'My Day', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/diary', label: 'Daily Diary', icon: BookOpen },
  { href: '/training', label: 'Training', icon: Dumbbell },
  { href: '/student-reviews', label: 'Reviews', icon: GraduationCap },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/weekly-review', label: 'Weekly Review', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r border-white/10 bg-[#0F172A]/95 backdrop-blur-xl transition-all duration-300 z-30 h-screen sticky top-0 select-none',
        isCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-white/10">
        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
          {isCollapsed ? (
            <DayFlowLogo variant="symbol" size={32} />
          ) : (
            <DayFlowLogo variant="horizontal" size={32} showTagline={true} />
          )}
        </Link>
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all group relative',
                isActive
                  ? 'bg-[#7C3AED]/15 text-white border border-[#7C3AED]/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 shrink-0 transition-colors',
                  isActive ? 'text-[#7C3AED]' : 'text-slate-400 group-hover:text-slate-200'
                )}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {isActive && (
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#7C3AED] rounded-r-full"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-white/10 text-xs text-slate-400">
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-300">DayFlow Online</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">v1.0</span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="DayFlow Online" />
          </div>
        )}
      </div>
    </aside>
  )
}
