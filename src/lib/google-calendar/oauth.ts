import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { encryptToken, decryptToken } from './crypto'

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
]

export function getGoogleOAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google'

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export interface TokenExchangeResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  email: string
}

export async function exchangeAuthCode(code: string): Promise<TokenExchangeResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google'

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text()
    throw new Error(`Failed to exchange authorization code: ${errorText}`)
  }

  const tokenData = await tokenRes.json()
  const accessToken = tokenData.access_token
  const refreshToken = tokenData.refresh_token
  const expiresIn = tokenData.expires_in || 3600

  // Fetch email associated with token
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  let email = ''
  if (userRes.ok) {
    const userData = await userRes.json()
    email = userData.email || ''
  }

  return {
    accessToken,
    refreshToken: refreshToken || '',
    expiresIn,
    email,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.GOOGLE_CLIENT_ID || ''
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || ''

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Failed to refresh Google access token: ${errorText}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600,
  }
}

export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Retrieves and validates the user's active Google Calendar access token.
 * Refreshes automatically if expired or expiring within 5 minutes.
 */
export async function getValidAccessTokenForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ accessToken: string; connectionId: string; accountEmail: string } | null> {
  const { data: connection, error } = await supabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !connection) return null

  const nowMs = Date.now()
  const expiresAtMs = new Date(connection.token_expires_at).getTime()
  const isExpired = expiresAtMs <= nowMs + 5 * 60 * 1000 // 5-minute buffer

  let plainAccessToken = ''

  if (isExpired) {
    try {
      const plainRefreshToken = decryptToken(connection.encrypted_refresh_token)
      if (!plainRefreshToken) return null

      const { accessToken: newAccessToken, expiresIn } = await refreshAccessToken(plainRefreshToken)
      plainAccessToken = newAccessToken

      const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      const newEncryptedAccess = encryptToken(newAccessToken)

      await supabase
        .from('calendar_connections')
        .update({
          encrypted_access_token: newEncryptedAccess,
          token_expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', connection.id)
    } catch {
      // Mark connection as inactive on token refresh failure
      await supabase
        .from('calendar_connections')
        .update({ is_active: false })
        .eq('id', connection.id)
      return null
    }
  } else {
    plainAccessToken = decryptToken(connection.encrypted_access_token)
  }

  return {
    accessToken: plainAccessToken,
    connectionId: connection.id,
    accountEmail: connection.account_email,
  }
}

