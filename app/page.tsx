'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getStoredUser, setStoredUser, clearStoredUser, ALL_MENUS, isAdmin, AuthUser } from '@/app/lib/auth'

const SPECIAL_MENUS = [
  { key: 'minjun',  label: '민준입시', href: '/민준입시.html', desc: '민준 입시 정보' },
  { key: 'lecture', label: '강의',     href: '/강의.html',     desc: '강의 자료' },
  { key: 'mdjob',   label: 'MDjob',    href: '/mdjob',         desc: 'MD 취업준비 · 기업분석/VOC' },
  { key: 'articlemd', label: 'ArticleMD', href: '/articlemd',   desc: '마크다운 아티클 뷰어' },
]

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    setMounted(true)

    if (stored && isAdmin(stored.email)) {
      // admin: 항상 현재 ALL_MENUS 전체로 갱신 (새 메뉴 추가 시 자동 반영)
      const updatedUser = { ...stored, permissions: ALL_MENUS.map(m => m.key) }
      setStoredUser(updatedUser)
      setUser(updatedUser)
    } else {
      // 일반 유저: 기존 권한 그대로 승계 (Supabase에서 명시 부여된 권한만 유지)
      setUser(stored)
    }
  }, [])

  function handleLogout() {
    clearStoredUser()
    setUser(null)
  }

  const permittedMenus = user
    ? ALL_MENUS.filter(m => user.permissions.includes(m.key))
    : []

  if (!mounted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FFF7F0 0%, #EFF8FF 60%, #F0FFF4 100%)' }}>
      <div style={{ textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div>
        <div style={{ fontSize: 14 }}>Haru Flower</div>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: 'linear-gradient(160deg, #FFF7F0 0%, #EFF8FF 60%, #F0FFF4 100%)' }}>

      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px', borderBottom: '1px solid rgba(0,0,0,0.06)',
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 22 }}>🌸</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#0369A1' }}>Haru Flower</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <>
              <span style={{ fontSize: 13, color: '#64748b' }}>{user.name}님</span>
              {isAdmin(user.email) && (
                <Link href="/admin" style={{ fontSize: 12, padding: '5px 12px', background: '#1e293b', color: '#fff', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>관리자</Link>
              )}
              <button onClick={handleLogout} style={{ fontSize: 12, padding: '5px 12px', background: 'none', border: '1px solid #CBD5E1', borderRadius: 6, color: '#64748b', cursor: 'pointer' }}>로그아웃</button>
            </>
          ) : (
            <><Link href="/login" style={{ fontSize: 13, padding: "7px 16px", background: "none", border: "1px solid #CBD5E1", color: "#64748b", borderRadius: 8, textDecoration: "none", fontWeight: 600 }}>로그인</Link><Link href="/register" style={{ fontSize: 13, padding: "7px 16px", background: "#0369A1", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 700 }}>신청</Link></> 
          )}
        </div>
      </header>

      <section style={{ textAlign: 'center', padding: '60px 20px 40px' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🌸</div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>Haru Flower</h1>
        <p style={{ fontSize: 16, color: '#64748b', maxWidth: 480, margin: '0 auto 8px', lineHeight: 1.7 }}>하루 한 송이 꽃처럼, 매일 새로운 소식과 일상을 기록하는 공간</p>
        <p style={{ fontSize: 13, color: '#94a3b8' }}>AI 뉴스 요약 · 하루꽃 일기 · 상품 기획 · 중등부 찬양 선곡</p>
      </section>

      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 60px' }}>
        {!user ? (
          <div style={{ textAlign: 'center', padding: '20px 0 40px' }}>
            <Link href="/login" style={{ display: 'inline-block', padding: '13px 32px', background: '#0369A1', color: '#fff', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15, marginRight: 12 }}>로그인</Link>
            <Link href="/register" style={{ display: 'inline-block', padding: '13px 32px', background: 'none', border: '2px solid #0369A1', color: '#0369A1', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 15 }}>🌸 서비스 신청</Link>
          </div>
        ) : permittedMenus.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>권한 부여 대기 중</p>
            <p style={{ fontSize: 13 }}>관리자가 접근 권한을 부여하면 메뉴가 표시됩니다.</p>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#64748b', marginBottom: 20 }}>{user.name}님의 메뉴</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14 }}>
              {permittedMenus.map(menu => (
                <Link key={menu.key} href={menu.href} style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '22px 20px', background: '#fff', border: '1.5px solid #BAE6FD', borderRadius: 12, cursor: 'pointer' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>{menu.label}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{menu.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* 항상 표시 — 로그인 여부 무관 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 14, marginTop: user && permittedMenus.length > 0 ? 14 : 0 }}>
          {SPECIAL_MENUS.map(menu => (
            <Link key={menu.key} href={menu.href} style={{ textDecoration: 'none' }}>
              <div style={{ padding: '22px 20px', background: '#fff', border: '1.5px solid #BAE6FD', borderRadius: 12, cursor: 'pointer' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>{menu.label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{menu.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
