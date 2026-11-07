import React from 'react'
import { cn } from '@/lib/utils'

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn('block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5', className)}
      {...props}
    >
      {children}
    </label>
  )
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, error, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl bg-[#162032]/90 border border-white/10 text-white placeholder-slate-500 text-sm transition-all focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed',
        error && 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, error, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl bg-[#162032]/90 border border-white/10 text-white placeholder-slate-500 text-sm transition-all focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[90px]',
        error && 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    />
  )
})
Textarea.displayName = 'Textarea'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, error, children, ...props }, ref) => {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full px-3.5 py-2.5 rounded-xl bg-[#162032] border border-white/10 text-white text-sm transition-all focus:outline-none focus:border-[#7C3AED] focus:ring-1 focus:ring-[#7C3AED] disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer',
        error && 'border-rose-500/50 focus:border-rose-500 focus:ring-rose-500',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
})
Select.displayName = 'Select'
