import { sendKakaoMessage } from '@/app/lib/kakao'

export const dynamic = 'force-dynamic'

// 카카오 전달 — 말씀(성경구절·배경·나눔)과 악보(이미지 링크) 전달
export async function POST(req: Request) {
  try {
    const w = await req.json()
    if (!w?.scripture || !w?.hymn) {
      return Response.json({ error: '전달할 예배 데이터가 없습니다.' }, { status: 400 })
    }

    const lines: string[] = []
    lines.push(`🙏 가정예배 — ${w.scripture}`)
    lines.push('')
    if (w.scriptureText) { lines.push(`📖 말씀`); lines.push(w.scriptureText); lines.push('') }
    if (w.background)    { lines.push(`📝 말씀 배경`); lines.push(w.background); lines.push('') }
    if (Array.isArray(w.guide) && w.guide.length) {
      lines.push('💬 말씀 나눔')
      w.guide.forEach((q: string, i: number) => lines.push(`${i + 1}. ${q}`))
      lines.push('')
    }
    lines.push(`🎵 찬송: ${w.hymn}`)
    if (w.score?.sheetImageUrl) lines.push(`악보: ${w.score.sheetImageUrl}`)
    else if (w.score?.searchUrl) lines.push(`악보 찾기: ${w.score.searchUrl}`)

    await sendKakaoMessage(lines.join('\n'))
    return Response.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return Response.json({ error: msg }, { status: 500 })
  }
}
