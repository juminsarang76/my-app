import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const PROMPT = `이 사진을 분석해서 꽃 이름, 꽃말, 오늘의 문장을 알려주세요.
꽃이 아닌 사진이면 사진 속 주요 대상으로 대신하세요.

반드시 아래 JSON만 반환하고 다른 텍스트 없이 응답하세요:
{"name":"꽃이름 (꽃말)","sentence":"꽃말을 담은 감성적인 한 문장 (10단어 이상, 70자 이내)"}`

function parseResult(raw: string): { name: string; sentence: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.name) return { name: parsed.name, sentence: parsed.sentence ?? '' }
  } catch { /* fallthrough */ }
  const nameMatch = raw.match(/"name"\s*:\s*"([^"]+)"/)
  const sentenceMatch = raw.match(/"sentence"\s*:\s*"([^"]+)"/)
  if (nameMatch) return { name: nameMatch[1], sentence: sentenceMatch?.[1] ?? '' }
  return null
}

export async function POST(req: NextRequest) {
  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  // ── 1순위: Groq Vision (LLaVA) ──
  // meta-llama/llama-4-scout 등 비전 지원 모델 시도
  if (groqKey) {
    for (const model of [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
      'llava-v1.5-7b-4096-preview',
    ]) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: PROMPT },
                { type: 'image_url', image_url: { url: `data:${mime ?? 'image/jpeg'};base64,${base64}` } },
              ],
            }],
            max_tokens: 200,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(20000),
        })

        if (res.ok) {
          const data = await res.json()
          const raw = (data.choices?.[0]?.message?.content ?? '').trim()
          const result = parseResult(raw)
          if (result) {
            return NextResponse.json({ ...result, flowerName: result.name, source: `groq-vision:${model}` })
          }
        }
      } catch { /* 지원 안 하면 다음 모델 */ }
    }
  }

  // ── 2순위: Gemini Vision ──
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
                  { text: PROMPT },
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
          const result = parseResult(raw)
          if (result) {
            return NextResponse.json({ ...result, flowerName: result.name, source: `gemini:${model}` })
          }
        }
      } catch { /* 다음 모델 */ }
    }
  }

  // ── 3순위: Groq 텍스트 (계절 기반) ──
  if (groqKey) {
    const month = new Date(Date.now() + 9 * 3600_000).getUTCMonth() + 1
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{
          role: 'user',
          content: `${month}월에 어울리는 꽃 이름, 꽃말, 그 꽃말을 담은 감성적인 한 문장(10단어 이상, 70자 이내).
JSON만 반환: {"name":"꽃이름 (꽃말)","sentence":"오늘의 문장"}`,
        }],
        max_tokens: 150,
        temperature: 0.9,
      }),
    })
    if (res.ok) {
      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content?.trim() ?? ''
      const result = parseResult(raw)
      if (result) {
        return NextResponse.json({ ...result, flowerName: result.name, source: 'groq-text' })
      }
    }
  }

  return NextResponse.json({ flowerName: '예쁜 꽃', sentence: '', name: '예쁜 꽃', source: 'default' })
}
