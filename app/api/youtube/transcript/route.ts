import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

interface CaptionTrack { baseUrl: string; languageCode: string; kind?: string }
interface CaptionEvent { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }

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

// Step 1: 동영상 HTML에서 INNERTUBE_API_KEY 추출
async function extractApiKey(videoId: string): Promise<string> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  })
  const html = await res.text()
  const m = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/)
    ?? html.match(/innertubeApiKey\s*['"]?\s*:\s*['"]([^'"]+)['"]/)
  return m?.[1] ?? 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
}

// Step 2: ANDROID 클라이언트로 Player API 호출
async function fetchPlayerResponse(videoId: string, apiKey: string) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${apiKey}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/20.10.38 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230805.001; gzip)',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '20.10.38',
        'Origin': 'https://www.youtube.com',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            androidSdkVersion: 33,
            osName: 'Android',
            osVersion: '13',
            platform: 'MOBILE',
            hl: 'en',
            gl: 'US',
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    },
  )
  if (!res.ok) throw new Error(`Player API 실패: ${res.status}`)
  return await res.json()
}

async function fetchTranscript(videoId: string, prefLangs: string[]) {
  // API 키 동적 추출 (없으면 공개 키 사용)
  let apiKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'
  try { apiKey = await extractApiKey(videoId) } catch { /* 기본 키 사용 */ }

  const data = await fetchPlayerResponse(videoId, apiKey)

  const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  const videoTitle = data?.videoDetails?.title ?? ''

  if (!tracks.length) {
    throw new Error(
      `이 영상에는 자막이 없습니다${videoTitle ? ` (${videoTitle})` : ''}.\n\nWhisper AI로 음성 인식을 시도하거나 downsub.com에서 자막을 가져와 붙여넣기 하세요.`
    )
  }

  // 선호 언어 선택 (수동 자막 우선, 자동 생성 차선)
  let selected = tracks[0]
  for (const lang of prefLangs) {
    const manual = tracks.find(t => t.languageCode === lang && t.kind !== 'asr')
    const auto = tracks.find(t => t.languageCode === lang)
    if (manual) { selected = manual; break }
    if (auto) { selected = auto; break }
  }

  // 자막 데이터 fetch
  const capUrl = (selected.baseUrl.startsWith('http')
    ? selected.baseUrl
    : `https://www.youtube.com${selected.baseUrl}`) + '&fmt=json3'

  const capRes = await fetch(capUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36' },
  })
  if (!capRes.ok) throw new Error(`자막 로드 실패: ${capRes.status}`)

  const capData: { events?: CaptionEvent[] } = await capRes.json()
  const items = (capData.events ?? [])
    .filter(e => e.segs?.length)
    .map(e => ({
      text: (e.segs ?? []).map(s => s.utf8 ?? '').join('').replace(/\n/g, ' ').trim(),
      start: Math.floor((e.tStartMs ?? 0) / 1000),
      duration: Math.floor((e.dDurationMs ?? 0) / 1000),
    }))
    .filter(item => item.text)

  return { items, lang: selected.languageCode, videoTitle }
}

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  const videoId = extractVideoId(url ?? '')
  if (!videoId) return NextResponse.json({ error: '유효한 YouTube URL이 아닙니다.' }, { status: 400 })

  try {
    const { items, lang, videoTitle } = await fetchTranscript(videoId, ['ko', 'en'])
    return NextResponse.json({ videoId, items, lang, total: items.length, videoTitle })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
