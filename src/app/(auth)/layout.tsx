import React from 'react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-[#101522] overflow-hidden">
      {/* Subtle ambient lighting gradients */}
      <div 
        aria-hidden="true" 
        className="absolute -top-40 -left-40 w-96 h-96 bg-[#8B7CFF]/15 rounded-full blur-3xl pointer-events-none" 
      />
      <div 
        aria-hidden="true" 
        className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#22D3EE]/10 rounded-full blur-3xl pointer-events-none" 
      />

      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}
