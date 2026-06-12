'use client'
import { useState } from 'react'

/* ── 타입 ───────────────────────────────────────────────── */
interface CompanyReport {
  company: string
  summary: string
  categories: { name: string; brands: string[] }[]
  recentIssues: { date: string; title: string; body: string; sourceTitle: string; sourceUrl: string }[]
  positioning: { competitors: string[]; strengths: string[]; weaknesses: string[] }
  coverLetter: { topic: string; point: string; example: string }[]
  interviewQs: { question: string; intent: string; tip: string }[]
  provider: string
  docCount: number
  error?: string
}

interface VocResult {
  total: number
  sentiment: { positive: number; negative: number; neutral: number }
  ratingGap: string
  keywords: { keyword: string; count: number; sentiment: string }[]
  clusters: { name: string; complaints: string[]; share: string }[]
  insights: { priority: string; action: string; reason: string }[]
  provider: string
  truncated: boolean
  error?: string
}

/* ── 공용 작은 컴포넌트 ─────────────────────────────────── */
function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14, padding: '20px 22px', marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span>{title}
      </div>
      {children}
    </div>
  )
}

function Chip({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600, color, background: bg }}>
      {text}
    </span>
  )
}

function ProviderBadge({ provider }: { provider?: string }) {
  if (!provider) return null
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#EFF8FF', color: '#0369A1', fontWeight: 600 }}>
      {provider} 분석
    </span>
  )
}

