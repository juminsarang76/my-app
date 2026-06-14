// 공용 검색 헬퍼 — 네이버(news/blog/shop) · 카카오 웹문서 · Google News RSS
// SearchDoc(정규화 문서) 형태와, 원시 items 접근(naverSearch) 모두 제공

const NAVER_ID     = process.env.NAVER_CLIENT_ID
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET
const KAKAO_KEY    = process.env.KAKAO_REST_API_KEY

export interface SearchDoc { source: string; title: string; body: string; url: string; date?: string }

export const stripTags = (s: string) =>
  (s ?? '').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()

type NaverType = 'news' | 'blog' | 'shop'

// 네이버 검색 원시 items (fashion 쇼핑 등 특화 후처리용)
export async function naverSearch(type: NaverType, query: string, display = 10): Promise<Record<string, string>[]> {
  if (!NAVER_ID || !NAVER_SECRET) return []
  const res = await fetch(
    `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=${display}&sort=${type === 'news' ? 'date' : 'sim'}`,
    { headers: { 'X-Naver-Client-Id': NAVER_ID, 'X-Naver-Client-Secret': NAVER_SECRET }, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Naver ${type} ${res.status}`)
  const data = await res.json()
  return (data.items ?? []) as Record<string, string>[]
}

// 네이버 검색 → SearchDoc[] (기업분석 등 텍스트 수집용)
export async function searchNaver(type: NaverType, query: string, display = 8): Promise<SearchDoc[]> {
  const items = await naverSearch(type, query, display)
  return items.map(it => ({
    source: `네이버 ${type === 'news' ? '뉴스' : type === 'blog' ? '블로그' : '쇼핑'}`,
    title: stripTags(it.title),
    body: stripTags(it.description) + (type === 'shop'
      ? ` (가격: ${it.lprice}원, 카테고리: ${[it.category1, it.category2, it.category3].filter(Boolean).join('>')}, 브랜드: ${it.brand || it.maker || '-'})`
      : ''),
    url: it.link ?? '',
    date: it.pubDate ? new Date(it.pubDate).toLocaleDateString('ko-KR') : undefined,
  }))
}

// 카카오 웹문서 검색 → SearchDoc[]
export async function searchKakaoWeb(query: string, size = 6): Promise<SearchDoc[]> {
  if (!KAKAO_KEY) return []
  const res = await fetch(
    `https://dapi.kakao.com/v2/search/web?query=${encodeURIComponent(query)}&size=${size}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` }, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Kakao web ${res.status}`)
  const data = await res.json()
  return (data.documents ?? []).map((d: Record<string, string>) => ({
    source: '카카오 웹문서',
    title: stripTags(d.title),
    body: stripTags(d.contents),
    url: d.url ?? '',
  }))
}

// ── Google News RSS ───────────────────────────────────────────────────
export interface RSSItem { title: string; link: string; pubDate: string; description: string }

export function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const c = m[1]
    const cdata = (s: string) => s?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() ?? ''
    const tag = (name: string) => cdata(c.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? '')
    const title = tag('title')
    const link = (c.match(/<link>(.*?)<\/link>/) ?? c.match(/<link\s+href="([^"]+)"/))?.[1]?.trim() ?? ''
    const pubDate = tag('pubDate') || tag('published') || tag('updated')
    const description = tag('description').replace(/<[^>]+>/g, '').slice(0, 400)
    if (title && link) items.push({ title, link, pubDate, description })
  }
  return items
}

// Google News RSS 검색 (키 불필요)
export async function searchGoogleNews(query: string): Promise<RSSItem[]> {
  const res = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124' }, next: { revalidate: 0 } }
  )
  if (!res.ok) throw new Error(`Google News RSS ${res.status}`)
  return parseRSS(await res.text())
}

// Google News → SearchDoc[]
export async function searchGoogleDocs(query: string, limit = 8): Promise<SearchDoc[]> {
  const items = await searchGoogleNews(query)
  return items.slice(0, limit).map(it => ({
    source: 'Google News',
    title: it.title,
    body: it.description,
    url: it.link,
    date: it.pubDate ? new Date(it.pubDate).toLocaleDateString('ko-KR') : undefined,
  }))
}
