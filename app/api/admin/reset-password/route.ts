import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { supabase } from '@/app/lib/supabase'
import { requireAdmin } from '@/app/lib/admin-guard'
import { hashPassword } from '@/app/lib/password'
import { ADMIN_EMAIL } from '@/app/lib/auth'

// 관리자가 다른 사용자의 비밀번호를 임시값으로 초기화한다.
// 비밀번호는 해시로만 저장돼 조회가 불가능하므로, 새로 발급해 관리자에게 한 번 보여주고
// 당사자가 /password 에서 바꾸게 한다.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req)
  if (denied) return denied

  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id 필요' }, { status: 400 })

  const { data: user } = await supabase
    .from('haru_users')
    .select('id, email, name')
    .eq('id', user_id)
    .single()

  if (!user) return NextResponse.json({ error: '사용자 없음' }, { status: 404 })

  // 관리자 본인은 이 경로로 바꾸지 않는다 (로그인 화면의 카카오 재설정을 쓴다)
  if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json(
      { error: '관리자 본인은 로그인 화면의 "비밀번호를 잊으셨나요?"를 이용하세요.' },
      { status: 400 },
    )
  }

  // 읽어서 전달하기 쉬운 임시 비밀번호 (12자)
  const temp = randomBytes(9).toString('base64url').slice(0, 12)

  const { error } = await supabase
    .from('haru_users')
    .update({ password: hashPassword(temp) })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, name: user.name, email: user.email, tempPassword: temp })
}
