import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
)

// GET /api/garden/test-analyze?id=DF_260531_2052_26
// 저장된 하루꽃 이미지로 Gemini Vision 분석 검증
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 파라미터 필요. 예: ?id=DF_260531_2052_26' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY 없음' })

  // Supabase에서 이미지 조회
  const { data, error } = await supabase
    .from('daily_flowers')
    .select('image_data, image_mime, title, flower_text')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ ok: false, error: `꽃 없음: ${error?.message}` })
  if (!data.image_data) return NextResponse.json({ ok: false, error: '이미지가 없는 항목입니다.' })

  // Gemini Vision으로 분석
  const prompt = `이 사진을 보고 두 가지를 알려주세요.
1. 사진 속 주요 대상의 이름 (꽃이면 꽃 이름, 예: 장미 / 수국 / 튤립)
2. 그 이름과 관련된 오늘의 감성적인 한 문장 (50자 이내)

반드시 아래 JSON 형식만 반환하세요:
{"name":"이름","sentence":"오늘의 문장"}`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: data.image_mime ?? 'image/jpeg', data: data.image_data } },
          ],
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
      }),
    },
  )

  const raw = res.ok ? await res.json() : null
  const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let parsed: unknown = null
  try {
    parsed = JSON.parse(text.replace(/```json\s*/g, '').replace(/```/g, '').trim())
  } catch {
    parsed = { raw: text }
  }

  return NextResponse.json({
    ok: res.ok,
    geminiStatus: res.status,
    flowerId: id,
    existingTitle: data.title,
    existingText: data.flower_text,
    analysisResult: parsed,
  })
}
