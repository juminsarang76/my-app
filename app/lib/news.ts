export type NewsItem = {
  title: string
  link: string
  pubDate: string
  summary?: string
}

export type AllNews = {
  quantum: NewsItem[]
  youtube: NewsItem[]
  yozm: NewsItem[]
  geeks: NewsItem[]
}

export type Summary = {
  overall: string
  quantum: string[]
  youtube: string[]
  yozm: string[]
  geeks: string[]
}

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? stripCdata(m[1]) : ''
}

async function fetchRss(url: string, count = 5): Promise<NewsItem[]> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return []
    const text = await res.text()
    const items = text.match(/<item[\s>][\s\S]*?<\/item>/g) || []
    return items.slice(0, count).map(item => ({
      title: extractTag(item, 'title'),
      link: extractTag(item, 'link') || extractTag(item, 'guid'),
      pubDate: extractTag(item, 'pubDate'),
    }))
  } catch {
    return []
  }
}

export async function fetchAllNews(): Promise<AllNews> {
  const [quantum, youtube, yozm, geeks] = await Promise.all([
    fetchRss('https://news.google.com/rss/search?q=양자컴퓨터+OR+IONQ&hl=ko&gl=KR&ceid=KR:ko'),
    fetchRss('https://news.google.com/rss/search?q=양자컴퓨터+youtube&hl=ko&gl=KR&ceid=KR:ko'),
    fetchRss('https://yozm.wishket.com/magazine/rss/'),
    fetchRss('https://news.hada.io/rss'),
  ])
  return { quantum, youtube, yozm, geeks }
}

export async function summarizeNews(news: AllNews): Promise<Summary> {
  const fmt = (items: NewsItem[]) =>
    items.length > 0
      ? items.map((n, i) => `${i + 1}. ${n.title}`).join('\n')
      : '(없음)'

  const prompt = `다음 뉴스들을 한국어로 요약해주세요.

양자뉴스:
${fmt(news.quantum)}

유튜브:
${fmt(news.youtube)}

요즘IT:
${fmt(news.yozm)}

Geeks:
${fmt(news.geeks)}

아래 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마세요.
overall_summary는 5줄 이내, 각 카테고리 요약은 각 3줄 이내로 작성하세요:
{
  "overall_summary": "전체 요약 (5줄 이내)",
  "quantum_summaries": ["요약1", "요약2", "요약3", "요약4", "요약5"],
  "youtube_summaries": ["요약1", "요약2", "요약3", "요약4", "요약5"],
  "yozm_summaries": ["요약1", "요약2", "요약3", "요약4", "요약5"],
  "geeks_summaries": ["요약1", "요약2", "요약3", "요약4", "요약5"]
}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  })

  const data = await res.json()
  const text = data.choices[0].message.content.replace(/```json|```/g, '').trim()
  const parsed = JSON.parse(text)

  return {
    overall: parsed.overall_summary ?? '',
    quantum: parsed.quantum_summaries ?? [],
    youtube: parsed.youtube_summaries ?? [],
    yozm: parsed.yozm_summaries ?? [],
    geeks: parsed.geeks_summaries ?? [],
  }
}

export function buildReportPayload(news: AllNews, summary: Summary) {
  return {
    summary: summary.overall,
    quantum_news: news.quantum.map((n, i) => ({ ...n, summary: summary.quantum[i] ?? '' })),
    youtube_news: news.youtube.map((n, i) => ({ ...n, summary: summary.youtube[i] ?? '' })),
    yozm_news: news.yozm.map((n, i) => ({ ...n, summary: summary.yozm[i] ?? '' })),
    geeks_news: news.geeks.map((n, i) => ({ ...n, summary: summary.geeks[i] ?? '' })),
  }
}

export function getKSTDate(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.toISOString().split('T')[0]
}

export function getKSTHour(): number {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return kst.getUTCHours()
}
