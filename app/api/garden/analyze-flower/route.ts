import { NextRequest, NextResponse } from 'next/server'

// Gemini Vision으로 꽃 사진 분석 → 꽃 이름 + 오늘의 문장 반환
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 })

  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const prompt = `이 꽃 사진을 분석해서 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 반환하세요.
{"flowerName":"꽃 이름(한국어, 모르면 '예쁜 꽃')","sentence":"이 꽃을 보며 오늘 하루를 아름답게 시작하는 감성적인 한 문장(60자 이내)"}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mime ?? 'image/jpeg', data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    // ```json ... ``` 코드블록도 처리
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({
      flowerName: parsed.flowerName ?? '예쁜 꽃',
      sentence: parsed.sentence ?? '',
    })
  } catch {
    return NextResponse.json({ flowerName: '예쁜 꽃', sentence: raw.slice(0, 100) })
  }
}
