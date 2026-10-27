import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '@/lib/validations/auth'

describe('Auth Validation Schemas', () => {
  describe('loginSchema', () => {
    it('accepts valid credentials', () => {
      const valid = loginSchema.safeParse({
        email: 'user@workday.io',
        password: 'Password123!',
      })
      expect(valid.success).toBe(true)
    })

    it('rejects invalid email formats', () => {
      const invalid = loginSchema.safeParse({
        email: 'not-an-email',
        password: 'Password123!',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Please enter a valid email address')
      }
    })

    it('rejects empty password', () => {
      const invalid = loginSchema.safeParse({
        email: 'user@workday.io',
        password: '',
      })
      expect(invalid.success).toBe(false)
    })

    it('rejects passwords shorter than 6 characters', () => {
      const invalid = loginSchema.safeParse({
        email: 'user@workday.io',
        password: '123',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Password must be at least 6 characters')
      }
    })
  })

  describe('registerSchema', () => {
    it('accepts valid registration input', () => {
      const valid = registerSchema.safeParse({
        fullName: 'Alex Architect',
        email: 'alex@workday.io',
        password: 'SecurePassword1',
        confirmPassword: 'SecurePassword1',
        timezone: 'America/New_York',
      })
      expect(valid.success).toBe(true)
    })

    it('rejects mismatched password and confirmPassword', () => {
      const invalid = registerSchema.safeParse({
        fullName: 'Alex Architect',
        email: 'alex@workday.io',
        password: 'SecurePassword1',
        confirmPassword: 'DifferentPassword2',
        timezone: 'America/New_York',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Passwords do not match')
      }
    })

    it('rejects passwords missing uppercase letters', () => {
      const invalid = registerSchema.safeParse({
        fullName: 'Alex Architect',
        email: 'alex@workday.io',
        password: 'lowercaseonly123',
        confirmPassword: 'lowercaseonly123',
        timezone: 'UTC',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Password must contain at least one uppercase letter')
      }
    })

    it('rejects passwords missing digits', () => {
      const invalid = registerSchema.safeParse({
        fullName: 'Alex Architect',
        email: 'alex@workday.io',
        password: 'NoNumbersHereAtAll',
        confirmPassword: 'NoNumbersHereAtAll',
        timezone: 'UTC',
      })
      expect(invalid.success).toBe(false)
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toBe('Password must contain at least one number')
      }
    })
  })
})
