import { NextResponse } from 'next/server'

const GROQ_API_KEY = process.env.GROQ_API_KEY

const RSS_QUERIES = [
  '2027학년도 수능 대입',
  '수능 탐구 사탐 과탐 2027',
  '대입 수시 정시 전략 2027학년도',
  '수능 모의평가 2027',
]

interface RSSItem {
  title: string
  link: string
  pubDate: string
  description: string
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const m of matches) {
    const c = m[1]
    const cdata = (s: string) => s?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim() ?? ''
    const tag = (name: string) => cdata(c.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`))?.[1] ?? '')
    const title = tag('title')
    const link  = (c.match(/<link>(.*?)<\/link>/) ?? c.match(/<link\s+href="([^"]+)"/))?.[1]?.trim() ?? ''
    const pubDate = tag('pubDate') || tag('published') || tag('updated')
    const description = tag('description').replace(/<[^>]+>/g, '').slice(0, 300)
    if (title && link) items.push({ title, link, pubDate, description })
  }
  return items
}

export async function GET() {
  // 1. RSS 병렬 수집
  const cutoff = Date.now() - 31 * 24 * 60 * 60 * 1000  // 31일 전
  const fetches = await Promise.allSettled(
    RSS_QUERIES.map(q =>
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124' }, next: { revalidate: 0 } }
      ).then(r => r.text()).then(parseRSS)
    )
  )

  const allItems = fetches.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // 2. 최근 31일 필터 + 중복 제거
  const seen = new Set<string>()
  const recent = allItems.filter(item => {
    const d = item.pubDate ? new Date(item.pubDate).getTime() : 0
    const key = item.title.slice(0, 30)
    if (!d || d < cutoff || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 25)

  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })
  }

  // 3. Groq 분석
  const prompt = `다음은 최근 한 달간 2027학년도 대입 관련 뉴스 ${recent.length}개다.

각 뉴스를 분석해서 아래 JSON 형식으로 반환해줘. 반드시 JSON만 반환.

입력 뉴스:
${recent.map((item, i) => `[${i + 1}] 날짜: ${item.pubDate}\n제목: ${item.title}\n요약: ${item.description}`).join('\n\n')}

반환 JSON 형식:
{
  "summary": "전체 동향 한 줄 요약 (50자 이내)",
  "news": [
    {
      "date": "YYYY.MM.DD",
      "title": "뉴스 제목 (원문 그대로 또는 핵심만)",
      "body": "150자 이내 한국어 요약. 구체적 수치·사실 포함. 중요한 내용 굵게 처리 없이 텍스트만.",
      "tags": ["사실", "추론", "변화"] 중 해당하는 것 1~2개,
      "sourceTitle": "언론사명",
      "sourceUrl": "원문 URL"
    }
  ],
  "changes": [
    {
      "topic": "달라진 주제 (예: 탐구 선택 전략)",
      "before": ["1~4월 인식 항목 1", "항목 2"],
      "after": ["5월 이후 달라진 인식 항목 1", "항목 2"],
      "warning": "추가 주의사항 (없으면 빈 문자열)"
    }
  ]
}

tags 기준:
- "사실": 공식 발표·실제 수치·확정된 일정
- "추론": 전문가 분석·입시학원 해석·가능성
- "변화": 이전 대비 달라진 인식·전략·수치`

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: '당신은 한국 대입 입시 전문 분석가입니다. 요청된 JSON 형식만 반환하세요.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!groqRes.ok) {
    return NextResponse.json({ error: `Groq API 오류 ${groqRes.status}` }, { status: 500 })
  }

  const groqData = await groqRes.json()
  let analysis: { summary?: string; news?: unknown[]; changes?: unknown[] }
  try {
    analysis = JSON.parse(groqData.choices[0].message.content)
  } catch {
    return NextResponse.json({ error: 'JSON 파싱 실패', raw: groqData.choices[0].message.content }, { status: 500 })
  }

  return NextResponse.json({
    fetchedAt: new Date().toISOString(),
    rawCount: recent.length,
    summary: analysis.summary ?? '',
    news: analysis.news ?? [],
    changes: analysis.changes ?? [],
  })
}
