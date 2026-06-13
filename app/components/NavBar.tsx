'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getStoredUser, setStoredUser, fetchFreshUser, AuthUser, ALL_MENUS, isAdmin } from '@/app/lib/auth'

export default function NavBar() {
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored) { setUser(null); return }
    // 낙관적 표시 후 서버 최신 권한으로 교체 (관리자 권한 변경 즉시 반영)
    setUser(stored)
    fetchFreshUser(stored).then(fresh => {
      setStoredUser(fresh)
      setUser(fresh)
    })
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

  // admin은 항상 전체 / 일반 유저는 부여된 권한만
  const permittedMenus = user
    ? isAdmin(user.email)
      ? [...ALL_MENUS]
      : ALL_MENUS.filter(m => user.permissions.includes(m.key))
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
      </div>
    </nav>
  )
}
