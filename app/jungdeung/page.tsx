import Link from 'next/link'
import { getAllPraiseDates } from '@/app/lib/praise'

export default function JungdeungPage() {
  const weeks = getAllPraiseDates()
  const latest = weeks[0]

  return (
    <div style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>교회</h1>
      <p style={{ color: '#64748b', marginBottom: 36, fontSize: 14 }}>교회 프로그램 자료 모음</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        <Link
          href="/jungdeung/praise"
          style={{
            display: 'block', padding: '24px', background: '#EFF8FF',
            border: '2px solid #BAE6FD', borderRadius: 14, textDecoration: 'none',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎵</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>찬양 선곡</div>
          <div style={{ fontSize: 13, color: '#0ea5e9', marginBottom: 12 }}>매주 일요일 선정되는 찬양 5곡</div>
          {latest && (
            <div style={{
              display: 'inline-block', background: '#DBEAFE', color: '#1D4ED8',
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            }}>
              최신: {latest.displayDate}
            </div>
          )}
        </Link>

        <Link
          href="/jungdeung/worship"
          style={{
            display: 'block', padding: '24px', background: '#F0FDF4',
            border: '2px solid #BBF7D0', borderRadius: 14, textDecoration: 'none',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>🙏</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#15803D', marginBottom: 4 }}>가정예배</div>
          <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 12 }}>주일 저녁 가정예배 순서를 자동 생성</div>
          <div style={{
            display: 'inline-block', background: '#DCFCE7', color: '#166534',
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          }}>
            성경구절·찬송 입력 → 예배 순서 생성
          </div>
        </Link>
      </div>
    </div>
  )
}
