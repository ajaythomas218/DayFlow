import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processClaimedDelivery } from '@/lib/reminders/scheduler'
import { Database } from '@/types/database.types'

/**
 * Server-Side Reminder Delivery Cron Handler.
 * Invoked periodically (e.g. every minute) by Vercel Cron or an external scheduler.
 * Authenticated via CRON_SECRET header to prevent unauthorized invocations.
 */
export async function GET(req: NextRequest) {
  return handleCronExecution(req)
}

export async function POST(req: NextRequest) {
  return handleCronExecution(req)
}

async function handleCronExecution(req: NextRequest) {
  // 1. Verify Scheduler Authentication
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET is not configured.' },
      { status: 500 }
    )
  }

  const authHeader = req.headers.get('authorization')
  const xCronHeader = req.headers.get('x-cron-secret')
  const isAuthorized =
    authHeader === `Bearer ${cronSecret}` ||
    xCronHeader === cronSecret ||
    req.nextUrl.searchParams.get('secret') === cronSecret

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret.' },
      { status: 401 }
    )
  }

  const startTime = Date.now()
  let processedCount = 0
  let successCount = 0
  let failureCount = 0

  try {
    const adminSupabase = createAdminClient()

    // 2. Atomically Claim Due Reminder Deliveries
    // Uses RPC claim_due_reminder_deliveries (FOR UPDATE SKIP LOCKED) with safe fallback
    let claimedJobs: Database['public']['Tables']['reminder_deliveries']['Row'][] = []

    const { data: rpcData, error: rpcError } = await adminSupabase.rpc(
      // @ts-expect-error Dynamic RPC check
      'claim_due_reminder_deliveries',
      { batch_size: 50 }
    )

    if (!rpcError && Array.isArray(rpcData)) {
      claimedJobs = rpcData
    } else {
      // Direct atomic query fallback: claim pending/due items with state transition
      const nowIso = new Date().toISOString()
      const { data: fallbackDue } = await adminSupabase
        .from('reminder_deliveries')
        .select('*')
        .or(`and(status.in.(scheduled,pending),scheduled_for.lte.${nowIso}),and(status.eq.failed,next_retry_at.lte.${nowIso})`)
        .order('scheduled_for', { ascending: true })
        .limit(50)

      if (fallbackDue && fallbackDue.length > 0) {
        const eligibleIds = fallbackDue
          .filter((d) => d.attempt_count < d.max_attempts)
          .map((d) => d.id)

        if (eligibleIds.length > 0) {
          const { data: markedJobs } = await adminSupabase
            .from('reminder_deliveries')
            .update({
              status: 'processing',
              last_attempt_at: nowIso,
            })
            .in('id', eligibleIds)
            .select()

          claimedJobs = markedJobs || []
        }
      }
    }

    processedCount = claimedJobs.length

    // 3. Process Each Claimed Job
    for (const job of claimedJobs) {
      const outcome = await processClaimedDelivery(adminSupabase, job)
      if (outcome.success) {
        successCount++
      } else {
        failureCount++
      }
    }

    const durationMs = Date.now() - startTime

    return NextResponse.json({
      success: true,
      processed: processedCount,
      delivered: successCount,
      failed: failureCount,
      durationMs,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown cron error'
    return NextResponse.json(
      { success: false, error: msg, processed: processedCount },
      { status: 500 }
    )
  }
}
