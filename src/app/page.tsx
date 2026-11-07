import Link from 'next/link'
import { Sparkles, CheckCircle2, Calendar, ShieldCheck, ArrowRight } from 'lucide-react'
import { DayFlowLogo } from '@/components/brand/dayflow-logo'

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#0F172A] text-white flex flex-col justify-between p-6 overflow-hidden">
      {/* Background Glows */}
      <div 
        aria-hidden="true" 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#7C3AED]/15 rounded-full blur-[140px] pointer-events-none" 
      />
      <div 
        aria-hidden="true" 
        className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[#06B6D4]/12 rounded-full blur-[120px] pointer-events-none" 
      />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <Link href="/" className="hover:opacity-95 transition-opacity">
          <DayFlowLogo variant="horizontal" size={36} showTagline={true} />
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium bg-[#7C3AED] hover:bg-[#8B5CF6] text-white rounded-xl shadow-lg shadow-[#7C3AED]/25 transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 max-w-4xl w-full mx-auto text-center my-auto py-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#06B6D4] mb-6 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Everything in flow.</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
          Your Personal Life &amp; <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-[#7C3AED] via-[#A78BFA] to-[#06B6D4] bg-clip-text text-transparent">
            Productivity OS
          </span>
        </h1>
        
        <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          Designed for high performers who demand clarity. Master your complete productivity ecosystem with unified tasks, calendar time-blocking, Google Calendar sync, daily reflection, and durable reminders.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7C3AED] to-[#06B6D4] hover:from-[#8B5CF6] hover:to-[#22D3EE] text-white font-semibold text-base shadow-xl shadow-[#7C3AED]/25 flex items-center justify-center gap-2.5 transition-all"
          >
            <span>Launch DayFlow</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#1E293B]/80 hover:bg-[#334155] border border-white/10 text-slate-200 font-semibold text-base transition-all"
          >
            Sign In to Workspace
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 text-left">
          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <CheckCircle2 className="w-6 h-6 text-[#34D399] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Unified Task Lifecycle</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canonical task state reused across projects, calendar time-blocking, and daily reflection.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <Calendar className="w-6 h-6 text-[#06B6D4] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Google Calendar Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bidirectional incremental delta synchronization with deterministic conflict resolution.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/10">
            <ShieldCheck className="w-6 h-6 text-[#7C3AED] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Zero-Leakage Security</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL Row Level Security (RLS) on every table, with encrypted server-side OAuth secrets.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center py-6 text-xs text-slate-500 border-t border-white/5">
        <p>DayFlow • Everything in flow. • Your Personal Life &amp; Productivity OS</p>
      </footer>
    </div>
  )
}
