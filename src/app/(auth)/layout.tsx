import React from 'react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#0F172A] overflow-hidden">
      {/* Subtle ambient lighting gradients */}
      <div 
        aria-hidden="true" 
        className="absolute -top-40 -left-40 w-96 h-96 bg-[#7C3AED]/15 rounded-full blur-3xl pointer-events-none" 
      />
      <div 
        aria-hidden="true" 
        className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#06B6D4]/12 rounded-full blur-3xl pointer-events-none" 
      />

      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}
