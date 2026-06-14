import { NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/ai/llm'
import { naverSearch as naverShopRaw } from '@/app/lib/ai/search'

const PROMPT = `당신은 대한민국 최고의 중학교 학생 패션 전문가입니다.
에이블리(Ably)·무신사(Musinsa) 현재 인기 아이템 기반으로 조사합니다.

프로필: 키 159cm / 몸무게 38kg / 여자 / 14살 중2 / 마른 체형

6개 카테고리 각 3개씩 추천 (상의/하의/악세사리/신발/모자/기타).
설명은 1문장씩. 검색어는 사이트명 없이 상품명만.
반드시 한글과 영어만 사용. 한자(漢字) 절대 사용 금지. JSON만 반환, 다른 텍스트 금지:
{"summary":"2026 중학교 여학생 패션 트렌드 전체 요약 2문장","categories":[{"category":"상의","icon":"👕","items":[{"아이템":"상품명만(사이트명 제외)","사진설명":"색상·소재·핏 시각묘사","설명":"체형 맞는 이유와 코디법","출처":"에이블리","검색어":"상품명만 키워드(사이트명 제외)"}]}]}`

// AI 호출 — 공용 callLLM(Gemini→Groq→Cerebras, JSON 모드) 사용
function callAI(prompt: string): Promise<{ text: string; provider: string }> {
  return callLLM('', prompt, { temperature: 0.7, maxTokens: 4096 })
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

// ── 중간 검증: 부적합 아이템 교체 ────────────────────────
type Item = { 아이템: string; 사진설명: string; 설명: string; 출처: string; 검색어: string }
type Cat  = { category: string; icon: string; items: Item[] }

async function validateAndReplace(categories: Cat[]): Promise<{ categories: Cat[]; replaced: number }> {
  // 아이템 이름만 전달해서 토큰 절약
  const list = categories.flatMap((c, ci) =>
    c.items.map((item, ii) => `[${ci}${ii}] ${item.아이템}`)
  ).join(', ')

  const checkPrompt = `다음은 14살 중학교 여학생 패션 아이템 목록이다.
미성년자에게 부적합한 아이템(과도한 신체 노출, 성인 전용, 클럽·파티 전용, 지나치게 짧거나 섹시한 스타일)의 코드를 반환하라.
없으면 빈 배열. JSON만 반환: {"remove":["코드",...]}

목록: ${list}`

  let removeIds: string[] = []
  try {
    const { text } = await callAI(checkPrompt)
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')
    const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}')
    if (s !== -1 && e !== -1) {
      const parsed = JSON.parse(cleaned.slice(s, e + 1)) as { remove?: string[] }
      removeIds = parsed.remove ?? []
    }
  } catch { return { categories, replaced: 0 } }

  if (!removeIds.length) return { categories, replaced: 0 }

  // 부적합 항목 교체 요청
  const badItems = removeIds.map(id => {
    const ci = parseInt(id[0]); const ii = parseInt(id[1])
    return `[${id}] ${categories[ci]?.items[ii]?.아이템 ?? ''} (${categories[ci]?.category})`
  }).join(', ')

  const replacePrompt = `다음 아이템들이 14살 중학교 여학생에게 부적합하다고 판단됐다: ${badItems}
같은 카테고리·같은 형식으로 적합한 대체 아이템을 제공하라.
반드시 한글/영어만. JSON만 반환: {"replacements":[{"id":"코드","아이템":"","사진설명":"","설명":"","출처":"에이블리 또는 무신사","검색어":""}]}`

  try {
    const { text } = await callAI(replacePrompt)
    const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '')
    const s = cleaned.indexOf('{'); const e = cleaned.lastIndexOf('}')
    if (s === -1 || e === -1) return { categories, replaced: 0 }
    const parsed = JSON.parse(cleaned.slice(s, e + 1)) as { replacements?: (Item & { id: string })[] }

    const updated = categories.map((cat, ci) => ({
      ...cat,
      items: cat.items.map((item, ii) => {
        const rep = parsed.replacements?.find(r => r.id === `${ci}${ii}`)
        if (!rep) return item
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, ...newItem } = rep
        return newItem as Item
      }),
    }))
    return { categories: updated, replaced: removeIds.length }
  } catch { return { categories, replaced: 0 } }
}

const NAVER_SEARCH_FALLBACK = 'https://search.shopping.naver.com/search/all?query='

type NaverResult = { imageUrl: string | null; productUrl: string | null }

