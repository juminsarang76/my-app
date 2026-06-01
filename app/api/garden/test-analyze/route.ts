import { NextResponse } from 'next/server'

// 꽃 이름 분석 기능 검증용 — 장미 샘플 이미지로 테스트
// GET /api/garden/test-analyze
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY 없음' })

  // 공개 장미 이미지 fetch
  const sampleUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Sunflower_from_Silesia2.jpg/320px-Sunflower_from_Silesia2.jpg'
  let imageBase64: string
  let imageMime: string

  try {
    const imgRes = await fetch(sampleUrl)
    if (!imgRes.ok) return NextResponse.json({ ok: false, error: '샘플 이미지 로드 실패' })
    const buf = await imgRes.arrayBuffer()
    imageBase64 = Buffer.from(buf).toString('base64')
    imageMime = imgRes.headers.get('content-type') ?? 'image/jpeg'
  } catch (e) {
    return NextResponse.json({ ok: false, error: `이미지 fetch 실패: ${String(e)}` })
  }

  // analyze-flower 엔드포인트 호출
  const origin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
  const analyzeRes = await fetch(`${origin}/api/garden/analyze-flower`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64: imageBase64, mime: imageMime }),
  })

  const result = await analyzeRes.json()

  return NextResponse.json({
    ok: analyzeRes.ok,
    status: analyzeRes.status,
    result,
    expected: '해바라기 (또는 유사 꽃 이름)',
  })
}
