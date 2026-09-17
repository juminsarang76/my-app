import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { requireAdmin } from '@/app/lib/admin-guard'


// 승인 재설정: 상태를 pending으로 되돌리고 권한 초기화
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied
  const { user_id } = await req.json()
  await supabase.from('haru_permissions').delete().eq('user_id', user_id)
  await supabase.from('haru_users').update({ status: 'pending' }).eq('id', user_id)
  return NextResponse.json({ ok: true })
}
