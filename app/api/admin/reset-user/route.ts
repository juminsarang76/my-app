import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { ADMIN_EMAIL } from '@/app/lib/auth'


// 승인 재설정: 상태를 pending으로 되돌리고 권한 초기화
export async function POST(req: NextRequest) {
  const adminEmail = req.headers.get('x-admin-email') ?? ''
  if (adminEmail.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  const { user_id } = await req.json()
  await supabase.from('haru_permissions').delete().eq('user_id', user_id)
  await supabase.from('haru_users').update({ status: 'pending' }).eq('id', user_id)
  return NextResponse.json({ ok: true })
}
