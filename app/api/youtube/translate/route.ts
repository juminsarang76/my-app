import { NextRequest, NextResponse } from 'next/server'
import { callLLMText } from '@/app/lib/llm'

export const maxDuration = 30

const CHUNK = 20

// Gemini(1순위) → Groq → Cerebras 폴백은 callLLMText 내부에서 처리.
// 실패 시 원문 반환.
async function translateWithFallback(lines: string[]): Promise<string[]> {
  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  try {
    const { text: raw } = await callLLMText(
      'You are a Korean subtitle translator. Output ONLY numbered translations in format "num. Korean text". No reasoning, no explanation.',
      `Translate each line to Korean. Output format: "num. Korean text"\n\n${numbered}`,
      { maxTokens: 4000, temperature: 0.2 },
    )
    const result = new Array(lines.length).fill('')
    raw.split('\n').forEach((line: string) => {
      const m = line.match(/^(\d+)\.\s+(.+)/)
      if (m) {
        const idx = parseInt(m[1]) - 1
        if (idx >= 0 && idx < lines.length) result[idx] = m[2].trim()
      }
    })
    return result.map((t, i) => t || lines[i])
  } catch {
    return lines  // 모든 프로바이더 실패 → 원문 반환
  }
}

export async function POST(req: NextRequest) {
  const { items } = await req.json()
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const texts: string[] = items.map((i: { text: string }) => i.text)
  const chunks: string[][] = []
  for (let i = 0; i < texts.length; i += CHUNK) chunks.push(texts.slice(i, i + CHUNK))

  const translated: string[] = new Array(texts.length).fill('')

  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3)
    const results = await Promise.allSettled(
      batch.map(chunk => translateWithFallback(chunk))
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
