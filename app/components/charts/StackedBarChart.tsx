'use client'
import { useState, useRef } from 'react'
import type { IndSeries } from './types'

/* SVG 누적 막대 차트 (월별 산업 스택, 툴팁 포함) */
export function StackedBarChart({
  series, colors, unit = '천', title,
}: {
  series: IndSeries[]
  colors: string[]
  unit?: string
  title: string
}) {
  const W = 700, H = 440           // 높이 2배
  const PAD = { t: 20, r: 20, b: 48, l: 70 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  if (!series.length) return null
  const dates = series[0].data.map(d => d.date)
  const n = dates.length

  // 각 월의 합계 → 최대값
  const totals = dates.map((_, i) => series.reduce((sum, s) => sum + (s.data[i]?.value ?? 0), 0))
  const maxTotal = Math.max(...totals) * 1.05 || 1

  const bandW = iW / n
  const barW = Math.min(bandW * 0.7, 26)
  const xOf = (i: number) => PAD.l + bandW * i + bandW / 2
  const hOf = (v: number) => (v / maxTotal) * iH

  const ticks = Array.from({ length: 5 }, (_, i) => (maxTotal * i) / 4)
  const xLabels = dates.reduce<{ i: number; label: string }[]>((acc, d, i) => {
    if (i % 6 === 0 || i === n - 1) acc.push({ i, label: d.slice(0, 7) })
    return acc
  }, [])

  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const idx = Math.floor((x - PAD.l) / bandW)
    setHover(Math.max(0, Math.min(n - 1, idx)))
  }

  return (
    <div style={{ marginBottom: 32, position: 'relative' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <span key={s.name} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, background: colors[i % colors.length], display: 'inline-block', borderRadius: 3 }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* 눈금선 */}
        {ticks.map((t, i) => {
          const y = PAD.t + iH - hOf(t)
          return (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {Math.round(t).toLocaleString()}{unit}
              </text>
            </g>
          )
        })}
        {/* X 레이블 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        {/* 누적 막대 */}
        {dates.map((_, i) => {
          let cum = 0
          const on = hover === i
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = s.data[i]?.value ?? 0
                const h = hOf(v)
                const y = PAD.t + iH - hOf(cum) - h
                cum += v
                return (
                  <rect key={si} x={xOf(i) - barW / 2} y={y} width={barW} height={Math.max(h, 0)}
                    fill={colors[si % colors.length]} opacity={on || hover == null ? 1 : 0.45}
                    rx="1" />
                )
              })}
            </g>
          )
        })}
        {/* 축 */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
      </svg>
      {/* 툴팁 */}
      {hover != null && (
        <div style={{
          position: 'absolute', top: 40,
          left: `${(xOf(hover) / W) * 100}%`,
          transform: `translateX(${hover > n / 2 ? '-105%' : '8px'})`,
          background: '#0f172a', color: '#fff', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#bae6fd' }}>
            {dates[hover]} · 합계 {totals[hover].toLocaleString()}{unit}
          </div>
          {series.map((s, si) => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: colors[si % colors.length], display: 'inline-block' }} />
              {s.name}: <b>{(s.data[hover]?.value ?? 0).toLocaleString()}{unit}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
