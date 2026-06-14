'use client'
import { useState } from 'react'
import Link from 'next/link'

interface Score {
  source: 'praise' | 'naver' | 'none'
  sheetImageUrl?: string
  chordChart?: string
  youtubeId?: string
  searchUrl: string
}
interface Worship {
  scripture: string
  hymn: string
  scriptureText: string
  openingPrayer: string
  background: string
  guide: string[]
  closingPrayer: string
  score: Score
  provider: string
  error?: string
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#15803D', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

export default function WorshipPage() {
  const [scripture, setScripture] = useState('')
  const [hymn, setHymn] = useState('')
  const [loading, setLoading] = useState(false)
  const [w, setW] = useState<Worship | null>(null)
  const [error, setError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [kakaoMsg, setKakaoMsg] = useState('')

  async function generate() {
    if (!scripture.trim() || !hymn.trim() || loading) return
    setLoading(true); setError(''); setW(null); setSaveMsg(''); setKakaoMsg('')
    try {
      const res = await fetch('/api/jungdeung/worship/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scripture: scripture.trim(), hymn: hymn.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `오류 ${res.status}`)
      setW(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!w) return
    setSaveMsg('저장 중…')
    try {
      const res = await fetch('/api/jungdeung/worship/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      })
      const d = await res.json()
      setSaveMsg(res.ok && !d.error ? '✓ 저장 완료' : `저장 실패: ${d.error}`)
    } catch (e) { setSaveMsg(`저장 실패: ${(e as Error).message}`) }
  }

  async function sendKakao() {
    if (!w) return
    setKakaoMsg('전송 중…')
    try {
      const res = await fetch('/api/jungdeung/worship/kakao', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      })
      const d = await res.json()
      setKakaoMsg(res.ok && !d.error ? '✓ 카카오 전달 완료 (말씀·악보)' : `전송 실패: ${d.error}`)
    } catch (e) { setKakaoMsg(`전송 실패: ${(e as Error).message}`) }
  }

  const btn = (bg: string): React.CSSProperties => ({
    padding: '10px 20px', background: bg, color: '#fff', border: 'none',
    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  })

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0fdf4' }}>
      <header style={{ background: 'linear-gradient(135deg,#15803d,#22c55e)', color: '#fff', padding: '36px 24px 28px' }}>
        <Link href="/jungdeung" style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>← 교회</Link>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 12, marginBottom: 6 }}>🙏 가정예배</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>주일 저녁 온 가족이 함께 드리는 예배 순서를 자동으로 만들어 드립니다.</p>
      </header>

      <main style={{ maxWidth: 760, margin: '0 auto', padding: '28px 20px 80px' }}>
        {/* 입력 */}
        <div style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              성경구절 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input value={scripture} onChange={e => setScripture(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="예: 시편 23편, 요한복음 3:16, 빌립보서 4:4-7"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #BBF7D0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
              찬송 <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>곡명 또는 찬송가 (예: 주님 한 분만으로 / 내게 강 같은 평화)</span>
            </label>
            <input value={hymn} onChange={e => setHymn(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generate()}
              placeholder="예: 내게 강 같은 평화"
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #BBF7D0', borderRadius: 10, fontSize: 14, outline: 'none' }} />
          </div>
          <button onClick={generate} disabled={loading || !scripture.trim() || !hymn.trim()}
            style={btn(loading ? '#94a3b8' : '#15803d')}>
            {loading ? '예배 순서 생성 중…' : '🙏 예배 순서 생성'}
          </button>
        </div>

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#9f1239', fontSize: 13, marginBottom: 20 }}>
            오류: {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 14 }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🕊️</div>예배 순서를 준비하고 있습니다…
          </div>
        )}

        {w && !loading && (
          <>
            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={save} style={btn('#0369A1')}>💾 저장</button>
              <button onClick={sendKakao} style={btn('#FAE100')}>
                <span style={{ color: '#3A1D1D' }}>💬 카카오 전달 (말씀·악보)</span>
              </button>
              {saveMsg && <span style={{ fontSize: 12, color: '#475569' }}>{saveMsg}</span>}
              {kakaoMsg && <span style={{ fontSize: 12, color: '#475569' }}>{kakaoMsg}</span>}
              {w.provider && <span style={{ fontSize: 10, marginLeft: 'auto', padding: '2px 8px', borderRadius: 10, background: '#DCFCE7', color: '#166534' }}>{w.provider} 생성</span>}
            </div>

            <Section icon="1️⃣" title="시작 기도">
              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{w.openingPrayer}</p>
            </Section>

            <Section icon="2️⃣" title={`성경구절 — ${w.scripture}`}>
              {w.scriptureText
                ? <p style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.8, fontStyle: 'italic', whiteSpace: 'pre-wrap' }}>“{w.scriptureText}”</p>
                : <p style={{ fontSize: 13, color: '#94a3b8' }}>본문을 성경에서 함께 펴서 읽으세요.</p>}
            </Section>

            <Section icon="3️⃣" title={`찬송 — ${w.hymn}`}>
              {w.score.sheetImageUrl ? (
                <div>
                  <img src={w.score.sheetImageUrl} alt={`${w.hymn} 악보`}
                    style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                    {w.score.source === 'praise' ? '찬양 자료실 악보' : '네이버 이미지 검색 악보'} ·{' '}
                    <a href={w.score.searchUrl} target="_blank" rel="noreferrer" style={{ color: '#16a34a' }}>다른 악보 찾기 ↗</a>
                  </div>
                </div>
              ) : (
                <a href={w.score.searchUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#16a34a' }}>
                  🔎 “{w.hymn}” 악보 검색하기 ↗
                </a>
              )}
              {w.score.youtubeId && (
                <div style={{ marginTop: 12, position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${w.score.youtubeId}`}
                    title={w.hymn} allowFullScreen
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} />
                </div>
              )}
              {w.score.chordChart && (
                <pre style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', fontSize: 12, color: '#334155', overflowX: 'auto', whiteSpace: 'pre' }}>{w.score.chordChart}</pre>
              )}
            </Section>

            <Section icon="4️⃣" title="말씀 배경">
              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{w.background}</p>
            </Section>

            <Section icon="5️⃣" title="말씀 나눔 가이드">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(w.guide ?? []).map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#DCFCE7', color: '#166534', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                    <span style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>{q}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section icon="6️⃣" title="맺음 기도">
              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{w.closingPrayer}</p>
            </Section>
          </>
        )}
      </main>
    </div>
  )
}
