'use client'

import React, { useState, useTransition, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { loginAction } from '@/lib/actions/auth'
import { Sparkles, Eye, EyeOff, AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

function LoginForm() {
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'

  const [error, setError] = useState<string | null>(errorParam)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set('redirectTo', redirectTo)

    startTransition(async () => {
      const result = await loginAction(formData)
      if (!result.success) {
        setError(result.error || 'Failed to sign in. Please verify your credentials.')
      }
    })
  }

  return (
    <div className="glass-panel rounded-2xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#8B7CFF] to-[#22D3EE] p-[1px] mb-4 glow-violet">
          <div className="w-full h-full bg-[#141B2D] rounded-[11px] flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#8B7CFF]" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Workday OS</h1>
        <p className="text-sm text-slate-400 mt-1">Sign in to your personal command center</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div 
          role="alert" 
          className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@workday.io"
            className="w-full px-3.5 py-2.5 bg-[#141B2D]/80 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition-colors"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-slate-300 uppercase tracking-wider">
              Password
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#141B2D]/80 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#8B7CFF] to-[#6E5DE7] hover:from-[#9E91FF] hover:to-[#8B7CFF] text-white font-medium text-sm rounded-lg shadow-lg shadow-[#8B7CFF]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Navigation */}
      <div className="mt-6 text-center text-xs text-slate-400">
        <span>Don&apos;t have an account? </span>
        <Link href="/register" className="text-[#8B7CFF] hover:text-[#9E91FF] font-medium transition-colors underline-offset-4 hover:underline">
          Create account
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="glass-panel rounded-2xl p-8 border border-white/10 flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#8B7CFF] animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
