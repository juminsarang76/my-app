import { NextRequest, NextResponse } from 'next/server'
import { callLLMText } from '@/app/lib/ai/llm'

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const fullText = items
    .map((i: { text: string }) => i.text)
    .join(' ')
    .slice(0, 12000) // 토큰 제한

  try {
    const { text } = await callLLMText(
      '당신은 유튜브 영상 자막 요약 전문가입니다.',
      `다음은 유튜브 동영상의 자막입니다. 핵심 내용을 한국어로 요약해주세요.
- 전체 주제 1~2문장
- 주요 내용 5~7개 항목 (불릿 포인트)
- 결론 1~2문장

자막:
${fullText}`,
      { maxTokens: 1500, temperature: 0.5 },
    )
    return NextResponse.json({ summary: text })
  } catch (e) {
    return NextResponse.json({ error: `요약 실패: ${(e as Error).message}` }, { status: 500 })
  }
}
