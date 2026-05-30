import { NextRequest, NextResponse } from 'next/server'

// Requires XAI_API_KEY in .env.local
// xAI Grok image generation: https://docs.x.ai/api
const XAI_ENDPOINT = 'https://api.x.ai/v1/images/generations'
const IMAGE_MODEL = 'grok-2-image-1212'

async function generateOne(prompt: string, variation: string): Promise<string | null> {
  const res = await fetch(XAI_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: `${prompt}${variation}`,
      n: 1,
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('xAI image generation error:', err)
    return null
  }

  const data = await res.json()
  return (data.data?.[0]?.url as string) ?? null
}

export async function POST(req: NextRequest) {
  if (!process.env.XAI_API_KEY) {
    return NextResponse.json(
      { error: 'XAI_API_KEY가 설정되지 않았습니다. .env.local에 추가하세요.' },
      { status: 500 },
    )
  }

  const { prompt } = await req.json()
  if (!prompt?.trim()) {
    return NextResponse.json({ error: '프롬프트가 비어 있습니다.' }, { status: 400 })
  }

  // 4개의 변형 이미지를 병렬 생성
  const variations = [
    ', front view, studio lighting',
    ', 45-degree angle, natural lighting, lifestyle setting',
    ', top-down flat lay, minimal background',
    ', close-up detail shot, bokeh background',
  ]

  const results = await Promise.allSettled(
    variations.map((v) => generateOne(prompt, v)),
  )

  const images = results
    .map((r) => (r.status === 'fulfilled' ? r.value : null))
    .filter((url): url is string => !!url)

  if (images.length === 0) {
    return NextResponse.json({ error: '이미지 생성에 실패했습니다. API 키를 확인하세요.' }, { status: 500 })
  }

  return NextResponse.json({ images })
}
