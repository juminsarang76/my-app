import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { sessionEmail } from '@/app/lib/session'


export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email 필요' }, { status: 400 })

  // 예전에는 이메일만 알면 누구나 타인의 id·권한을 조회할 수 있었다.
  // 세션 토큰의 주인과 조회 대상이 일치할 때만 허용한다.
  if (sessionEmail(req) !== email.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { data: user } = await supabase
    .from('haru_users')
    .select('id, name, email')
    .eq('email', email.toLowerCase())
    .single()

  if (!user) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  const { data: perms } = await supabase
    .from('haru_permissions')
    .select('menu_key')
    .eq('user_id', user.id)

  return NextResponse.json({ ...user, permissions: perms?.map(p => p.menu_key) ?? [] })
}
