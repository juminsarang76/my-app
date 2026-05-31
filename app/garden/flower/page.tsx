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

interface Friend {
  id: number
  name: string
  kakao_uuid: string
}

interface KakaoFriend {
  uuid: string
  profile_nickname: string
  profile_thumbnail_image?: string
  allowed_msg: boolean
}

export default function FlowerListPage() {
  const router = useRouter()
  const [flowers, setFlowers] = useState<Flower[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [newName, setNewName] = useState('')
  const [newUuid, setNewUuid] = useState('')
  const [friendLoading, setFriendLoading] = useState(false)
  const [kakaoFriends, setKakaoFriends] = useState<KakaoFriend[] | null>(null)
  const [kakaoLoading, setKakaoLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [fRes, frRes] = await Promise.all([
      fetch('/api/garden/flower'),
      fetch('/api/garden/friends'),
    ])
    if (fRes.ok) setFlowers(await fRes.json())
    if (frRes.ok) setFriends(await frRes.json())
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
    await fetch('/api/garden/flower', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    // use [id] route for delete
    const res = await fetch(`/api/garden/flower/${id}`, { method: 'DELETE' })
    if (res.ok) setFlowers((prev) => prev.filter((f) => f.id !== id))
  }

  async function handleLoadKakaoFriends() {
    setKakaoLoading(true)
    setError('')
    try {
      const res = await fetch('/api/garden/kakao-friends')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '조회 실패')
      setKakaoFriends(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '친구 목록 조회 실패')
    } finally {
      setKakaoLoading(false)
    }
  }

  async function handleAddKakaoFriend(kf: KakaoFriend) {
    setError('')
    try {
      const res = await fetch('/api/garden/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: kf.profile_nickname, kakao_uuid: kf.uuid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFriends((prev) => [...prev, data])
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패')
    }
  }

  async function handleAddFriend() {
    if (!newName.trim() || !newUuid.trim()) return
    setFriendLoading(true)
    setError('')
    try {
      const res = await fetch('/api/garden/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, kakao_uuid: newUuid }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFriends((prev) => [...prev, data])
      setNewName('')
      setNewUuid('')
    } catch (e) {
      setError(e instanceof Error ? e.message : '추가 실패')
    } finally {
      setFriendLoading(false)
    }
  }

  async function handleDeleteFriend(id: number) {
    const res = await fetch('/api/garden/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setFriends((prev) => prev.filter((f) => f.id !== id))
  }

  function formatId(id: string) {
    // DF_260531_1730_30 → 2026.05.31 17:30:30
    const m = id.match(/DF_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})_(\d{2})/)
    if (!m) return id
    return `20${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      {/* 브레드크럼 */}
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

      {/* 하루꽃 목록 */}
      {loading ? (
        <p style={{ color: '#94a3b8' }}>불러오는 중...</p>
      ) : flowers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', background: '#F8FAFC', borderRadius: 12 }}>
          아직 기록된 하루꽃이 없습니다.<br />
          <span style={{ fontSize: 13 }}>+ 새 하루꽃 버튼을 눌러 시작하세요.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
          {flowers.map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 18px', background: '#FFF7F0',
                border: '1px solid #FED7AA', borderRadius: 12,
              }}
            >
              {/* 썸네일 */}
              <div style={{
                width: 48, height: 48, borderRadius: 8, overflow: 'hidden',
                background: '#FEF3C7', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.image_mime ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/garden/flower/${f.id}/image`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 24 }}>🌸</span>
                )}
              </div>

              {/* 정보 */}
              <Link href={`/garden/flower/${f.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E' }}>{f.id}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{formatId(f.id)}</div>
                {f.flower_text && (
                  <div style={{ fontSize: 12, color: '#78350F', marginTop: 2 }}>
                    {f.flower_text.slice(0, 40)}{f.flower_text.length > 40 ? '...' : ''}
                  </div>
                )}
              </Link>

              {/* 전송 여부 */}
              {f.sent_at && (
                <span style={{ fontSize: 11, color: '#EA580C', background: '#FEF3C7', padding: '2px 8px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                  전송완료
                </span>
              )}

              {/* 삭제 */}
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

      {/* 친구 관리 */}
      <div style={{ border: '1px solid #FED7AA', borderRadius: 12, overflow: 'hidden' }}>
        <button
          onClick={() => setShowFriends(!showFriends)}
          style={{
            width: '100%', padding: '14px 18px', background: '#FFF7F0',
            border: 'none', cursor: 'pointer', textAlign: 'left',
            fontSize: 14, fontWeight: 700, color: '#92400E',
            display: 'flex', justifyContent: 'space-between',
          }}
        >
          <span>👥 카카오 친구 관리 ({friends.length}/5)</span>
          <span>{showFriends ? '▲' : '▼'}</span>
        </button>

        {showFriends && (
          <div style={{ padding: '16px 18px', background: '#fff' }}>
            {/* 친구 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {friends.length === 0 && (
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>등록된 친구가 없습니다.</p>
              )}
              {friends.map((fr) => (
                <div key={fr.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FFF7F0', borderRadius: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E', minWidth: 60 }}>{fr.name}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8', flex: 1, fontFamily: 'monospace', wordBreak: 'break-all' }}>{fr.kakao_uuid}</span>
                  <button onClick={() => handleDeleteFriend(fr.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 14 }}>✕</button>
                </div>
              ))}
            </div>

            {/* 카카오 친구 목록에서 추가 */}
            {friends.length < 5 && (
              <div style={{ marginBottom: 16 }}>
                <button
                  onClick={handleLoadKakaoFriends}
                  disabled={kakaoLoading}
                  style={{
                    padding: '9px 18px', background: '#FEE500', color: '#3C1E1E',
                    border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13,
                    cursor: 'pointer', marginBottom: 10,
                  }}
                >
                  {kakaoLoading ? '불러오는 중...' : '💬 카카오 친구 목록 불러오기'}
                </button>

                {kakaoFriends !== null && (
                  kakaoFriends.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#94a3b8' }}>
                      앱을 허용한 카카오 친구가 없습니다. 친구가 카카오 로그인으로 앱을 사용해야 합니다.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {kakaoFriends.map((kf) => {
                        const alreadyAdded = friends.some((f) => f.kakao_uuid === kf.uuid)
                        return (
                          <div key={kf.uuid} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A',
                          }}>
                            {kf.profile_thumbnail_image && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={kf.profile_thumbnail_image} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                            )}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>{kf.profile_nickname}</div>
                              <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{kf.uuid.slice(0, 20)}…</div>
                              {!kf.allowed_msg && (
                                <div style={{ fontSize: 10, color: '#ef4444' }}>메시지 수신 미동의</div>
                              )}
                            </div>
                            <button
                              onClick={() => handleAddKakaoFriend(kf)}
                              disabled={alreadyAdded || friends.length >= 5}
                              style={{
                                padding: '5px 12px', background: alreadyAdded ? '#e2e8f0' : '#EA580C',
                                color: alreadyAdded ? '#94a3b8' : '#fff',
                                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                              }}
                            >
                              {alreadyAdded ? '추가됨' : '+ 추가'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                )}
              </div>
            )}

            {/* 수동 UUID 입력 */}
            {friends.length < 5 && (
              <details style={{ marginBottom: 8 }}>
                <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', marginBottom: 8 }}>UUID 직접 입력</summary>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="이름"
                    style={{ padding: '8px 12px', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 13, width: 90 }}
                  />
                  <input
                    value={newUuid}
                    onChange={(e) => setNewUuid(e.target.value)}
                    placeholder="카카오 UUID"
                    style={{ padding: '8px 12px', border: '1px solid #FED7AA', borderRadius: 6, fontSize: 13, flex: 1, minWidth: 200 }}
                  />
                  <button
                    onClick={handleAddFriend}
                    disabled={friendLoading}
                    style={{ padding: '8px 16px', background: '#EA580C', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                  >
                    {friendLoading ? '...' : '추가'}
                  </button>
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
