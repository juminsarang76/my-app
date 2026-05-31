import { NextResponse } from 'next/server'

// 카카오 친구 목록 조회 (앱을 허용한 친구만 표시)
// GET https://kapi.kakao.com/v1/friends
export async function GET() {
  let token = process.env.KAKAO_ACCESS_TOKEN!

  const call = (t: string) =>
    fetch('https://kapi.kakao.com/v1/friends?limit=30', {
      headers: { Authorization: `Bearer ${t}` },
    })

  let res = await call(token)

  // 토큰 만료 시 자동 갱신
  if (res.status === 401) {
    const refresh = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.KAKAO_REST_API_KEY!,
        refresh_token: process.env.KAKAO_REFRESH_TOKEN!,
      }),
    })
    if (!refresh.ok) {
      return NextResponse.json({ error: '토큰 갱신 실패. KAKAO 토큰을 확인하세요.' }, { status: 401 })
    }
    const td = await refresh.json()
    token = td.access_token
    res = await call(token)
  }

  if (!res.ok) {
    const body = await res.text()
    return NextResponse.json(
      { error: `카카오 API 오류 ${res.status}: ${body}` },
      { status: res.status },
    )
  }

  const data = await res.json()
  // elements: [{ id, uuid, profile_nickname, profile_thumbnail_image, favorite, allowed_msg }]
  return NextResponse.json(data.elements ?? [])
}
