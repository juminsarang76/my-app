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

**핵심 작업**: 끊어진 자막 줄들을 읽고, 완성된 문장으로 합쳐주세요.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 **단 하나의 절대 규칙**:

**모든 출력 문장은 반드시 마침표(.), 물음표(?), 느낌표(!) 중 하나로 끝나야 합니다.**

→ 현재 줄이 . ? ! 로 끝나지 않으면 = 다음 줄과 무조건 합침
→ . ? ! 를 만날 때까지 계속 합침
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**추가 규칙** (다음 줄도 앞 줄에 붙여야 하는 경우):
- 다음 줄이 소문자로 시작할 때 (and, but, or, especially, at, of, in, to, for, which, that, when...)
- 다음 줄이 전치사/접속사로 시작할 때

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
[5] You get all these other reflections right now
[6] and this light is just going in all directions.
[7] Action was useful and an alternative way of solving physics problems,
[8] especially when Newton's laws get too cumbersome.
[9] The hotter the object, the more energy was emitted
[10] at every wavelength, and the peak of the distribution shifted to the left.
[11] But now
[12] the total distance is longer than it needs to be.
[13] At low temperatures, each material gave off its own characteristic spectrum,
[14] mostly in the infrared, but above about 500°C
[15] all materials started to glow in the same way,
[16] with an almost identical distribution of light.
[17] But now I will prove to you
[18] that this is not the case.

출력:
If you later find that of all the possible paths, light took the shortest time to get from A to B, I wouldn't think it was optimizing for anything.
You get all these other reflections right now and this light is just going in all directions.
Action was useful and an alternative way of solving physics problems, especially when Newton's laws get too cumbersome.
The hotter the object, the more energy was emitted at every wavelength, and the peak of the distribution shifted to the left.
But now the total distance is longer than it needs to be.
At low temperatures, each material gave off its own characteristic spectrum, mostly in the infrared, but above about 500°C all materials started to glow in the same way, with an almost identical distribution of light.
But now I will prove to you that this is not the case.

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
