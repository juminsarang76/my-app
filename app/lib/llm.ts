// 공용 LLM 호출 (JSON 모드) — Groq → Cerebras → Gemini 폴백 체인
// + Google News RSS 파서

const GROQ_API_KEY     = process.env.GROQ_API_KEY
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY

// OpenAI-compatible LLM 호출 (Groq / Cerebras 공용)
async function callOpenAICompat(
  baseUrl: string, apiKey: string, model: string, messages: object[], providerName: string
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, response_format: { type: 'json_object' }, temperature: 0.2, messages }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`${providerName} ${res.status}: ${err.slice(0, 120)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content
}

// Gemini (generateContent API)
async function callGemini(messages: { role: string; content: string }[]): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsg   = messages.find(m => m.role === 'user')?.content ?? ''
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemMsg }] },
        contents: [{ role: 'user', parts: [{ text: userMsg }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 120)}`)
  }
  const data = await res.json()
  return data.candidates[0].content.parts[0].text
}

// 폴백 체인: Groq → Cerebras → Gemini
export async function callLLM(
  systemPrompt: string, userPrompt: string
): Promise<{ text: string; provider: string }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]

  if (GROQ_API_KEY) {
    try {
      const text = await callOpenAICompat(
        'https://api.groq.com/openai/v1', GROQ_API_KEY,
        'llama-3.3-70b-versatile', messages, 'Groq'
      )
      return { text, provider: 'Groq' }
    } catch (e) {
      console.warn('Groq 실패, Cerebras 시도:', (e as Error).message)
    }
  }

  if (CEREBRAS_API_KEY) {
    try {
      const text = await callOpenAICompat(
        'https://api.cerebras.ai/v1', CEREBRAS_API_KEY,
        'llama-3.3-70b', messages, 'Cerebras'
      )
      return { text, provider: 'Cerebras' }
    } catch (e) {
      console.warn('Cerebras 실패, Gemini 시도:', (e as Error).message)
    }
  }

  if (GEMINI_API_KEY) {
    const text = await callGemini(messages)
    return { text, provider: 'Gemini' }
  }

  throw new Error('사용 가능한 LLM API 키가 없습니다. GROQ_API_KEY / CEREBRAS_API_KEY / GEMINI_API_KEY 중 하나 이상 필요.')
}

// ── Google News RSS 파서 ─────────────────────────────────────────────
export interface RSSItem {
  title: string
  link: string
  pubDate: string
  description: string
}

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
