import { NextRequest, NextResponse } from 'next/server'

// Gemini 2.0 Flash — 이미지 생성 (AI Studio GEMINI_API_KEY로 사용 가능)
const MODEL = 'gemini-2.0-flash-preview-image-generation'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

const VARIATIONS = [
  'professional product photography, front view, clean white studio background, soft diffused lighting',
  'product photography 45-degree angle, warm natural lighting, modern lifestyle setting',
  'product flat lay, top-down view, minimal pastel background, aesthetic composition',
  'product detail close-up, shallow depth of field, elegant bokeh background',
]

async function generateOne(
  prompt: string,
  variation: string,
  apiKey: string,
): Promise<{ dataUrl: string | null; error?: string }> {
  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${prompt}, ${variation}` }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  })

  const text = await res.text()
  if (!res.ok) return { dataUrl: null, error: `${res.status}: ${text}` }

  let data: { candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[] } = {}
  try { data = JSON.parse(text) } catch { return { dataUrl: null, error: 'JSON parse error' } }

  const imagePart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
  if (!imagePart?.inlineData) return { dataUrl: null, error: '이미지 파트 없음' }

  const { mimeType, data: b64 } = imagePart.inlineData
  return { dataUrl: `data:${mimeType};base64,${b64}` }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '프롬프트가 비어 있습니다.' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    VARIATIONS.map((v) => generateOne(prompt, v, apiKey)),
  )

  const images: string[] = []
  const errors: string[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.dataUrl) images.push(r.value.dataUrl)
      else errors.push(r.value.error ?? '알 수 없는 오류')
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
