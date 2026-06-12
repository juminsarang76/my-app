import Link from 'next/link'

// 마크다운 아티클 뷰어 — ArticleMD
const ARTICLES = [
  { href: '/MD/AI주도자_조직전환전략.md', icon: '🤖', title: 'AI는 도구가 아닌 주도자다', desc: '기업 리더가 지금 설계해야 할 조직 전환 전략 · 경희대 김상윤 교수 강의 기반' },
  { href: '/MD/AI리터러시_AI리더십전략.md', icon: '📚', title: 'AI 리터러시가 기업 생존을 결정한다', desc: 'AI 리더십 전략 · 경희대 김상윤 교수 / 한국AI리터러시아카데미 원장' },
  { href: '/MD/반도체트렌드.md', icon: '🔬', title: '반도체 패권 전쟁의 현주소', desc: '기술·시장·지정학 트렌드 · 고려대 신창환 교수 강의 기반' },
]

export default function ArticleMdPage() {
  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f7ff' }}>
      <header style={{
        background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        color: '#fff', textAlign: 'center', padding: '44px 24px 34px',
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>ArticleMD</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>마크다운 아티클 뷰어</p>
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '36px 20px 80px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ARTICLES.map(a => (
            <a key={a.href} href={a.href} target="_blank" rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 16, background: '#fff',
                border: '1px solid #BAE6FD', borderRadius: 14, padding: '18px 22px',
                textDecoration: 'none', color: 'inherit',
              }}>
              <span style={{ width: 44, height: 44, borderRadius: 10, background: '#EFF8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{a.icon}</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{a.title}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{a.desc}</span>
              </span>
              <span style={{ fontSize: 18, color: '#0369A1', flexShrink: 0 }}>›</span>
            </a>
          ))}
        </div>

        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <Link href="/mdjob" style={{ fontSize: 13, color: '#1D9E75', textDecoration: 'none' }}>
            🛍️ MD 취업준비 툴 바로가기 →
          </Link>
        </div>
      </main>
    </div>
  )
}
