import { NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/ai/llm'
import { searchGoogleNews } from '@/app/lib/ai/search'

// 분석·통계 위주 쿼리 — 단편 일정·행사 뉴스 최소화
const RSS_QUERIES = [
  '수능 사탐 과탐 표준점수 유불리 2027',
  '2027 수능 탐구 선택 통계 분석',
  '수시 정시 전략 분석 2027학년도',
  '수능 난이도 예측 분석 2027',
  '대입 N수생 재수 통계 2027',
]

// 단편 뉴스 키워드 — 해당 제목은 건너뜀
const SKIP_PATTERNS = [
  '원서접수', '합격자 발표', '일정 안내', '모집요강', '설명회 개최',
  '입학식', '오리엔테이션', '장학금 안내', '등록금', '개강',
]

export async function GET() {
  // 6월 1일 ~ 오늘
  const now = new Date()
  const june1 = new Date(`${now.getFullYear()}-06-01T00:00:00+09:00`).getTime()

  const fetches = await Promise.allSettled(RSS_QUERIES.map(q => searchGoogleNews(q)))

  const allItems = fetches.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // 6월 1일 이후 + 중복 제거 + 단편 뉴스 제거
  const seen = new Set<string>()
  const recent = allItems.filter(item => {
    const d = item.pubDate ? new Date(item.pubDate).getTime() : 0
    const key = item.title.slice(0, 30)
    const isSkip = SKIP_PATTERNS.some(p => item.title.includes(p))
    if (!d || d < june1 || seen.has(key) || isSkip) return false
    seen.add(key)
    return true
  }).slice(0, 30)

  const userPrompt = `
너는 2027학년도 대한민국 대입 입시 전문 분석가다.
아래는 2026년 6월 수집된 대입 관련 뉴스 ${recent.length}건이다.

[입력 뉴스]
${recent.map((item, i) => `(${i + 1}) ${item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : ''}\n제목: ${item.title}\n내용: ${item.description}\nURL: ${item.link}`).join('\n\n')}

[작업 지시]
1. 뉴스를 보고 "분석/통계/유불리" 관점에서 의미 있는 것만 선별한다.
   - 포함 기준: 수치·비율·통계·유불리 분석·전문가 해석·트렌드 변화가 담긴 뉴스
   - 제외 기준: 단순 일정 안내, 행사 개최 소식, 대학 홍보성 기사

2. 선별된 뉴스 각각에 대해:
   - 핵심 수치나 분석 내용을 중심으로 150자 이내 요약
   - tag를 아래 중 1~2개 부여:
     * "통계": 수치·비율·데이터가 핵심인 뉴스
     * "분석": 전문가 해석·입시학원 분석이 핵심인 뉴스
     * "유리": 특정 선택/전략이 유리하다는 내용
     * "불리": 특정 선택/전략이 불리하다는 내용
     * "결정": 수험생·학부모가 지금 결정해야 할 사항

3. 뉴스에서 도출되는 "입시 고민 포인트"를 2~4개 정리한다.
   - 각 포인트는 수험생/학부모가 실제로 고민하고 결정해야 하는 사항
   - 근거 수치·사실 포함
   - 결론은 "유리 / 불리 / 상황에 따라 다름" 중 하나로 명시

[출력 JSON 형식 - 반드시 이 형식만]
{
  "summary": "6월 핵심 동향 한 줄 (60자 이내)",
  "news": [
    {
      "date": "YYYY.MM.DD",
      "title": "뉴스 제목",
      "body": "수치·사실 중심 150자 이내 요약",
      "tags": ["통계"|"분석"|"유리"|"불리"|"결정" 중 1~2개],
      "sourceTitle": "언론사명",
      "sourceUrl": "원문 URL"
    }
  ],
  "points": [
    {
      "question": "고민 질문 (예: 지금 과탐을 사탐으로 바꿔야 할까?)",
      "basis": "근거가 되는 수치나 사실 (뉴스에서 도출)",
      "verdict": "유리" | "불리" | "상황에 따라 다름",
      "reason": "판단 이유 100자 이내"
    }
  ]
}
`

  const systemPrompt = '당신은 한국 대입 입시 분석 전문가입니다. 지시한 JSON 형식만 반환하세요. 다른 텍스트 없이 JSON만.'
  let llmResult: { text: string; provider: string }
  try {
    llmResult = await callLLM(systemPrompt, userPrompt)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let analysis: { summary?: string; news?: unknown[]; points?: unknown[] }
  try {
    analysis = JSON.parse(llmResult.text)
  } catch {
    return NextResponse.json(
      { error: 'JSON 파싱 실패', provider: llmResult.provider, raw: llmResult.text.slice(0, 300) },
      { status: 500 }
    )
  }

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    periodFrom: new Date(june1).toISOString(),
    rawCount: recent.length,
    provider: llmResult.provider,
    summary: analysis.summary ?? '',
    news: analysis.news ?? [],
    points: analysis.points ?? [],
  })
}
