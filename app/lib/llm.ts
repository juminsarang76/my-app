// 공용 LLM 호출 — Gemini(유료, 1순위) → Groq → Cerebras 폴백 체인
// JSON 모드(callLLM)와 평문 모드(callLLMText) 모두 지원
// + Google News RSS 파서

const GROQ_API_KEY     = process.env.GROQ_API_KEY
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY
const GEMINI_API_KEY   = process.env.GEMINI_API_KEY

export interface ChatOpts {
  json?: boolean          // true면 JSON 응답 강제
  maxTokens?: number
  temperature?: number
}

// OpenAI-compatible LLM 호출 (Groq / Cerebras 공용)
async function callOpenAICompat(
  baseUrl: string, apiKey: string, model: string, messages: object[], providerName: string, opts: ChatOpts
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`${providerName} ${res.status}: ${err.slice(0, 120)}`)
  }
  const data = await res.json()
  return data.choices[0].message.content ?? ''
}

// Gemini (generateContent API) — 모델 단종 대비 다중 모델 순회
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest']

async function callGemini(messages: { role: string; content: string }[], opts: ChatOpts): Promise<string> {
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const userMsg   = messages.find(m => m.role === 'user')?.content ?? ''
  let lastErr = ''
  for (const model of GEMINI_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg }] } } : {}),
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.2,
            ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
            ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      }
    )
    if (res.ok) {
      const data = await res.json()
      const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? []
      const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('').trim()
        || parts.map(p => p.text ?? '').join('').trim()
      if (text) return text
      lastErr = `${model} 빈 응답`
      continue
    }
    lastErr = `${model} ${res.status}: ${(await res.text().catch(() => res.statusText)).slice(0, 100)}`
    if (res.status !== 404) break  // 404(모델 없음)만 다음 모델 시도
  }
  throw new Error(`Gemini ${lastErr}`)
}

// 폴백 체인: Gemini(1순위) → Groq → Cerebras
async function callChat(
  systemPrompt: string, userPrompt: string, opts: ChatOpts
): Promise<{ text: string; provider: string }> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]

  if (GEMINI_API_KEY) {
    try {
      return { text: await callGemini(messages, opts), provider: 'Gemini' }
    } catch (e) {
      console.warn('Gemini 실패, Groq 시도:', (e as Error).message)
    }
  }

  if (GROQ_API_KEY) {
    try {
      const text = await callOpenAICompat(
        'https://api.groq.com/openai/v1', GROQ_API_KEY,
        'llama-3.3-70b-versatile', messages, 'Groq', opts
      )
      return { text, provider: 'Groq' }
    } catch (e) {
      console.warn('Groq 실패, Cerebras 시도:', (e as Error).message)
    }
  }

  if (CEREBRAS_API_KEY) {
    const text = await callOpenAICompat(
      'https://api.cerebras.ai/v1', CEREBRAS_API_KEY,
      'llama-3.3-70b', messages, 'Cerebras', opts
    )
    return { text, provider: 'Cerebras' }
  }

  throw new Error('사용 가능한 LLM API 키가 없습니다. GEMINI_API_KEY / GROQ_API_KEY / CEREBRAS_API_KEY 중 하나 이상 필요.')
}

// JSON 응답 (기존 시그니처 유지)
export function callLLM(systemPrompt: string, userPrompt: string) {
  return callChat(systemPrompt, userPrompt, { json: true })
}

// 평문 응답
export function callLLMText(systemPrompt: string, userPrompt: string, opts: ChatOpts = {}) {
  return callChat(systemPrompt, userPrompt, { ...opts, json: false })
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
