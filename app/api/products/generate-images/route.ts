import { NextRequest, NextResponse } from 'next/server'

// xAI Grok 이미지 생성 API
// 모델: grok-imagine-image ($0.02/장) | grok-imagine-image-quality ($0.05/장)
// 문서: https://docs.x.ai/developers/model-capabilities/imagine
const XAI_ENDPOINT = 'https://api.x.ai/v1/images/generations'
const IMAGE_MODEL = 'grok-imagine-image'

const VARIATIONS = [
  ', front view, clean studio white background, professional product photography',
  ', 45-degree angle, warm natural lighting, lifestyle setting',
  ', top-down flat lay, minimal pastel background, aesthetic composition',
  ', close-up detail shot, shallow depth of field, bokeh background',
]

async function generateOne(prompt: string, variation: string): Promise<{ url: string | null; error?: string }> {
  const body = {
    model: IMAGE_MODEL,
    prompt: `${prompt}${variation}`,
  }

  const res = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()

  if (!res.ok) {
    console.error(`[xAI] ${res.status}:`, text)
    return { url: null, error: `${res.status}: ${text}` }
  }

  let data: { data?: { url?: string; b64_json?: string }[] } = {}
  try { data = JSON.parse(text) } catch { return { url: null, error: 'JSON parse error' } }

  const item = data.data?.[0]
  const url = item?.url ?? null
  return { url }
}

export async function POST(req: NextRequest) {
  if (!process.env.XAI_API_KEY) {
    return NextResponse.json(
      { error: 'XAI_API_KEY가 설정되지 않았습니다. Vercel 환경변수에 추가하세요.' },
      { status: 500 },
    )
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '프롬프트가 비어 있습니다.' }, { status: 400 })
  }

  const results = await Promise.allSettled(
    VARIATIONS.map((v) => generateOne(prompt, v)),
  )

  const images: string[] = []
  const errors: string[] = []

  for (const r of results) {
    if (r.status === 'fulfilled') {
      if (r.value.url) images.push(r.value.url)
      else if (r.value.error) errors.push(r.value.error)
    } else {
      errors.push(String(r.reason))
    }
  }

  if (images.length === 0) {
    const detail = errors[0] ?? '알 수 없는 오류'
    return NextResponse.json(
      { error: `이미지 생성 실패: ${detail}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ images })
}
