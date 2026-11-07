import React from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLocalDateString } from '@/lib/timezone'
import { getDiaryDayDataAction } from '@/lib/actions/diary'
import { DiaryClient } from './diary-client'

export default async function DiaryPage(props: {
  searchParams?: Promise<{ date?: string }>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone, display_name')
    .eq('id', user.id)
    .single()

  const userTimezone = profile?.timezone || 'UTC'
  const targetDate = searchParams?.date || getLocalDateString(userTimezone)

  const initialDataRes = await getDiaryDayDataAction(targetDate, userTimezone)
  const initialData = initialDataRes.success && initialDataRes.data
    ? initialDataRes.data
    : {
        entry: null,
        entryDate: targetDate,
        focusTaskIds: [],
        focusTaskLinks: [],
        focusTasks: [],
        scheduledTasks: [],
        dueTasks: [],
        overdueTasks: [],
        completedTasks: [],
        availableTasks: [],
        calendarEvents: [],
      }

  return (
    <DiaryClient
      initialData={initialData}
      userTimezone={userTimezone}
      userDisplayName={profile?.display_name || user.user_metadata?.full_name}
    />
  )
}
