'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

/* ── 타입 ───────────────────────────────────────────────── */
interface MonthRow {
  date: string
  total: number
  male: number
  female: number
  urate: number
  erate: number
}
interface IndRow { name: string; value: number }
interface ApiData {
  monthly: MonthRow[]
  industry: IndRow[]
  source: string
  demo: boolean
}

/* ── SVG 라인 차트 ──────────────────────────────────────── */
function LineChart({
  data, keys, colors, labels, unit = '', title,
}: {
  data: Record<string, number>[]
  keys: string[]
  colors: string[]
  labels: string[]
  unit?: string
  title: string
}) {
  const W = 700, H = 220
  const PAD = { t: 20, r: 20, b: 48, l: 66 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const allVals = data.flatMap(d => keys.map(k => d[k] ?? 0)).filter(Boolean)
  if (!allVals.length) return null
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad  = (maxV - minV) * 0.08
  const lo = minV - pad, hi = maxV + pad

  const xOf = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * iW
  const yOf = (v: number) => PAD.t + iH - ((v - lo) / (hi - lo)) * iH

  // Y 눈금 5개
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)

  // X 레이블: 6개월 간격
  const xLabels = data.reduce<{ i: number; label: string }[]>((acc, d, i) => {
    const dateStr = String(d.date ?? '')
    if (i % 6 === 0 || i === data.length - 1) acc.push({ i, label: dateStr.slice(0, 7) })
    return acc
  }, [])

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <span key={k} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 20, height: 3, background: colors[i], display: 'inline-block', borderRadius: 2 }} />
            {labels[i]}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* 눈금선 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)}
              stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end"
              fontSize="10" fill="#94a3b8">
              {Math.round(t).toLocaleString()}{unit}
            </text>
          </g>
        ))}
        {/* X 레이블 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - PAD.b + 16}
            textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        {/* 데이터 라인 + 점 */}
        {keys.map((k, ki) => {
          const pts = data.map((d, i) => `${xOf(i)},${yOf(d[k] ?? 0)}`).join(' ')
          return (
            <g key={k}>
              <polyline points={pts} fill="none"
                stroke={colors[ki]} strokeWidth="2.2" strokeLinejoin="round" />
              {data.map((d, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(d[k] ?? 0)} r="3"
                  fill={colors[ki]} opacity={i % 3 === 0 ? 1 : 0} />
              ))}
            </g>
          )
        })}
        {/* 축 */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b}
          stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b}
          stroke="#cbd5e1" strokeWidth="1" />
      </svg>
    </div>
  )
}

