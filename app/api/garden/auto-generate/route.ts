import { NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/llm'

export const maxDuration = 30

// 오늘의 꽃 선택 + 문장 생성 (Gemini→Groq→Cerebras) → 꽃 이미지 생성 (Pollinations)
export async function POST() {
  // 1. 오늘의 꽃 이름 + 문장 생성
  let raw = ''
  try {
    const { text } = await callLLM(
      '당신은 감성적인 꽃 큐레이터입니다. 지시한 JSON 형식만 반환하세요.',
      `오늘 날짜에 어울리는 아름다운 꽃 하나를 선택하고 아래 JSON 형식으로만 응답하세요.
설명 없이 JSON만 반환하세요.
{"flowerName":"꽃 이름(한국어, 예: 장미/수국/튤립/라벤더/백합/벚꽃/국화)","sentence":"이 꽃을 보며 오늘 하루를 아름답게 시작하는 감성적인 한 문장(50자 이내, 직접 창작)"}`,
    )
    raw = text.trim()
  } catch {
    return NextResponse.json({ error: 'AI 오류' }, { status: 500 })
  }

  let flowerName = '장미'
  let sentence = ''

  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    flowerName = parsed.flowerName || '장미'
    sentence = parsed.sentence || ''
  } catch {
    const nameMatch = raw.match(/"flowerName"\s*:\s*"([^"]+)"/)
    const sentenceMatch = raw.match(/"sentence"\s*:\s*"([^"]+)"/)
    flowerName = nameMatch?.[1] ?? '장미'
    sentence = sentenceMatch?.[1] ?? ''
  }

  // 2. Pollinations로 꽃 이미지 생성
  const prompt = encodeURIComponent(
    `beautiful ${flowerName} flower professional photography, soft natural light, minimal white background, macro detail, high quality`,
  )
  const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=1024&height=1024&model=flux&nologo=true&seed=${Date.now()}`

  try {
    const imgRes = await fetch(imageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(25000),
    })

    if (!imgRes.ok) throw new Error(`이미지 요청 실패 ${imgRes.status}`)

    const buffer = await imgRes.arrayBuffer()
    const imageBase64 = Buffer.from(buffer).toString('base64')
    const imageMime = imgRes.headers.get('content-type') ?? 'image/jpeg'

    return NextResponse.json({ flowerName, sentence, imageBase64, imageMime })
  } catch {
    // 이미지 생성 실패 시 텍스트만 반환
    return NextResponse.json({ flowerName, sentence, imageBase64: null, imageMime: null })
  }
}
