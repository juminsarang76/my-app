import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CHUNK = 30 // 청크 크기 축소 (속도 향상)

async function translateChunk(lines: string[], groqKey: string): Promise<string[]> {
  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join('\n')
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `아래 자막을 한국어로 번역하세요. 번호 순서를 유지하고, 각 줄을 "번호. 번역문" 형식으로 반환하세요. 다른 설명 없이 번역만 출력하세요.\n\n${numbered}`,
      }],
      max_tokens: 4000,
      temperature: 0.3,
    }),
  })
  if (!res.ok) throw new Error(`Groq 오류: ${res.status}`)
  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''

  // "번호. 텍스트" 파싱
  const result = new Array(lines.length).fill('')
  raw.split('\n').forEach((line: string) => {
    const m = line.match(/^(\d+)\.\s+(.+)/)
    if (m) {
      const idx = parseInt(m[1]) - 1
      if (idx >= 0 && idx < lines.length) result[idx] = m[2].trim()
    }
  })
  return result
}

export async function POST(req: NextRequest) {
  const { items } = await req.json() // items: { text, start, duration }[]
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })
  if (!items?.length) return NextResponse.json({ error: '자막 없음' }, { status: 400 })

  const texts: string[] = items.map((i: { text: string }) => i.text)
  const translated: string[] = []

  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK)
    const result = await translateChunk(chunk, groqKey)
    translated.push(...result)
  }

  return NextResponse.json({ translated })
}
