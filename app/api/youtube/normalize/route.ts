import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY
  const cerebrasKey = process.env.CEREBRAS_API_KEY
  if (!groqKey && !cerebrasKey) return NextResponse.json({ error: 'API 키 없음' }, { status: 500 })

  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const rawTexts: string[] = items.map((i: { text: string }) => i.text)
  const totalDuration = items.reduce((s: number, i: { duration: number }) => s + (i.duration || 5), 0)

  // 번호를 붙여서 추적 가능하게
  const numbered = rawTexts.map((t, i) => `[${i + 1}] ${t}`).join('\n')

  const prompt = `당신은 유튜브 자막 편집 전문가입니다. 아래 자막은 영상 재생 타이밍에 맞춰 짧게 잘려 있어 문장이 중간에 끊깁니다.

**핵심 작업**: 끊어진 자막 줄들을 읽고, 의미상 하나의 완성된 문장으로 이어지는 줄들을 합쳐주세요.

**판단 기준**:
- 줄이 전치사(of, in, to, for, with, from, that, which, because, if, when, although...)로 끝나면 → 다음 줄과 합침
- 줄이 관사(a, an, the)로 끝나면 → 다음 줄과 합침
- 줄이 쉼표나 접속사(and, but, or, so, yet)로 끝나면 → 다음 줄과 합침
- 줄이 불완전한 절(주어만 있거나 동사만 있거나)이면 → 다음 줄과 합침
- 마침표(.), 물음표(?), 느낌표(!)로 끝나면 → 완성된 문장 (새 줄 시작)

**출력 규칙**:
- 완성된 문장만 줄바꿈으로 구분해서 출력
- 번호([1], [2]...) 없이 문장 텍스트만 출력
- 단어 추가/삭제/수정 절대 금지 (원문 단어 그대로)
- [음악], [박수] 등 설명은 그대로 유지

**예시**:
입력:
[1] If you later find that of all the possible paths,
[2] light took the shortest time
[3] to get from A to B,
[4] I wouldn't think it was optimizing for anything.
[5] But now I will prove to you

출력:
If you later find that of all the possible paths, light took the shortest time to get from A to B, I wouldn't think it was optimizing for anything.
But now I will prove to you

---
자막:
${numbered}

완성된 문장:`

  // Groq 우선, 실패 시 Cerebras
  const providers = [
    groqKey && { url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'llama-3.3-70b-versatile' },
    cerebrasKey && { url: 'https://api.cerebras.ai/v1/chat/completions', key: cerebrasKey, model: 'gpt-oss-120b' },
  ].filter(Boolean) as { url: string; key: string; model: string }[]

  let normalized: string[] = []

  for (const p of providers) {
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: p.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 4000,
          temperature: 0.05,
        }),
        signal: AbortSignal.timeout(25000),
      })

      if (!res.ok) { if (res.status === 429) continue; break }

      const data = await res.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      normalized = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
      if (normalized.length > 0) break
    } catch { continue }
  }

  if (!normalized.length) {
    // 정규화 실패 시 원문 반환
    return NextResponse.json({ items, count: items.length })
  }

  // 원본 타임스탬프 매핑 (정규화된 문장이 원본의 어느 구간인지 추정)
  const avgDuration = totalDuration / normalized.length
  const normalizedItems = normalized.map((text: string, i: number) => ({
    text,
    start: Math.round(i * avgDuration),
    duration: Math.round(avgDuration),
  }))

  return NextResponse.json({ items: normalizedItems, count: normalizedItems.length })
}
