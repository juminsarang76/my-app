import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { hashPassword, verifyPassword, validatePassword } from '@/app/lib/password'
import { sessionEmail } from '@/app/lib/session'

// 본인 비밀번호 변경. 세션 토큰의 주인만 자기 비밀번호를 바꿀 수 있다.
export async function POST(req: NextRequest) {
  const email = sessionEmail(req)
  if (!email) {
    return NextResponse.json({ error: '다시 로그인한 뒤 시도해주세요.' }, { status: 401 })
  }

  const { currentPassword, newPassword } = await req.json()
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: '현재 비밀번호와 새 비밀번호를 모두 입력하세요.' }, { status: 400 })
  }

  const invalid = validatePassword(newPassword)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: '현재 비밀번호와 다른 값을 입력하세요.' }, { status: 400 })
  }

  const { data: user } = await supabase
    .from('haru_users')
    .select('id, password')
    .eq('email', email)
    .single()

  if (!user || !verifyPassword(currentPassword, user.password)) {
    return NextResponse.json({ error: '현재 비밀번호가 올바르지 않습니다.' }, { status: 401 })
  }

  const { error } = await supabase
    .from('haru_users')
    .update({ password: hashPassword(newPassword) })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
