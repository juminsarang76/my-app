import { createClient } from '@supabase/supabase-js'
import { fetchAllNews, summarizeNews, buildReportPayload, getKSTDate } from '@/app/lib/news'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

// GET: 가장 최근 실시간요약 조회
export async function GET() {
  const { data } = await supabase
    .from('reports')
    .select('*')
    .like('date', 'rt_%')
    .order('date', { ascending: false })
    .limit(1)
    .single()

  return Response.json(data ?? null)
}

// POST: 실시간 뉴스 수집 → 요약 → 저장 → 카카오 전송
export async function POST() {
  try {
    const date = getKSTDate()
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000)
    const hhmm = kst.toISOString().slice(11, 16).replace(':', '')
    const key = `rt_${date}_${hhmm}`

    const news = await fetchAllNews()
    const summary = await summarizeNews(news)
    const payload = buildReportPayload(news, summary)

    const { data: report, error: dbError } = await supabase
      .from('reports')
      .upsert({ date: key, ...payload })
      .select()
      .single()

    if (dbError) throw new Error(`Supabase upsert failed: ${JSON.stringify(dbError)}`)

    return Response.json({ success: true, report })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
