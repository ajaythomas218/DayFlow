'use client'

import React, { useState, useEffect } from 'react'
import { Sidebar } from '@/components/shell/sidebar'
import { TopHeader } from '@/components/shell/top-header'
import { MobileNav } from '@/components/shell/mobile-nav'
import { CommandPalette } from '@/components/shell/command-palette'
import { CreateTaskModal } from '@/components/tasks/create-task-modal'
import { CreateProjectModal } from '@/components/projects/create-project-modal'
import { ToastProvider } from '@/components/ui/toast'
import { Project, Task } from '@/types'

interface AppShellProps {
  children: React.ReactNode
  userDisplayName?: string
  userEmail?: string
  projects?: Project[]
  tasks?: Task[]
}

export function AppShell({
  children,
  userDisplayName,
  userEmail,
  projects = [],
  tasks = [],
}: AppShellProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false)

  // Global Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#0F172A] text-white flex flex-col md:flex-row antialiased selection:bg-[#7C3AED]/30 selection:text-white">
        {/* Desktop Sidebar */}
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        {/* Mobile Navigation Drawer */}
        <MobileNav
          isOpen={isMobileNavOpen}
          onClose={() => setIsMobileNavOpen(false)}
          userEmail={userEmail}
        />

        {/* Main Application Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          <TopHeader
            onOpenMobileNav={() => setIsMobileNavOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            onOpenCreateTask={() => setIsCreateTaskOpen(true)}
            onOpenCreateProject={() => setIsCreateProjectOpen(true)}
            userDisplayName={userDisplayName}
            userEmail={userEmail}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-200">
            {children}
          </main>
        </div>

        {/* Modals & Command Palette */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          onOpenCreateProject={() => setIsCreateProjectOpen(true)}
        />

        <CreateTaskModal
          isOpen={isCreateTaskOpen}
          onClose={() => setIsCreateTaskOpen(false)}
          projects={projects}
          availableTasks={tasks}
        />

        <CreateProjectModal
          isOpen={isCreateProjectOpen}
          onClose={() => setIsCreateProjectOpen(false)}
        />
      </div>
    </ToastProvider>
  )
}

