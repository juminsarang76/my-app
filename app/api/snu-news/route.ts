const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return m ? stripCdata(m[1]) : ''
}

async function fetchRss(query: string, count = 10) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
  try {
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': UA } })
    if (!res.ok) return []
    const text = await res.text()
    const items = text.match(/<item[\s>][\s\S]*?<\/item>/g) || []
    return items.slice(0, count).map(item => ({
      title: extractTag(item, 'title'),
      link: extractTag(item, 'link') || extractTag(item, 'guid'),
      pubDate: extractTag(item, 'pubDate'),
      source: extractTag(item, 'source'),
    }))
  } catch {
    return []
  }
}

export async function GET() {
  const [snu, smsys] = await Promise.all([
    fetchRss('서울대학교 스마트시스템과학과'),
    fetchRss('서울대 SMSYS 스마트시스템'),
  ])

  // 중복 제거 (title 기준)
  const seen = new Set<string>()
  const merged = [...snu, ...smsys].filter(n => {
    if (!n.title || seen.has(n.title)) return false
    seen.add(n.title)
    return true
  })

  return Response.json({ items: merged, updatedAt: new Date().toISOString() })
}
