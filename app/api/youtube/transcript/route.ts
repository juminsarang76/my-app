import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.trim().match(p)
    if (m) return m[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  const videoId = extractVideoId(url ?? '')
  if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 })

  // 한국어 → 영어 → 자동 순으로 시도
  for (const lang of ['ko', 'en', undefined]) {
    try {
      const transcript = lang
        ? await YoutubeTranscript.fetchTranscript(videoId, { lang })
        : await YoutubeTranscript.fetchTranscript(videoId)

      const items = transcript.map(t => ({
        text: t.text,
        start: Math.floor((t.offset ?? 0) / 1000),
        duration: Math.floor((t.duration ?? 0) / 1000),
      }))

      if (items.length) {
        return NextResponse.json({ videoId, items, lang: lang ?? 'auto', total: items.length })
      }
    } catch { /* 다음 언어 시도 */ }
  }

  // 모든 시도 실패
  const isDisabled = true
  return NextResponse.json({
    error: isDisabled
      ? '이 영상은 자막이 비활성화되어 있습니다.\n\nWhisper AI로 시도해보세요.'
      : '자막을 가져올 수 없습니다.',
  }, { status: 500 })
}