/* ── SVG 가로 막대 차트 ─────────────────────────────────── */
function BarChart({ data, title }: { data: IndRow[]; title: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const max = sorted[0]?.value ?? 1
  const COLORS = [
    '#0369A1','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd',
    '#1D9E75','#34d399','#6ee7b7','#a7f3d0',
    '#f59e0b','#fbbf24',
  ]

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((row, i) => (
          <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 100, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
              {row.name}
            </div>
            <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 22, position: 'relative' }}>
              <div style={{
                width: `${(row.value / max) * 100}%`,
                background: COLORS[i % COLORS.length],
                height: '100%', borderRadius: 4,
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ width: 60, fontSize: 12, color: '#0369A1', fontWeight: 600, flexShrink: 0 }}>
              {row.value.toLocaleString()}천
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── KPI 카드 ───────────────────────────────────────────── */
function KpiCard({ label, value, unit, sub, color = '#0369A1' }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string
}) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #BAE6FD',
      borderRadius: 12, padding: '16px 20px',
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

/* ── 메인 페이지 ────────────────────────────────────────── */
export default function EmploymentPage() {
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'total' | 'gender' | 'rate' | 'industry'>('total')

  useEffect(() => {
    fetch('/api/stats/employment')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const latest = data?.monthly.at(-1)
  const prev12 = data?.monthly.at(-13)

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'total',    label: '취업자 추이' },
    { key: 'gender',   label: '성별 비교' },
    { key: 'rate',     label: '고용률·실업률' },
    { key: 'industry', label: '산업별' },
  ]

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#f0f7ff' }}>
      {/* 헤더 */}
      <header style={{
        background: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
        color: '#fff', padding: '32px 24px 28px',
      }}>
        <Link href="/stats" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', textDecoration: 'none' }}>
          ← 통계 홈
        </Link>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>
          취업 통계
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>
          경제활동인구조사 · 월별 · 2024~2026
          {data?.demo && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px',
              background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            }}>데모 데이터 (KOSIS_API_KEY 미설정)</span>
          )}
          {!data?.demo && data && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px',
              background: 'rgba(255,255,255,0.2)', borderRadius: 10,
            }}>KOSIS 실데이터</span>
          )}
        </p>
      </header>

      <main style={{ maxWidth: 860, margin: '0 auto', padding: '28px 20px 80px' }}>

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 15 }}>
            데이터 불러오는 중…
          </div>
        )}
        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: 16, color: '#9f1239' }}>
            오류: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 28 }}>
              <KpiCard label="최신 취업자" value={latest?.total ?? 0} unit="천명"
                sub={latest?.date} color="#0369A1" />
              <KpiCard label="고용률" value={latest?.erate ?? 0} unit="%"
                sub="15세 이상" color="#1D9E75" />
              <KpiCard label="실업률" value={latest?.urate ?? 0} unit="%"
                sub={latest?.date} color="#f97316" />
              <KpiCard
                label="전년 동월 대비"
                value={prev12 ? `${((( (latest?.total??0) - prev12.total) / prev12.total)*100).toFixed(1)}%` : '-'}
                sub="취업자 증감"
                color={prev12 && latest && latest.total >= prev12.total ? '#1D9E75' : '#ef4444'}
              />
            </div>

            {/* 탭 */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid #E2E8F0' }}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  padding: '9px 16px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: activeTab === t.key ? 700 : 400,
                  color: activeTab === t.key ? '#0369A1' : '#94a3b8',
                  borderBottom: `2px solid ${activeTab === t.key ? '#0369A1' : 'transparent'}`,
                  marginBottom: '-2px',
                }}>{t.label}</button>
              ))}
            </div>

            {/* 차트 영역 */}
            <div style={{ background: '#fff', border: '1px solid #BAE6FD', borderRadius: 14, padding: '24px 20px' }}>

              {activeTab === 'total' && (
                <LineChart
                  title="월별 취업자 수 (단위: 천명)"
                  data={data.monthly as unknown as Record<string,number>[]}
                  keys={['total']}
                  colors={['#0369A1']}
                  labels={['취업자 (천명)']}
                />
              )}

              {activeTab === 'gender' && (
                <LineChart
                  title="성별 취업자 수 (단위: 천명)"
                  data={data.monthly as unknown as Record<string,number>[]}
                  keys={['male', 'female']}
                  colors={['#0369A1', '#ec4899']}
                  labels={['남성', '여성']}
                />
              )}

              {activeTab === 'rate' && (
                <>
                  <LineChart
                    title="고용률 (%)"
                    data={data.monthly as unknown as Record<string,number>[]}
                    keys={['erate']}
                    colors={['#1D9E75']}
                    labels={['고용률']}
                    unit="%"
                  />
                  <LineChart
                    title="실업률 (%)"
                    data={data.monthly as unknown as Record<string,number>[]}
                    keys={['urate']}
                    colors={['#f97316']}
                    labels={['실업률']}
                    unit="%"
                  />
                </>
              )}

              {activeTab === 'industry' && (
                <BarChart
                  title="산업별 취업자 수 (단위: 천명, 최신 기준)"
                  data={data.industry}
                />
              )}
            </div>

            {/* 출처 */}
            <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
              출처: 통계청 경제활동인구조사 (KOSIS)
              {data.demo && ' · 데모 데이터 표시 중 — KOSIS_API_KEY 설정 시 실데이터 자동 전환'}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