/* ── 기업 분석 탭 ───────────────────────────────────────── */
function CompanyTab() {
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [error, setError] = useState('')

  async function generate() {
    if (!company.trim() || loading) return
    setLoading(true); setError(''); setReport(null)
    try {
      const res = await fetch('/api/mdjob/company-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim(), jd: jd.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `오류 ${res.status}`)
      setReport(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* 입력 폼 */}
      <div style={{ background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
            기업명 <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input value={company} onChange={e => setCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="예: 올리브영, 무신사, 컬리, 이마트"
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #BAE6FD', borderRadius: 10, fontSize: 14, outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
            채용공고(JD) <span style={{ color: '#94a3b8', fontWeight: 400 }}>— 선택, 붙여넣으면 자소서·면접질문이 JD에 맞춰짐</span>
          </label>
          <textarea value={jd} onChange={e => setJd(e.target.value)}
            placeholder="채용공고 본문을 붙여넣으세요 (선택)"
            rows={4}
            style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #BAE6FD', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        </div>
        <button onClick={generate} disabled={loading || !company.trim()}
          style={{
            padding: '11px 28px', background: loading ? '#94a3b8' : '#1D9E75', color: '#fff',
            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
          }}>
          {loading ? '검색·분석 중… (20~40초)' : '📊 리포트 생성'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#9f1239', fontSize: 13, marginBottom: 20 }}>
          오류: {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          네이버·카카오·구글에서 자료 수집 후 AI 분석 중…
        </div>
      )}

      {report && !loading && (
        <>
          {/* 총평 */}
          <div style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 14, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e' }}>{report.company}</span>
              <ProviderBadge provider={report.provider} />
              <span style={{ fontSize: 10, color: '#64748b' }}>자료 {report.docCount}건 기반</span>
            </div>
            <div style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.6 }}>💡 {report.summary}</div>
          </div>

          {/* ① 카테고리/브랜드 */}
          <SectionCard title="주력 카테고리 · 대표 브랜드" icon="🏷️">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(report.categories ?? []).map((cat, i) => (
                <div key={i}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>{cat.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(cat.brands ?? []).map((b, j) => <Chip key={j} text={b} color="#0c4a6e" bg="#E0F2FE" />)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ② 최근 이슈 */}
          <SectionCard title="최근 신상품·캠페인·이슈" icon="📰">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(report.recentIssues ?? []).map((n, i) => (
                <div key={i} style={{ borderLeft: '3px solid #BAE6FD', paddingLeft: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {n.date && <span style={{ fontSize: 10, color: '#64748b', background: '#f1f5f9', borderRadius: 5, padding: '1px 6px' }}>{n.date}</span>}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#0f172a' }}>{n.title}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 3 }}>{n.body}</div>
                  {n.sourceUrl && (
                    <a href={n.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#1D9E75', textDecoration: 'none' }}>
                      ↗ {n.sourceTitle || '원문'}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ③ 포지셔닝 */}
          <SectionCard title="경쟁사 대비 포지셔닝 — MD 관점" icon="⚖️">
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>주요 경쟁사</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {(report.positioning?.competitors ?? []).map((c, i) => <Chip key={i} text={c} color="#475569" bg="#f1f5f9" />)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 8 }}>💪 강점</div>
                {(report.positioning?.strengths ?? []).map((s, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#14532d', marginBottom: 5, paddingLeft: 10, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>•</span>{s}
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9f1239', marginBottom: 8 }}>⚠️ 약점·과제</div>
                {(report.positioning?.weaknesses ?? []).map((w, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#881337', marginBottom: 5, paddingLeft: 10, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>•</span>{w}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ④ 자소서 소재 */}
          <SectionCard title="자소서 소재" icon="✍️">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(report.coverLetter ?? []).map((c, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0369A1', marginBottom: 4 }}>{i + 1}. {c.topic}</div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 6 }}>🔗 {c.point}</div>
                  <div style={{ fontSize: 12.5, color: '#0c4a6e', background: '#E0F2FE', borderRadius: 8, padding: '8px 12px', fontStyle: 'italic' }}>
                    &ldquo;{c.example}&rdquo;
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ⑤ 면접 예상질문 */}
          <SectionCard title="직무 기반 면접 예상질문" icon="🎤">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(report.interviewQs ?? []).map((q, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Q{i + 1}. {q.question}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🎯 의도: {q.intent}</div>
                  <div style={{ fontSize: 12, color: '#166534' }}>💡 팁: {q.tip}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

/* ── 리뷰/VOC 분석 탭 ───────────────────────────────────── */
const SENT_COLOR: Record<string, { color: string; bg: string }> = {
  '긍정': { color: '#166534', bg: '#dcfce7' },
  '부정': { color: '#991b1b', bg: '#fee2e2' },
  '중립': { color: '#475569', bg: '#f1f5f9' },
}
const PRIORITY_COLOR: Record<string, { color: string; bg: string }> = {
  '높음': { color: '#991b1b', bg: '#fee2e2' },
  '중간': { color: '#854d0e', bg: '#fef9c3' },
  '낮음': { color: '#475569', bg: '#f1f5f9' },
}

function VocTab() {
  const [reviews, setReviews] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<VocResult | null>(null)
  const [error, setError] = useState('')

  async function analyze() {
    if (!reviews.trim() || loading) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/mdjob/voc-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: reviews.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `오류 ${res.status}`)
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const s = result?.sentiment

  return (
    <div>
      {/* 입력 */}
      <div style={{ background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14, padding: '20px 22px', marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
          상품 리뷰 데이터 <span style={{ color: '#ef4444' }}>*</span>
          <span style={{ color: '#94a3b8', fontWeight: 400, marginLeft: 6 }}>한 줄에 리뷰 1개씩, 별점 있으면 함께 (예: ⭐5 배송 빠르고 좋아요)</span>
        </label>
        <textarea value={reviews} onChange={e => setReviews(e.target.value)}
          placeholder={'⭐5 배송 빠르고 품질 좋아요. 재구매 의사 있습니다\n⭐2 사이즈가 너무 작게 나왔어요. 교환 신청했는데 응대도 느림\n⭐4 가성비 좋은데 마감이 살짝 아쉬워요\n…'}
          rows={10}
          style={{ width: '100%', padding: '12px 14px', border: '1.5px solid #BAE6FD', borderRadius: 10, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', marginBottom: 12 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={analyze} disabled={loading || !reviews.trim()}
            style={{
              padding: '11px 28px', background: loading ? '#94a3b8' : '#1D9E75', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: loading ? 'default' : 'pointer',
            }}>
            {loading ? 'AI 분석 중…' : '🔬 VOC 분석'}
          </button>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{reviews.trim() ? `${reviews.trim().length.toLocaleString()}자` : ''}</span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#9f1239', fontSize: 13, marginBottom: 20 }}>
          오류: {error}
        </div>
      )}

      {result && !loading && (
        <>
          {/* 감성 비율 */}
          <SectionCard title={`감성 분석 — 총 ${result.total}건`} icon="💬">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <ProviderBadge provider={result.provider} />
              {result.truncated && <span style={{ fontSize: 10, color: '#854d0e' }}>⚠️ 15,000자 초과분은 제외됨</span>}
            </div>
            {s && (
              <>
                <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                  {s.positive > 0 && <div style={{ width: `${s.positive}%`, background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{s.positive}%</div>}
                  {s.neutral > 0 && <div style={{ width: `${s.neutral}%`, background: '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 11, fontWeight: 700 }}>{s.neutral}%</div>}
                  {s.negative > 0 && <div style={{ width: `${s.negative}%`, background: '#E24B4A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>{s.negative}%</div>}
                </div>
                <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#64748b', marginBottom: 12 }}>
                  <span>🟢 긍정 {s.positive}%</span>
                  <span>⚪ 중립 {s.neutral}%</span>
                  <span>🔴 부정 {s.negative}%</span>
                </div>
              </>
            )}
            {result.ratingGap && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#78350f' }}>
                ⭐ <b>별점 vs 실제 톤:</b> {result.ratingGap}
              </div>
            )}
          </SectionCard>

          {/* 키워드 */}
          <SectionCard title="주요 키워드" icon="🔑">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(result.keywords ?? []).map((k, i) => {
                const c = SENT_COLOR[k.sentiment] ?? SENT_COLOR['중립']
                return (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 16, fontSize: 12.5, fontWeight: 600, color: c.color, background: c.bg }}>
                    {k.keyword}
                    <span style={{ fontSize: 10, opacity: 0.7 }}>×{k.count}</span>
                  </span>
                )
              })}
            </div>
          </SectionCard>

          {/* 불만 클러스터 */}
          <SectionCard title="불만 포인트 클러스터" icon="🧩">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(result.clusters ?? []).map((cl, i) => (
                <div key={i} style={{ border: '1px solid #fecdd3', background: '#fff7f7', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: '#9f1239' }}>{cl.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', background: '#fee2e2', borderRadius: 10, padding: '1px 8px' }}>{cl.share}</span>
                  </div>
                  {(cl.complaints ?? []).map((c, j) => (
                    <div key={j} style={{ fontSize: 12, color: '#881337', marginBottom: 4, fontStyle: 'italic' }}>&ldquo;{c}&rdquo;</div>
                  ))}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* 인사이트 */}
          <SectionCard title="발주·개선 인사이트" icon="💡">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(result.insights ?? []).map((ins, i) => {
                const p = PRIORITY_COLOR[ins.priority] ?? PRIORITY_COLOR['중간']
                return (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: p.color, background: p.bg, borderRadius: 10, padding: '3px 10px', flexShrink: 0, marginTop: 1 }}>
                      {ins.priority}
                    </span>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{ins.action}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{ins.reason}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

/* ── 메인 페이지 ────────────────────────────────────────── */
const ARTICLES = [
  { href: '/MD/AI주도자_조직전환전략.md', icon: '🤖', title: 'AI는 도구가 아닌 주도자다', desc: '기업 리더가 지금 설계해야 할 조직 전환 전략 · 경희대 김상윤 교수 강의 기반' },
  { href: '/MD/AI리터러시_AI리더십전략.md', icon: '📚', title: 'AI 리터러시가 기업 생존을 결정한다', desc: 'AI 리더십 전략 · 경희대 김상윤 교수 / 한국AI리터러시아카데미 원장' },
  { href: '/MD/반도체트렌드.md', icon: '🔬', title: '반도체 패권 전쟁의 현주소', desc: '기술·시장·지정학 트렌드 · 고려대 신창환 교수 강의 기반' },
]

export default function MdJobPage() {
  const [tab, setTab] = useState<'company' | 'voc'>('company')

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f7ff' }}>
      <header style={{
        background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        color: '#fff', textAlign: 'center', padding: '40px 24px 30px',
      }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>🛍️</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>MD 취업준비 툴</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
          지원기업 MD 관점 분석 리포트 · 리뷰/VOC 분석
        </p>
      </header>

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '28px 20px 80px' }}>
        {/* ArticleMD — 마크다운 아티클 뷰어 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0369A1', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            📄 ArticleMD
            <span style={{ flex: 1, height: 1, background: '#BAE6FD' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ARTICLES.map(a => (
              <a key={a.href} href={a.href} target="_blank" rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, background: '#fff',
                  border: '1px solid #BAE6FD', borderRadius: 12, padding: '14px 18px',
                  textDecoration: 'none', color: 'inherit',
                }}>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: '#EFF8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{a.icon}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{a.title}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: '#64748b' }}>{a.desc}</span>
                </span>
                <span style={{ fontSize: 16, color: '#0369A1', flexShrink: 0 }}>›</span>
              </a>
            ))}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '2px solid #E2E8F0' }}>
          {([
            { key: 'company', label: '🏢 기업 분석 리포트' },
            { key: 'voc',     label: '💬 리뷰·VOC 분석' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '11px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? '#0369A1' : '#94a3b8',
              borderBottom: `2px solid ${tab === t.key ? '#0369A1' : 'transparent'}`,
              marginBottom: '-2px',
            }}>{t.label}</button>
          ))}
        </div>

        {tab === 'company' ? <CompanyTab /> : <VocTab />}
      </main>
    </div>
  )
}
