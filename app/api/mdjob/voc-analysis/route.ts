import { NextRequest, NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/llm'

export const dynamic = 'force-dynamic'

const MAX_CHARS = 15000

export async function POST(req: NextRequest) {
  const { reviews } = await req.json().catch(() => ({}))
  if (!reviews?.trim()) {
    return NextResponse.json({ error: '리뷰 데이터를 입력하세요.' }, { status: 400 })
  }

  const text = reviews.trim().slice(0, MAX_CHARS)
  const truncated = reviews.trim().length > MAX_CHARS

  const userPrompt = `
당신은 커머스 MD(머천다이저)를 위한 VOC(고객의 소리) 분석 전문가다.
아래는 상품 리뷰 원본 데이터다. "⭐5", "별점 5점", "★★★☆☆" 같은 별점 표기가 있으면 함께 해석하라.

[리뷰 데이터]
${text}

[작업 지시]
1. 리뷰 건수를 세고, 긍정/부정/중립 감성 비율(%)을 산출하라 (합계 100).
2. 별점 표기가 있다면 "별점 대비 실제 톤"을 분석하라 — 예: 별점은 높은데 본문에 불만이 섞인 경우. 별점이 없으면 전체 톤 요약만.
3. 자주 등장하는 키워드를 빈도·감성과 함께 뽑아라.
4. 불만 포인트를 의미 단위로 클러스터링하라 (배송, 품질, 사이즈, 가격, CS 등).
5. MD가 차기 발주·상품 개선 시 반영할 인사이트를 우선순위와 함께 정리하라.
리뷰에 없는 내용은 지어내지 말 것.

[출력 JSON — 이 형식만, 다른 텍스트 금지]
{
  "total": 리뷰 건수(숫자),
  "sentiment": { "positive": 0, "negative": 0, "neutral": 0 },
  "ratingGap": "별점 대비 실제 톤 분석 요약 (120자 이내)",
  "keywords": [
    { "keyword": "키워드", "count": 등장횟수(숫자), "sentiment": "긍정" }
  ],
  "clusters": [
    { "name": "불만 클러스터명", "complaints": ["대표 불만 문구 1~3개 (리뷰 원문 인용)"], "share": "비중% (예: 35%)" }
  ],
  "insights": [
    { "priority": "높음", "action": "발주/개선 액션", "reason": "근거 (리뷰 기반)" }
  ]
}
keywords 6~10개, clusters 3~5개, insights 3~5개.
sentiment의 "sentiment" 값은 "긍정"|"부정"|"중립" 중 하나.
insights의 "priority" 값은 "높음"|"중간"|"낮음" 중 하나.
`

  let llm: { text: string; provider: string }
  try {
    llm = await callLLM('당신은 커머스 VOC 분석 전문가입니다. 지시한 JSON 형식만 반환하세요.', userPrompt)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let analysis: Record<string, unknown>
  try {
    analysis = JSON.parse(llm.text)
  } catch {
    return NextResponse.json({ error: 'LLM 응답 파싱 실패', provider: llm.provider }, { status: 500 })
  }

  return NextResponse.json({
    ...analysis,
    provider: llm.provider,
    truncated,
    fetchedAt: new Date().toISOString(),
  })
}
