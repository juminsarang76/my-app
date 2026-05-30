import Link from 'next/link'
import { getAllPraiseDates } from '@/app/lib/praise'

export default function JungdeungPage() {
  const weeks = getAllPraiseDates()
  const latest = weeks[0]

  return (
    <div style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>중등부</h1>
      <p style={{ color: '#64748b', marginBottom: 36, fontSize: 14 }}>중등부 프로그램 자료 모음</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <Link
          href="/jungdeung/praise"
          style={{
            display: 'block',
            padding: '24px',
            background: '#EFF8FF',
            border: '2px solid #BAE6FD',
            borderRadius: 14,
            textDecoration: 'none',
            transition: 'border-color 0.15s',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>찬양 선곡</div>
          <div style={{ fontSize: 13, color: '#0ea5e9', marginBottom: 12 }}>매주 일요일 선정되는 찬양 5곡</div>
          {latest && (
            <div style={{
              display: 'inline-block',
              background: '#DBEAFE',
              color: '#1D4ED8',
              fontSize: 11,
              fontWeight: 600,
              padding: '3px 10px',
              borderRadius: 20,
            }}>
              최신: {latest.displayDate}
            </div>
          )}
        </Link>
      </div>
    </div>
  )
}
