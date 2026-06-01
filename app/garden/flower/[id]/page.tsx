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
      Share: { sendDefault: (options: object) => void }
    }
  }
}

interface Flower {
  id: string
  title: string
  flower_text: string
  sent_at: string | null
  image_mime: string | null
}

export default function FlowerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [flower, setFlower] = useState<Flower | null>(null)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [hasImage, setHasImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [toast, setToast] = useState('')
  const [sdkReady, setSdkReady] = useState(false)
  const [friends, setFriends] = useState<{ id: number; name: string }[]>([])

  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY

  useEffect(() => {
    // SDK가 이미 로드된 경우 (목록→상세 페이지 이동 시)
    if (typeof window !== 'undefined' && window.Kakao?.isInitialized()) {
      setSdkReady(true)
    }

    fetch('/api/garden/friends')
      .then(r => r.json()).then(d => setFriends(d ?? [])).catch(() => {})

    fetch(`/api/garden/flower/${id}`)
      .then(r => r.json())
      .then((data: Flower) => {
        setFlower(data)
        setTitle(data.title ?? '')
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
    if (jsKey && !window.Kakao.isInitialized()) window.Kakao.init(jsKey)
    setSdkReady(window.Kakao.isInitialized())
  }

  // 카카오링크 공유
  function handleKakaoShare() {
    if (!window.Kakao?.isInitialized()) {
      showToast('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도하세요.')
      return
    }
    const imageUrl = hasImage ? `${apiUrl}/api/garden/flower/${id}/image` : undefined
    const link = {
      mobileWebUrl: `${apiUrl}/garden/flower/${id}`,
      webUrl: `${apiUrl}/garden/flower/${id}`,
    }
    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: title || '🌸 하루꽃',
        description: text || '오늘의 꽃입니다.',
        ...(imageUrl ? { imageUrl, imageWidth: 640, imageHeight: 640 } : {}),
        link,
      },
      buttons: [{ title: '꽃 보러 가기', link }],
    })
  }

  // 이미지 선택 → 저장 + Gemini 분석
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

      // 이미지 DB 저장
      await fetch(`/api/garden/flower/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: b64, image_mime: mime }),
      })

      // Gemini로 꽃 분석
      setAnalyzing(true)
      showToast('🌸 꽃을 분석하고 있습니다...')
      try {
        const res = await fetch('/api/garden/analyze-flower', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: b64, mime }),
        })
        if (res.ok) {
          const { flowerName, sentence } = await res.json()
          setTitle(flowerName)
          setText(sentence)
          showToast(`🌸 ${flowerName} 분석 완료! 수정 후 저장하세요.`)
        }
      } catch {
        showToast('사진 저장 완료. 분석에 실패했습니다.')
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // 친구 이름 삽입
  function handleInsertName(name: string) {
    const greeting = `${name}님\n`
    if (text.startsWith(greeting)) return
    setText(greeting + text)
  }

  // 제목 + 텍스트 저장
  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/garden/flower/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, flower_text: text }),
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
    return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontFamily: 'sans-serif' }}>불러오는 중...</div>
  }

  const textColor = text.length > 100 ? '#ef4444' : text.length > 80 ? '#f97316' : '#94a3b8'

  return (
    <>
      <Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
        strategy="afterInteractive" onLoad={handleSdkLoad} />

      <div style={{ fontFamily: 'sans-serif', maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>

        {toast && (
          <div style={{
            position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
            background: '#1e293b', color: '#fff', padding: '10px 22px', borderRadius: 10,
            fontSize: 13, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            maxWidth: '90vw', textAlign: 'center',
          }}>{toast}</div>
        )}

        {/* 브레드크럼 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, color: '#64748b' }}>
          <Link href="/garden" style={{ color: '#EA580C', textDecoration: 'none' }}>가든</Link>
          <span>/</span>
          <Link href="/garden/flower" style={{ color: '#EA580C', textDecoration: 'none' }}>하루꽃</Link>
          <span>/</span>
          <span style={{ fontSize: 11 }}>{id}</span>
        </div>

        {/* ── 상단: ID + 카카오 보내기 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatId(id)}</div>
          </div>
          <button
            onClick={handleKakaoShare}
            disabled={!sdkReady}
            style={{
              padding: '11px 24px',
              background: sdkReady ? '#FEE500' : '#e2e8f0',
              color: sdkReady ? '#3C1E1E' : '#94a3b8',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
              cursor: sdkReady ? 'pointer' : 'not-allowed',
            }}
          >
            {sdkReady ? '💬 카카오톡으로 보내기' : '로딩 중...'}
          </button>
        </div>

        {/* ── 제목 입력 ── */}
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={analyzing ? '🌸 꽃 이름 분석 중...' : '꽃 이름 (예: 장미, 수국)'}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '12px 16px', fontSize: 17, fontWeight: 700,
              border: '2px solid #FED7AA', borderRadius: 10, outline: 'none',
              background: analyzing ? '#FFF7F0' : '#fff',
              color: '#92400E',
            }}
          />
          {analyzing && (
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18 }}>
              🔍
            </div>
          )}
        </div>

        {/* ── 꽃 사진 ── */}
        <div
          onClick={() => !analyzing && fileRef.current?.click()}
          style={{
            width: '100%', aspectRatio: '1 / 1', maxHeight: 420,
            borderRadius: 16, overflow: 'hidden',
            cursor: analyzing ? 'wait' : 'pointer',
            background: '#FFF7F0', border: '2px dashed #FED7AA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, position: 'relative',
          }}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="꽃 사진"
              style={{ width: '100%', height: '100%', objectFit: 'cover',
                filter: analyzing ? 'brightness(0.7)' : 'none' }} />
          ) : (
            <div style={{ textAlign: 'center', color: '#FB923C' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🌸</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>사진을 선택하세요</div>
              <div style={{ fontSize: 12, color: '#FCA570', marginTop: 4 }}>클릭하여 기기에서 선택</div>
            </div>
          )}
          {analyzing && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 8, color: '#fff',
            }}>
              <div style={{ fontSize: 32 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>꽃을 분석하는 중...</div>
            </div>
          )}
          {previewUrl && !analyzing && (
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              background: 'rgba(0,0,0,0.5)', color: '#fff',
              fontSize: 11, padding: '4px 10px', borderRadius: 20,
            }}>클릭하여 변경</div>
          )}
        </div>

        <input ref={fileRef} type="file" accept="image/*"
          style={{ display: 'none' }} onChange={handleFileChange} />

        {/* ── 텍스트 에디터 ── */}
        <div style={{ border: '1px solid #FED7AA', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#FFF7F0', borderBottom: '1px solid #FED7AA', fontSize: 13, fontWeight: 700, color: '#92400E' }}>
            ✏️ 오늘의 문장
          </div>

          {/* 친구 이름 칩 */}
          {friends.length > 0 && (
            <div style={{ padding: '10px 16px 4px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {friends.map(f => (
                <button key={f.id} onClick={() => handleInsertName(f.name)}
                  style={{
                    padding: '4px 12px', background: '#FEF3C7',
                    border: '1px solid #FDE68A', borderRadius: 20,
                    fontSize: 12, fontWeight: 600, color: '#92400E', cursor: 'pointer',
                  }}>
                  {f.name}님
                </button>
              ))}
              <span style={{ fontSize: 11, color: '#94a3b8', alignSelf: 'center' }}>클릭 시 이름 삽입</span>
            </div>
          )}

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={analyzing ? '꽃을 분석해서 오늘의 문장을 작성 중...' : '오늘의 꽃과 함께 전하고 싶은 말을 적어보세요...'}
            rows={5}
            style={{
              width: '100%', padding: '14px 16px', border: 'none', outline: 'none',
              fontSize: 14, lineHeight: 1.7, resize: 'vertical',
              fontFamily: 'sans-serif', boxSizing: 'border-box',
            }}
          />

          {/* 글자수 카운터 */}
          <div style={{ padding: '2px 16px 8px', textAlign: 'right', fontSize: 11, color: textColor }}>
            {text.length}자{text.length > 100 ? ' (100자 초과 시 말줄임 표시)' : ''}
          </div>

          <div style={{ padding: '8px 16px 12px', background: '#FFF7F0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => { setTitle(flower.title ?? ''); setText(flower.flower_text ?? '') }}
              disabled={saving || analyzing}
              style={{
                padding: '8px 20px', background: '#e2e8f0', color: '#475569',
                border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving || analyzing}
              style={{
                padding: '8px 24px', background: '#EA580C', color: '#fff',
                border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13,
                cursor: (saving || analyzing) ? 'not-allowed' : 'pointer',
                opacity: (saving || analyzing) ? 0.6 : 1,
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
