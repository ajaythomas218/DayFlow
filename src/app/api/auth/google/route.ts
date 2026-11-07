import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getGoogleOAuthUrl } from '@/lib/google-calendar/oauth'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // Generate secure single-use CSRF state bound to initiating authenticated user session
  const randomNonce = crypto.randomBytes(24).toString('hex')
  const state = `${user.id}.${randomNonce}`
  const authUrl = getGoogleOAuthUrl(state)

  const response = NextResponse.redirect(authUrl)

  // Store state in secure HttpOnly cookie (10 minute TTL)
  response.cookies.set('gcal_oauth_state', state, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
  })

  return response
}
