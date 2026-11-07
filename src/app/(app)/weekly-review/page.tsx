import React from 'react'
import { getWeeklyReviewDataAction } from '@/lib/actions/weekly-review'
import { WeeklyReviewClient } from './weekly-review-client'

export default async function WeeklyReviewPage() {
  const reviewRes = await getWeeklyReviewDataAction()

  if (!reviewRes.success || !reviewRes.data) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p>Failed to load weekly review data. Please try refreshing.</p>
      </div>
    )
  }

  return <WeeklyReviewClient initialData={reviewRes.data} />
}

