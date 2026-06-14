import { NextResponse } from 'next/server'
import { callLLM } from '@/app/lib/ai/llm'
import { searchGoogleNews } from '@/app/lib/ai/search'

export const dynamic = 'force-dynamic'

const RSS_QUERIES = [
  '고용 취업자 통계',
  '실업률 고용률 발표',
  '산업별 고용 동향',
  '청년 고용 일자리',
]

export async function GET() {
  const now = Date.now()
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000

  const fetches = await Promise.allSettled(RSS_QUERIES.map(q => searchGoogleNews(q)))
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
