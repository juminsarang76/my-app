'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getStoredUser, isAdmin, ALL_MENUS } from '@/app/lib/auth'

interface HaruUser {
  id: string; name: string; email: string
  role: string; status: string; created_at: string; permissions: string[]
}

type Tab = 'pending' | 'approved' | 'rejected'

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<HaruUser[]>([])
  const [loading, setLoading] = useState(true)
  const [adminEmail, setAdminEmail] = useState('')
  const [tab, setTab] = useState<Tab>('pending')
  const [approveTarget, setApproveTarget] = useState<HaruUser | null>(null)
  const [selectedMenus, setSelectedMenus] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const user = getStoredUser()
    if (!user || !isAdmin(user.email)) { router.push('/'); return }
    setAdminEmail(user.email)
    loadUsers(user.email)
  }, [router])

  async function loadUsers(email: string) {
    const res = await fetch('/api/admin/users', { headers: { 'x-admin-email': email } })
    if (res.ok) setUsers(await res.json())
    setLoading(false)
  }

  async function handleApprove() {
    if (!approveTarget) return
    setBusy(true)
    await fetch('/api/admin/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
      body: JSON.stringify({ user_id: approveTarget.id, menu_keys: selectedMenus }),
    })
    setUsers(prev => prev.map(u => u.id !== approveTarget.id ? u : { ...u, status: 'approved', permissions: selectedMenus }))
    setApproveTarget(null)
    setBusy(false)
  }

  async function handleReject(userId: string) {
    if (!confirm('이 사용자를 거부하시겠습니까?')) return
    await fetch('/api/admin/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
      body: JSON.stringify({ user_id: userId }),
    })
    setUsers(prev => prev.map(u => u.id !== userId ? u : { ...u, status: 'rejected', permissions: [] }))
  }

  async function togglePermission(userId: string, menuKey: string, granted: boolean) {
    await fetch('/api/admin/permissions', {
      method: granted ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail },
      body: JSON.stringify({ user_id: userId, menu_key: menuKey }),
    })
    setUsers(prev => prev.map(u => u.id !== userId ? u : {
      ...u, permissions: granted ? u.permissions.filter(p => p !== menuKey) : [...u.permissions, menuKey]
    }))
  }

  const filtered = users.filter(u => u.status === tab)
  const pendingCount = users.filter(u => u.status === 'pending').length

  const TAB_CONFIG: { key: Tab; label: string; color: string }[] = [
    { key: 'pending', label: `대기 중 ${pendingCount > 0 ? `(${pendingCount})` : ''}`, color: '#f97316' },
    { key: 'approved', label: '승인됨', color: '#1D9E75' },
    { key: 'rejected', label: '거부됨', color: '#ef4444' },
  ]

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>불러오는 중...</div>

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>

      {/* 승인 모달 */}
      {approveTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '28px 24px', maxWidth: 480, width: '100%' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 17, color: '#1e293b' }}>승인 — {approveTarget.name}</h3>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>허용할 메뉴를 선택하세요.</p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {ALL_MENUS.map(m => {
                const on = selectedMenus.includes(m.key)
                return (
                  <button key={m.key} onClick={() => setSelectedMenus(prev => on ? prev.filter(x => x !== m.key) : [...prev, m.key])}
                    style={{ padding: '7px 14px', background: on ? '#0369A1' : '#F1F5F9', color: on ? '#fff' : '#64748b', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: on ? 700 : 400, cursor: 'pointer' }}>
                    {on ? '✓ ' : ''}{m.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setApproveTarget(null)} style={{ padding: '9px 20px', background: '#F1F5F9', color: '#64748b', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>취소</button>
              <button onClick={handleApprove} disabled={busy} style={{ padding: '9px 20px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
                {busy ? '처리 중...' : `승인 (${selectedMenus.length}개 메뉴)`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 24 }}>🛡️</span>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>권한 관리 — Admin</h1>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
        {TAB_CONFIG.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t.key ? 700 : 400, fontSize: 13,
            color: tab === t.key ? t.color : '#94a3b8',
            borderBottom: `2px solid ${tab === t.key ? t.color : 'transparent'}`,
            marginBottom: '-2px',
          }}>{t.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>해당 사용자가 없습니다.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(user => (
            <div key={user.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: tab === 'approved' ? 14 : 0 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#EFF8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#1e293b' }}>{user.name}
                    <span style={{ marginLeft: 8, fontSize: 11, padding: '2px 7px', borderRadius: 10, background: user.role === 'admin' ? '#1e293b' : '#EFF8FF', color: user.role === 'admin' ? '#fff' : '#0369A1', fontWeight: 600 }}>{user.role}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{user.email}</div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(user.created_at).toLocaleDateString('ko-KR')}</div>

                {tab === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setApproveTarget(user); setSelectedMenus(user.permissions) }}
                      style={{ padding: '7px 16px', background: '#1D9E75', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>승인</button>
                    <button onClick={() => handleReject(user.id)}
                      style={{ padding: '7px 16px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>거부</button>
                  </div>
                )}

                {tab === 'rejected' && (
                  <button onClick={() => { setApproveTarget(user); setSelectedMenus([]) }}
                    style={{ padding: '7px 14px', background: '#EFF8FF', color: '#0369A1', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>재승인</button>
                )}
              </div>

              {/* 승인된 사용자 권한 수정 + 승인 취소 */}
              {tab === 'approved' && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {ALL_MENUS.map(m => {
                    const granted = user.permissions.includes(m.key)
                    return (
                      <button key={m.key} onClick={() => togglePermission(user.id, m.key, granted)}
                        style={{ padding: '5px 12px', background: granted ? '#0369A1' : '#F1F5F9', color: granted ? '#fff' : '#64748b', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: granted ? 700 : 400, cursor: 'pointer' }}>
                        {granted ? '✓ ' : ''}{m.label}
                      </button>
                    )
                  })}
                  <button
                    onClick={() => handleReject(user.id)}
                    style={{ marginLeft: 'auto', padding: '5px 14px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
                  >
                    승인 취소
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
