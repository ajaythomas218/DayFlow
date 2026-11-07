'use client'

import React, { useEffect } from 'react'
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
  X,
  Sparkles,
  BarChart3,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DayFlowLogo } from '@/components/brand/dayflow-logo'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
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

export function MobileNav({ isOpen, onClose, userEmail }: MobileNavProps) {
  const pathname = usePathname()

  useEffect(() => {
    onClose()
  }, [pathname, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 md:hidden flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="relative z-10 w-72 max-w-[80vw] h-full bg-[#0F172A] border-r border-white/10 flex flex-col p-4 shadow-2xl animate-in slide-in-from-left">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <Link href="/dashboard" onClick={onClose}>
            <DayFlowLogo variant="horizontal" size={28} showTagline={false} />
          </Link>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all',
                  isActive
                    ? 'bg-[#7C3AED]/15 text-white border border-[#7C3AED]/30'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5',
                    isActive ? 'text-[#7C3AED]' : 'text-slate-400'
                  )}
                />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Footer with user info & logout */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          {userEmail && (
            <div className="px-2 py-1.5 rounded-lg bg-white/5 text-xs text-slate-300 truncate">
              {userEmail}
            </div>
          )}
          <button
            onClick={() => {
              const form = document.createElement('form')
              form.method = 'POST'
              form.action = '/auth/signout'
              document.body.appendChild(form)
              form.submit()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  )
}
