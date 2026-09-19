import { callLLM } from './llm'
import { searchGoogleNews } from './search'

export type AdmissionItem = {
  title: string
  link: string
  pubDate: string
  press: string
  summary: string
  tags: string[]
  // 같은 사안을 함께 보도한 다른 매체들 (중복 병합 결과)
  alsoReported?: string[]
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

// 같은 사안을 여러 매체가 다르게 제목 붙이는 일이 잦다.
// 제목 앞부분만 비교하면 걸러지지 않으므로 글자 바이그램 자카드 유사도로 판정한다.
// (한국어는 형태소 분석 없이도 바이그램이 꽤 잘 맞는다)
function bigrams(s: string): Set<string> {
  const t = s.replace(/[^가-힣a-zA-Z0-9]/g, '')
  const out = new Set<string>()
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2))
  return out
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const g of a) if (b.has(g)) inter++
  return inter / (a.size + b.size - inter)
}

const NEAR_DUP = 0.45

export async function fetchTodayAdmissionNews(limit = 12) {
  const results = await Promise.allSettled(QUERIES.map(q => searchGoogleNews(q)))
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []))

  const cutoff = Date.now() - WINDOW_MS
  const kept: { item: (typeof all)[number]; grams: Set<string> }[] = []

  for (const item of all.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())) {
    const t = item.pubDate ? new Date(item.pubDate).getTime() : 0
    if (!t || t < cutoff) continue
    if (SKIP_PATTERNS.some(p => item.title.includes(p))) continue

    // 언론사 접미사를 뗀 본문만 비교한다
    const grams = bigrams(splitPress(item.title).title)
    if (kept.some(k => similarity(grams, k.grams) >= NEAR_DUP)) continue

    kept.push({ item, grams })
    if (kept.length >= limit) break
  }

  return kept.map(k => ({ ...k.item, ...splitPress(k.item.title) }))
}

export async function summarizeAdmissionNews(
  news: Awaited<ReturnType<typeof fetchTodayAdmissionNews>>,
): Promise<AdmissionDigest> {
  if (news.length === 0) return { overall: '오늘 수집된 입시 뉴스가 없습니다.', items: [] }

  const prompt = `아래는 오늘 수집된 대한민국 대입 관련 뉴스 ${news.length}건이다.

${news.map((n, i) => `(${i + 1}) ${n.title}\n${n.description}`).join('\n\n')}

너는 2027학년도 대입 분석가다.

[가장 중요한 지시] 같은 사안을 다룬 기사는 반드시 하나로 묶어라.
- 여러 매체가 같은 통계·같은 발표·같은 주제를 보도한 경우가 많다.
  예: 같은 대학의 같은 경쟁률 기사, 같은 취지의 학습 조언 기사
- 묶을 때는 가장 내용이 충실한 기사 하나를 대표(index)로 고르고,
  나머지 번호를 duplicates 에 모두 넣는다.
- 결과 items 에는 서로 다른 사안만 남아야 한다. 같은 사안이 두 항목으로 나오면 안 된다.

각 항목의 summary 는 120자 이내, tags 는 "통계" "분석" "유리" "불리" "결정" 중 1~2개.
overall 은 오늘 동향을 3줄 이내로.

아래 JSON 형식으로만 응답하라.
{
  "overall": "오늘 입시 동향 3줄 이내",
  "items": [
    { "index": 1, "summary": "120자 이내 요약", "tags": ["분석"], "duplicates": [5, 7] }
  ]
}`

  const { text } = await callLLM(
    '당신은 한국 대입 입시 분석 전문가입니다. 지시한 JSON 형식만 반환하세요.',
    prompt,
  )
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())

  type Row = { index?: number; summary?: string; tags?: string[]; duplicates?: number[] }
  const rows: Row[] = parsed.items ?? parsed.summaries ?? []

  // 다른 항목의 duplicates 로 지목된 번호는 대표로 내보내지 않는다
  const merged = new Set<number>()
  for (const r of rows) for (const d of r.duplicates ?? []) if (d !== r.index) merged.add(d)

  const items: AdmissionItem[] = []
  const used = new Set<number>()

  for (const r of rows) {
    const i = (r.index ?? 0) - 1
    const n = news[i]
    if (!n || used.has(i) || merged.has(i + 1)) continue
    used.add(i)

    const also = (r.duplicates ?? [])
      .map(d => news[d - 1]?.press)
      .filter((p): p is string => !!p && p !== n.press)

    items.push({
      title: n.title,
      link: n.link,
      pubDate: n.pubDate,
      press: n.press,
      summary: r.summary ?? '',
      tags: r.tags ?? [],
      ...(also.length ? { alsoReported: Array.from(new Set(also)) } : {}),
    })
  }

  return { overall: parsed.overall ?? '', items }
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
