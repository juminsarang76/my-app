import { NextRequest, NextResponse } from 'next/server'
import { callLLM, searchGoogleNews } from '@/app/lib/llm'
import { fetchDartFinancials, fetchDartTimeseries, DartSummary } from '@/app/lib/dart'

export const dynamic = 'force-dynamic'

const NAVER_ID     = process.env.NAVER_CLIENT_ID
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET
const KAKAO_KEY    = process.env.KAKAO_REST_API_KEY

// ── 검색 소스 (모듈화 — 추후 Tavily/Brave 추가 용이) ────────────────

interface SearchDoc { source: string; title: string; body: string; url: string; date?: string }

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim()

// 네이버 검색 (news / blog / shop 공용)
async function searchNaver(type: 'news' | 'blog' | 'shop', query: string, display = 8): Promise<SearchDoc[]> {
  if (!NAVER_ID || !NAVER_SECRET) return []
  const res = await fetch(
    `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=${display}&sort=${type === 'news' ? 'date' : 'sim'}`,
    { headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET }, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Naver ${type} ${res.status}`)
  const data = await res.json()
  return (data.items ?? []).map((it: Record<string, string>) => ({
    source: `네이버 ${type === 'news' ? '뉴스' : type === 'blog' ? '블로그' : '쇼핑'}`,
    title: stripTags(it.title ?? ''),
    body: stripTags(it.description ?? '') + (type === 'shop' ? ` (가격: ${it.lprice}원, 카테고리: ${[it.category1, it.category2, it.category3].filter(Boolean).join('>')}, 브랜드: ${it.brand || it.maker || '-'})` : ''),
    url: it.link ?? '',
    date: it.pubDate ? new Date(it.pubDate).toLocaleDateString('ko-KR') : undefined,
  }))
}

// 카카오 웹문서 검색
async function searchKakaoWeb(query: string, size = 6): Promise<SearchDoc[]> {
  if (!KAKAO_KEY) return []
  const res = await fetch(
    `https://dapi.kakao.com/v2/search/web?query=${encodeURIComponent(query)}&size=${size}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Kakao web ${res.status}`)
  const data = await res.json()
  return (data.documents ?? []).map((d: Record<string, string>) => ({
    source: '카카오 웹문서',
    title: stripTags(d.title ?? ''),
    body: stripTags(d.contents ?? ''),
    url: d.url ?? '',
  }))
}

// Google News RSS
async function searchGoogle(query: string, limit = 8): Promise<SearchDoc[]> {
  const items = await searchGoogleNews(query)
  return items.slice(0, limit).map(it => ({
    source: 'Google News',
    title: it.title,
    body: it.description,
    url: it.link,
    date: it.pubDate ? new Date(it.pubDate).toLocaleDateString('ko-KR') : undefined,
  }))
}

// ── 채용공고 URL 본문 추출 ───────────────────────────────────────────

async function fetchJdFromUrl(url: string): Promise<{ text: string | null; error?: string }> {
  try {
    // 풀 브라우저 헤더 필요 — 일부 채용 사이트(올리브영 등)는 축약 UA에 500 반환
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return { text: null, error: `페이지 응답 ${res.status}` }
    const html = await res.text()

    // 메타 설명 (SPA 대응 — 메타에 JD 요약이 있는 경우 많음)
    const meta = [
      html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i)?.[1],
      html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1],
    ].filter(Boolean).join(' ')

    // 본문 추출: script/style/nav/header/footer 제거 → 태그 strip → 공백 정규화
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ')
      .trim()

    const text = `${meta} ${body}`.trim().slice(0, 3000)
    if (text.length < 300) {
      return { text: null, error: '본문이 너무 짧음 (JS 렌더링 사이트로 추정)' }
    }
    return { text }
  } catch (e) {
    return { text: null, error: (e as Error).message.slice(0, 80) }
  }
}

