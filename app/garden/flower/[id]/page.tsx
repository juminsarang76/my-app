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
  const [step, setStep] = useState('')   // 단계별 진행 메시지
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

  // 이미지 선택 → 즉시 표시 → 단계별 분석
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      const [meta, b64] = dataUrl.split(',')
      const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'

      // ① 사진 즉시 화면 표시
      setPreviewUrl(dataUrl)
      setHasImage(true)

      setAnalyzing(true)

      // ② 사진 저장
      setStep('📸 사진 저장 중...')
      await fetch(`/api/garden/flower/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_data: b64, image_mime: mime }),
      })

      // ③ 꽃 이름 찾기
      setStep('🔍 꽃 이름 찾는 중...')
      try {
        const res = await fetch('/api/garden/analyze-flower', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: b64, mime }),
        })
        const result = await res.json()

        if (res.ok && result.flowerName) {
          // ④ 제목 자동 작성
          setStep('✍️ 제목 작성 중...')
          await new Promise(r => setTimeout(r, 500))
          setTitle(result.flowerName)

          // ⑤ 오늘의 문장 자동 작성
          setStep('💬 오늘의 문장 작성 중...')
          await new Promise(r => setTimeout(r, 500))
          if (result.sentence) setText(result.sentence)

          // ⑥ 자동 저장
          setStep('💾 저장 중...')
          await fetch(`/api/garden/flower/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: result.flowerName, flower_text: result.sentence ?? '' }),
          })

          setStep('')
          showToast(`🌸 ${result.flowerName} 완료!`)
        } else {
          setStep('')
          showToast('사진 저장 완료. 제목과 문장을 직접 입력해주세요.')
        }
      } catch {
        setStep('')
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

  // 진행 단계 계산
  const STEPS = ['사진선택', '사진분석', '제목작성', '문장작성', '완료']
  function getStepIdx() {
    if (!previewUrl) return -1
    if (step.includes('저장 중') || step.includes('사진 저장')) return 0
    if (step.includes('분석')) return 1
    if (step.includes('제목')) return 2
    if (step.includes('문장')) return 3
    if (!analyzing && previewUrl) return 4
    return 0
  }
  const activeStep = getStepIdx()

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

        {/* ── 상단: 취소 | 날짜 | 카카오 보내기 + 저장 ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <button
            onClick={() => router.push('/garden/flower')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← 취소
          </button>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatId(id)}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving || analyzing}
              style={{
                padding: '9px 20px', background: '#EA580C', color: '#fff',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: (saving || analyzing) ? 'not-allowed' : 'pointer',
                opacity: (saving || analyzing) ? 0.6 : 1,
              }}
            >
              {saving ? '저장 중...' : '저장'}
            </button>
            <button
              onClick={handleKakaoShare}
              disabled={!sdkReady}
              style={{
                padding: '9px 18px',
                background: sdkReady ? '#FEE500' : '#e2e8f0',
                color: sdkReady ? '#3C1E1E' : '#94a3b8',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: sdkReady ? 'pointer' : 'not-allowed',
              }}
            >
              {sdkReady ? '💬 보내기' : '...'}
            </button>
          </div>
        </div>

        {/* ── 진행 상황 ── */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: i < activeStep ? '#1D9E75' : i === activeStep ? '#EA580C' : '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0,
                }}>
                  {i < activeStep ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 9, color: i === activeStep ? '#EA580C' : i < activeStep ? '#1D9E75' : '#94a3b8',
                  fontWeight: i === activeStep ? 700 : 400, whiteSpace: 'nowrap',
                }}>
                  {s}
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: 12,
                  background: i < activeStep ? '#1D9E75' : '#e2e8f0',
                  minWidth: 8,
                }} />
              )}
            </div>
          ))}
        </div>

        {/* ── 제목 입력 ── */}
        <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={step || '꽃 이름 (꽃말) 예: 장미 (사랑)'}
            style={{
              flex: 1, boxSizing: 'border-box',
              padding: '11px 16px', fontSize: 16, fontWeight: 700,
              border: '2px solid #FED7AA', borderRadius: 10, outline: 'none',
              background: '#fff', color: '#92400E',
            }}
          />
          {hasImage && (
            <button
              onClick={() => {
                const imgUrl = `${apiUrl}/api/garden/flower/${id}/image`
                window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imgUrl)}`, '_blank')
              }}
              title="Google 렌즈로 꽃 이름 찾기"
              style={{
                flexShrink: 0, padding: '10px 14px',
                background: '#4285F4', color: '#fff',
                border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🔍 구글 렌즈
            </button>
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
          {analyzing && step && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 8,
            }}>
              <div style={{
                background: 'rgba(0,0,0,0.65)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                padding: '12px 24px', borderRadius: 30,
                backdropFilter: 'blur(4px)',
              }}>
                {step}
              </div>
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
            onChange={e => {
              setText(e.target.value)
              // 자동 높이 조절
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            placeholder={analyzing ? '꽃을 분석해서 오늘의 문장을 작성 중...' : '오늘의 꽃과 함께 전하고 싶은 말을 적어보세요...'}
            rows={3}
            style={{
              width: '100%', padding: '12px 16px', border: 'none', outline: 'none',
              fontSize: 14, lineHeight: 1.7, resize: 'none',
              fontFamily: 'sans-serif', boxSizing: 'border-box',
              overflow: 'hidden', minHeight: '4.8em',
            }}
          />

          {/* 글자수 카운터 */}
          <div style={{ padding: '2px 16px 10px', textAlign: 'right', fontSize: 11, color: textColor }}>
            {text.length} / 100{text.length > 100 ? ' ⚠️ 말줄임 표시' : ''}
          </div>
        </div>
      </div>
    </>
  )
}
