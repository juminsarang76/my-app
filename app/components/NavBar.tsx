'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getStoredUser, AuthUser, ALL_MENUS } from '@/app/lib/auth'

// 권한 불필요한 특수 링크 (항상 표시)
const SPECIAL_LINKS = [
  { href: '/민준입시.html', label: '민준입시', key: 'minjun' },
  { href: '/강의.html',     label: '강의',     key: 'lecture' },
]

export default function NavBar() {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [pathname])

  // 이 경로들은 자체 헤더가 있어 NavBar 숨김
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/youtube') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/jungdeung') ||
    pathname.startsWith('/products') ||
    pathname.startsWith('/garden')
  ) return null

  const permittedMenus = user
    ? ALL_MENUS.filter(m => user.permissions.includes(m.key))
    : []

  return (
    <nav style={{
      background: '#EFF8FF', padding: '10px 20px',
      fontFamily: 'sans-serif', display: 'flex',
      alignItems: 'center', gap: 20, flexWrap: 'wrap',
    }}>
      <Link href="/" style={{ fontSize: 14, fontWeight: 800, color: '#0369A1', textDecoration: 'none', flexShrink: 0 }}>
        🌸 Haru Flower
      </Link>
      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', flex: 1 }}>
        {permittedMenus.map(m => (
          <Link key={m.key} href={m.href}
            style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none', padding: '5px 10px', borderRadius: 6 }}>
            {m.label}
          </Link>
        ))}
        {SPECIAL_LINKS.map(l => (
          <Link key={l.key} href={l.href}
            style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none', padding: '5px 10px', borderRadius: 6 }}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
