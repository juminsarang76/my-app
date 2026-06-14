import { supabase } from '@/app/lib/supabase'
import { fetchAllNews, summarizeNews, buildReportPayload, getKSTDate, getKSTHour } from '@/app/lib/ai/news'
import { sendKakaoMessage } from '@/app/lib/kakao'


export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get('force') === 'true'
    const hour = getKSTHour()
    // 한국시 6시~12시(정오) 범위 외에는 실행 차단 (force=true로 우회 가능)
    if (!force && (hour < 6 || hour >= 12)) {
      return Response.json(
        { error: `정기요약은 한국시 06:00~12:00 사이에만 생성됩니다. (현재 KST ${hour}시)` },
        { status: 403 }
      )
    }

    const date = getKSTDate()
    const news = await fetchAllNews()
    const summary = await summarizeNews(news)
    const payload = buildReportPayload(news, summary)

    const { data: report } = await supabase
      .from('reports')
      .upsert({ date, ...payload }, { onConflict: 'date' })
      .select()
      .single()

    const reportUrl = `${process.env.NEXT_PUBLIC_API_URL}/reports/${date}`
    await sendKakaoMessage(
      `[양자뉴스 정기요약 ${date}]\n\n${summary.overall}\n\n리포트 보기: ${reportUrl}`
    )

    return Response.json({ success: true, report })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
