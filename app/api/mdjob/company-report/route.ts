import { NextRequest, NextResponse } from 'next/server'
import { callLLM, searchGoogleNews } from '@/app/lib/llm'

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

// ── Route Handler ────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { company, jd } = await req.json().catch(() => ({}))
  if (!company?.trim()) {
    return NextResponse.json({ error: '기업명을 입력하세요.' }, { status: 400 })
  }
  const c = company.trim()

  // 병렬 수집 — 실패한 소스는 건너뜀
  const results = await Promise.allSettled([
    searchNaver('news', c),
    searchNaver('news', `${c} 신상품 출시`, 5),
    searchNaver('news', `${c} 캠페인 마케팅`, 5),
    searchNaver('shop', c, 10),
    searchNaver('blog', `${c} 후기`, 5),
    searchKakaoWeb(`${c} MD 머천다이저`),
    searchGoogle(`${c} 경쟁사 비교`),
  ])
  const docs = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
  const failedSources = results.filter(r => r.status === 'rejected').length

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

  const userPrompt = `
당신은 유통/커머스 MD(머천다이저) 직무 취업 컨설턴트다.
아래는 "${c}"에 대해 수집한 실제 검색 자료 ${unique.length}건이다.

[검색 자료]
${unique.map((d, i) => `(${i + 1}) [${d.source}]${d.date ? ` ${d.date}` : ''}\n제목: ${d.title}\n내용: ${d.body}\nURL: ${d.url}`).join('\n\n')}
${jd?.trim() ? `\n[지원 채용공고(JD)]\n${jd.trim().slice(0, 3000)}\n` : ''}

[작업 지시]
위 검색 자료에 근거해서 MD 직무 지원자 관점의 기업 분석 리포트를 작성하라.
- 검색 자료에 없는 내용은 지어내지 말 것. 자료가 부족한 항목은 일반적으로 알려진 사실만 보수적으로 기술.
- recentIssues는 검색 자료의 실제 기사에서만 뽑고 sourceUrl을 반드시 해당 자료의 URL로 채울 것.
${jd?.trim() ? '- coverLetter와 interviewQs는 JD의 요구 역량에 맞춰 작성할 것.' : ''}

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
  "coverLetter": [
    { "topic": "자소서 소재", "point": "이 기업과 연결되는 포인트", "example": "자소서에 쓸 수 있는 예시 문장 1개" }
  ],
  "interviewQs": [
    { "question": "면접 예상 질문", "intent": "출제 의도", "tip": "답변 방향 팁" }
  ]
}
categories 2~3개, recentIssues 3~5개, coverLetter 3개, interviewQs 4~5개.
`

  let llm: { text: string; provider: string }
  try {
    llm = await callLLM('당신은 유통/커머스 MD 직무 전문 취업 컨설턴트입니다. 지시한 JSON 형식만 반환하세요.', userPrompt)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let report: Record<string, unknown>
  try {
    report = JSON.parse(llm.text)
  } catch {
    return NextResponse.json({ error: 'LLM 응답 파싱 실패', provider: llm.provider }, { status: 500 })
  }

  return NextResponse.json({
    ...report,
    provider: llm.provider,
    docCount: unique.length,
    failedSources,
    fetchedAt: new Date().toISOString(),
  })
}
