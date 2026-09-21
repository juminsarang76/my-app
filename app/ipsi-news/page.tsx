'use client'

import { useEffect, useState } from 'react'

type Item = {
  title: string
  link: string
  pubDate: string
  press: string
  summary: string
  tags: string[]
  alsoReported?: string[]
}

type SendState = { ok: boolean; at: string; label: string; error?: string }

type Digest = {
  date: string
  summary: string
  quantum_news: Item[]   // reports 테이블 공용 사용 — ipsi_ 행에서는 입시뉴스가 여기 담긴다
  created_at?: string
  lastSend?: SendState | null
}

// 태그별 색 — 판단이 갈리는 유리/불리만 강조하고 나머지는 중립으로 둔다
const TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  유리: { bg: '#DCFCE7', fg: '#15803D' },
  불리: { bg: '#FEE2E2', fg: '#B91C1C' },
  결정: { bg: '#FEF3C7', fg: '#B45309' },
  통계: { bg: '#E0F2FE', fg: '#0369A1' },
  분석: { bg: '#E0F2FE', fg: '#0369A1' },
}

function formatDate(key: string) {
  return key.replace('ipsi_', '')
}

export default function IpsiNewsPage() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    fetch('/api/admission-news/daily', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setDigest(d && d.date ? d : null))
      .catch(() => setDigest(null))
      .finally(() => setLoading(false))
  }, [])

  const handleSendKakao = async () => {
    if (!digest) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/send-kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: '오늘 입시뉴스',
          date: formatDate(digest.date),
          summary: digest.summary,
          link: digest.quantum_news?.[0]?.link ?? '',
        }),
      })
      setSendResult(res.ok ? 'success' : 'error')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
    }
  }

  const items = digest?.quantum_news ?? []

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>오늘 입시뉴스</h1>
        <button
          onClick={handleSendKakao}
          disabled={sending || !digest}
          style={{
            padding: '8px 18px',
            background: sending || !digest ? '#aaa' : '#FEE500',
            color: sending || !digest ? 'white' : '#3C1E1E',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: sending || !digest ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '전송 중...' : '카카오톡 전송'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
        2027학년도 대입 뉴스를 매일 밤 10시에 수집·요약합니다.
        {digest && <> · 기준 <b style={{ color: '#0369A1' }}>{formatDate(digest.date)}</b></>}
      </p>

      {sendResult === 'success' && (
        <div style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0284C7' }}>
          카카오톡으로 전송했습니다.
        </div>
      )}
      {sendResult === 'error' && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          전송에 실패했습니다. 카카오 토큰이 만료됐을 수 있습니다.
        </div>
      )}

      {/* 자동 발송이 실패하면 아무도 모른 채 며칠이 지나므로 화면에 남긴다 */}
      {digest?.lastSend && !digest.lastSend.ok && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400E' }}>
          마지막 자동 발송이 실패했습니다 — {digest.lastSend.label || '카카오톡 전송'} ·{' '}
          {new Date(digest.lastSend.at).toLocaleString('ko-KR')}
          {digest.lastSend.error && (
            <div style={{ marginTop: 4, fontSize: 12, color: '#B45309', wordBreak: 'break-all' }}>
              {digest.lastSend.error.slice(0, 160)}
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: '#94a3b8', fontSize: 14 }}>불러오는 중…</p>}

      {!loading && !digest && (
        <div style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '20px', fontSize: 14, color: '#475569' }}>
          아직 수집된 뉴스가 없습니다. 매일 밤 10시에 자동으로 채워집니다.
        </div>
      )}

      {digest && (
        <>
          <div style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 10, padding: '16px 18px', marginBottom: 24, fontSize: 14, lineHeight: 1.75, color: '#0C4A6E' }}>
            {digest.summary}
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {items.map((n, i) => (
              <li key={i} style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                  {(n.tags ?? []).map(t => {
                    const s = TAG_STYLE[t] ?? { bg: '#E2E8F0', fg: '#475569' }
                    return (
                      <span key={t} style={{ background: s.bg, color: s.fg, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        {t}
                      </span>
                    )
                  })}
                </div>
                <a
                  href={n.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 15, fontWeight: 600, color: '#0369A1', textDecoration: 'none', lineHeight: 1.5 }}
                >
                  {n.title}
                </a>
                {n.press && (
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                    {n.press}
                    {n.alsoReported?.length ? ` · 외 ${n.alsoReported.length}개 매체` : ''}
                  </div>
                )}
                {n.summary && (
                  <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: '8px 0 0' }}>{n.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
