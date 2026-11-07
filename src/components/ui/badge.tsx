import React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'violet' | 'cyan' | 'lavender' | 'success' | 'warning' | 'danger' | 'neutral'
  size?: 'sm' | 'md'
}

export function Badge({ className, variant = 'default', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    default: 'bg-white/5 text-slate-300 border-white/10',
    violet: 'bg-[#7C3AED]/15 text-[#EDE9FE] border-[#7C3AED]/30',
    cyan: 'bg-[#06B6D4]/15 text-[#06B6D4] border-[#06B6D4]/30',
    lavender: 'bg-[#EDE9FE]/15 text-[#EDE9FE] border-[#EDE9FE]/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    danger: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    neutral: 'bg-slate-800 text-slate-400 border-slate-700',
  }

  const sizes = {
    sm: 'text-xs px-2 py-0.5 rounded-md font-medium',
    md: 'text-xs px-2.5 py-1 rounded-lg font-medium',
  }

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 border backdrop-blur-sm', variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </span>
  )
}
