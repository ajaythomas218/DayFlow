'use client'

import React, { useState } from 'react'
import {
  Menu,
  Search,
  Plus,
  FolderKanban,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/dropdown'

interface TopHeaderProps {
  onOpenMobileNav: () => void
  onOpenCommandPalette: () => void
  onOpenCreateTask: () => void
  onOpenCreateProject: () => void
  userDisplayName?: string
  userEmail?: string
}

export function TopHeader({
  onOpenMobileNav,
  onOpenCommandPalette,
  onOpenCreateTask,
  onOpenCreateProject,
  userDisplayName,
  userEmail,
}: TopHeaderProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(nextTheme)
    if (typeof document !== 'undefined') {
      if (nextTheme === 'light') {
        document.documentElement.classList.add('light-theme')
      } else {
        document.documentElement.classList.remove('light-theme')
      }
    }
  }

  const userMenuItems = [
    {
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      icon: theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[#7C3AED]" />,
      onClick: toggleTheme,
    },
    {
      label: 'Sign Out',
      icon: <LogOut className="w-4 h-4" />,
      onClick: () => {
        const form = document.createElement('form')
        form.method = 'POST'
        form.action = '/auth/signout'
        document.body.appendChild(form)
        form.submit()
      },
      variant: 'danger' as const,
    },
  ]

  return (
    <header className="h-16 border-b border-white/10 bg-[#0F172A]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Left: Mobile hamburger & Global Search Button */}
      <div className="flex items-center gap-3 flex-1 max-w-lg">
        <button
          onClick={onOpenMobileNav}
          className="md:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={onOpenCommandPalette}
          className="w-full max-w-md flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#162032] border border-white/10 hover:border-white/20 text-slate-400 hover:text-slate-200 transition-all text-xs sm:text-sm group shadow-inner"
        >
          <div className="flex items-center gap-2.5 truncate">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] transition-colors shrink-0" />
            <span className="truncate">Search tasks, projects, commands...</span>
          </div>
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 shrink-0 ml-2">
            <span>⌘K</span>
          </div>
        </button>
      </div>

      {/* Right: Quick actions & User menu */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Button
          onClick={onOpenCreateTask}
          size="sm"
          variant="primary"
          className="hidden sm:inline-flex"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </Button>

        <Button
          onClick={onOpenCreateProject}
          size="sm"
          variant="secondary"
          className="hidden md:inline-flex"
        >
          <FolderKanban className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>New Project</span>
        </Button>

        {/* Small screen quick create icon button */}
        <button
          onClick={onOpenCreateTask}
          className="sm:hidden p-2 rounded-xl bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/20"
          aria-label="Create new task"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* User Profile Pill / Menu */}
        <Dropdown
          align="right"
          trigger={
            <button className="flex items-center gap-2 p-1.5 rounded-xl border border-white/10 bg-[#162032] hover:border-white/20 transition-all group">
              <div className="w-7 h-7 rounded-lg bg-[#7C3AED]/20 border border-[#7C3AED]/40 text-[#7C3AED] flex items-center justify-center font-bold text-xs uppercase">
                {userDisplayName ? userDisplayName.charAt(0) : userEmail ? userEmail.charAt(0) : 'U'}
              </div>
              <div className="hidden lg:flex flex-col text-left pr-1 leading-tight">
                <span className="text-xs font-semibold text-white truncate max-w-[120px]">
                  {userDisplayName || 'User'}
                </span>
                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                  {userEmail || 'Active'}
                </span>
              </div>
            </button>
          }
          items={userMenuItems}
        />
      </div>
    </header>
  )
}
