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
} | null

const TABS = [
  { key: 'quantum_news', label: '양자뉴스' },
  { key: 'youtube_news', label: '유튜브' },
  { key: 'yozm_news', label: '요즘IT' },
  { key: 'geeks_news', label: 'Geeks' },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function RealtimePage() {
  const [report, setReport] = useState<Report>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('quantum_news')

  useEffect(() => {
    fetch('/api/realtime-report')
      .then(r => r.json())
      .then(data => {
        setReport(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleUpdate = async () => {
    setUpdating(true)
    setError(null)
    try {
      const res = await fetch('/api/realtime-report', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '업데이트에 실패했습니다.')
      } else if (data.report) {
        setReport(data.report)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setUpdating(false)
    }
  }

  const currentNews: NewsItem[] = report ? (report[activeTab] ?? []) : []

  return (
    <div style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 500 }}>실시간요약</h1>
        <button
          onClick={handleUpdate}
          disabled={updating}
          style={{
            padding: '8px 18px',
            background: updating ? '#aaa' : '#1D9E75',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            cursor: updating ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {updating ? '업데이트 중...' : '실시간 업데이트'}
        </button>
      </div>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 28 }}>
        버튼을 누르면 최신 뉴스를 수집·요약하고 카카오톡으로 전송합니다.
      </p>

      {error && (
        <div style={{ background: '#fff0f0', border: '1px solid #fcc', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#c00' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>불러오는 중...</p>
      ) : !report ? (
        <p style={{ color: '#aaa', fontSize: 14 }}>업데이트 버튼을 눌러 최신 뉴스를 가져오세요.</p>
      ) : (
        <>
          <div style={{ background: '#f8f8f8', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#888', marginBottom: 8 }}>전체 요약</div>
            <div style={{ fontSize: 14, lineHeight: 1.9, color: '#333', whiteSpace: 'pre-line' }}>
              {report.summary}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 16px',
                  border: '1px solid',
                  borderColor: activeTab === tab.key ? '#1D9E75' : '#ddd',
                  borderRadius: 20,
                  background: activeTab === tab.key ? '#1D9E75' : 'white',
                  color: activeTab === tab.key ? 'white' : '#555',
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentNews.map((item, i) => (
              <div key={i} style={{ padding: '14px 18px', border: '1px solid #eee', borderRadius: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111', marginBottom: 4, lineHeight: 1.5 }}>
                  {item.summary}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>{item.title}</div>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 12, color: '#1D9E75', textDecoration: 'none' }}
                  >
                    원문 보기 →
                  </a>
                )}
              </div>
            ))}
            {currentNews.length === 0 && (
              <p style={{ fontSize: 13, color: '#bbb' }}>뉴스가 없습니다.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
