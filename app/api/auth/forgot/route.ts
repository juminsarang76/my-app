import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAIL } from '@/app/lib/auth'
import { issueResetToken } from '@/app/lib/reset'
import { sendKakaoMessage } from '@/app/lib/kakao'

export const maxDuration = 30

// 비밀번호 찾기.
//
// 카카오 "나에게 보내기"는 앱 소유자 본인에게만 도착하므로, 이 경로는 관리자 계정 전용이다.
// 일반 사용자는 관리자가 /admin 에서 초기화해준다.
//
// 계정 열거를 막기 위해 어떤 이메일이 들어와도 같은 응답을 돌려준다.
export async function POST(req: NextRequest) {
  const OK = { ok: true, message: '해당 계정이 있으면 카카오톡으로 재설정 링크를 보냈습니다.' }

  let email = ''
  try {
    ({ email } = await req.json())
  } catch {
    return NextResponse.json(OK)
  }

  if (!email || email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return NextResponse.json(OK)
  }

  try {
    const token = await issueResetToken(ADMIN_EMAIL)
    const url = `${process.env.NEXT_PUBLIC_API_URL}/reset?token=${encodeURIComponent(token)}`
    await sendKakaoMessage(
      `[비밀번호 재설정]\n\n아래 링크에서 새 비밀번호를 설정하세요.\n30분 뒤 만료되며 한 번만 사용할 수 있습니다.\n\n${url}`,
      '비밀번호 재설정 링크',
    )
  } catch {
    // 발송 실패도 동일하게 응답한다 (계정 존재 여부가 드러나지 않도록).
    // 실패 자체는 app_state 의 kakao_last_send 에 남는다.
  }

  return NextResponse.json(OK)
}
