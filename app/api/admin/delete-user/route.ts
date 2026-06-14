import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { ADMIN_EMAIL } from '@/app/lib/auth'


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
