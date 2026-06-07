import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

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

interface CaptionTrack { baseUrl: string; languageCode: string; kind?: string }
interface CaptionEvent { tStartMs?: number; dDurationMs?: number; segs?: { utf8?: string }[] }

async function fetchViaInnerTube(videoId: string, prefLangs: string[]) {
  // YouTube InnerTube API — 서버에서 플레이어 데이터 직접 조회
  const res = await fetch('https://www.youtube.com/youtubei/v1/player', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': '2.20240101.00.00',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      'Origin': 'https://www.youtube.com',
      'Referer': `https://www.youtube.com/watch?v=${videoId}`,
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240101.00.00',
          hl: 'en',
          gl: 'US',
          deviceMake: '',
          deviceModel: '',
          platform: 'DESKTOP',
          browserName: 'Chrome',
          browserVersion: '125.0.0.0',
          osName: 'Windows',
          osVersion: '10.0',
        },
      },
    }),
  })

  if (!res.ok) throw new Error(`InnerTube API 실패: ${res.status}`)
  const data = await res.json()

  const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new Error('이 영상에는 자막이 없습니다.\n\nWhisper AI로 음성 인식을 시도해보세요.')

  // 선호 언어 선택
  let selected = tracks[0]
  for (const lang of prefLangs) {
    const found = tracks.find(t => t.languageCode === lang)
    if (found) { selected = found; break }
  }

  // 자막 데이터 fetch
  const captionUrl = selected.baseUrl.startsWith('http') ? selected.baseUrl : `https://www.youtube.com${selected.baseUrl}`
  const capRes = await fetch(`${captionUrl}&fmt=json3`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  })
  if (!capRes.ok) throw new Error(`자막 데이터 로드 실패: ${capRes.status}`)

  const capData: { events?: CaptionEvent[] } = await capRes.json()
  const items = (capData.events ?? [])
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
    const { items, lang } = await fetchViaInnerTube(videoId, ['ko', 'en'])
    return NextResponse.json({ videoId, items, lang, total: items.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
