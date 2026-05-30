import { NextRequest, NextResponse } from 'next/server'

// Gemini Imagen 3 Fast — GEMINI_API_KEY 사용 (기존 키 재활용)
// 문서: https://ai.google.dev/api/images
const MODEL = 'imagen-3.0-fast-generate-001'

const VARIATIONS = [
  'professional product photography, front view, clean white studio background, soft diffused lighting',
  'product photography 45-degree angle, warm natural lighting, modern lifestyle setting',
  'product flat lay, top-down view, minimal pastel background, aesthetic composition',
  'product detail close-up, shallow depth of field, elegant bokeh background',
]

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '프롬프트가 비어 있습니다.' }, { status: 400 })
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predict?key=${apiKey}`

  // 4개 변형을 병렬 생성 (각 1장씩 → 응답 크기 분산)
  const results = await Promise.allSettled(
    VARIATIONS.map((variation) =>
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: `${prompt}, ${variation}` }],
          parameters: { sampleCount: 1, aspectRatio: '1:1' },
        }),
      }).then(async (r) => {
        const text = await r.text()
        if (!r.ok) throw new Error(`${r.status}: ${text}`)
        return JSON.parse(text)
      }),
    ),
  )

  const images: string[] = []
  const errors: string[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const pred = r.value?.predictions?.[0]
      if (pred?.bytesBase64Encoded) {
        const mime = pred.mimeType ?? 'image/png'
        images.push(`data:${mime};base64,${pred.bytesBase64Encoded}`)
      } else {
        errors.push('예측 데이터 없음')
      }
    } else {
      errors.push(String(r.reason))
    }
  }

  if (images.length === 0) {
    return NextResponse.json(
      { error: `이미지 생성 실패: ${errors[0] ?? '알 수 없는 오류'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ images })
}
