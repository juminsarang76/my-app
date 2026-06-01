'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Flower {
  id: string
  created_at: string
  flower_text: string
  sent_at: string | null
  image_mime: string | null
}

export default function FlowerListPage() {
  const router = useRouter()
  const [flowers, setFlowers] = useState<Flower[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchFlowers() }, [])

  async function fetchFlowers() {
    setLoading(true)
    const res = await fetch('/api/garden/flower')
    if (res.ok) setFlowers(await res.json())
    setLoading(false)
  }

  async function handleCreate() {
    setCreating(true)
    try {
      const res = await fetch('/api/garden/flower', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/garden/flower/${data.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '생성 실패')
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(`${id}를 삭제할까요?`)) return
    const res = await fetch(`/api/garden/flower/${id}`, { method: 'DELETE' })
    if (res.ok) setFlowers((prev) => prev.filter((f) => f.id !== id))
  }

  function formatId(id: string) {
    const m = id.match(/DF_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})_(\d{2})/)
    if (!m) return id
    return `20${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#64748b' }}>
        <Link href="/garden" style={{ color: '#EA580C', textDecoration: 'none' }}>가든</Link>
        <span>/</span>
        <span>하루꽃</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>🌸 하루꽃</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{ padding: '10px 22px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {creating ? '생성 중...' : '+ 새 하루꽃'}
        </button>
      </div>

      {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <p style={{ color: '#94a3b8' }}>불러오는 중...</p>
      ) : flowers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#F8FAFC', borderRadius: 12 }}>
          아직 기록된 하루꽃이 없습니다.<br />
          <span style={{ fontSize: 13 }}>+ 새 하루꽃 버튼을 눌러 시작하세요.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flowers.map((f) => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 18px', background: '#FFF7F0',
              border: '1px solid #FED7AA', borderRadius: 12,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                background: '#FEF3C7', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.image_mime ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/garden/flower/${f.id}/image`} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24 }}>🌸</span>
                )}
              </div>

              <Link href={`/garden/flower/${f.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{f.id}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{formatId(f.id)}</div>
                {f.flower_text && (
                  <div style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>
                    {f.flower_text.slice(0, 40)}{f.flower_text.length > 40 ? '...' : ''}
                  </div>
                )}
              </Link>

              {f.sent_at && (
                <span style={{ fontSize: 11, color: '#EA580C', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  전송완료
                </span>
              )}

              <button
                onClick={() => handleDelete(f.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 16, padding: 4 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
