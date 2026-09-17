import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { hashPassword, isAdmin, ALL_MENUS } from '@/app/lib/auth'
import { createSessionToken } from '@/app/lib/session'


export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: '이메일과 비밀번호를 입력하세요.' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('haru_users')
    .select('id, name, email, role, status, password')
    .eq('email', email.trim().toLowerCase())
    .single()

  // 계정 열거(enumeration) 방지 — 미등록 이메일과 비밀번호 불일치를 구분하지 않는다
  const INVALID = '이메일 또는 비밀번호가 올바르지 않습니다.'
  if (!user) return NextResponse.json({ error: INVALID }, { status: 401 })
  if (user.password !== hashPassword(password)) {
    return NextResponse.json({ error: INVALID }, { status: 401 })
  }
  if (user.status === 'rejected') {
    return NextResponse.json({ error: '접근이 거부된 계정입니다.' }, { status: 403 })
  }

  // Admin은 항상 모든 권한
  const permissions = isAdmin(user.email)
    ? ALL_MENUS.map(m => m.key)
    : await supabase
        .from('haru_permissions').select('menu_key').eq('user_id', user.id)
        .then(({ data }) => data?.map(p => p.menu_key) ?? [])

  return NextResponse.json({
    id: user.id, name: user.name, email: user.email,
    role: user.role, status: user.status,
    permissions,
    token: createSessionToken(user.email),
  })
}
