'use client'

import React, { useState, useTransition } from 'react'
import Link from 'next/link'
import { registerAction } from '@/lib/actions/auth'
import { Sparkles, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    let detectedTz = 'UTC'
    try {
      detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      detectedTz = 'UTC'
    }
    formData.set('timezone', detectedTz)

    startTransition(async () => {
      const result = await registerAction(formData)
      if (result.success) {
        setSuccess(true)
      } else {
        setError(result.error || 'Failed to create account. Please check your inputs.')
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
        <h1 className="text-2xl font-bold tracking-tight text-white">Create Account</h1>
        <p className="text-sm text-slate-400 mt-1">Initialize your Workday OS workspace</p>
      </div>

      {/* Success Notification */}
      {success ? (
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Account Created!</h2>
            <p className="text-sm text-slate-400 mt-1">
              Please check your email to confirm your account, or sign in now if email confirmation is disabled.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#8B7CFF] text-white text-sm font-medium hover:bg-[#9E91FF] transition-colors"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <>
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
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Full Name
              </label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                required
                placeholder="Jane Doe"
                className="w-full px-3.5 py-2.5 bg-[#141B2D]/80 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition-colors"
              />
            </div>

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
                placeholder="jane@example.com"
                className="w-full px-3.5 py-2.5 bg-[#141B2D]/80 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Min. 8 chars (1 uppercase, 1 number)"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="Repeat password"
                className="w-full px-3.5 py-2.5 bg-[#141B2D]/80 border border-white/10 rounded-lg text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#8B7CFF] focus:ring-1 focus:ring-[#8B7CFF] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-[#8B7CFF] to-[#6E5DE7] hover:from-[#9E91FF] hover:to-[#8B7CFF] text-white font-medium text-sm rounded-lg shadow-lg shadow-[#8B7CFF]/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div className="mt-6 text-center text-xs text-slate-400">
            <span>Already have an account? </span>
            <Link href="/login" className="text-[#8B7CFF] hover:text-[#9E91FF] font-medium transition-colors underline-offset-4 hover:underline">
              Sign in
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
