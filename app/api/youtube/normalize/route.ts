import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// 끊어진 자막 문장을 완성된 문장으로 정리
export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })

  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  // 전체 텍스트 추출
  const rawTexts: string[] = items.map((i: { text: string }) => i.text)
  const fullText = rawTexts.join('\n')
  const totalDuration = items.reduce(
    (sum: number, i: { duration: number }) => sum + (i.duration || 5), 0
  )

  const prompt = `다음은 유튜브 자막 텍스트입니다. 자막은 영상 타이밍에 맞춰 줄이 잘려 있어 문장이 중간에 끊기는 경우가 많습니다.

규칙:
1. 끊어진 문장을 전체 맥락을 보고 완성된 문장으로 합쳐주세요
2. 문장의 내용은 수정하지 마세요 (단어 추가/삭제 금지)
3. 완성된 문장 하나씩 줄바꿈으로 구분해서 출력하세요
4. 빈 줄이나 번호 없이 문장만 출력하세요
5. 짧은 감탄사나 단독 표현([음악], [박수] 등)은 그대로 유지

원본 자막:
${fullText}

완성된 문장 목록:`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(25000),
  })

  if (!res.ok) {
    return NextResponse.json({ error: `Groq 오류: ${res.status}` }, { status: 500 })
  }

  const data = await res.json()
  const normalized = (data.choices?.[0]?.message?.content ?? '')
    .split('\n')
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0)

  if (!normalized.length) {
    return NextResponse.json({ error: '정규화 결과 없음' }, { status: 500 })
  }

  // 시간을 비례 배분
  const avgDuration = totalDuration / normalized.length
  const normalizedItems = normalized.map((text: string, i: number) => ({
    text,
    start: Math.round(i * avgDuration),
    duration: Math.round(avgDuration),
  }))

  return NextResponse.json({ items: normalizedItems, count: normalizedItems.length })
}
