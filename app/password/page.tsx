'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getStoredUser, clearStoredUser, AuthUser } from '@/app/lib/auth'

export default function PasswordPage() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    setUser(getStoredUser())
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    if (next !== confirm) {
      setMsg({ kind: 'err', text: '새 비밀번호가 서로 다릅니다.' })
      return
    }
    if (next.length < 8) {
      setMsg({ kind: 'err', text: '새 비밀번호는 8자 이상이어야 합니다.' })
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user?.token ? { authorization: `Bearer ${user.token}` } : {}),
        },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ kind: 'ok', text: '비밀번호를 변경했습니다. 다시 로그인해주세요.' })
        setCurrent(''); setNext(''); setConfirm('')
        setTimeout(() => { clearStoredUser(); router.push('/login') }, 1800)
      } else {
        setMsg({ kind: 'err', text: data.error ?? '변경에 실패했습니다.' })
      }
    } catch {
      setMsg({ kind: 'err', text: '요청 중 오류가 발생했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  if (!mounted) return null

  if (!user) {
    return (
      <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>로그인이 필요합니다.</p>
        <Link href="/login" style={{ padding: '10px 20px', background: '#0369A1', color: '#fff', borderRadius: 8, textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
          로그인
        </Link>
      </div>
    )
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14,
    fontFamily: 'inherit', marginTop: 6,
  }
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#334155' }

  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>비밀번호 변경</h1>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>{user.name}님 · {user.email}</p>

      {msg && (
        <div style={{
          background: msg.kind === 'ok' ? '#E0F2FE' : '#FEE2E2',
          border: `1px solid ${msg.kind === 'ok' ? '#BAE6FD' : '#FECACA'}`,
          color: msg.kind === 'ok' ? '#0284C7' : '#B91C1C',
          borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13,
        }}>
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>현재 비밀번호
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)}
              autoComplete="current-password" required style={field} />
          </label>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={label}>새 비밀번호
            <input type="password" value={next} onChange={e => setNext(e.target.value)}
              autoComplete="new-password" required minLength={8} style={field} />
          </label>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>8자 이상</p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={label}>새 비밀번호 확인
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required style={field} />
          </label>
        </div>

        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '12px', border: 'none', borderRadius: 8,
          background: busy ? '#94a3b8' : '#1D9E75', color: '#fff',
          fontSize: 15, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>
          {busy ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <Link href="/" style={{ fontSize: 13, color: '#64748b', textDecoration: 'none' }}>← 홈으로</Link>
      </div>
    </div>
  )
}
