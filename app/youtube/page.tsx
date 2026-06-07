'use client'

import { useEffect, useRef, useState } from 'react'

interface SubItem { text: string; start: number; duration: number }
type Tab = '원문' | '번역' | '동시보기' | '한글요약'

// 클라이언트 규칙 기반 문장 합치기 (API 불필요)
// 규칙: 구두점(. ? !)으로 끝나지 않으면 다음 줄과 합침
function mergeIntoSentences(items: SubItem[]): SubItem[] {
  if (!items.length) return items

  const SENTENCE_END = /[.?!][\s"'»)]*$/
  const CONTINUES_NEXT = (text: string) => !SENTENCE_END.test(text.trim())

  const merged: SubItem[] = []
  let buffer: string[] = []
  let bufferStart = 0
  let bufferDuration = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (buffer.length === 0) {
      bufferStart = item.start
      bufferDuration = 0
    }
    buffer.push(item.text.trim())
    bufferDuration += item.duration

    // 현재 줄이 구두점으로 끝나면 → 완성 문장
    if (!CONTINUES_NEXT(item.text)) {
      merged.push({
        text: buffer.join(' ').replace(/\s+/g, ' '),
        start: bufferStart,
        duration: bufferDuration,
      })
      buffer = []
    }
  }

  // 마지막에 남은 버퍼 (구두점 없이 끝난 경우)
  if (buffer.length > 0) {
    merged.push({
      text: buffer.join(' ').replace(/\s+/g, ' '),
      start: bufferStart,
      duration: bufferDuration,
    })
  }

  return merged
}

