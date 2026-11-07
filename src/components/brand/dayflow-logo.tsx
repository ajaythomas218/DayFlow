'use client'

import React, { useId } from 'react'
import { cn } from '@/lib/utils'

export type DayFlowLogoVariant =
  | 'horizontal'
  | 'symbol'
  | 'app-icon'
  | 'dark'
  | 'light'
  | 'monochrome'

export interface DayFlowLogoProps {
  variant?: DayFlowLogoVariant
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  showTagline?: boolean
  className?: string
  priority?: boolean
}

interface SymbolProps {
  gradId: string
  subtleGradId: string
  isMonochrome: boolean
  className?: string
}

function DayFlowSymbol({ gradId, subtleGradId, isMonochrome, className }: SymbolProps) {
  const strokePrimary = isMonochrome ? 'currentColor' : `url(#${gradId})`
  const fillPrimary = isMonochrome ? 'currentColor' : `url(#${gradId})`
  const strokeWave = isMonochrome ? 'currentColor' : `url(#${subtleGradId})`

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-full h-full select-none overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        {!isMonochrome && (
          <>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7C3AED" />
              <stop offset="65%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id={subtleGradId} x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#06B6D4" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0.9" />
            </linearGradient>
            <filter id={`${gradId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#7C3AED" floodOpacity="0.3" />
            </filter>
          </>
        )}
      </defs>

      {/* Main Structural D Arc */}
      <path
        d="M26 19H50C70.5 19 84 32.5 84 50C84 67.5 70.5 81 50 81H26"
        stroke={strokePrimary}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={!isMonochrome ? { filter: `url(#${gradId}-glow)` } : undefined}
      />

      {/* Calendar Spine / Pillar of Time */}
      <rect x="17" y="19" width="9" height="62" rx="4.5" fill={fillPrimary} />

      {/* Structured Calendar / Timeline Notches */}
      <circle cx="21.5" cy="35" r="1.75" fill={isMonochrome ? '#000000' : '#0F172A'} />
      <circle cx="21.5" cy="50" r="1.75" fill={isMonochrome ? '#000000' : '#0F172A'} />
      <circle cx="21.5" cy="65" r="1.75" fill={isMonochrome ? '#000000' : '#0F172A'} />

      {/* Internal Flowing Energy Ribbon (Momentum & Flow) */}
      <path
        d="M26 50C38 36 58 38 68 50C58 64 38 64 26 50Z"
        fill={fillPrimary}
        opacity={isMonochrome ? 0.3 : 0.22}
      />
      <path
        d="M26 50C38 36 52 64 68 50"
        stroke={strokeWave}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SIZE_MAP = {
  xs: { icon: 20, text: 'text-sm', tagline: 'text-[9px]' },
  sm: { icon: 28, text: 'text-base', tagline: 'text-[10px]' },
  md: { icon: 36, text: 'text-xl', tagline: 'text-xs' },
  lg: { icon: 48, text: 'text-2xl', tagline: 'text-xs' },
  xl: { icon: 64, text: 'text-3xl', tagline: 'text-sm' },
}

export function DayFlowLogo({
  variant = 'horizontal',
  size = 'md',
  showTagline = false,
  className,
}: DayFlowLogoProps) {
  const rawId = useId()
  const gradId = `df-grad-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const subtleGradId = `df-wave-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`

  const sizeConfig = typeof size === 'number'
    ? { icon: size, text: 'text-lg', tagline: 'text-xs' }
    : SIZE_MAP[size] || SIZE_MAP.md

  const isMonochrome = variant === 'monochrome'
  const isLight = variant === 'light'
  const isSymbolOnly = variant === 'symbol'
  const isAppIcon = variant === 'app-icon'

  // App Icon variant (square with smooth squircle/rounded corners, dark Midnight Navy ground)
  if (isAppIcon) {
    const iconDim = typeof size === 'number' ? size : sizeConfig.icon * 1.5
    return (
      <div
        className={cn(
          'relative rounded-2xl bg-[#0F172A] border border-white/10 shadow-xl shadow-[#7C3AED]/20 p-2.5 flex items-center justify-center shrink-0 overflow-hidden group',
          className
        )}
        style={{ width: iconDim, height: iconDim }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-[#7C3AED]/20 to-[#06B6D4]/10 pointer-events-none" />
        <DayFlowSymbol
          gradId={gradId}
          subtleGradId={subtleGradId}
          isMonochrome={false}
          className="relative z-10 w-full h-full"
        />
      </div>
    )
  }

  // Symbol Only variant
  if (isSymbolOnly) {
    const iconDim = typeof size === 'number' ? size : sizeConfig.icon
    return (
      <div
        className={cn('relative flex items-center justify-center shrink-0', className)}
        style={{ width: iconDim, height: iconDim }}
      >
        <DayFlowSymbol
          gradId={gradId}
          subtleGradId={subtleGradId}
          isMonochrome={isMonochrome}
          className="w-full h-full"
        />
      </div>
    )
  }

  // Full Wordmark Variants (horizontal, dark, light, monochrome)
  const iconDim = typeof size === 'number' ? size : sizeConfig.icon
  const textColor = isMonochrome
    ? 'text-current'
    : isLight
    ? 'text-[#0F172A]'
    : 'text-white'
  const taglineColor = isMonochrome
    ? 'text-current opacity-70'
    : isLight
    ? 'text-slate-500'
    : 'text-slate-400'

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <div
        className="relative flex items-center justify-center shrink-0"
        style={{ width: iconDim, height: iconDim }}
      >
        <DayFlowSymbol
          gradId={gradId}
          subtleGradId={subtleGradId}
          isMonochrome={isMonochrome}
          className="w-full h-full"
        />
      </div>

      <div className="flex flex-col justify-center leading-none">
        <div className={cn('font-bold tracking-tight flex items-baseline', sizeConfig.text, textColor)}>
          <span>Day</span>
          <span className={!isMonochrome && !isLight ? 'text-[#06B6D4]' : ''}>Flow</span>
        </div>
        {showTagline && (
          <span className={cn('font-medium tracking-normal mt-0.5', sizeConfig.tagline, taglineColor)}>
            Everything in flow.
          </span>
        )}
      </div>
    </div>
  )
}

