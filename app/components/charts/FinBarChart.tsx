'use client'
import { useState, useRef } from 'react'
import type { SeriesPoint } from './types'

/* 재무 바 차트 (그룹드 바, 음수/0기준선, 호버 툴팁) */
export function FinBarChart({
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