async function naverShoppingSearch(query: string, preferMall?: string): Promise<NaverResult> {
  try {
    const items = await naverShopRaw('shop', query, 10)
    if (!items.length) return { imageUrl: null, productUrl: null }

    // 쇼핑몰명 필터 (무신사/에이블리 우선)
    const MALL_ALIASES: Record<string, string[]> = {
      '무신사': ['무신사', 'musinsa'],
      '에이블리': ['에이블리', 'ably'],
    }
    const aliases = preferMall ? (MALL_ALIASES[preferMall] ?? []) : []
    const matched = aliases.length
      ? items.find(i => aliases.some(a => (i.mallName ?? '').toLowerCase().includes(a.toLowerCase())))
      : null
    const item = matched ?? items[0]

    return { imageUrl: item.image || null, productUrl: item.link || null }
  } catch { return { imageUrl: null, productUrl: null } }
}

const ABLY_SEARCH = (kw: string) =>
  `https://m.a-bly.com/search?screen_name=SEARCH_RESULT&keyword=${encodeURIComponent(kw)}&search_type=DIRECT`

// 에이블리: Naver에서 이미지만 가져오고 링크는 에이블리 모바일웹으로
// 무신사: Naver에서 이미지 + 실제 상품 직링크
async function naverSearch(source: string, keyword: string): Promise<NaverResult> {
  const isAbly = source === '에이블리'
  const mallFilter = isAbly ? undefined : source  // 에이블리는 필터 없이 이미지만

  // 1차: 쇼핑몰명 포함 검색
  const withMall = await naverShoppingSearch(`${source} ${keyword}`, mallFilter)
  if (withMall.imageUrl) {
    return {
      imageUrl: withMall.imageUrl,
      productUrl: isAbly ? ABLY_SEARCH(keyword) : withMall.productUrl,
    }
  }

  // 2차: 검색어만
  const noMall = await naverShoppingSearch(keyword, mallFilter)
  if (noMall.imageUrl) {
    return {
      imageUrl: noMall.imageUrl,
      productUrl: isAbly ? ABLY_SEARCH(keyword) : noMall.productUrl,
    }
  }

  // 3차: 핵심 단어만
  const words = keyword.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const short = await naverShoppingSearch(words[words.length - 1], mallFilter)
    if (short.imageUrl) {
      return {
        imageUrl: short.imageUrl,
        productUrl: isAbly ? ABLY_SEARCH(keyword) : short.productUrl,
      }
    }
  }

  return {
    imageUrl: null,
    productUrl: isAbly
      ? ABLY_SEARCH(keyword)
      : NAVER_SEARCH_FALLBACK + encodeURIComponent(`${source} ${keyword}`),
  }
}

// 5개씩 배치 처리 (Naver API 10 RPS 한도 대응)
async function batchedNaverSearch(pairs: [string, string][], batchSize = 5, delayMs = 150): Promise<NaverResult[]> {
  const results: NaverResult[] = []
  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(([src, kw]) => naverSearch(src, kw)))
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
    // ① AI 아이템 생성
    const { text, provider } = await callAI(PROMPT)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = stripChinese(extractJSON(text)) as any

    const ICONS: Record<string, string> = {
      '상의': '👕', '하의': '👖', '악세사리': '✨', '신발': '👟', '모자': '🧢', '기타': '🌟',
    }

    let categories: Cat[] = (parsed.categories || []).map((c: Cat) => ({
      ...c,
      icon: c.icon || ICONS[c.category] || '🛍️',
    }))

    // ② 중간 검증: 부적합 아이템 감지 및 교체
    const { categories: validated, replaced } = await validateAndReplace(categories)
    categories = validated

    const pairs: [string, string][] = categories.flatMap((cat: Cat) =>
      cat.items.map((item: Item): [string, string] => [
        item.출처,
        item.검색어.replace(/^(에이블리|무신사)\s*/i, ''),
      ])
    )
    const naverResults = await batchedNaverSearch(pairs)

    let idx = 0
    const enrichedCategories = categories.map((cat: Cat) => ({
      ...cat,
      items: cat.items.map((item: Item) => {
        const { imageUrl, productUrl } = naverResults[idx++]
        return {
          ...item,
          imageUrl,
          productUrl: productUrl ?? NAVER_SEARCH_FALLBACK + encodeURIComponent(
            item.검색어.replace(/^(에이블리|무신사)\s*/i, '')
          ),
        }
      }),
    }))

    const result = {
      summary: parsed.summary || '',
      categories: enrichedCategories,
      provider,
      replaced,   // 교체된 부적합 아이템 수
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
