import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'


export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'email 필요' }, { status: 400 })

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
