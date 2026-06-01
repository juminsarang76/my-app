import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 })

  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const prompt = `이 사진을 보고 두 가지를 알려주세요.
1. 사진 속 주요 대상의 이름 (꽃이면 꽃 이름, 예: 장미 / 수국 / 튤립 / 벚꽃)
2. 그 이름과 관련된 오늘 하루를 아름답게 시작하는 감성적인 한 문장 (직접 창작, 50자 이내)

반드시 아래 JSON 형식만 반환하고 다른 텍스트는 쓰지 마세요:
{"name":"이름","sentence":"오늘의 문장"}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25000)

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: mime ?? 'image/jpeg', data: base64 } },
            ],
          }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 200 },
        }),
      },
    )

    clearTimeout(timer)

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    const data = await res.json()
    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()

    // JSON 파싱
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    try {
      const parsed = JSON.parse(cleaned)
      return NextResponse.json({
        flowerName: parsed.name || parsed.flowerName || '예쁜 꽃',
        sentence: parsed.sentence || '',
      })
    } catch {
      // 파싱 실패 시 정규식으로 추출
      const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/)
      const sentenceMatch = raw.match(/"sentence"\s*:\s*"([^"]+)"/)
      return NextResponse.json({
        flowerName: nameMatch?.[1] ?? '예쁜 꽃',
        sentence: sentenceMatch?.[1] ?? '',
      })
    }
  } catch (e) {
    clearTimeout(timer)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
