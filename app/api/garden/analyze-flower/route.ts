import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY 없음' }, { status: 500 })

  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const prompt = `이 사진을 분석해서 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 반환하세요.

규칙:
1. 꽃 사진이면 꽃의 정확한 이름을 한국어로 작성 (예: 장미, 수국, 튤립, 벚꽃, 라벤더)
2. 꽃이 아닌 다른 사진이면 사진 속 주요 대상의 이름을 한국어로 작성
3. sentence는 찾은 이름과 관련된 오늘 하루를 아름답게 시작하는 감성적이고 따뜻한 한 문장 (50자 이내, 직접 창작)

{"name":"이름","sentence":"오늘의 문장"}`

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
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('[analyze-flower]', res.status, err)
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({
      flowerName: parsed.name || parsed.flowerName || '예쁜 꽃',
      sentence: parsed.sentence || '',
    })
  } catch {
    // JSON 파싱 실패 시 텍스트에서 추출 시도
    const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/) || raw.match(/"flowerName"\s*:\s*"([^"]+)"/)
    const sentenceMatch = raw.match(/"sentence"\s*:\s*"([^"]+)"/)
    return NextResponse.json({
      flowerName: nameMatch?.[1] ?? '예쁜 꽃',
      sentence: sentenceMatch?.[1] ?? '',
    })
  }
}
