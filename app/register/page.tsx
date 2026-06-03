'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '신청 실패')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FFF7F0 0%, #EFF8FF 100%)', fontFamily: 'sans-serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>신청 완료!</h2>
        <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 1.7 }}>
          관리자가 승인하면 로그인하여 서비스를 이용할 수 있습니다.
        </p>
        <Link href="/login" style={{ display: 'inline-block', padding: '11px 28px', background: '#0369A1', color: '#fff', borderRadius: 8, textDecoration: 'none', fontWeight: 700 }}>
          로그인 페이지로
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #FFF7F0 0%, #EFF8FF 100%)', fontFamily: 'sans-serif', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 420, width: '100%', boxShadow: '0 4px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌸</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>Haru Flower 신청</h1>
          <p style={{ fontSize: 13, color: '#64748b' }}>관리자 승인 후 서비스를 이용할 수 있습니다.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: '이름', value: name, setter: setName, placeholder: '홍길동', type: 'text' },
            { label: '이메일 (ID)', value: email, setter: setEmail, placeholder: 'example@email.com', type: 'email' },
            { label: '비밀번호 (PW)', value: password, setter: setPassword, placeholder: '6자 이상', type: 'password' },
            { label: '비밀번호 확인', value: confirm, setter: setConfirm, placeholder: '비밀번호 재입력', type: 'password' },
          ].map(f => (
            <div key={f.label}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)}
                placeholder={f.placeholder} required
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', border: '1.5px solid #E2E8F0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            </div>
          ))}

          {error && <p style={{ color: '#ef4444', fontSize: 12, margin: 0 }}>{error}</p>}

          <button type="submit" disabled={loading} style={{
            padding: '12px', background: loading ? '#e2e8f0' : '#0369A1',
            color: loading ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8,
            fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4,
          }}>
            {loading ? '신청 중...' : '접근 신청하기'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#64748b' }}>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" style={{ color: '#0369A1', fontWeight: 600, textDecoration: 'none' }}>로그인</Link>
        </div>
      </div>
    </div>
  )
}
