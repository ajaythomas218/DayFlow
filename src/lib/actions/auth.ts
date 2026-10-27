'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loginSchema, registerSchema } from '@/lib/validations/auth'
import { ActionResponse } from '@/types'

export async function loginAction(formData: FormData): Promise<ActionResponse> {
  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  }

  const parsed = loginSchema.safeParse(rawData)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid input'
    return { success: false, error: errorMsg }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  const redirectTo = (formData.get('redirectTo') as string) || '/dashboard'
  redirect(redirectTo)
}

export async function registerAction(formData: FormData): Promise<ActionResponse> {
  const rawData = {
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    timezone: (formData.get('timezone') as string) || 'UTC',
  }

  const parsed = registerSchema.safeParse(rawData)
  if (!parsed.success) {
    const errorMsg = parsed.error.issues[0]?.message || 'Invalid registration input'
    return { success: false, error: errorMsg }
  }

  const { email, password, fullName, timezone } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        timezone,
      },
    },
  })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
