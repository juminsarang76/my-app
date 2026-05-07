'use client'

import { useEffect, useState } from 'react'

type NewsItem = {
  title: string
  link: string
  pubDate: string
  summary: string
}

type Report = {
  date: string
  summary: string
  quantum_news: NewsItem[]
  youtube_news: NewsItem[]
  yozm_news: NewsItem[]
  geeks_news: NewsItem[]
}

const CATEGORIES = [
  { key: 'quantum_news', label: '양자뉴스' },
  { key: 'youtube_news', label: '유튜브' },
  { key: 'yozm_news', label: '요즘IT' },
  { key: 'geeks_news', label: 'Geeks' },
] as const

export default function RealtimePage() {
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    fetch('/api/realtime-report', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.error) setFetchError(data.error)
        else if (data.report) setReport(data.report)
      })
      .catch(() => setFetchError('뉴스 수집 중 오류가 발생했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const handleSendKakao = async () => {
    if (!report) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/send-kakao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: report.summary, date: report.date }),
      })
      setSendResult(res.ok ? 'success' : 'error')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>실시간요약</h1>
        <button
          onClick={handleSendKakao}
          disabled={sending || !report}
          style={{
            padding: '8px 18px',
            background: sending || !report ? '#aaa' : '#FEE500',
            color: sending || !report ? 'white' : '#3C1E1E',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            cursor: sending || !report ? 'not-allowed' : 'pointer',
          }}
        >
          {sending ? '전송 중...' : '카카오톡 전송'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>
        페이지 진입 시 자동으로 최신 뉴스를 수집합니다.
      </p>

      {sendResult === 'success' && (
        <div style={{ background: '#EFF8FF', border: '1px solid #BAE6FD', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#0284C7' }}>
          카카오톡으로 전송됐습니다.
        </div>
      )}
      {sendResult === 'error' && (
        <div style={{ background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c00' }}>
          카카오톡 전송에 실패했습니다.
        </div>
      )}

      {loading ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>뉴스를 수집하고 있습니다...</p>
      ) : fetchError ? (
        <p style={{ color: '#c00', fontSize: 14 }}>{fetchError}</p>
      ) : !report ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>데이터를 불러오지 못했습니다.</p>
      ) : (
        <>
          <div style={{ background: '#EFF8FF', borderRadius: 12, padding: '16px 20px', marginBottom: 32 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 8 }}>전체 요약</div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: '#333', whiteSpace: 'pre-line' }}>
              {report.summary}
            </div>
          </div>

          {CATEGORIES.map(cat => {
            const items: NewsItem[] = report[cat.key] ?? []
            return (
              <section key={cat.key} style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>{cat.label}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((news, i) => (
                    <div key={i} style={{ padding: '14px 18px', border: '1px solid #eee', borderRadius: 10 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 4, lineHeight: 1.5 }}>
                        {news.summary}
                      </div>
                      {news.link ? (
                        <a
                          href={news.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: '#999', textDecoration: 'none' }}
                        >
                          {news.title}
                        </a>
                      ) : (
                        <div style={{ fontSize: 12, color: '#999' }}>{news.title}</div>
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p style={{ fontSize: 13, color: '#bbb', padding: '4px 0' }}>뉴스가 없습니다.</p>
                  )}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}
