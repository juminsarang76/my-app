import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// Gemini Vision 시도 → 실패 시 Groq 텍스트로 폴백
export async function POST(req: NextRequest) {
  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  // ── Gemini Vision 시도 ──
  if (geminiKey) {
    for (const model of ['gemini-1.5-flash-8b', 'gemini-1.5-flash', 'gemini-1.5-pro']) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  {
                    text: `이 사진을 보고 두 가지를 알려주세요.
1. 사진 속 주요 대상 이름 (꽃이면 꽃 이름, 예: 장미/수국/튤립)
2. 그 이름과 관련된 오늘의 감성적인 한 문장 (50자 이내)
반드시 아래 JSON만 반환하세요:
{"name":"이름","sentence":"오늘의 문장"}`
                  },
                  { inlineData: { mimeType: mime ?? 'image/jpeg', data: base64 } },
                ],
              }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
            }),
            signal: AbortSignal.timeout(20000),
          },
        )

        if (res.ok) {
          const data = await res.json()
          const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
          try {
            const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleaned)
            if (parsed.name) {
              return NextResponse.json({
                flowerName: parsed.name,
                sentence: parsed.sentence ?? '',
                source: `gemini:${model}`,
              })
            }
          } catch { /* 파싱 실패 시 다음 모델 시도 */ }
        }
        // 429 또는 오류면 다음 모델로
      } catch { /* timeout 등 무시하고 다음 모델 */ }
    }
  }

  // ── Groq 폴백: 계절 기반 꽃 추천 ──
  if (groqKey) {
    const today = new Date(Date.now() + 9 * 3600_000)
    const month = today.getUTCMonth() + 1

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `${month}월에 어울리는 꽃 한 가지와 그 꽃의 감성적인 한 문장을 알려주세요 (50자 이내).
JSON만 반환: {"name":"꽃 이름(한국어)","sentence":"오늘의 문장"}`,
        }],
        max_tokens: 100,
        temperature: 0.9,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
      try {
        const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
        const parsed = JSON.parse(cleaned)
        return NextResponse.json({
          flowerName: parsed.name ?? '예쁜 꽃',
          sentence: parsed.sentence ?? '',
          source: 'groq',
        })
      } catch { /* fallthrough */ }
    }
  }

  return NextResponse.json({ flowerName: '예쁜 꽃', sentence: '', source: 'default' })
}
