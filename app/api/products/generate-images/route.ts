import { NextRequest, NextResponse } from 'next/server'

// Pollinations.ai — 무료, API 키 불필요, flux 모델
// URL 접근 시 브라우저에서 실시간 생성 (서버 처리 없음)
const BASE = 'https://image.pollinations.ai/prompt'

const VARIATIONS = [
  'professional product photography, front view, clean white studio background, soft diffused lighting, commercial photo',
  'product lifestyle photography, 45 degree angle, warm natural light, modern minimal interior',
  'product flat lay, top-down view, pastel minimal background, aesthetic composition, instagram style',
  'product detail close-up, shallow depth of field, elegant bokeh background, macro lens',
]

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '프롬프트가 비어 있습니다.' }, { status: 400 })
  }

  const seed = Math.floor(Math.random() * 9999999)

  const images = VARIATIONS.map((variation, i) => {
    const fullPrompt = encodeURIComponent(`${prompt}, ${variation}`)
    return `${BASE}/${fullPrompt}?width=1024&height=1024&seed=${seed + i}&nologo=true&model=flux`
  })

  return NextResponse.json({ images })
}
