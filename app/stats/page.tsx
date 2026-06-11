import Link from 'next/link'

const STAT_CARDS = [
  {
    href: '/stats/employment',
    icon: '👷',
    title: '취업 통계',
    desc: '월별 취업자·실업률·고용률·산업별 현황 (2024~2026)',
    badge: '국가통계포털',
    color: '#0369A1',
  },
]

export default function StatsPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f7ff' }}>
      <header style={{
        background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        color: '#fff', textAlign: 'center', padding: '48px 24px 36px',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 8 }}>통계 대시보드</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.82)' }}>
          국가통계포털(KOSIS) 데이터 기반 시각화
        </p>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          {STAT_CARDS.map(c => (
            <Link key={c.href} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{
                background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14,
                padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18,
                transition: 'box-shadow 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(3,105,161,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 12,
                  background: '#EFF8FF', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 24, flexShrink: 0,
                }}>{c.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{c.title}</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 10,
                      background: '#EFF8FF', color: c.color, fontWeight: 600,
                    }}>{c.badge}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>{c.desc}</div>
                </div>
                <span style={{ fontSize: 20, color: '#0369A1', flexShrink: 0 }}>›</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
