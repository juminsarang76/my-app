import { NextResponse } from 'next/server'

const PROMPT = `당신은 대한민국 최고의 중학교 학생 패션 전문가입니다.
에이블리(Ably)·무신사(Musinsa) 현재 인기 아이템 기반으로 조사합니다.

프로필: 키 159cm / 몸무게 38kg / 여자 / 14살 중2 / 마른 체형

6개 카테고리 각 3개씩 추천 (상의/하의/악세사리/신발/모자/기타).
설명은 1문장씩. 검색어는 사이트명 없이 상품명만.
반드시 한글과 영어만 사용. 한자(漢字) 절대 사용 금지. JSON만 반환, 다른 텍스트 금지:
{"summary":"2026 중학교 여학생 패션 트렌드 전체 요약 2문장","categories":[{"category":"상의","icon":"👕","items":[{"아이템":"상품명만(사이트명 제외)","사진설명":"색상·소재·핏 시각묘사","설명":"체형 맞는 이유와 코디법","출처":"에이블리","검색어":"상품명만 키워드(사이트명 제외)"}]}]}`

// ── AI 프로바이더 ──────────────────────────────────────────
// 공통 에러: status 포함해서 throw
class AIError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

// OpenAI 호환 형식(Groq, Cerebras) 공통 호출
async function callOpenAICompat(url: string, apiKey: string, model: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: PROMPT }],
      temperature: 0.85,
      max_tokens: 4096,
    }),
  })
  if (!res.ok) throw new AIError(res.status, `${url} → ${res.status}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

async function callGroq(): Promise<string> {
  return callOpenAICompat(
    'https://api.groq.com/openai/v1/chat/completions',
    process.env.GROQ_API_KEY ?? '',
    'llama-3.3-70b-versatile',
  )
}

async function callGemini(): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )
  if (!res.ok) throw new AIError(res.status, `Gemini → ${res.status}`)
  const data = await res.json()
  const parts: { text?: string; thought?: boolean }[] = data.candidates?.[0]?.content?.parts ?? []
  const text = parts.filter(p => !p.thought).map(p => p.text ?? '').join('').trim()
    || parts.map(p => p.text ?? '').join('').trim()
  if (!text) throw new AIError(500, 'Gemini 응답 없음')
  return text
}

async function callCerebras(): Promise<string> {
  return callOpenAICompat(
    'https://api.cerebras.ai/v1/chat/completions',
    process.env.CEREBRAS_API_KEY ?? '',
    'qwen-3-235b-a22b-instruct-2507',  // 한국어 품질 최강
  )
}

// 순서대로 시도, 429/503 → 다음 프로바이더
async function callAIWithFallback(): Promise<{ text: string; provider: string }> {
  const providers: [string, () => Promise<string>][] = [
    ['Groq', callGroq],
    ['Gemini', callGemini],
    ['Cerebras', callCerebras],
  ]
  const errors: string[] = []
  for (const [name, fn] of providers) {
    try {
      const text = await fn()
      return { text, provider: name }
    } catch (e) {
      const status = e instanceof AIError ? e.status : 0
      errors.push(`${name}(${status})`)
      if (status === 429 || status === 503 || status === 0) continue
      break // 인증 오류 등은 계속 시도해도 무의미
    }
  }
  throw new Error(`모든 AI 서비스 한도 초과: ${errors.join(' → ')}`)
}

// ── 유틸 ──────────────────────────────────────────────────
function stripChinese(obj: unknown): unknown {
  if (typeof obj === 'string') return obj.replace(/[㐀-䶿一-鿿]/g, '').trim()
  if (Array.isArray(obj)) return obj.map(stripChinese)
  if (obj && typeof obj === 'object')
    return Object.fromEntries(Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, stripChinese(v)]))
  return obj
}

function extractJSON(raw: string): unknown {
  const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('JSON not found in response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

const SOURCE_SEARCH: Record<string, string> = {
  '에이블리': 'https://m.a-bly.com/search?q=',
  '무신사': 'https://www.musinsa.com/search/musinsa/goods?q=',
}

const SHOP_DOMAINS = ['msscdn', 'ably', 'a-bly', 'zigzag', 'shop', 'product', 'item', 'goods']

async function kakaoSearch(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=3&sort=accuracy`,
      { headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const docs: { thumbnail_url: string; image_url: string; doc_url: string }[] = data.documents || []
    if (!docs.length) return null
    const best = docs.find(d => SHOP_DOMAINS.some(s => d.image_url?.includes(s) || d.doc_url?.includes(s))) || docs[0]
    return best?.thumbnail_url || best?.image_url || null
  } catch { return null }
}

