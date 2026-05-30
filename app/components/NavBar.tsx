'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/reports',       label: '정기요약' },
  { href: '/realtime',      label: '실시간요약' },
  { href: '/stocks',        label: '재무' },
  { href: '/',              label: '할 일' },
  { href: '/photos',        label: '사진' },
  { href: '/battery',       label: '배터리' },
  { href: '/민준입시.html', label: '민준입시' },
  { href: '/강의.html',     label: '강의' },
  { href: '/jinju',         label: '진주' },
  { href: '/jungdeung',     label: '중등부' },
  { href: '/products',      label: '상품' },
]

export default function NavBar() {
  const pathname = usePathname()
  if (pathname.startsWith('/jungdeung')) return null

  return (
    <nav style={{
      background: '#EFF8FF',
      padding: '12px 20px',
      fontFamily: 'sans-serif',
      display: 'flex',
      alignItems: 'center',
      gap: 24,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0369A1', flexShrink: 0 }}>
        My App
      </div>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none', padding: '6px 10px', borderRadius: 6 }}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
