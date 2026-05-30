'use client'

import { useState } from 'react'

// ── 타입 ──────────────────────────────────────────────────────────────
interface FormData {
  productName: string
  features: string
  price: string
  targetCustomer: string
  customTarget: string
  imageStyle: string
  platforms: string[]
  competitors: string
}

// ── 상수 ──────────────────────────────────────────────────────────────
const TARGET_OPTIONS = [
  '20~30대 직장인',
  '대학생',
  '30~40대 주부',
  '운동·헬스 마니아',
  '아웃도어 활동가',
  '직접 입력',
]
const STYLE_OPTIONS = [
  '미니멀·고급스러운',
  '밝고 활기찬',
  '자연친화적',
  '모던·시크한',
  '귀엽고 캐주얼한',
]
const PLATFORM_OPTIONS = ['스마트스토어', '쿠팡', '11번가', '자사몰', '인스타그램 쇼핑']

const INITIAL_FORM: FormData = {
  productName: '',
  features: '',
  price: '',
  targetCustomer: '20~30대 직장인',
  customTarget: '',
  imageStyle: '미니멀·고급스러운',
  platforms: [],
  competitors: '',
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────
export default function ProductClient() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [prompt, setPrompt] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [promptLoading, setPromptLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  // ── 플랫폼 체크박스 ──
  function togglePlatform(p: string) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p)
        ? f.platforms.filter((x) => x !== p)
        : [...f.platforms, p],
    }))
  }

  // ── 프롬프트 생성 ──
  async function handleGeneratePrompt() {
    if (!form.productName.trim()) { setError('상품명을 입력해 주세요.'); return }
    setError('')
    setPromptLoading(true)
    try {
      const target = form.targetCustomer === '직접 입력' ? form.customTarget : form.targetCustomer
      const res = await fetch('/api/products/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, targetCustomer: target }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '프롬프트 생성 실패')
      setPrompt(data.prompt)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setPromptLoading(false)
    }
  }

  // ── 이미지 생성 ──
  async function handleGenerateImages() {
    if (!prompt.trim()) { setError('프롬프트를 먼저 생성하거나 입력하세요.'); return }
    setError('')
    setImgLoading(true)
    setImages([])
    try {
      const res = await fetch('/api/products/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '이미지 생성 실패')
      setImages(data.images)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setImgLoading(false)
    }
  }

  // ── 칸바 연동 — URL 복사 + Canva 열기 ──
  function handleCanva(imgUrl: string) {
    navigator.clipboard.writeText(imgUrl).catch(() => {})
    window.open('https://www.canva.com/design/create', '_blank')
    showToast('이미지 URL 복사 완료 → Canva: 업로드 → URL에서 붙여넣기')
    setSelectedImage(null)
  }

  // ── 이미지 다운로드 ──
  async function handleDownload(imgUrl: string) {
    try {
      const res = await fetch(imgUrl)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `product-image-${Date.now()}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(a.href)
    } catch {
      window.open(imgUrl, '_blank')
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 860, margin: '0 auto', padding: '32px 16px' }}>

      {/* 토스트 */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', color: '#fff', padding: '12px 24px', borderRadius: 10,
          fontSize: 13, zIndex: 1000, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}

      {/* 이미지 모달 */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 999, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', maxWidth: 600, width: '100%' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedImage} alt="선택 이미지" style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: '16px 20px', display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleCanva(selectedImage)}
                style={{ ...btnStyle('#7C3AED'), flex: 1 }}
              >
                Canva에서 편집
              </button>
              <button
                onClick={() => handleDownload(selectedImage)}
                style={{ ...btnStyle('#1D9E75'), flex: 1 }}
              >
                다운로드
              </button>
              <button
                onClick={() => setSelectedImage(null)}
                style={{ ...btnStyle('#94a3b8'), flex: 1 }}
              >
                닫기
              </button>
            </div>
            <p style={{ padding: '0 20px 16px', fontSize: 11, color: '#94a3b8', margin: 0 }}>
              Canva 열기 후: 요소 → 이미지 업로드 → URL에서 붙여넣기
            </p>
          </div>
        </div>
      )}

      {/* ── 페이지 제목 ─────────────────────────────────────────────── */}
      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>
        상품 기획
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 32 }}>
        상품 정보를 입력하면 AI가 마케팅 이미지 프롬프트를 생성하고 Grok으로 이미지 4장을 만들어드립니다.
      </p>

      {/* ── 섹션 1: 상품 정보 입력 ─────────────────────────────────── */}
      <Section title="① 상품 기획 정보 입력">
        <div style={{ display: 'grid', gap: 20 }}>

          {/* 상품명 */}
          <Field label="상품명" hint="예) 울트라 슬림 스테인리스 텀블러">
            <input
              value={form.productName}
              onChange={(e) => setForm({ ...form, productName: e.target.value })}
              placeholder="울트라 슬림 스테인리스 텀블러"
              style={inputStyle}
            />
          </Field>

          {/* 핵심 기능 */}
          <Field label="핵심 기능 / 특징" hint="쉼표로 구분하여 입력">
            <input
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              placeholder="이중 진공 단열, 12시간 보온, 누수 방지 뚜껑"
              style={inputStyle}
            />
          </Field>

          {/* 가격대 */}
          <Field label="가격대">
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="35,000원"
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </Field>

          {/* 타겟 고객 */}
          <Field label="타겟 고객">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TARGET_OPTIONS.map((opt) => (
                <label key={opt} style={chipLabel(form.targetCustomer === opt)}>
                  <input
                    type="radio"
                    name="target"
                    value={opt}
                    checked={form.targetCustomer === opt}
                    onChange={() => setForm({ ...form, targetCustomer: opt, customTarget: '' })}
                    style={{ display: 'none' }}
                  />
                  {opt}
                </label>
              ))}
            </div>
            {form.targetCustomer === '직접 입력' && (
              <input
                value={form.customTarget}
                onChange={(e) => setForm({ ...form, customTarget: e.target.value })}
                placeholder="타겟 고객을 직접 입력하세요"
                style={{ ...inputStyle, marginTop: 8 }}
              />
            )}
          </Field>

          {/* 이미지 분위기 */}
          <Field label="이미지 분위기">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {STYLE_OPTIONS.map((opt) => (
                <label key={opt} style={chipLabel(form.imageStyle === opt)}>
                  <input
                    type="radio"
                    name="style"
                    value={opt}
                    checked={form.imageStyle === opt}
                    onChange={() => setForm({ ...form, imageStyle: opt })}
                    style={{ display: 'none' }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </Field>

          {/* 판매 플랫폼 */}
          <Field label="판매 플랫폼">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {PLATFORM_OPTIONS.map((opt) => {
                const checked = form.platforms.includes(opt)
                return (
                  <label key={opt} style={chipLabel(checked)}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePlatform(opt)}
                      style={{ display: 'none' }}
                    />
                    {checked ? '✓ ' : ''}{opt}
                  </label>
                )
              })}
            </div>
          </Field>

          {/* 경쟁사 */}
          <Field label="경쟁사 / 차별점" hint="선택 입력">
            <textarea
              value={form.competitors}
              onChange={(e) => setForm({ ...form, competitors: e.target.value })}
              placeholder="예) 스탠리 대비 절반 가격, 국내 생산으로 AS 용이"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {/* 에러 */}
          {error && (
            <p style={{ color: '#ef4444', fontSize: 13, margin: 0 }}>{error}</p>
          )}

          {/* 프롬프트 생성 버튼 */}
          <button
            onClick={handleGeneratePrompt}
            disabled={promptLoading}
            style={{ ...btnStyle('#0369A1'), padding: '13px 28px', fontSize: 14, alignSelf: 'flex-start' }}
          >
            {promptLoading ? '생성 중...' : '✨ 프롬프트 생성'}
          </button>
        </div>
      </Section>

      {/* ── 섹션 2: 프롬프트 ────────────────────────────────────────── */}
      <Section title="② 프롬프트 생성 및 수정">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="위에서 '프롬프트 생성'을 클릭하거나 직접 영문 프롬프트를 입력하세요."
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7 }}
        />
        <button
          onClick={handleGenerateImages}
          disabled={imgLoading || !prompt.trim()}
          style={{
            ...btnStyle('#1D9E75'),
            marginTop: 14,
            padding: '14px 32px',
            fontSize: 15,
            width: '100%',
            opacity: imgLoading || !prompt.trim() ? 0.6 : 1,
          }}
        >
          {imgLoading ? '🔄 이미지 생성 중...' : '🖼 이미지 4장 생성'}
        </button>
      </Section>

      {/* ── 섹션 3: 생성 이미지 ─────────────────────────────────────── */}
      {images.length > 0 && (
        <Section title="③ 생성된 이미지 (클릭하면 Canva 편집)">
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
            이미지를 클릭하면 확대 보기 + Canva 편집 또는 다운로드 가능합니다.
            이미지가 로딩 중이면 잠시 기다려주세요.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {images.map((url, idx) => (
              <ImageCard key={url} url={url} idx={idx} onClick={() => setSelectedImage(url)} />
            ))}
          </div>
        </Section>
      )}

    </div>
  )
}

// ── 헬퍼 컴포넌트 ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #BAE6FD',
      borderRadius: 14,
      padding: '24px',
      marginBottom: 20,
    }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0369A1', marginBottom: 20 }}>{title}</h2>
      {children}
    </div>
  )
}

function ImageCard({ url, idx, onClick }: { url: string; idx: number; onClick: () => void }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative', aspectRatio: '1 / 1', borderRadius: 10,
        overflow: 'hidden', cursor: 'pointer', border: '2px solid #BAE6FD',
        background: '#F1F5F9',
      }}
    >
      {!loaded && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94a3b8', fontSize: 12,
        }}>
          <div style={{ fontSize: 24 }}>🎨</div>
          이미지 {idx + 1} 생성 중...
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={`생성 이미지 ${idx + 1}`}
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: loaded ? 'block' : 'none' }}
      />
      {loaded && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s',
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.4)' }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)' }}
        >
          <span style={{
            color: '#fff', fontSize: 13, fontWeight: 700,
            background: 'rgba(0,0,0,0.5)', padding: '6px 14px', borderRadius: 20,
            opacity: 0, transition: 'opacity 0.2s',
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.opacity = '1' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.opacity = '0' }}
          >
            클릭하여 편집
          </span>
        </div>
      )}
      <div style={{
        position: 'absolute', top: 8, left: 8, background: '#0369A1', color: '#fff',
        fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
      }}>
        {idx + 1}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

// ── 스타일 헬퍼 ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid #CBD5E1',
  borderRadius: 8,
  fontSize: 13,
  color: '#1e293b',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

function chipLabel(active: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '7px 14px',
    borderRadius: 20,
    border: `1.5px solid ${active ? '#0369A1' : '#CBD5E1'}`,
    background: active ? '#EFF8FF' : '#fff',
    color: active ? '#0369A1' : '#64748b',
    fontSize: 12,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    userSelect: 'none',
  }
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '10px 20px',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    textAlign: 'center',
  }
}
