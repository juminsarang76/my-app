import { NextRequest, NextResponse } from 'next/server'
import ytdl from '@distube/ytdl-core'

export const maxDuration = 30

const GROQ_LIMIT = 24 * 1024 * 1024 // 24MB (Groq 25MB limit에서 여유)

export async function POST(req: NextRequest) {
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) return NextResponse.json({ error: 'GROQ_API_KEY 없음' }, { status: 500 })

  const { videoId: rawId } = await req.json()
  if (!rawId) return NextResponse.json({ error: 'videoId 없음' }, { status: 400 })

  // URL이면 ID 추출
  const idMatch = rawId.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/)
    || rawId.match(/^([a-zA-Z0-9_-]{11})$/)
  const videoId = idMatch?.[1] ?? rawId

  const url = `https://www.youtube.com/watch?v=${videoId}`

  // 1. YouTube 오디오 스트림 URL 가져오기
  let audioUrl: string
  let lengthSeconds: number
  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    })
    lengthSeconds = parseInt(info.videoDetails.lengthSeconds ?? '0')

    if (lengthSeconds > 2400) { // 20분 초과
      return NextResponse.json({
        error: `영상이 너무 깁니다 (${Math.floor(lengthSeconds / 60)}분). Whisper AI는 약 40분 이하 영상을 지원합니다.`,
      }, { status: 400 })
    }

    // 가장 낮은 품질의 오디오 선택 (파일 크기 최소화)
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly')
    const format = audioFormats.sort((a, b) => (a.audioBitrate ?? 999) - (b.audioBitrate ?? 999))[0]
    if (!format?.url) throw new Error('오디오 포맷 없음')
    audioUrl = format.url
  } catch (e) {
    return NextResponse.json({
      error: `YouTube 오디오 추출 실패: ${String(e)}\n\n자막이 있는 영상을 사용하거나, 영상 URL이 올바른지 확인하세요.`,
    }, { status: 500 })
  }

  // 2. 오디오 다운로드 (최대 24MB)
  let audioBuffer: ArrayBuffer
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25000)
    const audioRes = await fetch(audioUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
      },
    })
    clearTimeout(timer)
    if (!audioRes.ok) throw new Error(`오디오 다운로드 실패: ${audioRes.status}`)

    audioBuffer = await audioRes.arrayBuffer()
    if (audioBuffer.byteLength > GROQ_LIMIT) {
      return NextResponse.json({
        error: `오디오 파일이 너무 큽니다 (${Math.round(audioBuffer.byteLength / 1024 / 1024)}MB). 약 40분 이하 영상만 지원합니다.`,
      }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({
      error: `오디오 다운로드 실패: ${String(e)}`,
    }, { status: 500 })
  }

  // 3. Groq Whisper로 음성 인식
  try {
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm')
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('response_format', 'verbose_json')
    formData.append('timestamp_granularities[]', 'segment')

    const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${groqKey}` },
      body: formData,
    })

    if (!whisperRes.ok) {
      const err = await whisperRes.text()
      throw new Error(`Whisper API 오류: ${whisperRes.status} ${err}`)
    }

    const whisperData = await whisperRes.json()

    // segments → 자막 형식으로 변환
    const items = (whisperData.segments ?? []).map((seg: {
      text: string; start: number; end: number
    }) => ({
      text: seg.text.trim(),
      start: Math.floor(seg.start),
      duration: Math.floor(seg.end - seg.start),
    }))

    // segments가 없으면 전체 텍스트를 하나로
    if (!items.length && whisperData.text) {
      items.push({ text: whisperData.text, start: 0, duration: lengthSeconds })
    }

    return NextResponse.json({
      videoId,
      items,
      lang: whisperData.language ?? 'auto',
      total: items.length,
      source: 'whisper',
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
