import { supabase } from '@/app/lib/supabase'
import {
  fetchTodayAdmissionNews,
  summarizeAdmissionNews,
  buildAdmissionPayload,
  admissionKey,
} from '@/app/lib/ai/admission'
import { getKSTDate } from '@/app/lib/ai/news'
import { sendKakaoMessage } from '@/app/lib/kakao'

// GET         — 가장 최근 오늘입시뉴스 조회 (입시전쟁.html이 호출)
// GET ?run=1  — 수집 → 요약 → 저장 → 카카오 전송 (Vercel 크론이 매일 KST 22:00 호출)
//               Vercel 크론은 GET만 보내므로 생성도 GET에 둔다.
export async function GET(req: Request) {
  const run = new URL(req.url).searchParams.get('run') === '1'

  if (!run) {
    const { data } = await supabase
      .from('reports')
      .select('date, summary, quantum_news, created_at')
      .like('date', 'ipsi_%')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()

    return Response.json(data ?? null)
  }

  try {
    const date = getKSTDate()
    const news = await fetchTodayAdmissionNews()
    const digest = await summarizeAdmissionNews(news)
    const payload = buildAdmissionPayload(digest)

    const { data: report, error } = await supabase
      .from('reports')
      .upsert({ date: admissionKey(date), ...payload }, { onConflict: 'date' })
      .select()
      .single()

    if (error) throw new Error(`Supabase upsert failed: ${JSON.stringify(error)}`)

    // 저장까지 끝난 뒤 전송 — 카카오 토큰이 만료돼도 데이터는 남는다
    let kakao: string
    try {
      const top = digest.items.slice(0, 3)
        .map((n, i) => `${i + 1}. ${n.title}\n${n.link}`)
        .join('\n\n')
      await sendKakaoMessage(`[오늘 입시뉴스 ${date}]\n\n${digest.overall}\n\n${top}`)
      kakao = 'sent'
    } catch (e) {
      kakao = `failed: ${e instanceof Error ? e.message : String(e)}`
    }

    return Response.json({ success: true, count: digest.items.length, kakao, report })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
