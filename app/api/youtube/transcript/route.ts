import { NextRequest, NextResponse } from 'next/server'
import { YoutubeTranscript } from 'youtube-transcript'

function extractVideoId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
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

  try {
    // 한국어 자막 우선 시도, 없으면 영어, 없으면 자동 생성
    let transcript
    let lang = 'ko'
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'ko' })
    } catch {
      try {
        transcript = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' })
        lang = 'en'
      } catch {
        transcript = await YoutubeTranscript.fetchTranscript(videoId)
        lang = 'auto'
      }
    }

    const items = transcript.map(t => ({
      text: t.text,
      start: Math.floor(t.offset / 1000),
      duration: Math.floor(t.duration / 1000),
    }))

    return NextResponse.json({ videoId, items, lang, total: items.length })
  } catch (e) {
    return NextResponse.json(
      { error: `자막을 가져올 수 없습니다. 자막이 비활성화된 영상일 수 있습니다. (${String(e)})` },
      { status: 500 },
    )
  }
}
