import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits for GCM
export const CURRENT_KEY_VERSION = 'v1'
const DEFAULT_TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

/**
 * Validates the encryption key length and derives a 32-byte key buffer using SHA-256.
 * Fails closed if the key is missing or shorter than 32 characters in production.
 */
export function getEncryptionKey(customKey?: string): Buffer {
  const keyStr = customKey || process.env.CALENDAR_ENCRYPTION_KEY

  if (!keyStr) {
    if (process.env.NODE_ENV === 'test') {
      return crypto.createHash('sha256').update(DEFAULT_TEST_KEY).digest()
    }
    throw new Error('Encryption configuration error: CALENDAR_ENCRYPTION_KEY environment variable is missing.')
  }

  if (keyStr.length < 32) {
    throw new Error('Encryption configuration error: CALENDAR_ENCRYPTION_KEY must be at least 32 characters in length.')
  }

  return crypto.createHash('sha256').update(keyStr).digest()
}

/**
 * Encrypts a plaintext token string with AES-256-GCM.
 * Output format: `v1:<ivHex>:<tagHex>:<cipherHex>`
 * Nonce (IV) is uniquely generated per encryption operation.
 */
export function encryptToken(plainText: string, customKey?: string): string {
  if (!plainText) return ''

  const key = getEncryptionKey(customKey)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag()

  return `${CURRENT_KEY_VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted token string.
 * Supports both versioned (`v1:iv:tag:ciphertext`) and legacy (`iv:tag:ciphertext`) formats.
 * Validates integrity via the GCM authentication tag.
 */
export function decryptToken(cipherString: string, customKey?: string): string {
  if (!cipherString) return ''

  const parts = cipherString.split(':')
  let ivHex: string
  let tagHex: string
  let encryptedHex: string

  if (parts.length === 4 && parts[0] === 'v1') {
    ;[, ivHex, tagHex, encryptedHex] = parts
  } else if (parts.length === 3 && parts[0] !== 'v1') {
    ;[ivHex, tagHex, encryptedHex] = parts
  } else {
    throw new Error('Invalid cipher format. Expected v1:iv:tag:ciphertext or legacy iv:tag:ciphertext.')
  }

  const key = getEncryptionKey(customKey)
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Re-encrypts a token under a new encryption key to support key rotation without data loss.
 */
export function rotateTokenEncryption(cipherString: string, oldKey: string, newKey: string): string {
  const plainText = decryptToken(cipherString, oldKey)
  return encryptToken(plainText, newKey)
}
