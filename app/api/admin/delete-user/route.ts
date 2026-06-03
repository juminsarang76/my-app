import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ADMIN_EMAIL } from '@/app/lib/auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

export async function DELETE(req: NextRequest) {
  const adminEmail = req.headers.get('x-admin-email') ?? ''
  if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { user_id } = await req.json()
  await supabase.from('haru_permissions').delete().eq('user_id', user_id)
  await supabase.from('haru_users').delete().eq('id', user_id)
  return NextResponse.json({ ok: true })
}
