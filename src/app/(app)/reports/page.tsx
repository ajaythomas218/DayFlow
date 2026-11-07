import React from 'react'
import { getReportsAction } from '@/lib/actions/reports'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const reportRes = await getReportsAction({ preset: 'this_week' })

  if (!reportRes.success || !reportRes.data) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Failed to load reports. Please try refreshing.</p>
      </div>
    )
  }

  return <ReportsClient initialData={reportRes.data} />
}

