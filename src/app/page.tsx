import Link from 'next/link'
import { Sparkles, CheckCircle2, Calendar, ShieldCheck, ArrowRight } from 'lucide-react'

export default function HomePage() {

  return (
    <div className="relative min-h-screen bg-[#101522] text-white flex flex-col justify-between p-6 overflow-hidden">
      {/* Background Glows */}
      <div 
        aria-hidden="true" 
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#8B7CFF]/15 rounded-full blur-[120px] pointer-events-none" 
      />
      <div 
        aria-hidden="true" 
        className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#22D3EE]/10 rounded-full blur-[100px] pointer-events-none" 
      />

      {/* Top Header */}
      <header className="relative z-10 max-w-6xl w-full mx-auto flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#8B7CFF] to-[#22D3EE] p-[1px] glow-violet">
            <div className="w-full h-full bg-[#141B2D] rounded-[11px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#8B7CFF]" />
            </div>
          </div>
          <span className="font-bold text-lg tracking-tight">Workday OS</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium bg-[#8B7CFF] hover:bg-[#9E91FF] text-white rounded-lg shadow-lg shadow-[#8B7CFF]/20 transition-all"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Main Hero */}
      <main className="relative z-10 max-w-4xl w-full mx-auto text-center my-auto py-16">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#22D3EE] mb-6 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Production Productivity Command Center</span>
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
          Master Your Day With <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-[#8B7CFF] via-[#9E91FF] to-[#22D3EE] bg-clip-text text-transparent">
            Precision &amp; Peace of Mind
          </span>
        </h1>
        
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The all-in-one personal productivity operating system. Tasks, calendar time-blocking, Google Calendar two-way synchronization, daily journaling, training routines, and durable multi-channel reminders.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#8B7CFF] to-[#6E5DE7] hover:from-[#9E91FF] hover:to-[#8B7CFF] text-white font-semibold text-base shadow-xl shadow-[#8B7CFF]/25 flex items-center justify-center gap-2.5 transition-all"
          >
            <span>Launch Command Center</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#141B2D]/80 hover:bg-[#182238] border border-white/10 text-slate-200 font-semibold text-base transition-all"
          >
            Existing User Sign In
          </Link>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 text-left">
          <div className="glass-card rounded-xl p-5 border border-white/5">
            <CheckCircle2 className="w-6 h-6 text-[#34D399] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Unified Task Lifecycle</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Canonical task state reused across projects, calendar time-blocking, and daily reflection.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 border border-white/5">
            <Calendar className="w-6 h-6 text-[#22D3EE] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Google Calendar Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Bidirectional incremental delta synchronization with deterministic conflict resolution.
            </p>
          </div>

          <div className="glass-card rounded-xl p-5 border border-white/5">
            <ShieldCheck className="w-6 h-6 text-[#8B7CFF] mb-3" />
            <h3 className="font-semibold text-white text-sm mb-1">Zero-Leakage Security</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PostgreSQL Row Level Security (RLS) on every table, with encrypted server-side OAuth secrets.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full mx-auto text-center py-6 text-xs text-slate-500 border-t border-white/5">
        <p>Workday OS • Production Architecture Phase 1 • Antigravity Engine</p>
      </footer>
    </div>
  )
}
