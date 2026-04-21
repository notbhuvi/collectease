import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// PATCH /api/profile — update own profile (full_name, company_name, password)
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { full_name, company_name, new_password, current_password } = body

  const serviceClient = await createServiceClient()
  const updates: Record<string, string> = {}
  if (full_name !== undefined) updates.full_name = full_name
  if (company_name !== undefined) updates.company_name = company_name

  // Update profile fields
  if (Object.keys(updates).length > 0) {
    const { error } = await serviceClient
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Change password if requested
  if (new_password) {
    if (!current_password) {
      return NextResponse.json({ error: 'Current password required to change password' }, { status: 400 })
    }
    // Verify current password
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    })
    if (authError) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 })
    }
    // Update password via admin API
    const { error: pwError } = await serviceClient.auth.admin.updateUserById(user.id, {
      password: new_password,
    })
    if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
