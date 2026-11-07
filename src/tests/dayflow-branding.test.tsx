import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { DayFlowLogo } from '@/components/brand/dayflow-logo'

describe('DayFlow Brand Identity & Logo System', () => {
  it('renders primary horizontal logo variant with wordmark', () => {
    const html = renderToString(<DayFlowLogo variant="horizontal" showTagline={true} />)
    expect(html).toContain('Day')
    expect(html).toContain('Flow')
    expect(html).toContain('Everything in flow.')
    expect(html).toContain('svg')
    expect(html).toContain('df-grad')
  })

  it('renders symbol-only variant without text or tagline', () => {
    const html = renderToString(<DayFlowLogo variant="symbol" size="md" />)
    expect(html).toContain('svg')
    expect(html).not.toContain('Everything in flow.')
    expect(html).not.toContain('</span>')
  })

  it('renders app-icon variant with squircle container and background gradient', () => {
    const html = renderToString(<DayFlowLogo variant="app-icon" size={64} />)
    expect(html).toContain('rounded-2xl')
    expect(html).toContain('bg-[#0F172A]')
    expect(html).toContain('svg')
  })

  it('renders dark-background variant optimized for dark theme', () => {
    const html = renderToString(<DayFlowLogo variant="dark" showTagline={true} />)
    expect(html).toContain('text-white')
    expect(html).toContain('text-[#06B6D4]')
    expect(html).toContain('Everything in flow.')
  })

  it('renders light-background variant with dark typography', () => {
    const html = renderToString(<DayFlowLogo variant="light" showTagline={true} />)
    expect(html).toContain('text-[#0F172A]')
    expect(html).toContain('text-slate-500')
    expect(html).toContain('Everything in flow.')
  })

  it('renders monochrome variant with currentColor and no gradient defs', () => {
    const html = renderToString(<DayFlowLogo variant="monochrome" showTagline={true} />)
    expect(html).toContain('currentColor')
    expect(html).not.toContain('<linearGradient')
  })
})
