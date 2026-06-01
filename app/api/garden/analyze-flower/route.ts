import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// koreanName: PlantNet이 준 한국어명 (있을 수도 없을 수도)
// scientificName: 학명 (항상 있음)
function makeGroqPrompt(koreanName: string | undefined, scientificName: string) {
  const nameHint = koreanName
    ? `한국어 이름: ${koreanName}`
    : `학명: ${scientificName} — 이 학명에 해당하는 한국어 꽃 이름을 찾아주세요`

  return `${nameHint}
이 꽃의 한국어 이름, 꽃말, 꽃말을 담은 오늘의 감성적인 문장(10단어 이상, 70자 이내)을 알려주세요.
JSON만 반환: {"name":"한국어꽃이름 (꽃말)","sentence":"오늘의 문장"}`
}

async function groqText(groqKey: string, content: string) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content }],
      max_tokens: 150,
      temperature: 0.8,
    }),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? null
}

function parseJson(raw: string): { name: string; sentence: string } | null {
  try {
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```/g, '').trim()
    const p = JSON.parse(cleaned)
    if (p.name) return { name: p.name, sentence: p.sentence ?? '' }
  } catch { /* fallthrough */ }
  const nm = raw.match(/"name"\s*:\s*"([^"]+)"/)
  const sm = raw.match(/"sentence"\s*:\s*"([^"]+)"/)
  if (nm) return { name: nm[1], sentence: sm?.[1] ?? '' }
  return null
}

export async function POST(req: NextRequest) {
  const { base64, mime } = await req.json()
  if (!base64) return NextResponse.json({ error: '이미지 없음' }, { status: 400 })

  const plantnetKey = process.env.PLANTNET_API_KEY
  const geminiKey = process.env.GEMINI_API_KEY
  const groqKey = process.env.GROQ_API_KEY

  // ── 1순위: PlantNet (식물 전문 식별) + Groq (꽃말·문장) ──
  if (plantnetKey && groqKey) {
    try {
      const buf = Buffer.from(base64, 'base64')
      const formData = new FormData()
      formData.append('images', new Blob([buf], { type: mime ?? 'image/jpeg' }), 'flower.jpg')
      formData.append('organs', 'flower')

      const plantRes = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${plantnetKey}&lang=ko&nb-results=1`,
        { method: 'POST', body: formData, signal: AbortSignal.timeout(15000) },
      )

      if (plantRes.ok) {
        const plantData = await plantRes.json()
        const top = plantData.results?.[0]
        if (top) {
          const koreanName = top.species?.commonNames?.[0] as string | undefined
          const scientificName = (top.species?.scientificName ?? '') as string

          // Groq로 한국어 이름 + 꽃말 + 문장 생성
          const raw = await groqText(groqKey, makeGroqPrompt(koreanName, scientificName))
          if (raw) {
            const result = parseJson(raw)
            if (result) {
              return NextResponse.json({ ...result, flowerName: result.name, source: 'plantnet+groq' })
            }
          }
          // Groq 파싱 실패 시 PlantNet 이름만 반환
          const fallbackName = koreanName || scientificName
          return NextResponse.json({ flowerName: fallbackName, name: fallbackName, sentence: '', source: 'plantnet' })
        }
      }
    } catch { /* 다음 방법으로 */ }
  }

  // ── 2순위: Groq Vision (llama-4 등) ──
  if (groqKey) {
    for (const model of [
      'meta-llama/llama-4-scout-17b-16e-instruct',
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
                {
                  type: 'text',
                  text: `이 사진의 꽃 이름(한국어), 꽃말, 꽃말을 담은 감성 문장(10단어 이상, 70자 이내)을 알려주세요.
JSON만 반환: {"name":"꽃이름 (꽃말)","sentence":"오늘의 문장"}`,
                },
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
          const result = parseJson(raw)
          if (result) return NextResponse.json({ ...result, flowerName: result.name, source: `groq-vision:${model}` })
        }
      } catch { /* 다음 모델 */ }
    }
  }

  // ── 3순위: Gemini Vision ──
  if (geminiKey) {
    for (const model of ['gemini-1.5-flash-8b', 'gemini-1.5-flash']) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `꽃 이름(한국어), 꽃말, 감성 문장(10단어↑, 70자↓) JSON만 반환: {"name":"꽃이름 (꽃말)","sentence":"문장"}` },
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
          const result = parseJson(raw)
          if (result) return NextResponse.json({ ...result, flowerName: result.name, source: `gemini:${model}` })
        }
      } catch { /* 다음 */ }
    }
  }

  // ── 4순위: Groq 텍스트 (계절 기반) ──
  if (groqKey) {
    const month = new Date(Date.now() + 9 * 3600_000).getUTCMonth() + 1
    const raw = await groqText(groqKey,
      `${month}월에 어울리는 꽃 이름, 꽃말, 그 꽃말을 담은 감성 문장(10단어 이상, 70자 이내).
JSON만 반환: {"name":"꽃이름 (꽃말)","sentence":"오늘의 문장"}`)
    if (raw) {
      const result = parseJson(raw)
      if (result) return NextResponse.json({ ...result, flowerName: result.name, source: 'groq-text' })
    }
  }

  return NextResponse.json({ flowerName: '예쁜 꽃', name: '예쁜 꽃', sentence: '', source: 'default' })
}
