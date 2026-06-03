'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser, isAdmin, ALL_MENUS } from '@/app/lib/auth'

interface HaruUser {
  id: string
  name: string
  email: string
  created_at: string
  permissions: string[]
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<HaruUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    const user = getStoredUser()
    if (!user || !isAdmin(user.email)) {
      router.push('/')
      return
    }
    setAdminEmail(user.email)
    loadUsers(user.email)
  }, [router])

  async function loadUsers(email: string) {
    const res = await fetch('/api/admin/users', { headers: { 'x-admin-email': email } })
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  async function togglePermission(userId: string, menuKey: string, currentlyGranted: boolean) {
    const method = currentlyGranted ? 'DELETE' : 'POST'
    await fetch('/api/admin/permissions', {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
      body: JSON.stringify({ user_id: userId, menu_key: menuKey }),
    })
    setUsers(prev => prev.map(u =>
      u.id !== userId ? u :
        currentlyGranted
          ? { ...u, permissions: u.permissions.filter(p => p !== menuKey) }
          : { ...u, permissions: [...u.permissions, menuKey] }
    ))
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>불러오는 중...</div>

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <span style={{ fontSize: 28 }}>🛡️</span>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Admin — 권한 관리</h1>
      </div>

      {users.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14 }}>신청한 사용자가 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {users.map(user => (
            <div key={user.id} style={{
              background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 12, padding: '20px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: '#EFF8FF', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 16,
                }}>👤</div>
                <div>
                  <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 15 }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>
                  {new Date(user.created_at).toLocaleDateString('ko-KR')} 가입
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALL_MENUS.map(menu => {
                  const granted = user.permissions.includes(menu.key)
                  return (
                    <button
                      key={menu.key}
                      onClick={() => togglePermission(user.id, menu.key, granted)}
                      style={{
                        padding: '6px 14px',
                        background: granted ? '#0369A1' : '#F1F5F9',
                        color: granted ? '#fff' : '#64748b',
                        border: 'none', borderRadius: 20,
                        fontSize: 12, fontWeight: granted ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {granted ? '✓ ' : ''}{menu.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
