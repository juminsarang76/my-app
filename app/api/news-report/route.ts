import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

async function fetchNews(query: string) {
  const encoded = encodeURIComponent(query)
  const url = `https://news.google.com/rss/search?q=${encoded}&hl=ko&gl=KR&ceid=KR:ko`
  const res = await fetch(url)
  const text = await res.text()

  const items = text.match(/<item>([\s\S]*?)<\/item>/g) || []
  return items.slice(0, 3).map(item => {
    const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || ''
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || ''
    const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || ''
    return { title, link, pubDate }
  })
}

async function summarizeWithGroq(ionqNews: any[], quantumNews: any[]) {
  const prompt = `다음 뉴스들을 한국어로 요약해주세요.

IONQ 뉴스:
${ionqNews.map((n, i) => `${i + 1}. ${n.title}`).join('\n')}

양자컴퓨터 뉴스:
${quantumNews.map((n, i) => `${i + 1}. ${n.title}`).join('\n')}

다음 JSON 형식으로만 응답하고 다른 텍스트는 포함하지 마세요:
{
  "overall_summary": "전체 내용을 3줄로 요약",
  "ionq_summaries": ["뉴스1 한줄요약", "뉴스2 한줄요약", "뉴스3 한줄요약"],
  "quantum_summaries": ["뉴스1 한줄요약", "뉴스2 한줄요약", "뉴스3 한줄요약"]
}`

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    })
  })

  const data = await res.json()
  console.log('Groq 응답:', JSON.stringify(data))
  const text = data.choices[0].message.content.replace(/```json|```/g, '').trim()
  return JSON.parse(text)
}

async function sendKakaoMessage(message: string) {
  await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KAKAO_ACCESS_TOKEN}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text: message,
        link: { web_url: process.env.NEXT_PUBLIC_API_URL }
      })
    })
  })
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const hour = searchParams.get('hour') || '06'
    const today = new Date().toISOString().split('T')[0]
    const reportKey = `${today}_${hour}`

    const [ionqNews, quantumNews] = await Promise.all([
      fetchNews('IONQ'),
      fetchNews('양자컴퓨터')
    ])

    const summary = await summarizeWithGroq(ionqNews, quantumNews)

const { data: report } = await supabase
      .from('reports')
      .upsert({
        date: reportKey,
        summary: summary.overall_summary,
        ionq_news: ionqNews.map((n, i) => ({ ...n, summary: summary.ionq_summaries[i] })),
        quantum_news: quantumNews.map((n, i) => ({ ...n, summary: summary.quantum_summaries[i] }))
      })
      .select()
      .single()

    const reportUrl = `${process.env.NEXT_PUBLIC_API_URL}/reports/${reportKey}`
    const kakaoMessage = `[양자컴퓨터 뉴스 일일요약 ${reportKey}]\n\n${summary.overall_summary}\n\n리포트 보기: ${reportUrl}`
    await sendKakaoMessage(kakaoMessage)

    return Response.json({ success: true, report })
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 })
  }
}