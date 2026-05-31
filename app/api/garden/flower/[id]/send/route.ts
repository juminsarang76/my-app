import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

async function getToken(): Promise<string> {
  const token = process.env.KAKAO_ACCESS_TOKEN!
  // 401 시 refresh는 send 함수 내에서 처리
  return token
}

async function refreshToken(): Promise<string> {
  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.KAKAO_REST_API_KEY!,
      refresh_token: process.env.KAKAO_REFRESH_TOKEN!,
    }),
  })
  if (!res.ok) throw new Error('Token refresh failed')
  const data = await res.json()
  return data.access_token as string
}

async function sendToFriend(
  uuid: string,
  templateObject: object,
  token: string,
): Promise<{ uuid: string; ok: boolean; error?: string }> {
  const send = async (t: string) =>
    fetch('https://kapi.kakao.com/v1/api/talk/friends/message/default/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        receiver_uuids: JSON.stringify([uuid]),
        template_object: JSON.stringify(templateObject),
      }),
    })

  let res = await send(token)
  if (res.status === 401) {
    const newToken = await refreshToken()
    res = await send(newToken)
  }

  if (!res.ok) {
    const body = await res.text()
    return { uuid, ok: false, error: `${res.status}: ${body}` }
  }
  return { uuid, ok: true }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // 꽃 데이터 조회
  const { data: flower, error: ferr } = await supabase
    .from('daily_flowers')
    .select('flower_text, image_data')
    .eq('id', id)
    .single()

  if (ferr || !flower) {
    return NextResponse.json({ error: '하루꽃을 찾을 수 없습니다.' }, { status: 404 })
  }

  // 친구 목록 조회
  const { data: friends, error: friendErr } = await supabase
    .from('garden_friends')
    .select('name, kakao_uuid')
    .order('id', { ascending: true })
    .limit(5)

  if (friendErr || !friends?.length) {
    return NextResponse.json({ error: '등록된 친구가 없습니다.' }, { status: 400 })
  }

  const imageUrl = flower.image_data
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/garden/flower/${id}/image`
    : null

  const templateObject = {
    object_type: 'feed',
    content: {
      title: '🌸 하루꽃',
      description: flower.flower_text || '오늘의 꽃입니다.',
      ...(imageUrl ? { image_url: imageUrl, image_width: 640, image_height: 640 } : {}),
      link: {
        web_url: `${process.env.NEXT_PUBLIC_API_URL}/garden/flower/${id}`,
        mobile_web_url: `${process.env.NEXT_PUBLIC_API_URL}/garden/flower/${id}`,
      },
    },
  }

  const token = await getToken()

  const results = await Promise.allSettled(
    friends.map((f) => sendToFriend(f.kakao_uuid, templateObject, token)),
  )

  const summary = results.map((r, i) => ({
    name: friends[i].name,
    ...(r.status === 'fulfilled' ? r.value : { uuid: friends[i].kakao_uuid, ok: false, error: String(r.reason) }),
  }))

  // 전송 완료 시각 기록
  if (summary.some((s) => s.ok)) {
    await supabase
      .from('daily_flowers')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({ results: summary })
}
