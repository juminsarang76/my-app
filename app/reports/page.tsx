'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Report {
  id: number
  date: string
  summary: string | null
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/reports')
      .then(r => r.json())
      .then(data => { setReports(data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleDelete(date: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`${date} 리포트를 삭제할까요?`)) return
    setDeleting(date)
    const res = await fetch('/api/reports', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    })
    if (res.ok) setReports(prev => prev.filter(r => r.date !== date))
    setDeleting(null)
  }

  return (
    <main style={{ maxWidth: 680, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 500, marginBottom: 8 }}>정기요약</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>
        양자뉴스 · 유튜브 · 요즘IT · Geeks 뉴스를 매일 오전 정리합니다.
      </p>

      {loading ? (
        <p style={{ color: '#888', fontSize: 14 }}>불러오는 중...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(report => (
            <div key={report.id} style={{ position: 'relative' }}>
              <Link href={`/reports/${report.date}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ padding: '16px 20px', paddingRight: 56, border: '1px solid #BAE6FD', borderRadius: 12, cursor: 'pointer', background: '#EFF8FF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>
                      정기요약 {report.date}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>{report.date}</div>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
                    {report.summary ? report.summary.slice(0, 100) + '...' : '내용 없음'}
                  </div>
                </div>
              </Link>

              {/* 삭제 버튼 */}
              <button
                onClick={(e) => handleDelete(report.date, e)}
                disabled={deleting === report.date}
                style={{
                  position: 'absolute', top: '50%', right: 12,
                  transform: 'translateY(-50%)',
                  background: deleting === report.date ? '#e2e8f0' : '#fee2e2',
                  border: 'none', borderRadius: 6,
                  color: '#ef4444', fontSize: 12, fontWeight: 700,
                  padding: '6px 10px', cursor: 'pointer',
                }}
              >
                {deleting === report.date ? '...' : '삭제'}
              </button>
            </div>
          ))}

          {reports.length === 0 && (
            <div style={{ fontSize: 14, color: '#888', textAlign: 'center', padding: '40px 0' }}>
              아직 리포트가 없습니다.
            </div>
          )}
        </div>
      )}
    </main>
  )
}