// SRT/VTT/TXT 파싱
function parseSubtitleText(raw: string): SubItem[] {
  const text = raw.trim()

  // SRT 형식: 숫자\n00:00:00,000 --> 00:00:00,000\n텍스트
  if (/\d+\r?\n\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->/.test(text)) {
    const blocks = text.split(/\r?\n\r?\n/)
    return blocks.flatMap(block => {
      const lines = block.split(/\r?\n/)
      const timeLine = lines.find(l => /-->/.test(l))
      if (!timeLine) return []
      const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,\.](\d{3})/)
      if (!m) return []
      const start = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
      const textContent = lines.filter(l => !/-->/.test(l) && !/^\d+$/.test(l.trim())).join(' ').trim()
      return textContent ? [{ text: textContent, start, duration: 3 }] : []
    }).filter(Boolean)
  }

  // VTT 형식: WEBVTT 헤더 포함
  if (text.startsWith('WEBVTT') || /\d{2}:\d{2}:\d{2}\.\d{3}\s*-->/.test(text)) {
    const blocks = text.replace('WEBVTT', '').trim().split(/\r?\n\r?\n/)
    return blocks.flatMap(block => {
      const lines = block.split(/\r?\n/)
      const timeLine = lines.find(l => /-->/.test(l))
      if (!timeLine) return []
      const m = timeLine.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
      if (!m) return []
      const start = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
      const textContent = lines.filter(l => !/-->/.test(l)).join(' ').replace(/<[^>]+>/g, '').trim()
      return textContent ? [{ text: textContent, start, duration: 3 }] : []
    }).filter(Boolean)
  }

  // [MM:SS] text 또는 MM:SS text 타임스탬프 형식
  if (/^\[\d{2}:\d{2}\]|\d{2}:\d{2}\s+\w/.test(text.split('\n')[0])) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    return lines.map((line, i) => {
      const m = line.match(/^\[?(\d{2}):(\d{2})\]?\s+(.+)/)
      if (m) {
        const start = parseInt(m[1]) * 60 + parseInt(m[2])
        return { text: m[3].trim(), start, duration: 5 }
      }
      return { text: line.trim(), start: i * 5, duration: 5 }
    }).filter(item => item.text)
  }

  // 일반 텍스트: 줄/문단 단위로 분리
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  return lines.map((line, i) => ({ text: line.trim(), start: i * 5, duration: 5 }))
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function YoutubePage() {
  const [url, setUrl] = useState('')
  const [videoId, setVideoId] = useState('')
  const [items, setItems] = useState<SubItem[]>([])
  const [translated, setTranslated] = useState<string[]>([])
  const [summary, setSummary] = useState('')
  const [tab, setTab] = useState<Tab>('동시보기')
  const [videoTitle, setVideoTitle] = useState('')
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [loadingTranslate, setLoadingTranslate] = useState(false)
  const [translateProgress, setTranslateProgress] = useState(0) // 0~100
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingWhisper, setLoadingWhisper] = useState(false)
  const [savingNotion, setSavingNotion] = useState(false)
  const [savingGithub, setSavingGithub] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [lang, setLang] = useState('')
  const [noCaption, setNoCaption] = useState(false)
  const [showPasteInput, setShowPasteInput] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [normalizing, setNormalizing] = useState(false)
  const [obsidianToken, setObsidianToken] = useState('')
  const [obsidianPort, setObsidianPort] = useState('27124')
  const [showObsidianSettings, setShowObsidianSettings] = useState(false)

  useEffect(() => {
    setObsidianToken(localStorage.getItem('obsidian_token') ?? '')
    setObsidianPort(localStorage.getItem('obsidian_port') ?? '27124')
  }, [])

  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  // 동시 보기 동기 스크롤
  function onLeftScroll() {
    if (syncingRef.current || !rightRef.current || !leftRef.current) return
    syncingRef.current = true
    rightRef.current.scrollTop = leftRef.current.scrollTop
    setTimeout(() => { syncingRef.current = false }, 50)
  }
  function onRightScroll() {
    if (syncingRef.current || !leftRef.current || !rightRef.current) return
    syncingRef.current = true
    leftRef.current.scrollTop = rightRef.current.scrollTop
    setTimeout(() => { syncingRef.current = false }, 50)
  }

  async function tryLocalServer(videoUrl: string): Promise<{ items: SubItem[]; videoId: string; lang: string } | null> {
    // 로컬 Python 서버 시도 — HTTP 우선 (Chrome은 localhost HTTP 허용)
    const endpoints = [
      `http://127.0.0.1:8765/transcript?url=${encodeURIComponent(videoUrl)}`,
      `http://localhost:8765/transcript?url=${encodeURIComponent(videoUrl)}`,
    ]
    for (const endpoint of endpoints) {
      try {
        const res = await fetch(endpoint, {
          signal: AbortSignal.timeout(15000),
          // Chrome Private Network Access 정책 대응
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.items?.length) return data
        }
      } catch (e) {
        console.warn('[LocalServer]', endpoint, e)
      }
    }
    return null
  }

  async function handleFetch() {
    if (!url.trim()) return
    setError('')
    setItems([])
    setTranslated([])
    setSummary('')
    setNoCaption(false)
    setLoadingTranscript(true)
    setTab('원문')
    try {
      // 1순위: 로컬 Python 서버 (PC에서 scripts/youtube_server.py 실행 시)
      const local = await tryLocalServer(url)
      if (local) {
        setItems(local.items)
        setVideoId(local.videoId)
        setLang(`${local.lang} (로컬)`)
        try {
          const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${local.videoId}&format=json`)
          if (oRes.ok) { const oData = await oRes.json(); setVideoTitle(oData.title ?? '') }
        } catch { /* ignore */ }
        return
      }

      // 2순위: Vercel 서버 API
      const res = await fetch('/api/youtube/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.items)
      setVideoId(data.videoId)
      setLang(data.lang)
      // 영상 제목 가져오기 (oEmbed API)
      try {
        const oRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${data.videoId}&format=json`)
        if (oRes.ok) { const oData = await oRes.json(); setVideoTitle(oData.title ?? '') }
      } catch { /* 제목 없으면 videoId 사용 */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '자막을 가져오지 못했습니다.'
      // 서버 IP 차단 → 로컬 서버 안내 메시지로 교체
      const isBlocked = msg.includes('자막이 없습니다') || msg.includes('비활성화') || msg.includes('disabled')
      setError(isBlocked
        ? `YouTube가 서버 요청을 차단했습니다.\n\n✅ 해결 방법 1 (PC): 아래 명령어 실행 후 "자막 가져오기" 재시도\n  python scripts/youtube_server.py\n  (최초 1회: https://localhost:8765 접속 → 인증서 허용)\n\n✅ 해결 방법 2: 📋 자막 직접 붙여넣기 버튼 클릭\n  python scripts/youtube_transcript.py [URL] 실행 후 출력 복사`
        : msg)
      if (msg.includes('비활성화') || msg.includes('disabled') || msg.includes('CC') || isBlocked) {
        setNoCaption(true)
      }
    } finally {
      setLoadingTranscript(false)
    }
  }

  async function handleWhisper() {
    const vid = videoId || url.trim()
    if (!vid) return
    setError('')
    setNoCaption(false)
    setItems([])
    setTranslated([])
    setSummary("")
    setLoadingWhisper(true)
    setTab('원문')
    try {
      const res = await fetch('/api/youtube/whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: vid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.items)
      setVideoId(data.videoId)
      setLang(`${data.lang} (Whisper AI)`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Whisper 인식에 실패했습니다.')
    } finally {
      setLoadingWhisper(false)
    }
  }

  function makeFilename() {
    const today = new Date().toISOString().slice(0, 10)
    const title = videoTitle || videoId
    return `${title}_${today}`.replace(/[/\\?%*:|"<>]/g, '-')
  }

  // Obsidian: 마크다운 생성
  function buildMarkdown() {
    let md = `# ${videoTitle || videoId}\n\n`
    md += `🎬 https://www.youtube.com/watch?v=${videoId}\n`
    md += `📅 ${new Date().toLocaleDateString('ko-KR')}\n\n`
    if (summary) { md += `## 📋 한글 요약\n\n${summary}\n\n` }
    if (translated.length) {
      md += `## 🇰🇷 한글 번역\n\n`
      items.forEach((item, i) => { md += `\`${formatTime(item.start)}\` ${translated[i] || item.text}\n\n` })
    }
    md += `## 📝 원문 자막\n\n`
    items.forEach(item => { md += `\`${formatTime(item.start)}\` ${item.text}\n\n` })
    return md
  }

  // Obsidian Local REST API로 직접 저장
  async function handleObsidian() {
    if (!items.length) return
    const fname = makeFilename()
    const md = buildMarkdown()

    // 토큰이 없으면 설정 열기
    if (!obsidianToken) {
      setShowObsidianSettings(true)
      return
    }

    try {
      // 브라우저에서 직접 localhost Obsidian API 호출
      const res = await fetch(`https://127.0.0.1:${obsidianPort}/vault/${encodeURIComponent(fname)}.md`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${obsidianToken}`,
          'Content-Type': 'text/markdown',
        },
        body: md,
      })

      if (res.ok || res.status === 204) {
        setToast(`✅ Obsidian에 저장됐습니다: ${fname}.md`)
        // Obsidian 앱으로 바로 이동
        window.open(`obsidian://open?path=${encodeURIComponent(fname)}.md`)
      } else {
        throw new Error(`HTTP ${res.status}`)
      }
    } catch (e) {
      // 실패 시 .md 파일 다운로드로 폴백
      const blob = new Blob([md], { type: 'text/markdown; charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${fname}.md`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(a.href)

      setToast(`⚠️ 직접 저장 실패 (인증서 문제일 수 있음). 파일 다운로드로 대체했습니다.\n브라우저에서 https://127.0.0.1:${obsidianPort} 접속 후 인증서를 허용하세요.`)
    }
  }

  function saveObsidianSettings() {
    localStorage.setItem('obsidian_token', obsidianToken)
    localStorage.setItem('obsidian_port', obsidianPort)
    setShowObsidianSettings(false)
    setToast('✅ Obsidian 설정 저장됨')
  }

  // GitHub: youtube_script 저장소에 저장 → Obsidian Git sync
  async function handleGithub() {
    if (!items.length) return
    setSavingGithub(true)
    try {
      const res = await fetch('/api/youtube/save-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: makeFilename(), content: buildMarkdown() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setToast('✅ GitHub에 저장됨 → Obsidian Git이 자동 sync합니다')
      if (data.url) window.open(data.url, '_blank')
    } catch (e) {
      setToast(`❌ ${e instanceof Error ? e.message : 'GitHub 저장 실패'}`)
    } finally {
      setSavingGithub(false)
      setTimeout(() => setToast(''), 4000)
    }
  }

  // Notion: API 저장
  async function handleNotion() {
    if (!items.length) return
    setSavingNotion(true)
    try {
      const res = await fetch('/api/youtube/save-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, videoTitle: makeFilename(), items, translated, summary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setToast('✅ Notion에 저장됐습니다!')
      if (data.url) window.open(data.url, '_blank')
    } catch (e) {
      setToast(`❌ ${e instanceof Error ? e.message : 'Notion 저장 실패'}`)
    } finally {
      setSavingNotion(false)
      setTimeout(() => setToast(''), 4000)
    }
  }

  // 둘다 저장
  // 클립보드에서 자막 읽기 (python scripts/youtube_transcript.py 실행 후)
  async function handleReadClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) { setError('클립보드가 비어있습니다.'); return }
      const parsed = parseSubtitleText(text)
      if (!parsed.length) { setError('자막 형식이 아닙니다. python scripts/youtube_transcript.py [URL] 실행 후 다시 시도하세요.'); return }
      setItems(parsed)
      setTranslated([])
      setSummary('')
      setTab('원문')
      setLang(`클립보드 (${parsed.length}줄)`)
      setError('')
      setNormalizing(true)
      try {
        const res = await fetch('/api/youtube/normalize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: parsed }) })
        if (res.ok) { const d = await res.json(); if (d.items?.length) { setItems(d.items); setLang(`클립보드 정리됨 (${d.items.length}문장)`) } }
      } catch { /* 실패 시 원문 유지 */ } finally { setNormalizing(false) }
    } catch {
      setError('클립보드 접근 권한이 필요합니다. 브라우저 팝업에서 허용을 클릭하세요.')
    }
  }

  async function handleSaveBoth() {
    await Promise.allSettled([handleGithub(), handleNotion()])
  }

  async function handleTranslate() {
    if (!items.length) {
      setError('번역할 자막이 없습니다. 먼저 자막을 붙여넣거나 가져오세요.')
      return
    }
    setLoadingTranslate(true)
    setTranslateProgress(0)
    setTranslated([])
    setError('')
    setTab('동시보기')

    const CHUNK = 20
    const total = items.length
    const chunks: typeof items[] = []
    for (let i = 0; i < total; i += CHUNK) chunks.push(items.slice(i, i + CHUNK))

    const result: string[] = new Array(total).fill('')

    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci]
        const startIdx = ci * CHUNK

        const res = await fetch('/api/youtube/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk }),
        })

        let data: { translated?: string[]; error?: string }
        try { data = await res.json() }
        catch { data = { error: `HTTP ${res.status}` } }

        if (res.ok && data.translated?.length) {
          data.translated.forEach((t, k) => { result[startIdx + k] = t || chunk[k].text })
        } else {
          // 실패한 청크는 원문 유지
          chunk.forEach((item, k) => { result[startIdx + k] = item.text })
          // 429 Rate Limit 오류 표시
          if (res.status === 429 || data.error?.includes('rate')) {
            setError('⚠️ Groq 일일 번역 한도 초과. Cerebras로 재시도 중...')
          }
        }

        // 진행률 업데이트 및 현재까지 번역된 것 즉시 표시
        const done = Math.min(startIdx + chunk.length, total)
        setTranslateProgress(Math.round((done / total) * 100))
        setTranslated([...result])
      }
      // ── 번역 안 된 항목 재시도 ──
      const untranslatedIdx = items
        .map((item, i) => ({ item, i }))
        .filter(({ item, i }) => result[i] === item.text || !result[i])
        .map(({ i }) => i)

      if (untranslatedIdx.length > 0 && untranslatedIdx.length < total) {
        setError(`⚠️ ${untranslatedIdx.length}개 항목 번역 실패 → 재시도 중...`)
        // 실패 항목만 다시 번역 (청크로)
        const failedItems = untranslatedIdx.map(i => items[i])
        const failedChunks: typeof items[] = []
        for (let i = 0; i < failedItems.length; i += CHUNK) failedChunks.push(failedItems.slice(i, i + CHUNK))

        for (let ci = 0; ci < failedChunks.length; ci++) {
          const chunk = failedChunks[ci]
          const res2 = await fetch('/api/youtube/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: chunk }),
          })
          if (res2.ok) {
            const data2 = await res2.json()
            if (data2.translated?.length) {
              data2.translated.forEach((t: string, k: number) => {
                const origIdx = untranslatedIdx[ci * CHUNK + k]
                if (origIdx !== undefined && t && t !== chunk[k]?.text) {
                  result[origIdx] = t
                }
              })
              setTranslated([...result])
            }
          }
        }
        const stillFailed = items.filter((item, i) => result[i] === item.text || !result[i]).length
        setError(stillFailed > 0 ? `⚠️ ${stillFailed}개 항목은 번역되지 않았습니다 (API 한도 초과).` : '')
      } else if (untranslatedIdx.length === 0) {
        setError('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '번역에 실패했습니다.')
    } finally {
      setLoadingTranslate(false)
      setTranslateProgress(100)
    }
  }

  async function handleSummary() {
    if (!items.length) return
    setLoadingSummary(true)
    setError('')
    try {
      const res = await fetch('/api/youtube/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSummary(data.summary)
    } catch (e) {
      setError(e instanceof Error ? e.message : '요약에 실패했습니다.')
    } finally {
      setLoadingSummary(false)
    }
  }

  const TABS: Tab[] = ['동시보기', '원문', '번역', '한글요약']

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* Obsidian 설정 모달 */}
      {showObsidianSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 24px', maxWidth: 440, width: '100%' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b' }}>🗂 Obsidian Local REST API 설정</h3>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.7 }}>
              Obsidian Local REST API 플러그인이 필요합니다.<br/>
              플러그인 설정에서 Bearer Token을 확인하세요.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Bearer Token</label>
                <input value={obsidianToken} onChange={e => setObsidianToken(e.target.value)}
                  placeholder="ab69cae5c136ac11..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>포트 (기본: 27124)</label>
                <input value={obsidianPort} onChange={e => setObsidianPort(e.target.value)}
                  placeholder="27124"
                  style={{ width: 120, padding: '9px 12px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 13 }} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#f97316', marginTop: 12, lineHeight: 1.6 }}>
              ⚠️ 첫 사용 전 브라우저에서 <strong>https://127.0.0.1:{obsidianPort}</strong> 접속 후 인증서를 허용해야 합니다.
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowObsidianSettings(false)} style={{ padding: '8px 18px', background: '#F1F5F9', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer' }}>취소</button>
              <button onClick={saveObsidianSettings} style={{ padding: '8px 18px', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: '#fff', padding: '10px 22px', borderRadius: 10, fontSize: 13, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>▶ 유튜브 자막 보기</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="/youtube/notion" style={{ padding: '6px 14px', background: '#000', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>📓 Notion 목록</a>
          <a href="/youtube/obsidian" style={{ padding: '6px 14px', background: '#6d28d9', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>🗂 Obsidian 목록</a>
        </div>
      </div>

      {/* URL 입력 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          placeholder="YouTube URL 또는 영상 ID 입력"
          style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none' }}
        />
        <button onClick={handleFetch} disabled={loadingTranscript || !url.trim()} style={{
          padding: '10px 22px', background: '#DC2626', color: '#fff',
          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
          cursor: (loadingTranscript || !url.trim()) ? 'not-allowed' : 'pointer',
          opacity: (loadingTranscript || !url.trim()) ? 0.6 : 1,
          whiteSpace: 'nowrap',
        }}>
          {loadingTranscript ? '가져오는 중...' : '자막 가져오기'}
        </button>
        {/* 클립보드에서 가져오기 — python scripts/youtube_transcript.py 실행 후 클릭 */}
        <button
          onClick={handleReadClipboard}
          title="python scripts/youtube_transcript.py [URL] 실행 후 클릭"
          style={{
            padding: '10px 14px', background: '#1D9E75', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
            cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          📋 클립보드
        </button>
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 8 }}>
        📋 클립보드: <code>python scripts/youtube_transcript.py [URL]</code> 실행 후 클릭
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#DC2626', borderRadius: 8, fontSize: 13, marginBottom: 16, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {error}
          {noCaption && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #FECACA' }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: '#B91C1C' }}>🎙️ Whisper AI로 음성 인식 시도</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                자막이 없어도 Groq Whisper AI가 오디오를 직접 분석해 자막을 생성합니다.<br/>
                약 15분 이하 영상 지원 · 처리 시간 10~30초
              </div>
              <button
                onClick={handleWhisper}
                disabled={loadingWhisper}
                style={{
                  padding: '9px 20px', background: loadingWhisper ? '#e2e8f0' : '#7C3AED',
                  color: loadingWhisper ? '#94a3b8' : '#fff',
                  border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: loadingWhisper ? 'not-allowed' : 'pointer',
                }}
              >
                {loadingWhisper ? '🎙️ 음성 인식 중... (최대 30초)' : '🎙️ Whisper AI로 자막 생성'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 수동 자막 입력 (downsub 등에서 복사한 경우) */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowPasteInput(v => !v)}
          style={{
            padding: '6px 14px', background: 'none',
            border: '1.5px dashed #CBD5E1', borderRadius: 8,
            color: '#64748b', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          📋 {showPasteInput ? '자막 직접 입력 닫기' : 'downsub 등에서 자막 붙여넣기'}
        </button>

        {showPasteInput && (
          <div style={{ marginTop: 10, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
              <strong>① 아래 사이트에서 자막 추출 후 복사</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                <a
                  href={url ? `https://downsub.com/?url=${encodeURIComponent(url)}` : 'https://downsub.com'}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '5px 12px', background: '#1e293b', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}
                >
                  🔗 DownSub에서 열기
                </a>
                <a
                  href={url ? `https://lilys.ai/digest?sId=${url.match(/[a-zA-Z0-9_-]{11}/)?.[0] ?? ''}` : 'https://lilys.ai'}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '5px 12px', background: '#7C3AED', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}
                >
                  🔗 Lilys.ai에서 열기
                </a>
                <a
                  href={url ? `https://youtubetotranscript.com/?url=${encodeURIComponent(url)}` : 'https://youtubetotranscript.com'}
                  target="_blank" rel="noopener noreferrer"
                  style={{ padding: '5px 12px', background: '#0369A1', color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 11, fontWeight: 700 }}
                >
                  🔗 YouTubeToTranscript
                </a>
              </div>
              <div style={{ marginTop: 6 }}>② 추출된 자막 텍스트 전체 복사 → 아래 붙여넣기 (SRT/VTT/TXT 모두 지원)</div>
            </div>
            <textarea
              value={pasteText}
              onChange={async e => {
                const val = e.target.value
                setPasteText(val)
                if (val.trim().length > 0) {
                  const parsed = parseSubtitleText(val)
                  if (parsed.length > 0) {
                    // 1단계: 클라이언트 규칙 기반 즉시 합치기 (구두점 없으면 다음 줄과 합침)
                    const merged = mergeIntoSentences(parsed)
                    setItems(merged)
                    setTranslated([])
                    setSummary('')
                    setTab('원문')
                    setLang(`수동입력 (${merged.length}문장) — AI 정제 중...`)
                    setError('')
                    setNoCaption(false)

                    // 2단계: AI로 추가 정제 (비동기, API 실패해도 1단계 결과 유지)
                    setNormalizing(true)
                    try {
                      const res = await fetch('/api/youtube/normalize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: merged }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data.items?.length) {
                          setItems(data.items)
                          setLang(`정리됨 (${data.items.length}문장)`)
                        }
                      }
                    } catch { /* 실패 시 원문 유지 */ }
                    finally { setNormalizing(false) }
                  }
                } else {
                  setItems([])
                }
              }}
              placeholder="자막 텍스트를 여기에 붙여넣으면 원문 탭에 바로 표시됩니다."
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', border: 'none', outline: 'none',
                fontSize: 13, lineHeight: 1.7, fontFamily: 'monospace',
                resize: 'vertical', background: '#FAFAFA',
              }}
            />
            {items.length > 0 && pasteText && (
              <div style={{ padding: '8px 14px', background: '#D1FAE5', fontSize: 12, color: '#065F46', fontWeight: 600 }}>
                ✅ {items.length}줄 인식됨 — 원문 탭에서 확인하세요
              </div>
            )}
            <div style={{ padding: '8px 14px', background: '#F8FAFC', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPasteInput(false); setPasteText('') }}
                style={{ padding: '7px 16px', background: '#F1F5F9', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                닫기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 영상 정보 + 액션 버튼 — 항상 표시 */}
      <div style={{ marginBottom: 16 }}>
        {videoTitle && (
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>{videoTitle}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {items.length > 0 && (
            <span style={{ fontSize: 12, color: '#64748b', background: '#F1F5F9', padding: '4px 10px', borderRadius: 20 }}>
              총 {items.length}줄 · {lang}
            </span>
          )}
          <button onClick={() => { setTab('동시보기'); if (!translated.length && !loadingTranslate && items.length) handleTranslate() }}
            disabled={loadingTranslate || !items.length}
            style={{ padding: '7px 14px', background: (!items.length || loadingTranslate) ? '#e2e8f0' : '#0369A1', color: (!items.length || loadingTranslate) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: (!items.length || loadingTranslate) ? 'not-allowed' : 'pointer' }}>
            {loadingTranslate ? '번역 중...' : '한글 번역'}
          </button>
          <button onClick={() => { setTab('한글요약'); if (!summary && !loadingSummary && items.length) handleSummary() }}
            disabled={loadingSummary || !items.length}
            style={{ padding: '7px 14px', background: (!items.length || loadingSummary) ? '#e2e8f0' : '#1D9E75', color: (!items.length || loadingSummary) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: (!items.length || loadingSummary) ? 'not-allowed' : 'pointer' }}>
            {loadingSummary ? '요약 중...' : '한글 요약'}
          </button>
          {/* 저장 버튼 — 항상 표시, 자막 없으면 비활성 */}
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={handleNotion} disabled={savingNotion || !items.length} style={{ padding: '7px 14px', background: (savingNotion || !items.length) ? '#e2e8f0' : '#000', color: (savingNotion || !items.length) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: (savingNotion || !items.length) ? 'not-allowed' : 'pointer' }}>
              {savingNotion ? '저장 중...' : '📓 노션저장'}
            </button>
            <div style={{ display: 'flex', gap: 2 }}>
              <button onClick={handleGithub} disabled={savingGithub || !items.length} style={{ padding: '7px 12px', background: (savingGithub || !items.length) ? '#e2e8f0' : '#6d28d9', color: (savingGithub || !items.length) ? '#94a3b8' : '#fff', border: 'none', borderRadius: '8px 0 0 8px', fontWeight: 700, fontSize: 12, cursor: (savingGithub || !items.length) ? 'not-allowed' : 'pointer' }}>
                {savingGithub ? '...' : '🗂 옵시디언저장'}
              </button>
              <button onClick={() => setShowObsidianSettings(true)} style={{ padding: '7px 8px', background: '#5b21b6', color: '#fff', border: 'none', borderRadius: '0 8px 8px 0', fontSize: 11, cursor: 'pointer' }}>⚙️</button>
            </div>
            <button onClick={handleSaveBoth} disabled={savingNotion || savingGithub || !items.length} style={{ padding: '7px 14px', background: (savingNotion || savingGithub || !items.length) ? '#e2e8f0' : '#0369A1', color: (savingNotion || savingGithub || !items.length) ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: (savingNotion || savingGithub || !items.length) ? 'not-allowed' : 'pointer' }}>
              {(savingNotion || savingGithub) ? '저장 중...' : '💾 둘다저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 탭 — 통합 */}
      <>
        <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 0 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => {
              setTab(t)
              // 한글요약 탭 클릭 시 요약 없으면 자동 실행
              if (t === '한글요약' && !summary && !loadingSummary && items.length > 0) {
                handleSummary()
              }
              // 번역 탭 클릭 시 번역 없으면 자동 실행
              if (t === '번역' && !translated.length && !loadingTranslate && items.length > 0) {
                handleTranslate()
              }
            }} style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: tab === t ? 700 : 400, fontSize: 13,
              color: tab === t ? '#0369A1' : '#94a3b8',
              borderBottom: `2px solid ${tab === t ? '#0369A1' : 'transparent'}`,
              marginBottom: '-2px',
            }}>{t}</button>
          ))}
        </div>

        {/* 자막 없을 때 안내 */}
        {!items.length && !loadingTranscript && (
          <div style={{ height: 200, border: '1px solid #E2E8F0', borderTop: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14, flexDirection: 'column', gap: 8 }}>
            <span>YouTube URL을 입력하거나 자막을 붙여넣어 주세요</span>
            <span style={{ fontSize: 12 }}>📋 downsub 등에서 자막 붙여넣기 버튼 이용</span>
          </div>
        )}

        {/* 자막 있을 때 콘텐츠 */}
        {items.length > 0 && (
          <>
          {/* 원문 탭 */}
          {tab === '원문' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none' }}>
              {normalizing && (
                <div style={{ padding: '8px 16px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', fontSize: 12, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✍️ AI가 끊어진 문장을 완성된 문장으로 정리하는 중...</span>
                </div>
              )}
            <div style={{ height: normalizing ? 480 : 520, overflowY: 'auto' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 44, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>
                    {formatTime(item.start)}
                  </span>
                  <span style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{item.text}</span>
                </div>
              ))}
            </div>
            </div>
          )}

          {/* 번역 탭 */}
          {tab === '번역' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none' }}>
              {/* 진행률 바 */}
              {loadingTranslate && (
                <div style={{ padding: '10px 16px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#0369A1', marginBottom: 6, fontWeight: 600 }}>
                    <span>🔄 번역 중...</span>
                    <span>{translateProgress}% ({Math.round(items.length * translateProgress / 100)} / {items.length}줄)</span>
                  </div>
                  <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#0369A1', borderRadius: 3, width: `${translateProgress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              {/* 오류 표시 */}
              {error && !loadingTranslate && (
                <div style={{ padding: '10px 16px', background: '#FEF2F2', color: '#DC2626', fontSize: 12, borderBottom: '1px solid #FECACA' }}>
                  ⚠️ {error}
                </div>
              )}

              {translated.length === 0 && !loadingTranslate ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ marginBottom: 12 }}>번역 결과가 없습니다.</p>
                  <button onClick={handleTranslate} style={{ padding: '8px 20px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    번역 시작
                  </button>
                </div>
              ) : (
                <div style={{ height: 480, overflowY: 'auto' }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start', background: translated[i] ? '#fff' : '#FAFAFA' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 44, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>
                        {formatTime(item.start)}
                      </span>
                      {translated[i] ? (
                        <span style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{translated[i]}</span>
                      ) : (
                        <span style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, fontStyle: 'italic' }}>{item.text}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 동시보기 탭 — 단일 스크롤, 문장별 동일 높이 */}
          {tab === '동시보기' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', height: 520, display: 'flex', flexDirection: 'column' }}>

              {/* 번역 진행률 */}
              {loadingTranslate && (
                <div style={{ padding: '6px 12px', background: '#EFF8FF', borderBottom: '1px solid #BAE6FD', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#0369A1', marginBottom: 3, fontWeight: 600 }}>
                    <span>번역 중...</span>
                    <span>{translateProgress}% ({Math.round(items.length * translateProgress / 100)}/{items.length}줄)</span>
                  </div>
                  <div style={{ height: 3, background: '#DBEAFE', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#0369A1', width: `${translateProgress}%`, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

              {translated.length === 0 && !loadingTranslate ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#94a3b8' }}>
                  <p>먼저 한글 번역을 진행해주세요.</p>
                  <button onClick={handleTranslate} style={{ padding: '8px 20px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    번역 시작
                  </button>
                </div>
              ) : (
                /* ── 핵심: 하나의 스크롤 박스 안에 좌우 열 ── */
                <div style={{ flex: 1, overflowY: 'auto' }}>

                  {/* 고정 헤더 */}
                  <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 2 }}>
                    <div style={{ flex: 1, padding: '7px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#64748b' }}>원문</div>
                    <div style={{ flex: 1, padding: '7px 12px', background: '#EFF8FF', borderBottom: '1px solid #BAE6FD', fontSize: 11, fontWeight: 700, color: '#0369A1' }}>한글 번역</div>
                  </div>

                  {/* 문장 행 — 한 행 안에 원문·번역 → 높이 자동 일치 */}
                  {items.map((item, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      borderBottom: '1px solid #F1F5F9',
                      /* 중요: stretch로 양쪽 셀 높이 동기화 */
                      alignItems: 'stretch',
                    }}>
                      {/* 원문 셀 */}
                      <div style={{ flex: 1, display: 'flex', gap: 8, padding: '9px 12px', borderRight: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: 10, minWidth: 36, flexShrink: 0, paddingTop: 3, fontFamily: 'monospace', color: '#94a3b8' }}>
                          {formatTime(item.start)}
                        </span>
                        <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.7, flex: 1 }}>{item.text}</span>
                        <span style={{ fontSize: 11, color: '#CBD5E1', flexShrink: 0, paddingTop: 3, minWidth: 20, textAlign: 'right' }}>{i + 1}</span>
                      </div>
                      {/* 번역 셀 */}
                      <div style={{ flex: 1, display: 'flex', gap: 8, padding: '9px 12px', background: translated[i] ? '#fff' : '#FAFAFA' }}>
                        <span style={{ fontSize: 10, minWidth: 36, flexShrink: 0, paddingTop: 3, fontFamily: 'monospace', color: '#94a3b8' }}>
                          {formatTime(item.start)}
                        </span>
                        <span style={{ fontSize: 13, lineHeight: 1.7, color: translated[i] ? '#1e293b' : '#94a3b8', fontStyle: translated[i] ? 'normal' : 'italic' }}>
                          {translated[i] || item.text}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 한글요약 탭 */}
          {tab === '한글요약' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none', minHeight: 200 }}>
              {loadingSummary ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  ✍️ 요약 생성 중...
                </div>
              ) : summary ? (
                <div style={{ padding: '20px', fontSize: 14, color: '#1e293b', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                  {summary}
                </div>
              ) : (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ marginBottom: 12 }}>요약을 생성합니다.</p>
                  <button onClick={handleSummary} disabled={loadingSummary}
                    style={{ padding: '8px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    요약 생성
                  </button>
                </div>
              )}
            </div>
          )}
          </>
        )}
      </>
    </div>
  )
}
