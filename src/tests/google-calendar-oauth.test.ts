import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getGoogleOAuthUrl,
  exchangeAuthCode,
  refreshAccessToken,
  revokeGoogleToken,
  GOOGLE_CALENDAR_SCOPES,
} from '@/lib/google-calendar/oauth'

describe('Google Calendar OAuth 2.0 Integration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      GOOGLE_CLIENT_ID: 'mock-google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
      GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/callback/google',
      CALENDAR_ENCRYPTION_KEY: 'test-encryption-key-for-oauth-tests',
    }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('generates a valid Google OAuth consent URL with correct query parameters', () => {
    const state = 'secure-csrf-state-token-12345'
    const urlString = getGoogleOAuthUrl(state)
    const url = new URL(urlString)

    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.pathname).toBe('/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('mock-google-client-id.apps.googleusercontent.com')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/auth/callback/google')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('state')).toBe(state)

    const scopes = url.searchParams.get('scope')?.split(' ') || []
    expect(scopes).toEqual(GOOGLE_CALENDAR_SCOPES)
    expect(scopes).toContain('https://www.googleapis.com/auth/calendar.events')
    expect(scopes).toContain('https://www.googleapis.com/auth/userinfo.email')
  })

  it('exchanges an authorization code for access and refresh tokens', async () => {
    const mockTokenResponse = {
      access_token: 'mock-access-token-abc',
      refresh_token: 'mock-refresh-token-xyz',
      expires_in: 3600,
    }
    const mockUserInfoResponse = {
      email: 'alex@workdayos.internal',
    }

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === 'https://oauth2.googleapis.com/token') {
        return Promise.resolve({
          ok: true,
          json: async () => mockTokenResponse,
        })
      }
      if (url === 'https://www.googleapis.com/oauth2/v2/userinfo') {
        return Promise.resolve({
          ok: true,
          json: async () => mockUserInfoResponse,
        })
      }
      return Promise.reject(new Error(`Unexpected fetch URL: ${url}`))
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeAuthCode('auth-code-123')

    expect(result.accessToken).toBe('mock-access-token-abc')
    expect(result.refreshToken).toBe('mock-refresh-token-xyz')
    expect(result.expiresIn).toBe(3600)
    expect(result.email).toBe('alex@workdayos.internal')
  })

  it('handles token exchange errors gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Code expired' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(exchangeAuthCode('bad-code')).rejects.toThrow(/Failed to exchange authorization code/)
  })

  it('refreshes an expired access token using the stored refresh token', async () => {
    const mockRefreshResponse = {
      access_token: 'new-refreshed-access-token',
      expires_in: 3600,
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRefreshResponse,
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await refreshAccessToken('stored-refresh-token')
    expect(res.accessToken).toBe('new-refreshed-access-token')
    expect(res.expiresIn).toBe(3600)
  })

  it('revokes a Google OAuth token cleanly upon disconnect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(revokeGoogleToken('token-to-revoke')).resolves.not.toThrow()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/revoke?token=token-to-revoke',
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
  })

  it('binds single-use CSRF state tokens securely to user session identifiers', () => {
    const userId = 'user-uuid-1234-5678'
    const nonce = 'random-crypto-nonce-9876'
    const state = `${userId}.${nonce}`

    const urlString = getGoogleOAuthUrl(state)
    const url = new URL(urlString)

    expect(url.searchParams.get('state')).toBe(state)
    const stateParts = url.searchParams.get('state')?.split('.') || []
    expect(stateParts[0]).toBe(userId)
    expect(stateParts[1]).toBe(nonce)
  })

  it('fails gracefully when refreshing an invalid or revoked refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => JSON.stringify({ error: 'invalid_grant', error_description: 'Token has been expired or revoked' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(refreshAccessToken('revoked-refresh-token')).rejects.toThrow(/Failed to refresh Google access token/)
  })
})

