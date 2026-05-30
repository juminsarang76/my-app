import { NextRequest, NextResponse } from 'next/server'

// Vercel Pro: 최대 30초 허용
export const maxDuration = 30

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'

const VARIATIONS = [
  'front view, clean white studio background, professional commercial product photo',
  '45 degree angle, warm natural window light, modern lifestyle interior setting',
  'flat lay top-down view, minimal pastel background, aesthetic instagram style',
  'close-up macro detail shot, shallow depth of field, elegant bokeh background',
]

export async function POST(req: NextRequest) {
  const { prompt, variationIndex } = await req.json()

  const idx = Number(variationIndex ?? 0) % VARIATIONS.length
  const variation = VARIATIONS[idx]
  const seed = Math.floor(Math.random() * 9999999)

  // 프롬프트 길이 제한 (URL 안정성)
  const short = (prompt as string).trim().slice(0, 180)
  const encoded = encodeURIComponent(`${short}, ${variation}`)
  const url = `${POLLINATIONS_BASE}/${encoded}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(timer)

    if (!res.ok) {
      return NextResponse.json(
        { error: `이미지 생성 실패 (${res.status})` },
        { status: 500 },
      )
    }

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const mime = res.headers.get('content-type') ?? 'image/jpeg'
    return NextResponse.json({ image: `data:${mime};base64,${base64}` })
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `요청 실패: ${msg}` }, { status: 500 })
  }
}
