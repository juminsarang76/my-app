import { NextResponse } from 'next/server'

// GET /api/garden/test-analyze
// 1단계: Gemini API 키 유효성 확인 (텍스트)
// 2단계: Vision 분석 테스트
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, step: 'init', error: 'GEMINI_API_KEY 없음' })

  // ── 1단계: 텍스트 API 확인 ──
  const textRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: '장미꽃에 대한 짧은 한 문장을 써주세요.' }] }],
        generationConfig: { maxOutputTokens: 50 },
      }),
    },
  )

  if (!textRes.ok) {
    const err = await textRes.text()
    return NextResponse.json({ ok: false, step: 'text', status: textRes.status, error: err })
  }

  const textData = await textRes.json()
  const textAnswer = textData.candidates?.[0]?.content?.parts?.[0]?.text ?? '(응답 없음)'

  // ── 2단계: Vision API 확인 (안정적인 공개 이미지) ──
  // 작은 공개 이미지를 직접 base64로 변환
  let visionResult: unknown = null
  let visionError: string | null = null

  try {
    const imgUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Red_rose.jpg/320px-Red_rose.jpg'
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const imgRes = await fetch(imgUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; test-bot)' },
    })
    clearTimeout(timer)

    if (imgRes.ok) {
      const buf = await imgRes.arrayBuffer()
      const b64 = Buffer.from(buf).toString('base64')
      const mime = imgRes.headers.get('content-type') ?? 'image/jpeg'

      const vRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: '이 꽃의 이름을 한국어로 알려주세요. JSON으로만: {"name":"꽃이름"}' },
                { inlineData: { mimeType: mime, data: b64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 50 },
          }),
        },
      )
      const vData = await vRes.json()
      const raw = vData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      try {
        visionResult = JSON.parse(raw.replace(/```json\s*/g, '').replace(/```/g, '').trim())
      } catch {
        visionResult = { raw }
      }
    } else {
      visionError = `이미지 로드 실패: ${imgRes.status}`
    }
  } catch (e) {
    visionError = String(e)
  }

  return NextResponse.json({
    ok: true,
    step1_text: { ok: true, answer: textAnswer },
    step2_vision: visionError ? { ok: false, error: visionError } : { ok: true, result: visionResult },
  })
}
