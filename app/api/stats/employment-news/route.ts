import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GROQ_API_KEY     = process.env.GROQ_API_KEY
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY

const RSS_QUERIES = [
  '고용 취업자 통계',
  '실업률 고용률 발표',
  '산업별 고용 동향',
  '청년 고용 일자리',
]

interface RSSItem { title: string; link: string; pubDate: string; description: string }

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const c = m[1]
    const cdata = (s: string) => s?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() ?? ''
    const tag = (name: string) => cdata(c.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? '')
    const title = tag('title')
    const link = (c.match(/<link>(.*?)<\/link>/) ?? c.match(/<link\s+href="([^"]+)"/))?.[1]?.trim() ?? ''
    const pubDate = tag('pubDate') || tag('published')
    const description = tag('description').replace(/<[^>]+>/g, '').slice(0, 300)
    if (title && link) items.push({ title, link, pubDate, description })
  }
  return items
}

async function callOpenAICompat(baseUrl: string, key: string, model: string, msgs: object[], name: string) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0.2, messages: msgs }),
  })
  if (!res.ok) throw new Error(`${name} ${res.status}`)
  return (await res.json()).choices[0].message.content
}

async function callGemini(msgs: { role: string; content: string }[]) {
  const sys = msgs.find(m => m.role === 'system')?.content ?? ''
  const usr = msgs.find(m => m.role === 'user')?.content ?? ''
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: usr }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini ${res.status}`)
  return (await res.json()).candidates[0].content.parts[0].text
}

async function callLLM(sys: string, usr: string): Promise<{ text: string; provider: string }> {
  const msgs = [{ role: 'system', content: sys }, { role: 'user', content: usr }]
  if (GROQ_API_KEY) {
    try { return { text: await callOpenAICompat('https://api.groq.com/openai/v1', GROQ_API_KEY, 'llama-3.3-70b-versatile', msgs, 'Groq'), provider: 'Groq' } }
    catch (e) { console.warn('Groq 실패:', (e as Error).message) }
  }
  if (CEREBRAS_API_KEY) {
    try { return { text: await callOpenAICompat('https://api.cerebras.ai/v1', CEREBRAS_API_KEY, 'llama-3.3-70b', msgs, 'Cerebras'), provider: 'Cerebras' } }
    catch (e) { console.warn('Cerebras 실패:', (e as Error).message) }
  }
  if (GEMINI_API_KEY) return { text: await callGemini(msgs), provider: 'Gemini' }
  throw new Error('사용 가능한 LLM API 키 없음')
}

export async function GET() {
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  const fetches = await Promise.allSettled(
    RSS_QUERIES.map(q =>
      fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124' }, next: { revalidate: 0 } }
      ).then(r => r.text()).then(parseRSS)
    )
  )
  const all = fetches.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  const seen = new Set<string>()
  const recent = all.filter(item => {
    const d = item.pubDate ? new Date(item.pubDate).getTime() : 0
    const key = item.title.slice(0, 30)
    if (!d || d < weekAgo || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 20)

  if (!recent.length) {
    return NextResponse.json({ fetchedAt: new Date().toISOString(), count: 0, summary: '', news: [] })
  }

  const prompt = `다음은 최근 1주일간 한국 고용·취업 관련 뉴스 ${recent.length}건이다.

${recent.map((it, i) => `(${i + 1}) ${it.pubDate ? new Date(it.pubDate).toLocaleDateString('ko-KR') : ''}\n제목: ${it.title}\n내용: ${it.description}\nURL: ${it.link}`).join('\n\n')}

통계·수치·고용동향이 담긴 의미 있는 뉴스만 선별해 아래 JSON으로 반환. JSON만 반환.
{
  "summary": "이번 주 고용 동향 핵심 요약 (80자 이내)",
  "news": [
    { "date": "YYYY.MM.DD", "title": "제목", "body": "수치 중심 100자 이내 요약", "sourceTitle": "언론사", "sourceUrl": "URL" }
  ]
}`

  let result: { text: string; provider: string }
  try {
    result = await callLLM('당신은 고용·노동 통계 분석가입니다. JSON만 반환하세요.', prompt)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }

  let parsed: { summary?: string; news?: unknown[] }
  try { parsed = JSON.parse(result.text) }
  catch { return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 500 }) }

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    count: recent.length,
    provider: result.provider,
    summary: parsed.summary ?? '',
    news: parsed.news ?? [],
  })
}
