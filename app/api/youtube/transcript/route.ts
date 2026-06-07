import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
}

function extractVideoId(url: string): string | null {
  for (const p of [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/(?:watch\?v=|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]) {
    const m = url.trim().match(p)
    if (m) return m[1]
  }
  return null
}

interface CaptionTrack {
  baseUrl: string
  languageCode: string
  kind?: string
}

interface CaptionEvent {
  tStartMs?: number
  dDurationMs?: number
  segs?: { utf8?: string }[]
}

async function fetchYouTubeTranscript(videoId: string, prefLangs: string[]) {
  // 1. YouTube 페이지 직접 fetch (브라우저처럼)
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en&gl=US`, {
    headers: BROWSER_HEADERS,
  })

  if (!res.ok) throw new Error(`YouTube 페이지 로드 실패: ${res.status}`)
  const html = await res.text()

  // 2. ytInitialPlayerResponse 추출
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;[\s\n]*(?:var|const|let|\n|<)/)
    ?? html.match(/ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});/)
  if (!match) throw new Error('플레이어 데이터를 찾을 수 없습니다. 영상이 존재하는지 확인하세요.')

  let playerResponse: {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: CaptionTrack[]
      }
    }
  }
  try {
    playerResponse = JSON.parse(match[1])
  } catch {
    throw new Error('플레이어 데이터 파싱 실패')
  }

  const tracks: CaptionTrack[] = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new Error('이 영상에는 자막이 없습니다.\n\nWhisper AI로 음성 인식을 시도해보세요.')

  // 3. 선호 언어 자막 선택
  let selected = tracks[0]
  for (const lang of prefLangs) {
    const found = tracks.find(t => t.languageCode === lang)
    if (found) { selected = found; break }
  }

  // 4. 자막 URL fetch (json3 형식)
  const captionUrl = selected.baseUrl + '&fmt=json3'
  const captionRes = await fetch(captionUrl, { headers: { 'User-Agent': BROWSER_HEADERS['User-Agent'] } })
  if (!captionRes.ok) throw new Error(`자막 데이터 로드 실패: ${captionRes.status}`)

  const captionData: { events?: CaptionEvent[] } = await captionRes.json()

  // 5. 파싱
  const items = (captionData.events ?? [])
    .filter(e => e.segs?.length)
    .map(e => ({
      text: (e.segs ?? []).map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim(),
      start: Math.floor((e.tStartMs ?? 0) / 1000),
      duration: Math.floor((e.dDurationMs ?? 0) / 1000),
    }))
    .filter(item => item.text)

  return { items, lang: selected.languageCode }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  const videoId = extractVideoId(url ?? '')
  if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 })

  try {
    const { items, lang } = await fetchYouTubeTranscript(videoId, ['ko', 'en'])
    return NextResponse.json({ videoId, items, lang, total: items.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
