import Link from 'next/link'

export default function GardenPage() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 860, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>가든 🌿</h1>
      <p style={{ color: '#64748b', marginBottom: 36, fontSize: 14 }}>나만의 꽃 정원</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        <Link
          href="/garden/flower"
          style={{
            display: 'block', padding: '28px 24px',
            background: '#FFF7F0', border: '2px solid #FED7AA',
            borderRadius: 14, textDecoration: 'none',
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 10 }}>🌸</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#EA580C', marginBottom: 4 }}>하루꽃</div>
          <div style={{ fontSize: 13, color: '#FB923C' }}>오늘의 꽃 사진과 메시지를 기록하고 친구에게 보내요</div>
        </Link>
      </div>
    </div>
  )
}
