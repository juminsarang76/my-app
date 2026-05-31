'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Flower {
  id: string
  flower_text: string
  sent_at: string | null
  image_mime: string | null
}

interface SendResult {
  name: string
  ok: boolean
  error?: string
}

export default function FlowerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [flower, setFlower] = useState<Flower | null>(null)
  const [text, setText] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasImage, setHasImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/garden/flower/${id}`)
      .then((r) => r.json())
      .then((data: Flower) => {
        setFlower(data)
        setText(data.flower_text ?? '')
        setHasImage(!!data.image_mime)
        if (data.image_mime) {
          setPreviewUrl(`/api/garden/flower/${id}/image`)
        }
      })
      .catch(() => router.push('/garden/flower'))
  }, [id, router])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // 이미지 선택 → base64 변환 → 자동 저장
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      // data:image/jpeg;base64,{b64}
      const [meta, b64] = dataUrl.split(',')
      const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'

      setPreviewUrl(dataUrl)
      setHasImage(true)

      // 자동 저장
      const res = await fetch(`/api/garden/flower/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: b64, image_mime: mime }),
      })
      if (res.ok) showToast('사진이 저장됐습니다.')
      else showToast('사진 저장 실패')
    }
    reader.readAsDataURL(file)
  }

  // 텍스트 저장
  async function handleSaveText() {
    setSaving(true)
    const res = await fetch(`/api/garden/flower/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flower_text: text }),
    })
    setSaving(false)
    showToast(res.ok ? '저장됐습니다.' : '저장 실패')
  }

  // 카카오 전송
  async function handleSend() {
    setSending(true)
    setSendResults(null)
    setError('')
    try {
      const res = await fetch(`/api/garden/flower/${id}/send`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSendResults(data.results)
      setFlower((prev) => prev ? { ...prev, sent_at: new Date().toISOString() } : prev)
    } catch (e) {
      setError(e instanceof Error ? e.message : '전송 실패')
    } finally {
      setSending(false)
    }
  }

  function formatId(rawId: string) {
    const m = rawId.match(/DF_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})_(\d{2})/)
    if (!m) return rawId
    return `20${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  }

  if (!flower) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>불러오는 중...</div>
  }

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '10px 22px', borderRadius: 10,
          fontSize: 13, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* 브레드크럼 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: '#64748b' }}>
        <Link href="/garden" style={{ color: '#EA580C', textDecoration: 'none' }}>가든</Link>
        <span>/</span>
        <Link href="/garden/flower" style={{ color: '#EA580C', textDecoration: 'none' }}>하루꽃</Link>
        <span>/</span>
        <span style={{ fontSize: 11 }}>{id}</span>
      </div>

      {/* ── 상단: 제목 + 보내기 버튼 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 10,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: 0 }}>🌸 {id}</h1>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{formatId(id)}</div>
          {flower.sent_at && (
            <div style={{ fontSize: 11, color: '#EA580C', marginTop: 2 }}>
              전송됨: {new Date(flower.sent_at).toLocaleString('ko-KR')}
            </div>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={sending}
          style={{
            padding: '11px 24px', background: '#FEE500', color: '#3C1E1E',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {sending ? '전송 중...' : '💬 카카오 보내기'}
        </button>
      </div>

      {/* 전송 결과 */}
      {sendResults && (
        <div style={{ marginBottom: 20, padding: '14px 16px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
          {sendResults.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
              <span>{r.ok ? '✅' : '❌'}</span>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              {!r.ok && <span style={{ color: '#ef4444', fontSize: 11 }}>{r.error}</span>}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── 중단: 꽃 사진 ── */}
      <div
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%', aspectRatio: '1 / 1', maxHeight: 420,
          borderRadius: 16, overflow: 'hidden', cursor: 'pointer',
          background: '#FFF7F0', border: '2px dashed #FED7AA',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 20, position: 'relative',
        }}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="꽃 사진" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ textAlign: 'center', color: '#FB923C' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>사진을 선택하세요</div>
            <div style={{ fontSize: 12, color: '#FCA570', marginTop: 4 }}>클릭하여 기기에서 선택</div>
          </div>
        )}
        {previewUrl && (
          <div style={{
            position: 'absolute', bottom: 10, right: 10,
            background: 'rgba(0,0,0,0.5)', color: '#fff',
            fontSize: 11, padding: '4px 10px', borderRadius: 20,
          }}>
            클릭하여 변경
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* ── 하단: 텍스트 에디터 ── */}
      <div style={{ border: '1px solid #FED7AA', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#FFF7F0', borderBottom: '1px solid #FED7AA', fontSize: 13, fontWeight: 700, color: '#92400E' }}>
          ✏️ 메시지
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="오늘의 꽃과 함께 전하고 싶은 말을 적어보세요..."
          rows={6}
          style={{
            width: '100%', padding: '14px 16px', border: 'none', outline: 'none',
            fontSize: 14, lineHeight: 1.7, resize: 'vertical',
            fontFamily: 'sans-serif', boxSizing: 'border-box',
          }}
        />
        <div style={{ padding: '10px 16px', background: '#FFF7F0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleSaveText}
            disabled={saving}
            style={{
              padding: '8px 20px', background: '#EA580C', color: '#fff',
              border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
