import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CHUNK = 20 // 20줄씩 병렬 처리

async function translateChunk(lines: string[], groqKey: string): Promise<string[]> {
  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `다음 자막을 한국어로 번역하세요. "번호. 번역문" 형식으로만 출력하세요.\n\n${numbered}`,
      }],
      max_tokens: 2000,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(12000),
  })
  if (!res.ok) throw new Error(`Groq 오류: ${res.status}`)
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
  // 번역 안 된 줄은 원문 유지
  return result.map((t, i) => t || lines[i])
}

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const texts: string[] = items.map((i: { text: string }) => i.text)

  // 청크로 나눠서 병렬 처리 (최대 3개 동시)
  const chunks: string[][] = []
  for (let i = 0; i < texts.length; i += CHUNK) {
    chunks.push(texts.slice(i, i + CHUNK))
  }

  const translated: string[] = new Array(texts.length).fill('')

  // 3개씩 병렬 처리
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(chunk => translateChunk(chunk, groqKey))
    )
    results.forEach((r, j) => {
      const startIdx = (i + j) * CHUNK
      if (r.status === 'fulfilled') {
        r.value.forEach((t, k) => { translated[startIdx + k] = t })
      } else {
        // 실패한 청크는 원문 유지
        batch[j].forEach((t, k) => { translated[startIdx + k] = t })
      }
    })
  }

  return NextResponse.json({ translated: translated.filter(Boolean) })
}
