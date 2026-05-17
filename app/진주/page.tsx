import Link from 'next/link'

const ITEMS = [
  {
    href: '/진주/패션조사',
    icon: '👗',
    title: '패션 조사',
    desc: '2026 중학교 여학생 패션 아이템 추천',
  },
]

export default function JinjuPage() {
  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: '#111' }}>진주</h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 32 }}>진주를 위한 자료 모음</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {ITEMS.map(item => (
          <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              background: '#EFF8FF', border: '1px solid #BAE6FD',
              borderRadius: 14, padding: '18px 22px', cursor: 'pointer',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{item.desc}</div>
              </div>
              <span style={{ fontSize: 18, color: '#0369A1' }}>›</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
