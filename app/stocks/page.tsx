import Link from 'next/link'

type Card = {
  href: string
  icon: string
  title: string
  desc: string
}

const CARDS: Card[] = [
  {
    href: '/stocks/market',
    icon: '📊',
    title: '지수',
    desc: '미국/한국 증시 지수, 환율, IONQ — TradingView 연동',
  },
  {
    href: '/stocks/portfolio',
    icon: '💼',
    title: '주식 리스트',
    desc: '워치리스트 종목별 차트 (IONQ, RDW, 삼성전자 등) · 드래그 순서 변경',
  },
  {
    href: '/stocks/kiwoom',
    icon: '🏦',
    title: '키움증권',
    desc: 'REST OpenAPI 연동 · 종목 시세 · 매수 / 매도 주문 (모의투자 기본)',
  },
]

export default function FinanceHubPage() {
  return (
    <main style={{ maxWidth: 680, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: 28 }}>재무</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                padding: '22px 24px',
                border: '1px solid #BAE6FD',
                borderRadius: 14,
                background: '#EFF8FF',
                cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 10 }}>{c.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#0369A1', marginBottom: 6 }}>
                {c.title}
              </div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  )
}
