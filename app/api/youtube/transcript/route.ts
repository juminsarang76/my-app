import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8'

interface CaptionTrack { baseUrl: string; languageCode: string }
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

async function tryClient(videoId: string, clientCtx: Record<string, string>, clientId: string) {
  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-YouTube-Client-Name': clientId,
        'X-YouTube-Client-Version': clientCtx.clientVersion,
        'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)',
        'Origin': 'https://www.youtube.com',
      },
      body: JSON.stringify({ videoId, context: { client: clientCtx } }),
      signal: AbortSignal.timeout(10000),
    },
  )
  if (!res.ok) return null
  const data = await res.json()
  const tracks: CaptionTrack[] = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  return { tracks, videoTitle: data?.videoDetails?.title }
}

async function fetchTranscript(videoId: string, prefLangs: string[]) {
  // 여러 클라이언트 순서대로 시도
  const clients = [
    [{ clientName: 'iOS', clientVersion: '19.09.3', hl: 'en', gl: 'US', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '17.5.1' }, '5'],
    [{ clientName: 'ANDROID', clientVersion: '19.09.36', hl: 'en', gl: 'US', osName: 'Android', osVersion: '14', androidSdkVersion: '34' }, '3'],
    [{ clientName: 'TVHTML5', clientVersion: '7.20231213.07.00', hl: 'en', gl: 'US' }, '7'],
    [{ clientName: 'WEB', clientVersion: '2.20240101.00.00', hl: 'en', gl: 'US', platform: 'DESKTOP' }, '1'],
  ] as [Record<string, string>, string][]

  let tracks: CaptionTrack[] = []
  let dbgTitle = ''

  for (const [ctx, id] of clients) {
    try {
      const result = await tryClient(videoId, ctx, id)
      if (result) {
        dbgTitle = result.videoTitle ?? ''
        if (result.tracks.length) { tracks = result.tracks; break }
      }
    } catch { /* 다음 클라이언트 */ }
  }

  if (!tracks.length) {
    throw new Error(`이 영상에는 자막이 없습니다 (title: ${dbgTitle || '없음'}).\n\nWhisper AI로 음성 인식을 시도해보세요.`)
  }

  // 선호 언어 선택
  let selected = tracks[0]
  for (const lang of prefLangs) {
    const f = tracks.find(t => t.languageCode === lang)
    if (f) { selected = f; break }
  }

  // 자막 fetch
  const capUrl = (selected.baseUrl.startsWith('http') ? selected.baseUrl : `https://www.youtube.com${selected.baseUrl}`) + '&fmt=json3'
  const capRes = await fetch(capUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } })
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
    const { items, lang } = await fetchTranscript(videoId, ['ko', 'en'])
    return NextResponse.json({ videoId, items, lang, total: items.length })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
