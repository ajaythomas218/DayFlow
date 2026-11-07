import { describe, it, expect } from 'vitest'
import {
  encryptToken,
  decryptToken,
  rotateTokenEncryption,
  CURRENT_KEY_VERSION,
  getEncryptionKey,
} from '@/lib/google-calendar/crypto'

describe('Google Calendar Token Encryption (AES-256-GCM)', () => {
  const secret = 'super-secret-production-encryption-key-for-test-suite-32chars'

  it('encrypts tokens with version prefix, unique IV, auth tag, and ciphertext', () => {
    const originalToken = 'ya29.a0AfH6SMDh_sample_google_access_token_123456789'
    const encrypted = encryptToken(originalToken, secret)

    expect(encrypted).not.toBe(originalToken)
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(4) // v1:iv:tag:ciphertext
    expect(parts[0]).toBe(CURRENT_KEY_VERSION)

    const decrypted = decryptToken(encrypted, secret)
    expect(decrypted).toBe(originalToken)
  })

  it('handles empty strings gracefully', () => {
    expect(encryptToken('', secret)).toBe('')
    expect(decryptToken('', secret)).toBe('')
  })

  it('produces distinct ciphertexts for identical plaintexts due to unique nonce generation', () => {
    const token = '1//0gExampleRefreshTokenHere'
    const encrypted1 = encryptToken(token, secret)
    const encrypted2 = encryptToken(token, secret)

    expect(encrypted1).not.toBe(encrypted2)

    // Both decrypt to the identical original token
    expect(decryptToken(encrypted1, secret)).toBe(token)
    expect(decryptToken(encrypted2, secret)).toBe(token)
  })

  it('rejects tampered ciphertext with an authentication error', () => {
    const originalToken = 'sensitive-google-refresh-token'
    const encrypted = encryptToken(originalToken, secret)
    const [version, iv, tag, ciphertext] = encrypted.split(':')

    // Tamper with the ciphertext
    const tamperedCiphertext = ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa')
    const tampered = `${version}:${iv}:${tag}:${tamperedCiphertext}`

    expect(() => decryptToken(tampered, secret)).toThrow()
  })

  it('rejects tampered authentication tag', () => {
    const originalToken = 'sensitive-google-refresh-token'
    const encrypted = encryptToken(originalToken, secret)
    const [version, iv, tag, ciphertext] = encrypted.split(':')

    // Tamper with auth tag
    const tamperedTag = tag.slice(0, -2) + '00'
    const tampered = `${version}:${iv}:${tamperedTag}:${ciphertext}`

    expect(() => decryptToken(tampered, secret)).toThrow()
  })

  it('supports backward compatibility with legacy unversioned 3-part payloads', () => {
    // Generate legacy format without version: iv:tag:ciphertext
    const originalToken = 'legacy-stored-token'
    const encrypted = encryptToken(originalToken, secret)
    const [, iv, tag, ciphertext] = encrypted.split(':')
    const legacyCipher = `${iv}:${tag}:${ciphertext}`

    expect(decryptToken(legacyCipher, secret)).toBe(originalToken)
  })

  it('validates key length and fails closed when key is too short', () => {
    expect(() => getEncryptionKey('short-key-less-than-32-chars')).toThrow(/must be at least 32 characters/)
  })

  it('supports seamless key rotation without token loss', () => {
    const oldKey = 'old-super-secure-encryption-key-for-test-32chars'
    const newKey = 'new-super-secure-encryption-key-for-test-32chars'

    const token = 'token-to-rotate-12345'
    const encryptedOld = encryptToken(token, oldKey)

    const encryptedNew = rotateTokenEncryption(encryptedOld, oldKey, newKey)
    expect(decryptToken(encryptedNew, newKey)).toBe(token)
  })

  it('rejects malformed encrypted payload format', () => {
    expect(() => decryptToken('malformed-payload-without-parts', secret)).toThrow(/Invalid cipher format/)
    expect(() => decryptToken('v1:iv:tag', secret)).toThrow(/Invalid cipher format/)
  })
})
