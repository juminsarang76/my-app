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
    const msg = String(e)
    const isDisabled = msg.includes('disabled') || msg.includes('Transcript is disabled')
    const isNotFound = msg.includes('No transcript') || msg.includes('not found')

    const userMsg = isDisabled
      ? '이 영상은 자막이 비활성화되어 있습니다.\n\n자막이 있는 영상을 사용하세요:\n• TED 강연 (ted.com/talks)\n• YouTube에서 CC 버튼이 활성화된 영상\n• 영어권 뉴스·교육 채널 (CNN, BBC, Crash Course 등)'
      : isNotFound
      ? '자막(CC)이 없는 영상입니다. 자막이 있는 영상의 URL을 입력해주세요.'
      : '자막을 가져오지 못했습니다. 잠시 후 다시 시도하거나 다른 영상을 사용해주세요.'

    return NextResponse.json({ error: userMsg }, { status: 500 })
  }
}
