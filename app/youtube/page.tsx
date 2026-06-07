'use client'

import { useEffect, useRef, useState } from 'react'

interface SubItem { text: string; start: number; duration: number }
type Tab = '원문' | '번역' | '동시보기' | '한글요약'

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
  const [tab, setTab] = useState<Tab>('원문')
  const [videoTitle, setVideoTitle] = useState('')
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [loadingTranslate, setLoadingTranslate] = useState(false)
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
      setError(msg)
      // 자막 없는 영상이면 Whisper 옵션 표시
      if (msg.includes('비활성화') || msg.includes('disabled') || msg.includes('CC')) {
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

  // 수동 붙여넣기 처리
  function handlePasteSubmit() {
    const raw = pasteText.trim()
    if (!raw) return
    const parsed = parseSubtitleText(raw)
    if (!parsed.length) {
      alert('자막을 인식하지 못했습니다.\nSRT, VTT, 또는 일반 텍스트 형식을 붙여넣어 주세요.')
      return
    }
    setItems(parsed)
    setTranslated([])
    setSummary('')
    setTab('원문')
    setShowPasteInput(false)
    setPasteText('')
    setError('')
    setNoCaption(false)
    setLang(`수동입력 (${parsed.length}줄)`)
  }

  // 둘다 저장
  async function handleSaveBoth() {
    await Promise.allSettled([handleGithub(), handleNotion()])
  }

  async function handleTranslate() {
    if (!items.length) return
    setLoadingTranslate(true)
    setError('')
    try {
      const res = await fetch('/api/youtube/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTranslated(data.translated)
      setTab('번역')
    } catch (e) {
      setError(e instanceof Error ? e.message : '번역에 실패했습니다.')
    } finally {
      setLoadingTranslate(false)
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

  const TABS: Tab[] = ['원문', '번역', '동시보기', '한글요약']

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
              onChange={e => setPasteText(e.target.value)}
              placeholder={'SRT, VTT, 또는 일반 텍스트 형식으로 붙여넣기...\n\n예시 (SRT):\n1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,000\nThis is a test'}
              rows={8}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px', border: 'none', outline: 'none',
                fontSize: 12, lineHeight: 1.6, fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
            <div style={{ padding: '10px 14px', background: '#F8FAFC', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPasteInput(false); setPasteText('') }}
                style={{ padding: '7px 16px', background: '#F1F5F9', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}>
                취소
              </button>
              <button onClick={handlePasteSubmit} disabled={!pasteText.trim()}
                style={{ padding: '7px 16px', background: pasteText.trim() ? '#0369A1' : '#e2e8f0', color: pasteText.trim() ? '#fff' : '#94a3b8', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: pasteText.trim() ? 'pointer' : 'not-allowed' }}>
                자막 불러오기
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
          <button onClick={() => { setTab('번역'); if (!translated.length && !loadingTranslate && items.length) handleTranslate() }}
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
            <div style={{ height: 520, overflowY: 'auto', border: '1px solid #E2E8F0', borderTop: 'none' }}>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 44, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>
                    {formatTime(item.start)}
                  </span>
                  <span style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{item.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* 번역 탭 */}
          {tab === '번역' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none' }}>
              {translated.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ marginBottom: 12 }}>번역 결과가 없습니다.</p>
                  <button onClick={handleTranslate} disabled={loadingTranslate} style={{ padding: '8px 20px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    {loadingTranslate ? '번역 중...' : '지금 번역하기'}
                  </button>
                </div>
              ) : (
                <div style={{ height: 520, overflowY: 'auto' }}>
                  {items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 16px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 44, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>
                        {formatTime(item.start)}
                      </span>
                      <span style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.6 }}>{translated[i] || item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 동시보기 탭 */}
          {tab === '동시보기' && (
            <div style={{ border: '1px solid #E2E8F0', borderTop: 'none' }}>
              {translated.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <p style={{ marginBottom: 12 }}>먼저 한글 번역을 진행해주세요.</p>
                  <button onClick={handleTranslate} disabled={loadingTranslate} style={{ padding: '8px 20px', background: '#0369A1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                    {loadingTranslate ? '번역 중...' : '번역하기'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 520 }}>
                  {/* 왼쪽: 원문 */}
                  <div
                    ref={leftRef}
                    onScroll={onLeftScroll}
                    style={{ overflowY: 'auto', borderRight: '1px solid #E2E8F0' }}
                  >
                    <div style={{ padding: '8px 12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: 11, fontWeight: 700, color: '#64748b', position: 'sticky', top: 0 }}>
                      원문
                    </div>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 12px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 38, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>{formatTime(item.start)}</span>
                        <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                  {/* 오른쪽: 번역 */}
                  <div
                    ref={rightRef}
                    onScroll={onRightScroll}
                    style={{ overflowY: 'auto' }}
                  >
                    <div style={{ padding: '8px 12px', background: '#EFF8FF', borderBottom: '1px solid #BAE6FD', fontSize: 11, fontWeight: 700, color: '#0369A1', position: 'sticky', top: 0 }}>
                      한글 번역
                    </div>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, padding: '9px 12px', borderBottom: '1px solid #F1F5F9', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 38, flexShrink: 0, paddingTop: 2, fontFamily: 'monospace' }}>{formatTime(item.start)}</span>
                        <span style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6 }}>{translated[i] || ''}</span>
                      </div>
                    ))}
                  </div>
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
