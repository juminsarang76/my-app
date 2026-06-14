import { NextRequest, NextResponse } from 'next/server'
import { callLLMText } from '@/app/lib/llm'

export const maxDuration = 30

export async function POST(req: NextRequest) {
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
[19] What's weird about this is that as humans,
[20] we can see where we want to go and then figure out the fastest route.
[21] Now, you might recognize this mathematical relationship because it is
[22] the exact same law that governs light passing from one medium into another.
[23] In a previous video, we showed how an obscure scientist, Maupertuis,
[24] made an ad hoc proposal that there should be a quantity
[25] called action that nature minimizes.

출력:
If you later find that of all the possible paths, light took the shortest time to get from A to B, I wouldn't think it was optimizing for anything.
You get all these other reflections right now and this light is just going in all directions.
Action was useful and an alternative way of solving physics problems, especially when Newton's laws get too cumbersome.
The hotter the object, the more energy was emitted at every wavelength, and the peak of the distribution shifted to the left.
But now the total distance is longer than it needs to be.
At low temperatures, each material gave off its own characteristic spectrum, mostly in the infrared, but above about 500°C all materials started to glow in the same way, with an almost identical distribution of light.
But now I will prove to you that this is not the case.
What's weird about this is that as humans, we can see where we want to go and then figure out the fastest route.
Now, you might recognize this mathematical relationship because it is the exact same law that governs light passing from one medium into another.
In a previous video, we showed how an obscure scientist, Maupertuis, made an ad hoc proposal that there should be a quantity called action that nature minimizes.

---
자막:
${numbered}

완성된 문장:`

  // Gemini(1순위) → Groq → Cerebras 폴백은 callLLMText 내부에서 처리
  let normalized: string[] = []
  try {
    const { text: raw } = await callLLMText('', prompt, { maxTokens: 4000, temperature: 0.05 })
    normalized = raw.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0)
  } catch { /* 실패 시 원문 반환 */ }

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
