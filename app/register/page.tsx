'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setStoredUser } from '@/app/lib/auth'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError('이름과 이메일을 모두 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '신청 실패')
      setStoredUser(data)
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FFF7F0 0%, #EFF8FF 100%)',
      fontFamily: 'sans-serif', padding: 20,
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '40px 32px',
        maxWidth: 420, width: '100%',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌸</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
            Haru Flower 신청
          </h1>
          <p style={{ fontSize: 14, color: '#64748b' }}>
            이름과 이메일을 입력하면 관리자가 페이지 접근 권한을 부여합니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>이름</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="홍길동"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', border: '1.5px solid #E2E8F0',
                borderRadius: 8, fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '10px 14px', border: '1.5px solid #E2E8F0',
                borderRadius: 8, fontSize: 14, outline: 'none',
              }}
            />
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px', background: loading ? '#e2e8f0' : '#0369A1',
              color: loading ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: 8, fontWeight: 700,
              fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: 4,
            }}
          >
            {loading ? '신청 중...' : '접근 신청하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
