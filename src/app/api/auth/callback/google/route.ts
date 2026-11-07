import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeAuthCode, GOOGLE_CALENDAR_SCOPES } from '@/lib/google-calendar/oauth'
import { encryptToken } from '@/lib/google-calendar/crypto'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const errorParam = searchParams.get('error')

  const storedState = req.cookies.get('gcal_oauth_state')?.value
  const settingsUrl = new URL('/settings', req.url)

  // 1. Handle user cancellation or OAuth error from Google
  if (errorParam) {
    const response = NextResponse.redirect(settingsUrl)
    response.cookies.delete('gcal_oauth_state')
    settingsUrl.searchParams.set('error', errorParam === 'access_denied' ? 'oauth_denied' : 'google_oauth_error')
    return NextResponse.redirect(settingsUrl)
  }

  // 2. Validate single-use CSRF state token
  if (!state || !storedState || state !== storedState) {
    const response = NextResponse.redirect(settingsUrl)
    response.cookies.delete('gcal_oauth_state')
    settingsUrl.searchParams.set('error', 'oauth_csrf_invalid')
    return NextResponse.redirect(settingsUrl)
  }

  // 3. Ensure authorization code is present
  if (!code) {
    const response = NextResponse.redirect(settingsUrl)
    response.cookies.delete('gcal_oauth_state')
    settingsUrl.searchParams.set('error', 'missing_auth_code')
    return NextResponse.redirect(settingsUrl)
  }

  // 4. Verify authenticated user session and state binding
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    const loginUrl = new URL('/login', req.url)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete('gcal_oauth_state')
    return response
  }

  // Validate that the state was initiated by this specific authenticated user
  const stateUserId = state.split('.')[0]
  if (stateUserId !== user.id) {
    const response = NextResponse.redirect(settingsUrl)
    response.cookies.delete('gcal_oauth_state')
    settingsUrl.searchParams.set('error', 'oauth_user_mismatch')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    // 5. Exchange code for tokens (never log tokens or codes)
    const { accessToken, refreshToken, expiresIn, email } = await exchangeAuthCode(code)

    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const encryptedAccess = encryptToken(accessToken)

    // Check if an existing connection exists for this user and account
    const accountEmail = email || user.email || 'unknown@gmail.com'
    const { data: existingConnection } = await supabase
      .from('calendar_connections')
      .select('id, encrypted_refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'google')
      .eq('account_email', accountEmail)
      .maybeSingle()

    // Handle reconnect / refresh token retention:
    // If Google did not return a new refresh token on reconnect, preserve existing refresh token
    let encryptedRefresh: string
    if (refreshToken) {
      encryptedRefresh = encryptToken(refreshToken)
    } else if (existingConnection?.encrypted_refresh_token) {
      encryptedRefresh = existingConnection.encrypted_refresh_token
    } else {
      // Fallback: encrypt empty or flag error
      encryptedRefresh = encryptToken('')
    }

    // 6. Upsert connection record safely
    const { data: connection, error: upsertError } = await supabase
      .from('calendar_connections')
      .upsert(
        {
          user_id: user.id,
          provider: 'google',
          account_email: accountEmail,
          encrypted_access_token: encryptedAccess,
          encrypted_refresh_token: encryptedRefresh,
          token_expires_at: tokenExpiresAt,
          scopes: GOOGLE_CALENDAR_SCOPES,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,provider,account_email' }
      )
      .select('id')
      .single()

    if (upsertError || !connection) {
      settingsUrl.searchParams.set('error', 'db_save_failed')
      const response = NextResponse.redirect(settingsUrl)
      response.cookies.delete('gcal_oauth_state')
      return response
    }

    // 7. Initialize calendar_sync_state for primary calendar
    const { data: existingSyncState } = await supabase
      .from('calendar_sync_state')
      .select('id')
      .eq('calendar_connection_id', connection.id)
      .eq('google_calendar_id', 'primary')
      .maybeSingle()

    if (!existingSyncState) {
      await supabase.from('calendar_sync_state').insert({
        calendar_connection_id: connection.id,
        google_calendar_id: 'primary',
        sync_status: 'idle',
      })
    }

    settingsUrl.searchParams.set('success', 'google_calendar_connected')
    const response = NextResponse.redirect(settingsUrl)

    // Clear single-use state cookie
    response.cookies.delete('gcal_oauth_state')
    return response
  } catch (err) {
    // Fail safely without logging secrets or credentials
    const msg = err instanceof Error ? 'exchange_failed' : 'unknown_error'
    settingsUrl.searchParams.set('error', msg)
    const response = NextResponse.redirect(settingsUrl)
    response.cookies.delete('gcal_oauth_state')
    return response
  }
}
