'use client'
import { useState, useRef } from 'react'

/* ── 타입 ───────────────────────────────────────────────── */
interface Financials {
  revenue: string
  operatingProfit: string
  headcount: string
  direction: string[]
  source: string
  note: string
}
interface SeriesPoint { period: string; revenue: number | null; profit: number | null; employees: number | null }
interface FinancialCharts { quarterly: SeriesPoint[]; yearly: SeriesPoint[] }

interface CompanyReport {
  company: string
  summary: string
  categories: { name: string; brands: string[] }[]
  recentIssues: { date: string; title: string; body: string; sourceTitle: string; sourceUrl: string }[]
  positioning: { competitors: string[]; strengths: string[]; weaknesses: string[] }
  financials?: Financials
  coverLetter: { topic: string; point: string; starGuide?: string; example: string; tip?: string }[]
  interviewQs: { category?: string; question: string; intent: string; answerFrame?: string; tip?: string; avoid?: string; fromReview?: boolean }[]
  careerDocCount?: number
  careerError?: string
  provider: string
  docCount: number
  jdSource?: string
  jdUrlError?: string
  financialCharts?: FinancialCharts | null
  chartSource?: 'dart' | 'news' | null
  dartUsed?: boolean
  isSample?: boolean
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

/* ── 재무 바 차트 (그룹드 바, 호버 툴팁) ────────────────── */
function FinBarChart({
  data, keys, colors, labels, unit, title,
}: {
  data: SeriesPoint[]
  keys: ('revenue' | 'profit' | 'employees')[]
  colors: string[]
  labels: string[]
  unit: string
  title: string
}) {
  const W = 700, H = 240
  const PAD = { t: 18, r: 16, b: 42, l: 70 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const vals = data.flatMap(d => keys.map(k => d[k])).filter((v): v is number => v != null)
  if (!vals.length) return null
  // 음수(영업적자) 포함 스케일, 0 기준선 포함
  const minV = Math.min(...vals, 0)
  const maxV = Math.max(...vals, 0)
  const pad = (maxV - minV) * 0.08 || 1
  const lo = minV < 0 ? minV - pad : 0
  const hi = maxV + pad

  const n = data.length
  const bandW = iW / n
  const groupW = Math.min(bandW * 0.72, 56)
  const barW = groupW / keys.length
  const xBand = (i: number) => PAD.l + bandW * i + bandW / 2
  const yOf = (v: number) => PAD.t + iH - ((v - lo) / (hi - lo)) * iH
  const y0 = yOf(0)

  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const step = Math.max(1, Math.ceil(n / 10))

  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.floor((x - PAD.l) / bandW)
    setHover(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <div style={{ marginBottom: 24, position: 'relative' }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <span key={k} style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, background: colors[i], display: 'inline-block', borderRadius: 3 }} />
            {labels[i]}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d, i) => (i % step === 0 || i === n - 1) && (
          <text key={i} x={xBand(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.period}</text>
        ))}
        {/* 바 */}
        {data.map((d, i) => {
          const on = hover === i
          return (
            <g key={i}>
              {keys.map((k, ki) => {
                const v = d[k]
                if (v == null) return null
                const x = xBand(i) - groupW / 2 + ki * barW
                const yTop = v >= 0 ? yOf(v) : y0
                const h = Math.abs(yOf(v) - y0)
                return (
                  <rect key={k} x={x} y={yTop} width={Math.max(barW - 2, 2)} height={Math.max(h, 1)}
                    fill={colors[ki]} rx="2"
                    opacity={hover == null || on ? 1 : 0.45} />
                )
              })}
            </g>
          )
        })}
        {/* 0 기준선 + 축 */}
        <line x1={PAD.l} x2={W - PAD.r} y1={y0} y2={y0} stroke="#94a3b8" strokeWidth="1" />
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
      {hover != null && (
        <div style={{
          position: 'absolute', top: 30,
          left: `${(xBand(hover) / W) * 100}%`,
          transform: `translateX(${hover > n / 2 ? '-105%' : '8px'})`,
          background: '#0f172a', color: '#fff', borderRadius: 8,
          padding: '7px 11px', fontSize: 12, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 3, color: '#bae6fd' }}>{data[hover].period}</div>
          {keys.map((k, ki) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[ki], display: 'inline-block' }} />
              {labels[ki]}: <b>{data[hover][k] != null ? `${data[hover][k]!.toLocaleString()}${unit}` : '-'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── 예시 리포트 (첫 진입 시 표시) ──────────────────────── */
const SAMPLE_REPORT: CompanyReport = {
  isSample: true,
  company: '올리브영 (예시)',
  summary: '뷰티·생활건강 분야 1위 H&B 플랫폼 — 자체 브랜드와 옴니채널 강점',
  categories: [
    { name: '화장품·뷰티', brands: ['바이오힐보', '브링그린', '웨이크메이크'] },
    { name: '생활건강', brands: ['딜라이트 프로젝트', '식품·건강기능식품'] },
  ],
  recentIssues: [
    { date: '2026.06.12', title: 'AI 시대 브랜드 생존 공식 바뀌었다', body: '올리브영 입점 K뷰티 브랜드들의 AI 마케팅 전환 가속. 큐레이션 경쟁력이 핵심 화두로.', sourceTitle: '예시 기사', sourceUrl: '' },
    { date: '2026.06.10', title: '여름 시즌 선케어 기획전 확대', body: '자외선차단제 카테고리 전년 대비 30% 성장, 글로벌 K뷰티 수요 지속.', sourceTitle: '예시 기사', sourceUrl: '' },
    { date: '2026.06.08', title: '외국인 관광객 매출 비중 확대', body: '명동·홍대 상권 중심으로 외국인 매출 비중 상승, 옴니채널 전략 강화.', sourceTitle: '예시 기사', sourceUrl: '' },
  ],
  positioning: {
    competitors: ['다이소', '무신사 뷰티', '쿠팡 로켓럭셔리'],
    strengths: ['전국 1,300+ 매장 옴니채널 네트워크', '신진 브랜드 발굴·큐레이션 역량', '오늘드림 즉시배송'],
    weaknesses: ['다이소 저가 뷰티 추격', '온라인 전용 플랫폼 대비 가격 경쟁력'],
  },
  financials: {
    revenue: '2024년 4.8조원 (전년比 +25%)',
    operatingProfit: '약 4,600억원 — 견조한 성장세',
    headcount: '약 4,400명, 매장 확장과 함께 증가 추세',
    direction: ['글로벌 K뷰티 플랫폼 확장', '자체 브랜드(PB) 강화', '옴니채널 고도화'],
    source: '뉴스 기반 추정',
    note: '예시 데이터입니다',
  },
  financialCharts: {
    quarterly: [
      { period: '2024.3Q', revenue: 12100, profit: 1150, employees: 4250 },
      { period: '2024.4Q', revenue: 13400, profit: 1290, employees: 4320 },
      { period: '2025.1Q', revenue: 12800, profit: 1210, employees: 4360 },
      { period: '2025.2Q', revenue: 13900, profit: 1340, employees: 4410 },
      { period: '2025.3Q', revenue: 14200, profit: 1390, employees: 4450 },
      { period: '2025.4Q', revenue: 15600, profit: 1520, employees: 4490 },
      { period: '2026.1Q', revenue: 14900, profit: 1450, employees: 4530 },
      { period: '2026.2Q', revenue: 15800, profit: 1560, employees: 4570 },
    ],
    yearly: [
      { period: '2017', revenue: 14600, profit: 1010, employees: 2900 },
      { period: '2018', revenue: 16600, profit: 860, employees: 3100 },
      { period: '2019', revenue: 19600, profit: 880, employees: 3300 },
      { period: '2020', revenue: 18700, profit: 1000, employees: 3350 },
      { period: '2021', revenue: 21200, profit: 1380, employees: 3500 },
      { period: '2022', revenue: 27800, profit: 2710, employees: 3700 },
      { period: '2023', revenue: 38700, profit: 4660, employees: 3950 },
      { period: '2024', revenue: 48000, profit: 5900, employees: 4400 },
      { period: '2025', revenue: 56500, profit: 7100, employees: 4500 },
    ],
  },
  coverLetter: [
    { topic: '트렌드 큐레이션 역량', point: '올리브영의 핵심 경쟁력은 신진 브랜드 발굴', starGuide: 'S: 특정 카테고리 유행 직전 상황 → T: 수요 예측 필요 → A: 리뷰·SNS 데이터 분석 → R: 예측 적중 사례', example: '"고객 리뷰 데이터를 분석해 차세대 인기 카테고리를 예측해본 경험이 있습니다."', tip: '단순 관심이 아닌 실제 데이터 분석 경험으로 차별화' },
    { topic: '옴니채널 이해', point: '오늘드림 등 O2O 전략과 연결', starGuide: 'S: 온·오프 채널 비교 경험 → T: 차이점 파악 → A: 직접 체험·기록 → R: 개선 인사이트 도출', example: '"온·오프라인 구매 여정을 직접 비교 체험하며 옴니채널 UX 개선점을 정리했습니다."', tip: '매장 방문 경험을 구체적 지점명과 함께 언급' },
    { topic: '데이터 기반 상품 기획', point: 'MD 직무의 핵심 — 발주·재고 최적화', starGuide: 'S: 수요 변동이 큰 상황 → T: 적정 발주량 결정 → A: 판매 데이터 분석 → R: 재고 회전율 개선', example: '"판매 데이터 기반으로 시즌 수요를 예측하는 사이드 프로젝트를 진행했습니다."', tip: '엑셀·SQL 등 사용 도구를 명시해 실무 즉시투입 가능성 어필' },
  ],
  interviewQs: [
    { category: '직무역량', question: '최근 주목하는 뷰티 트렌드와 그 이유는?', intent: '카테고리 감각·시장 관심도 확인', answerFrame: '트렌드 명명 → 수치·근거 → 올리브영 매대에서의 관찰 → MD로서의 시사점 순으로 답변', avoid: '근거 없이 "요즘 유행이라서" 식의 막연한 답변' },
    { category: '직무역량', question: '신규 브랜드 입점을 결정한다면 어떤 기준으로 평가하겠는가?', intent: 'MD 의사결정 프레임 확인', answerFrame: '시장성·차별성·마진·운영 역량 4축으로 구조화하고 각 축의 판단 근거 제시', avoid: '한 가지 기준만 나열하거나 직감에 의존하는 답변' },
    { category: '기업이해', question: '다이소 뷰티의 추격에 어떻게 대응해야 한다고 보는가?', intent: '경쟁 환경 분석력', answerFrame: '가격이 아닌 큐레이션·경험 가치로 차별화 논리 전개, 구체적 실행 아이디어 1개 제시', avoid: '다이소를 무시하거나 가격 인하로 맞서자는 답변' },
    { category: '인성·상황', question: '재고가 과다하게 남은 상품을 어떻게 처리하겠는가?', intent: '실무 문제해결 능력', answerFrame: '원인 분석 → 할인·번들링·채널 전환 단계별 방안 → 재발 방지책 순', avoid: '무조건 폐기하거나 책임 회피성 답변' },
  ],
  provider: '',
  docCount: 0,
}

/* ── 기업 분석 탭 ───────────────────────────────────────── */
function CompanyTab() {
  const [company, setCompany] = useState('')
  const [jd, setJd] = useState('')
  const [jdUrl, setJdUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CompanyReport | null>(null)
  const [error, setError] = useState('')
  const [chartMode, setChartMode] = useState<'quarterly' | 'yearly'>('quarterly')

  async function generate() {
    if (!company.trim() || loading) return
    setLoading(true); setError(''); setReport(null)
    try {
      const res = await fetch('/api/mdjob/company-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          jd: jd.trim() || undefined,
          jdUrl: jdUrl.trim() || undefined,
        }),
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

  // 표시 데이터: 실제 결과 없으면 예시
  const shown = report ?? SAMPLE_REPORT
  const isSample = !report
  const charts = shown.financialCharts
  const isNewsChart = shown.chartSource === 'news'
  // 선택 모드에 데이터 없으면 반대 모드로 자동 전환
  const effectiveMode = charts
    ? ((chartMode === 'quarterly' ? charts.quarterly : charts.yearly).length ? chartMode
       : (chartMode === 'quarterly' ? 'yearly' : 'quarterly'))
    : chartMode
  const chartData = charts ? (effectiveMode === 'quarterly' ? charts.quarterly : charts.yearly) : []
  const shortLabel = isNewsChart ? '반기별' : '최근 2년 분기별'
  const longLabel  = isNewsChart ? '연별'   : '최근 10년 연별'

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
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#334155', display: 'block', marginBottom: 6 }}>
            채용공고 링크 <span style={{ color: '#94a3b8', fontWeight: 400 }}>— 선택, URL만 넣으면 본문을 자동으로 가져옴</span>
          </label>
          <input value={jdUrl} onChange={e => setJdUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && generate()}
            placeholder="https://www.wanted.co.kr/wd/12345"
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, outline: 'none',
              border: `1.5px solid ${jdUrl.trim() && !/^https?:\/\//.test(jdUrl.trim()) ? '#fca5a5' : '#BAE6FD'}`,
            }} />
          {jdUrl.trim() && !/^https?:\/\//.test(jdUrl.trim()) && (
            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>http:// 또는 https:// 로 시작하는 URL을 입력하세요</div>
          )}
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

      {!loading && (
        <div style={isSample ? { opacity: 0.75 } : undefined}>
          {/* 총평 */}
          <div style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: 14, padding: '16px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0c4a6e' }}>{shown.company}</span>
              {isSample ? (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#fef9c3', color: '#854d0e', fontWeight: 700 }}>예시</span>
              ) : (
                <>
                  <ProviderBadge provider={shown.provider} />
                  <span style={{ fontSize: 10, color: '#64748b' }}>자료 {shown.docCount}건 기반</span>
                  {shown.dartUsed && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 600 }}>DART 공시</span>}
                  {(shown.jdSource === 'url' || shown.jdSource === 'both') && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#ede9fe', color: '#5b21b6', fontWeight: 600 }}>JD 반영됨</span>}
                </>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#0c4a6e', lineHeight: 1.6 }}>💡 {shown.summary}</div>
            {isSample && (
              <div style={{ fontSize: 12, color: '#854d0e', marginTop: 8 }}>
                ⬆ 기업명을 입력하고 리포트를 생성하면 실제 분석으로 교체됩니다.
              </div>
            )}
          </div>

          {/* JD URL 추출 실패 경고 */}
          {!isSample && shown.jdUrlError && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', fontSize: 12.5, color: '#78350f', marginBottom: 14 }}>
              ⚠️ 채용공고 본문 추출 실패 ({shown.jdUrlError}) — 사이트가 차단했거나 JS 렌더링 페이지입니다. JD를 텍스트로 붙여넣으면 더 정확해집니다.
            </div>
          )}

          {/* ① 카테고리/브랜드 */}
          <SectionCard title="주력 카테고리 · 대표 브랜드" icon="🏷️">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(shown.categories ?? []).map((cat, i) => (
                <div key={i}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0369A1', marginBottom: 6 }}>{cat.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(cat.brands ?? []).map((b, j) => <Chip key={j} text={b} color="#0c4a6e" bg="#E0F2FE" />)}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ①.5 재무·인력·주력 방향 */}
          {shown.financials && (
            <SectionCard title="재무·인력·주력 방향" icon="📈">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginBottom: 14 }}>
                {([
                  { label: '매출', value: shown.financials.revenue, color: '#0369A1' },
                  { label: '영업이익', value: shown.financials.operatingProfit, color: '#1D9E75' },
                  { label: '인력 동향', value: shown.financials.headcount, color: '#8b5cf6' },
                ]).map(item => {
                  const noData = !item.value || item.value.includes('자료 부족')
                  return (
                    <div key={item.label} style={{
                      background: noData ? '#f8fafc' : '#fff', border: '1px solid #e2e8f0',
                      borderRadius: 10, padding: '12px 14px',
                    }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: noData ? '#94a3b8' : item.color, lineHeight: 1.5 }}>
                        {item.value || '자료 부족'}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>주력 방향</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(shown.financials.direction ?? []).map((d, i) => <Chip key={i} text={d} color="#0c4a6e" bg="#E0F2FE" />)}
                </div>
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                출처: {shown.financials.source}{shown.financials.source !== 'DART 공시' && ' — 정확한 수치는 공시 확인'}
                {shown.financials.note && ` · ${shown.financials.note}`}
              </div>

              {/* 재무 추이 그래프 */}
              {charts && chartData.length > 0 ? (
                <div style={{ marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                    {([
                      { key: 'quarterly', label: shortLabel, empty: !charts.quarterly.length },
                      { key: 'yearly',    label: longLabel,  empty: !charts.yearly.length },
                    ] as const).map(m => (
                      <button key={m.key} onClick={() => !m.empty && setChartMode(m.key)} disabled={m.empty} style={{
                        padding: '6px 14px', borderRadius: 16, fontSize: 12,
                        cursor: m.empty ? 'default' : 'pointer', opacity: m.empty ? 0.4 : 1,
                        fontWeight: effectiveMode === m.key ? 700 : 400,
                        background: effectiveMode === m.key ? '#0369A1' : '#f1f5f9',
                        color: effectiveMode === m.key ? '#fff' : '#64748b',
                        border: 'none',
                      }}>{m.label}</button>
                    ))}
                    {isNewsChart && (
                      <span style={{ fontSize: 10.5, color: '#854d0e', background: '#fef9c3', borderRadius: 10, padding: '2px 8px' }}>
                        뉴스 기사 기반 추정치
                      </span>
                    )}
                  </div>
                  <FinBarChart
                    title="매출 · 영업이익 (단위: 억원)"
                    data={chartData}
                    keys={['revenue', 'profit']}
                    colors={['#0369A1', '#1D9E75']}
                    labels={['매출', '영업이익']}
                    unit="억원"
                  />
                  <FinBarChart
                    title="종업원수 (단위: 명)"
                    data={chartData}
                    keys={['employees']}
                    colors={['#8b5cf6']}
                    labels={['종업원수']}
                    unit="명"
                  />
                  {isNewsChart && (
                    <div style={{ fontSize: 10.5, color: '#94a3b8' }}>
                      ※ 비상장(DART 미공시) 기업 — 언론 보도 수치를 모은 추정 그래프입니다. 정확한 수치는 감사보고서 확인.
                    </div>
                  )}
                </div>
              ) : !isSample && (
                <div style={{ marginTop: 14, fontSize: 12, color: '#94a3b8' }}>
                  📉 시계열 데이터 없음 (공시·기사 모두 수치 미확인)
                </div>
              )}
            </SectionCard>
          )}

          {/* ② 최근 이슈 */}
          <SectionCard title="최근 신상품·캠페인·이슈" icon="📰">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(shown.recentIssues ?? []).map((n, i) => (
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
                {(shown.positioning?.competitors ?? []).map((c, i) => <Chip key={i} text={c} color="#475569" bg="#f1f5f9" />)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 8 }}>💪 강점</div>
                {(shown.positioning?.strengths ?? []).map((s, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#14532d', marginBottom: 5, paddingLeft: 10, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>•</span>{s}
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 10, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9f1239', marginBottom: 8 }}>⚠️ 약점·과제</div>
                {(shown.positioning?.weaknesses ?? []).map((w, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: '#881337', marginBottom: 5, paddingLeft: 10, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0 }}>•</span>{w}
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* ④ 자소서 소재 */}
          <SectionCard title="자소서 소재" icon="✍️">
            {!isSample && shown.careerError && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#78350f', marginBottom: 12 }}>
                ⚠️ 자소서·면접 자료 생성 일부 실패 ({shown.careerError}) — 다시 생성해 보세요.
              </div>
            )}
            {!isSample && (shown.careerDocCount ?? 0) > 0 && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>
                실제 면접 후기·합격 자소서 자료 {shown.careerDocCount}건 분석 기반
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {(shown.coverLetter ?? []).map((c, i) => (
                <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0369A1', marginBottom: 5 }}>{i + 1}. {c.topic}</div>
                  <div style={{ fontSize: 12.5, color: '#475569', marginBottom: 8 }}>🔗 {c.point}</div>
                  {c.starGuide && (
                    <div style={{ fontSize: 12, color: '#5b21b6', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                      <b>STAR 가이드</b> — {c.starGuide}
                    </div>
                  )}
                  <div style={{ fontSize: 12.5, color: '#0c4a6e', background: '#E0F2FE', borderRadius: 8, padding: '8px 12px', fontStyle: 'italic', marginBottom: c.tip ? 8 : 0 }}>
                    &ldquo;{c.example}&rdquo;
                  </div>
                  {c.tip && (
                    <div style={{ fontSize: 12, color: '#166534' }}>💡 차별화: {c.tip}</div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          {/* ⑤ 면접 예상질문 */}
          <SectionCard title="직무 기반 면접 예상질문" icon="🎤">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(shown.interviewQs ?? []).map((q, i) => (
                <div key={i} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '13px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    {q.category && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: q.category === '직무역량' ? '#dbeafe' : q.category === '기업이해' ? '#dcfce7' : '#fef9c3',
                        color:      q.category === '직무역량' ? '#1d4ed8' : q.category === '기업이해' ? '#166534' : '#854d0e',
                      }}>{q.category}</span>
                    )}
                    {q.fromReview && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fee2e2', color: '#991b1b' }}>
                        기출 (후기 기반)
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Q{i + 1}. {q.question}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>🎯 의도: {q.intent}</div>
                  {(q.answerFrame || q.tip) && (
                    <div style={{ fontSize: 12, color: '#0c4a6e', background: '#f0f9ff', borderRadius: 8, padding: '7px 11px', marginBottom: q.avoid ? 5 : 0 }}>
                      🧭 답변 골격: {q.answerFrame || q.tip}
                    </div>
                  )}
                  {q.avoid && (
                    <div style={{ fontSize: 11.5, color: '#9f1239' }}>🚫 피할 답변: {q.avoid}</div>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
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
