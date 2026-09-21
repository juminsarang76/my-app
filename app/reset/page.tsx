'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetForm() {
  const router = useRouter()
  const token = useSearchParams().get('token') ?? ''
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) { setMsg({ kind: 'err', text: '새 비밀번호가 서로 다릅니다.' }); return }
    if (next.length < 8) { setMsg({ kind: 'err', text: '비밀번호는 8자 이상이어야 합니다.' }); return }

    setBusy(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: next }),
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ kind: 'ok', text: '비밀번호를 설정했습니다. 로그인 화면으로 이동합니다.' })
        setTimeout(() => router.push('/login'), 1600)
      } else {
        setMsg({ kind: 'err', text: data.error ?? '재설정에 실패했습니다.' })
      }
    } catch {
      setMsg({ kind: 'err', text: '요청 중 오류가 발생했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  const field: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '11px 13px',
    border: '1px solid #CBD5E1', borderRadius: 8, fontSize: 14,
    fontFamily: 'inherit', marginTop: 6,
  }

  if (!token) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#B91C1C', fontSize: 14, marginBottom: 18 }}>재설정 토큰이 없습니다.</p>
        <Link href="/login" style={{ fontSize: 13, color: '#0369A1', textDecoration: 'none' }}>로그인으로</Link>
      </div>
    )
  }

  return (
    <>
      {msg && (
        <div style={{
          background: msg.kind === 'ok' ? '#E0F2FE' : '#FEE2E2',
          border: `1px solid ${msg.kind === 'ok' ? '#BAE6FD' : '#FECACA'}`,
          color: msg.kind === 'ok' ? '#0284C7' : '#B91C1C',
          borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 13,
        }}>{msg.text}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>새 비밀번호
            <input type="password" value={next} onChange={e => setNext(e.target.value)}
              autoComplete="new-password" required minLength={8} style={field} />
          </label>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0' }}>8자 이상</p>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>새 비밀번호 확인
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password" required style={field} />
          </label>
        </div>
        <button type="submit" disabled={busy} style={{
          width: '100%', padding: '12px', border: 'none', borderRadius: 8,
          background: busy ? '#94a3b8' : '#1D9E75', color: '#fff',
          fontSize: 15, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}>{busy ? '설정 중…' : '비밀번호 설정'}</button>
      </form>
    </>
  )
}

export default function ResetPage() {
  return (
    <div style={{ maxWidth: 420, margin: '60px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px' }}>비밀번호 재설정</h1>
      <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 24px' }}>
        링크는 30분간 유효하며 한 번만 사용할 수 있습니다.
      </p>
      <Suspense fallback={<p style={{ color: '#94a3b8', fontSize: 14 }}>불러오는 중…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  )
}
