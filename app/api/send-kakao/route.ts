import { sendKakaoMessage } from '@/app/lib/kakao'

export async function POST(req: Request) {
  try {
    const { summary, date } = await req.json()
    await sendKakaoMessage(
      `[양자뉴스 실시간요약 ${date}]\n\n${summary}\n\n자세히 보기: ${process.env.NEXT_PUBLIC_API_URL}/realtime`
    )
    return Response.json({ success: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