async function kakaoImageSearch(source: string, keyword: string): Promise<string | null> {
  // 1차: 출처 + 전체 검색어
  const full = await kakaoSearch(`${source} ${keyword}`)
  if (full) return full

  // 2차: 출처 + 마지막 명사(핵심 단어)
  const words = keyword.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const short = await kakaoSearch(`${source} ${words[words.length - 1]}`)
    if (short) return short
  }

  // 3차: 출처 없이 검색어만
  return kakaoSearch(keyword)
}

// 배열을 n개씩 묶어 순차 실행 (Kakao rate-limit 방지)
async function batchedImageSearch(pairs: [string, string][], batchSize = 3, delayMs = 250): Promise<(string | null)[]> {
  const results: (string | null)[] = []
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(([src, kw]) => kakaoImageSearch(src, kw)))
    results.push(...batchResults)
    if (i + batchSize < pairs.length) await new Promise(r => setTimeout(r, delayMs))
  }
  return results
}

// ── 서버 메모리 캐시 (10분) ───────────────────────────────
let cache: { data: unknown; expireAt: number } | null = null

// ── Route Handler ─────────────────────────────────────────
export async function GET() {
  if (cache && Date.now() < cache.expireAt) {
    return NextResponse.json(cache.data)
  }

  try {
    const { text, provider } = await callAIWithFallback()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = stripChinese(extractJSON(text)) as any

    const ICONS: Record<string, string> = {
      '상의': '👕', '하의': '👖', '악세사리': '✨', '신발': '👟', '모자': '🧢', '기타': '🌟',
    }

    type Item = { 아이템: string; 사진설명: string; 설명: string; 출처: string; 검색어: string }
    type Cat  = { category: string; icon: string; items: Item[] }

    const categories: Cat[] = (parsed.categories || []).map((c: Cat) => ({
      ...c,
      icon: c.icon || ICONS[c.category] || '🛍️',
    }))

    const pairs: [string, string][] = categories.flatMap((cat: Cat) =>
      cat.items.map((item: Item): [string, string] => [
        item.출처,
        item.검색어.replace(/^(에이블리|무신사)\s*/i, ''),
      ])
    )
    const imageUrls = await batchedImageSearch(pairs)

    let idx = 0
    const enrichedCategories = categories.map((cat: Cat) => ({
      ...cat,
      items: cat.items.map((item: Item) => ({
        ...item,
        imageUrl: imageUrls[idx++],
        productUrl: (SOURCE_SEARCH[item.출처] ?? '') + encodeURIComponent(
          item.검색어.replace(/^(에이블리|무신사)\s*/i, '')
        ),
      })),
    }))

    const result = {
      summary: parsed.summary || '',
      categories: enrichedCategories,
      provider,  // 어떤 AI가 응답했는지 표시
      generatedAt: new Date().toISOString(),
    }

    cache = { data: result, expireAt: Date.now() + 10 * 60 * 1000 }
    return NextResponse.json(result)

  } catch (error: unknown) {
    // 모든 프로바이더 실패 시 만료 캐시라도 반환
    if (cache) return NextResponse.json({ ...cache.data as object, cached: true })
    const msg = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
