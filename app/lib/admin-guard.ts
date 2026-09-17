import { NextResponse } from 'next/server'
import { ADMIN_EMAIL } from './auth'
import { sessionEmail, isSecretConfigured } from './session'

// 관리자 라우트 공용 가드.
// 통과하면 null, 막으면 그대로 반환할 응답을 돌려준다.
export function requireAdmin(req: Request): NextResponse | null {
  if (!isSecretConfigured()) {
    return NextResponse.json(
      { error: 'AUTH_SECRET 미설정 — 관리자 API가 비활성화되었습니다.' },
      { status: 503 },
    )
  }
  const email = sessionEmail(req)
  if (!email || email !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }
  return null
}
