import { callLLM } from './llm'
import { searchGoogleNews } from './search'

export type AdmissionItem = {
  title: string
  link: string
  pubDate: string
  press: string
  summary: string
  tags: string[]
}

export type AdmissionDigest = {
  overall: string
  items: AdmissionItem[]
}

// 2027학년도 수험생 관점의 수집 쿼리
const QUERIES = [
  '2027학년도 대입 전형',
  '수시 학생부종합 교과전형 경쟁률',
  '수능 등급컷 표준점수 분석',
  '대입 전형 변경 발표',
  '수능 최저학력기준',
]

// 단편 공지성 뉴스 — 제목에 걸리면 제외
const SKIP_PATTERNS = [
  '원서접수', '합격자 발표', '일정 안내', '모집요강', '설명회 개최',
  '입학식', '오리엔테이션', '장학금 안내', '등록금', '개강',
]

// 최근 36시간 이내 뉴스만 "오늘자"로 본다 (피드 타임존 편차 흡수)
const WINDOW_MS = 36 * 60 * 60 * 1000

// Google News 제목은 "제목 - 언론사" 형태
function splitPress(title: string): { title: string; press: string } {
  const i = title.lastIndexOf(' - ')
  if (i < 0) return { title, press: '' }
  return { title: title.slice(0, i), press: title.slice(i + 3) }
}

export async function fetchTodayAdmissionNews(limit = 12) {
  const results = await Promise.allSettled(QUERIES.map(q => searchGoogleNews(q)))
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))

  const cutoff = Date.now() - WINDOW_MS
  const seen = new Set<string>()

  return all
    .filter(item => {
      const t = item.pubDate ? new Date(item.pubDate).getTime() : 0
      const key = item.title.slice(0, 30)
      if (!t || t < cutoff) return false
      if (seen.has(key)) return false
      if (SKIP_PATTERNS.some(p => item.title.includes(p))) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, limit)
    .map(item => ({ ...item, ...splitPress(item.title) }))
}

export async function summarizeAdmissionNews(
  news: Awaited<ReturnType<typeof fetchTodayAdmissionNews>>,
): Promise<AdmissionDigest> {
  if (news.length === 0) return { overall: '오늘 수집된 입시 뉴스가 없습니다.', items: [] }

  const prompt = `아래는 오늘 수집된 대한민국 대입 관련 뉴스 ${news.length}건이다.

${news.map((n, i) => `(${i + 1}) ${n.title}\n${n.description}`).join('\n\n')}

너는 2027학년도 대입 분석가다. 아래 JSON 형식으로만 응답하라.
overall은 오늘 동향을 3줄 이내로, 각 뉴스 요약은 120자 이내로 작성하라.
tags는 "통계" "분석" "유리" "불리" "결정" 중 1~2개만 고른다.
{
  "overall": "오늘 입시 동향 3줄 이내",
  "summaries": [
    { "index": 1, "summary": "120자 이내 요약", "tags": ["분석"] }
  ]
}`

  const { text } = await callLLM(
    '당신은 한국 대입 입시 분석 전문가입니다. 지시한 JSON 형식만 반환하세요.',
    prompt,
  )
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  const byIndex = new Map<number, { summary?: string; tags?: string[] }>(
    (parsed.summaries ?? []).map((s: { index: number }) => [s.index, s]),
  )

  return {
    overall: parsed.overall ?? '',
    items: news.map((n, i) => ({
      title: n.title,
      link: n.link,
      pubDate: n.pubDate,
      press: n.press,
      summary: byIndex.get(i + 1)?.summary ?? '',
      tags: byIndex.get(i + 1)?.tags ?? [],
    })),
  }
}

// reports 테이블 재사용 — 정기요약은 "YYYY-MM-DD", 실시간은 "rt_", 오늘입시뉴스는 "ipsi_"
export function admissionKey(kstDate: string) {
  return `ipsi_${kstDate}`
}

// 입시뉴스 항목은 quantum_news 컬럼에 담는다 (reports 테이블 공용 사용).
// ionq_news는 NOT NULL 제약이 있어 빈 배열을 반드시 포함한다.
export function buildAdmissionPayload(digest: AdmissionDigest) {
  return {
    summary: digest.overall,
    ionq_news: [],
    quantum_news: digest.items,
    youtube_news: [],
    yozm_news: [],
    geeks_news: [],
  }
}
