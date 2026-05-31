'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void
      isInitialized: () => boolean
      Share: {
        sendDefault: (options: object) => void
      }
    }
  }
}

interface Flower {
  id: string
  flower_text: string
  sent_at: string | null
  image_mime: string | null
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
  const [toast, setToast] = useState('')
  const [sdkReady, setSdkReady] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

  useEffect(() => {
    fetch(`/api/garden/flower/${id}`)
      .then((r) => r.json())
      .then((data: Flower) => {
        setFlower(data)
        setText(data.flower_text ?? '')
        setHasImage(!!data.image_mime)
        if (data.image_mime) setPreviewUrl(`/api/garden/flower/${id}/image`)
      })
      .catch(() => router.push('/garden/flower'))
  }, [id, router])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function handleSdkLoad() {
    if (!window.Kakao) return
    if (jsKey && !window.Kakao.isInitialized()) {
      window.Kakao.init(jsKey)
    }
    setSdkReady(window.Kakao.isInitialized())
  }

  // KakaoLink — 카카오톡 앱에서 직접 친구 선택해서 보내기
  function handleKakaoShare() {
    if (!window.Kakao?.isInitialized()) {
      showToast('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도하세요.')
      return
    }

    const imageUrl = hasImage
      ? `${apiUrl}/api/garden/flower/${id}/image`
      : undefined

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: '🌸 하루꽃',
        description: text || '오늘의 꽃입니다.',
        ...(imageUrl ? { imageUrl, imageWidth: 640, imageHeight: 640 } : {}),
        link: {
          mobileWebUrl: `${apiUrl}/garden/flower/${id}`,
          webUrl: `${apiUrl}/garden/flower/${id}`,
        },
      },
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const [meta, b64] = dataUrl.split(',')
      const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
      setPreviewUrl(dataUrl)
      setHasImage(true)
      const res = await fetch(`/api/garden/flower/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: b64, image_mime: mime }),
      })
      showToast(res.ok ? '사진이 저장됐습니다.' : '사진 저장 실패')
    }
    reader.readAsDataURL(file)
  }

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

  function formatId(rawId: string) {
    const m = rawId.match(/DF_(\d{2})(\d{2})(\d{2})_(\d{2})(\d{2})_(\d{2})/)
    if (!m) return rawId
    return `20${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}:${m[6]}`
  }

  if (!flower) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <>
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
        strategy="afterInteractive"
        onLoad={handleSdkLoad}
      />

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
          </div>

          <button
            onClick={handleKakaoShare}
            disabled={!sdkReady}
            style={{
              padding: '11px 24px',
              background: sdkReady ? '#FEE500' : '#e2e8f0',
              color: '#3C1E1E',
              border: 'none', borderRadius: 8,
              fontWeight: 700, fontSize: 14,
              cursor: sdkReady ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {sdkReady ? '💬 카카오톡으로 보내기' : '로딩 중...'}
          </button>
        </div>

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
            <img src={previewUrl} alt="꽃 사진"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

        <input ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleFileChange} />

        {/* ── 하단: 텍스트 에디터 ── */}
        <div style={{ border: '1px solid #FED7AA', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{
            padding: '12px 16px', background: '#FFF7F0',
            borderBottom: '1px solid #FED7AA', fontSize: 13, fontWeight: 700, color: '#92400E',
          }}>
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
          <div style={{
            padding: '10px 16px', background: '#FFF7F0',
            display: 'flex', justifyContent: 'flex-end',
          }}>
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
    </>
  )
}
