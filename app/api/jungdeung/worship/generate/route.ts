import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/ai/llm'
import { naverImage } from '@/app/lib/ai/search'
import { findPraiseSong } from '@/app/lib/praise'

export const dynamic = 'force-dynamic'

// 주일 저녁 가정예배 순서 생성
// 입력: 성경구절 + 찬송 → 시작기도 · 말씀배경 · 말씀나눔가이드 · 맺음기도 + 악보
export async function POST(req: NextRequest) {
  const { scripture, hymn } = await req.json().catch(() => ({}))
  if (!scripture?.trim() || !hymn?.trim()) {
    return NextResponse.json({ error: '성경구절과 찬송을 모두 입력하세요.' }, { status: 400 })
  }
  const sc = scripture.trim()
  const hy = hymn.trim()

  // ── 악보: 기존 찬양 데이터 재사용 → 없으면 네이버 이미지 검색 폴백 ──
  const praise = findPraiseSong(hy)
  let score: {
    source: 'praise' | 'naver' | 'none'
    sheetImageUrl?: string
    chordChart?: string
    youtubeId?: string
    searchUrl: string
  }
  const searchUrl = `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(hy + ' 악보')}`
  if (praise) {
    score = { source: 'praise', sheetImageUrl: praise.sheetImageUrl, chordChart: praise.chordChart, youtubeId: praise.youtubeId, searchUrl }
  } else {
    const img = await naverImage(`${hy} 악보`).catch(() => null)
    score = img
      ? { source: 'naver', sheetImageUrl: img.imageUrl, searchUrl }
      : { source: 'none', searchUrl }
  }

  // ── LLM: 시작기도/말씀배경/나눔가이드/맺음기도 ──
  const prompt = `너는 한국 개신교 가정예배 인도를 돕는 신앙 안내자다.
주일 저녁 온 가족이 함께 드리는 가정예배 순서를 작성하라.

[성경구절] ${sc}
[찬송] ${hy}

[작성 지침]
- 따뜻하고 경건한 한국어. 가족(부모·자녀)이 함께 드리기에 적합한 길이와 어휘.
- 말씀배경: 해당 성경구절의 본문 배경·핵심 메시지를 쉽게 4~6문장.
- 말씀나눔가이드: 가족이 함께 나눌 수 있는 질문 4~5개 (자녀도 답할 수 있게 쉬운 것부터 깊은 것까지).
- 시작기도/맺음기도: 각 3~5문장, 실제로 소리내어 드릴 수 있는 기도문.
- 성경구절 본문이 유명하면 핵심 구절 1~2절을 scriptureText에 인용(개역개정 기준, 불확실하면 빈 문자열).

[출력 JSON — 이 형식만, 다른 텍스트 금지]
{
  "scriptureText": "핵심 구절 본문 인용 (불확실하면 빈 문자열)",
  "openingPrayer": "시작기도 (3~5문장)",
  "background": "말씀 배경 (4~6문장)",
  "guide": ["나눔 질문 1", "나눔 질문 2", "나눔 질문 3", "나눔 질문 4"],
  "closingPrayer": "맺음기도 (3~5문장)"
}`

  let parsed: Record<string, unknown>
  let provider = ''
  try {
    const llm = await callLLM('당신은 한국 개신교 가정예배 안내자입니다. 지시한 JSON 형식만 반환하세요.', prompt)
    provider = llm.provider
    parsed = JSON.parse(llm.text)
  } catch (e) {
    return NextResponse.json({ error: `예배 생성 실패: ${(e as Error).message}` }, { status: 500 })
  }

  return NextResponse.json({
    scripture: sc,
    hymn: hy,
    scriptureText: parsed.scriptureText ?? '',
    openingPrayer: parsed.openingPrayer ?? '',
    background: parsed.background ?? '',
    guide: parsed.guide ?? [],
    closingPrayer: parsed.closingPrayer ?? '',
    score,
    provider,
    generatedAt: new Date().toISOString(),
  })
}
