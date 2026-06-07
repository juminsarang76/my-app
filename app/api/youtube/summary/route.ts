import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const fullText = items
    .map((i: { text: string }) => i.text)
    .join(' ')
    .slice(0, 12000) // 토큰 제한

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `다음은 유튜브 동영상의 자막입니다. 핵심 내용을 한국어로 요약해주세요.
- 전체 주제 1~2문장
- 주요 내용 5~7개 항목 (불릿 포인트)
- 결론 1~2문장

자막:
${fullText}`,
      }],
      max_tokens: 1500,
      temperature: 0.5,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: `Groq 오류: ${res.status}` }, { status: 500 })
  const data = await res.json()
  const summary = data.choices?.[0]?.message?.content ?? ''
  return NextResponse.json({ summary })
}
