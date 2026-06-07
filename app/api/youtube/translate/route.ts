import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const CHUNK = 20

// 번역 API 엔드포인트 목록 (순서대로 시도)
const PROVIDERS = [
  {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
  },
  {
    url: 'https://api.groq.com/openai/v1/chat/completions',
    keyEnv: 'GROQ_API_KEY',
    model: 'llama-3.1-8b-instant',  // 더 작은 모델 (별도 쿼터)
  },
  {
    url: 'https://api.cerebras.ai/v1/chat/completions',
    keyEnv: 'CEREBRAS_API_KEY',
    model: 'llama-3.3-70b',
  },
]

async function translateChunk(
  lines: string[],
  url: string,
  apiKey: string,
  model: string,
): Promise<string[]> {
  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: `다음 영어 자막을 한국어로 번역하세요. "번호. 번역문" 형식으로만 출력하세요.\n\n${numbered}`,
      }],
      max_tokens: 2000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(12000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    // 429 Rate Limit → 다음 프로바이더로
    if (res.status === 429) throw new Error(`rate_limit:${model}`)
    throw new Error(`api_error:${res.status}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''

  const result = new Array(lines.length).fill('')
  raw.split('\n').forEach((line: string) => {
    const m = line.match(/^(\d+)\.\s+(.+)/)
    if (m) {
      const idx = parseInt(m[1]) - 1
      if (idx >= 0 && idx < lines.length) result[idx] = m[2].trim()
    }
  })
  return result.map((t, i) => t || lines[i])
}

async function translateWithFallback(
  lines: string[],
  env: Record<string, string | undefined>,
): Promise<string[]> {
  for (const p of PROVIDERS) {
    const key = env[p.keyEnv]
    if (!key) continue
    try {
      return await translateChunk(lines, p.url, key, p.model)
    } catch (e) {
      const msg = String(e)
      if (msg.includes('rate_limit')) continue  // 다음 프로바이더 시도
      throw e  // 다른 오류는 즉시 throw
    }
  }
  // 모든 프로바이더 실패 → 원문 반환
  return lines
}

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const env = {
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
  }

  const texts: string[] = items.map((i: { text: string }) => i.text)
  const chunks: string[][] = []
  for (let i = 0; i < texts.length; i += CHUNK) chunks.push(texts.slice(i, i + CHUNK))

  const translated: string[] = new Array(texts.length).fill('')

  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(chunk => translateWithFallback(chunk, env))
    )
    results.forEach((r, j) => {
      const startIdx = (i + j) * CHUNK
      if (r.status === 'fulfilled') {
        r.value.forEach((t, k) => { translated[startIdx + k] = t })
      } else {
        batch[j].forEach((t, k) => { translated[startIdx + k] = t })
      }
    })
  }

  return NextResponse.json({ translated: translated.filter(Boolean) })
}