// ── Route Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { company, jd, jdUrl } = await req.json().catch(() => ({}))
  if (!company?.trim()) {
    return NextResponse.json({ error: '기업명을 입력하세요.' }, { status: 400 })
  }
  const c = company.trim()

  // 병렬 수집 — 검색 + JD URL + DART (실패한 소스는 건너뜀)
  const jdUrlPromise = jdUrl?.trim() && /^https?:\/\//.test(jdUrl.trim())
    ? fetchJdFromUrl(jdUrl.trim())
    : Promise.resolve({ text: null as string | null })
  const dartSummaryPromise = fetchDartFinancials(c)
  const dartChartsPromise  = fetchDartTimeseries(c)

  const results = await Promise.allSettled([
    searchNaver('news', c),
    searchNaver('news', `${c} 신상품 출시`, 5),
    searchNaver('news', `${c} 캠페인 마케팅`, 5),
    searchNaver('news', `${c} 매출 영업이익 실적`, 6),
    searchNaver('news', `${c} 연매출 연간 실적 전년`, 6),
    searchNaver('news', `${c} 상반기 실적 영업이익`, 5),
    searchNaver('news', `${c} 채용 조직 인력 확대`, 5),
    searchNaver('shop', c, 10),
    searchNaver('blog', `${c} 후기`, 5),
    searchKakaoWeb(`${c} MD 머천다이저`),
    searchGoogle(`${c} 경쟁사 비교`),
  ])
  const docs = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const failedSources = results.filter(r => r.status === 'rejected').length

  // 커리어 전용 검색 — 실제 면접 후기·합격 자소서·직무 정보
  const careerResults = await Promise.allSettled([
    searchNaver('blog', `${c} 면접 후기 질문`, 8),
    searchNaver('blog', `${c} 자소서 합격`, 6),
    searchNaver('blog', `${c} MD 직무 현직자`, 5),
    searchKakaoWeb(`${c} 면접 질문 후기`, 6),
    searchKakaoWeb(`${c} 자기소개서 항목`, 4),
    searchGoogle(`${c} 면접 후기`, 5),
  ])
  const careerDocs = careerResults.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  const jdFetch = await jdUrlPromise
  const dartSummary: DartSummary | null = await dartSummaryPromise.catch(() => null)
  const dartCharts = await dartChartsPromise.catch(() => null)

  // JD 병합 (붙여넣기 + URL 추출, 합계 4,000자)
  const jdText: string = [jd?.trim(), jdFetch.text].filter(Boolean).join('\n\n---\n\n').slice(0, 4000)
  const jdSource = jd?.trim() && jdFetch.text ? 'both' : jd?.trim() ? 'text' : jdFetch.text ? 'url' : 'none'

  if (!docs.length) {
    return NextResponse.json({ error: '검색 결과가 없습니다. 기업명을 확인해주세요.' }, { status: 502 })
  }

  // 중복 제거 (제목 앞 25자 기준)
  const seen = new Set<string>()
  const unique = docs.filter(d => {
    const key = d.title.slice(0, 25)
    if (!d.title || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 40)

  // DART 공시 수치 블록 (있으면 프롬프트에 주입 — LLM이 우선 사용)
  const eok = (n: number | null) => n == null ? '?' : n >= 10000 ? `${(n / 10000).toFixed(1)}조원` : `${n.toLocaleString()}억원`
  const dartBlock = dartSummary ? `
[공시 확정 수치 — DART ${dartSummary.year}년 사업보고서 (${dartSummary.corpName}${dartSummary.stockCode ? ', 상장' : ''})]
- 매출액: ${eok(dartSummary.revenueEok)} (전년 ${eok(dartSummary.revenuePrevEok)})
- 영업이익: ${eok(dartSummary.profitEok)} (전년 ${eok(dartSummary.profitPrevEok)})
- 직원수: ${dartSummary.employees?.toLocaleString() ?? '?'}명
` : ''

  const userPrompt = `
당신은 유통/커머스 MD(머천다이저) 직무 취업 컨설턴트다.
아래는 "${c}"에 대해 수집한 실제 검색 자료 ${unique.length}건이다.

[검색 자료]
${unique.map((d, i) => `(${i + 1}) [${d.source}]${d.date ? ` ${d.date}` : ''}\n제목: ${d.title}\n내용: ${d.body}\nURL: ${d.url}`).join('\n\n')}
${dartBlock}
${jdText ? `\n[지원 채용공고(JD)]\n${jdText}\n` : ''}

[작업 지시]
위 검색 자료에 근거해서 MD 직무 지원자 관점의 기업 분석 리포트를 작성하라.
- 검색 자료에 없는 내용은 지어내지 말 것. 자료가 부족한 항목은 일반적으로 알려진 사실만 보수적으로 기술.
- recentIssues는 검색 자료의 실제 기사에서만 뽑고 sourceUrl을 반드시 해당 자료의 URL로 채울 것.
- financials: ${dartSummary ? '위 [공시 확정 수치]를 그대로 사용하고 source를 "DART 공시"로 표기.' : '검색 자료에 명시된 수치만 사용하고 source를 "뉴스 기반 추정"으로 표기. 수치가 없으면 "자료 부족" 명시 — 추정 금지.'}
${!dartCharts ? `- newsTimeseries: 검색 자료(기사)에 등장하는 "${c}"의 연도별 매출·영업이익 수치를 모두 모아 yearly 배열로 정리하라 (예: "2023년 매출 3조9천억" → {"period":"2023","revenue":39000,"profit":...}). 반기 실적 기사가 있으면 half 배열에도 정리 (period는 "2025.H1" 형식). 단위는 억원 숫자. 기사에 없는 연도·항목은 null. 기사에 수치가 전혀 없으면 빈 배열 — 절대 추정으로 채우지 말 것.` : ''}

[출력 JSON — 이 형식만, 다른 텍스트 금지]
{
  "company": "${c}",
  "summary": "MD 관점 한 줄 총평 (80자 이내)",
  "categories": [
    { "name": "주력 카테고리", "brands": ["대표 브랜드·상품 2~4개"] }
  ],
  "recentIssues": [
    { "date": "YYYY.MM.DD 또는 빈문자열", "title": "신상품/캠페인/이슈 제목", "body": "100자 이내 요약", "sourceTitle": "출처", "sourceUrl": "URL" }
  ],
  "positioning": {
    "competitors": ["주요 경쟁사 2~4개"],
    "strengths": ["MD 관점 강점 2~4개 (구체적으로)"],
    "weaknesses": ["MD 관점 약점·과제 2~3개"]
  },
  "financials": {
    "revenue": "최근 매출 (예: 2024년 29조원, 전년比 -1.5%)",
    "operatingProfit": "영업이익 동향 (흑자전환·증감 등)",
    "headcount": "인력수 및 증감 동향",
    "direction": ["주력 방향·전략 2~4개"],
    "source": "DART 공시" 또는 "뉴스 기반 추정",
    "note": "자료 부족 항목이 있으면 명시, 없으면 빈 문자열"
  }${!dartCharts ? `,
  "newsTimeseries": {
    "yearly": [ { "period": "2023", "revenue": 39000, "profit": 4660, "employees": null } ],
    "half":   [ { "period": "2025.H1", "revenue": null, "profit": null, "employees": null } ]
  }` : ''}
}
categories 2~3개, recentIssues 3~5개.
`

  // ── 커리어 전용 프롬프트 (자소서·면접 — 면접 후기·합격 자소서 자료 기반) ──
  const careerPrompt = `
당신은 유통/커머스 MD(머천다이저) 직무 전문 취업 컨설턴트다.
"${c}" MD 직무 지원자를 위한 자소서 소재와 면접 예상질문을 만들어라.

[실제 면접 후기·자소서 관련 검색 자료 ${careerDocs.length}건]
${careerDocs.map((d, i) => `(${i + 1}) [${d.source}]\n제목: ${d.title}\n내용: ${d.body}`).join('\n\n')}

[기업 관련 최신 기사 요약]
${unique.slice(0, 12).map(d => `- ${d.title}`).join('\n')}
${dartBlock}
${jdText ? `\n[지원 채용공고(JD) 전문]\n${jdText}\n` : ''}

[작업 지시]
1. coverLetter (자소서 소재 5개):
   - ${jdText ? 'JD의 요구 역량·우대사항을 1:1로 매핑해' : '기업의 사업 방향에 맞춰'} 각기 다른 역량을 어필하는 소재 5개
   - 각 소재마다: 기업/JD 연결 포인트, STAR 구조 가이드(어떤 상황-과제-행동-결과 경험을 쓰면 좋은지), 실제 자소서에 쓸 수 있는 예시 문단(2~3문장), 차별화 팁
2. interviewQs (면접 예상질문 9개):
   - category를 "직무역량" 4개 / "기업이해" 3개 / "인성·상황" 2개로 배분
   - 검색 자료에 실제 면접 후기 질문이 있으면 우선 반영하고 fromReview를 true로 표시
   - 각 질문마다: 출제 의도, 답변 골격(어떤 구조·내용으로 답해야 하는지 2~3문장), 피해야 할 답변

[출력 JSON — 이 형식만, 다른 텍스트 금지]
{
  "coverLetter": [
    {
      "topic": "소재 주제",
      "point": "기업/JD와 연결되는 포인트",
      "starGuide": "S(상황)-T(과제)-A(행동)-R(결과)로 어떤 경험을 풀면 좋은지 안내",
      "example": "자소서에 쓸 수 있는 예시 문단 (2~3문장)",
      "tip": "다른 지원자와 차별화하는 팁"
    }
  ],
  "interviewQs": [
    {
      "category": "직무역량",
      "question": "면접 예상 질문",
      "intent": "출제 의도",
      "answerFrame": "답변 골격 (구조·핵심 포인트 2~3문장)",
      "avoid": "피해야 할 답변 유형",
      "fromReview": false
    }
  ]
}
coverLetter 정확히 5개, interviewQs 정확히 9개.
`

  // 메인 리포트 + 커리어(자소서·면접) 병렬 호출
  const SYS = '당신은 유통/커머스 MD 직무 전문 취업 컨설턴트입니다. 지시한 JSON 형식만 반환하세요.'
  const [mainRes, careerRes] = await Promise.allSettled([
    callLLM(SYS, userPrompt),
    callLLM(SYS, careerPrompt),
  ])

  if (mainRes.status === 'rejected') {
    return NextResponse.json({ error: (mainRes.reason as Error).message }, { status: 500 })
  }
  const llm = mainRes.value

  let report: Record<string, unknown>
  try {
    report = JSON.parse(llm.text)
  } catch {
    return NextResponse.json({ error: 'LLM 응답 파싱 실패', provider: llm.provider }, { status: 500 })
  }

  // 커리어 결과 병합 (실패 시 빈 배열 — 리포트는 유지)
  let careerError: string | undefined
  if (careerRes.status === 'fulfilled') {
    try {
      const career = JSON.parse(careerRes.value.text)
      report.coverLetter = career.coverLetter ?? []
      report.interviewQs = career.interviewQs ?? []
    } catch { careerError = '자소서·면접 생성 파싱 실패' }
  } else {
    careerError = (careerRes.reason as Error).message?.slice(0, 100)
  }
  if (careerError) {
    report.coverLetter ??= []
    report.interviewQs ??= []
  }

  // 차트: DART 우선, 없으면 뉴스에서 추출한 시계열 (연별 + 반기별)
  interface NewsPoint { period: string; revenue: number | null; profit: number | null; employees: number | null }
  const newsTs = report.newsTimeseries as { yearly?: NewsPoint[]; half?: NewsPoint[] } | undefined
  delete report.newsTimeseries
  const hasNum = (arr?: NewsPoint[]) => (arr ?? []).filter(p => p.revenue != null || p.profit != null)
  const newsYearly = hasNum(newsTs?.yearly).sort((a, b) => a.period.localeCompare(b.period))
  const newsHalf   = hasNum(newsTs?.half).sort((a, b) => a.period.localeCompare(b.period))
  const financialCharts = dartCharts
    ?? (newsYearly.length || newsHalf.length ? { quarterly: newsHalf, yearly: newsYearly } : null)

  return NextResponse.json({
    ...report,
    provider: llm.provider,
    docCount: unique.length,
    failedSources,
    jdSource,
    jdUrlError: jdUrl?.trim() && !jdFetch.text ? (jdFetch as { error?: string }).error ?? '추출 실패' : undefined,
    financialCharts,
    chartSource: dartCharts ? 'dart' : financialCharts ? 'news' : null,
    dartUsed: !!dartSummary,
    careerDocCount: careerDocs.length,
    careerError,
    fetchedAt: new Date().toISOString(),
  })
}
