'use client'

import { useRef, useState } from 'react'

interface SubItem { text: string; start: number; duration: number }
type Tab = '원문' | '번역' | '동시보기'

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
  const [loadingTranscript, setLoadingTranscript] = useState(false)
  const [loadingTranslate, setLoadingTranslate] = useState(false)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingWhisper, setLoadingWhisper] = useState(false)
  const [error, setError] = useState('')
  const [lang, setLang] = useState('')
  const [noCaption, setNoCaption] = useState(false)  // 자막 없는 영상 여부

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

  const TABS: Tab[] = ['원문', '번역', '동시보기']

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
        ▶ 유튜브 자막 보기
      </h1>

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

      {/* 영상 정보 + 액션 버튼 */}
      {items.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748b', background: '#F1F5F9', padding: '4px 10px', borderRadius: 20 }}>
            총 {items.length}줄 · 언어: {lang}
          </span>
          <button onClick={handleTranslate} disabled={loadingTranslate} style={{
            padding: '7px 16px', background: loadingTranslate ? '#e2e8f0' : '#0369A1',
            color: loadingTranslate ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8,
            fontWeight: 600, fontSize: 13, cursor: loadingTranslate ? 'not-allowed' : 'pointer',
          }}>
            {loadingTranslate ? '번역 중...' : '한글 번역'}
          </button>
          <button onClick={handleSummary} disabled={loadingSummary} style={{
            padding: '7px 16px', background: loadingSummary ? '#e2e8f0' : '#1D9E75',
            color: loadingSummary ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8,
            fontWeight: 600, fontSize: 13, cursor: loadingSummary ? 'not-allowed' : 'pointer',
          }}>
            {loadingSummary ? '요약 중...' : '한글 요약'}
          </button>
        </div>
      )}

      {/* 탭 */}
      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', borderBottom: '2px solid #E2E8F0', marginBottom: 0 }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: tab === t ? 700 : 400, fontSize: 13,
                color: tab === t ? '#0369A1' : '#94a3b8',
                borderBottom: `2px solid ${tab === t ? '#0369A1' : 'transparent'}`,
                marginBottom: '-2px',
              }}>{t}</button>
            ))}
          </div>

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

          {/* 요약 */}
          {summary && (
            <div style={{ marginTop: 20, padding: '20px', background: '#E0F2FE', borderRadius: 12, border: '1px solid #BAE6FD' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369A1', marginBottom: 10 }}>📋 한글 요약</div>
              <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{summary}</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
