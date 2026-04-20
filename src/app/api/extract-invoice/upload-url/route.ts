import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { fileType } = await request.json().catch(() => ({ fileType: 'application/pdf' }))
  const ext = fileType?.includes('pdf') ? 'pdf' : fileType?.split('/')[1] || 'pdf'

  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Create bucket if it doesn't exist (ignore already-exists error)
  await serviceClient.storage.createBucket('invoice-documents', {
    public: false,
    fileSizeLimit: 20971520,
  })

  const path = `${user.id}/${Date.now()}.${ext}`
  const { data, error } = await serviceClient.storage
    .from('invoice-documents')
    .createSignedUploadUrl(path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ signedUrl: data.signedUrl, token: data.token, path })
}
