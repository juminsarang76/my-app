import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/app/lib/supabase'
import { consumeResetToken } from '@/app/lib/reset'
import { hashPassword, validatePassword } from '@/app/lib/password'

// 재설정 링크로 받은 1회성 토큰으로 새 비밀번호를 설정한다.
export async function POST(req: NextRequest) {
  const { token, newPassword } = await req.json()
  if (!token || !newPassword) {
    return NextResponse.json({ error: '토큰과 새 비밀번호가 필요합니다.' }, { status: 400 })
  }

  const invalid = validatePassword(newPassword)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const email = await consumeResetToken(token)
  if (!email) {
    return NextResponse.json(
      { error: '링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('haru_users')
    .update({ password: hashPassword(newPassword) })
    .eq('email', email)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
