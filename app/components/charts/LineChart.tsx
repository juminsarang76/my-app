'use client'
import { useState, useRef } from 'react'

/* SVG 라인 차트 (인터랙티브 툴팁 포함) */
export function LineChart({
  data, keys, colors, labels, unit = '', title,
}: {
  data: Record<string, number | string>[]
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
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const num = (v: number | string | undefined) => (typeof v === 'number' ? v : 0)
  const allVals = data.flatMap(d => keys.map(k => num(d[k]))).filter(v => v !== 0)
  if (!allVals.length) return null
  const minV = Math.min(...allVals)
  const maxV = Math.max(...allVals)
  const pad  = (maxV - minV) * 0.08 || 1
  const lo = minV - pad, hi = maxV + pad

  const xOf = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * iW
  const yOf = (v: number) => PAD.t + iH - ((v - lo) / (hi - lo)) * iH

  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)
  const xLabels = data.reduce<{ i: number; label: string }[]>((acc, d, i) => {
    const dateStr = String(d.date ?? '')
    if (i % 6 === 0 || i === data.length - 1) acc.push({ i, label: dateStr.slice(0, 7) })
    return acc
  }, [])

  // 마우스 → 가장 가까운 데이터 인덱스
  function handleMove(e: React.MouseEvent) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * W
    const ratio = (x - PAD.l) / iW
    const idx = Math.round(ratio * (data.length - 1))
    setHover(Math.max(0, Math.min(data.length - 1, idx)))
  }

  const hoverDate = hover != null ? String(data[hover].date ?? '') : ''

  return (
    <div style={{ marginBottom: 32, position: 'relative' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        {keys.map((k, i) => (
          <span key={k} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 20, height: 3, background: colors[i], display: 'inline-block', borderRadius: 2 }} />
            {labels[i]}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}
        onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
        {/* 눈금선 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yOf(t)} y2={yOf(t)} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.l - 6} y={yOf(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(t).toLocaleString()}{unit}
            </text>
          </g>
        ))}
        {/* X 레이블 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={xOf(i)} y={H - PAD.b + 16} textAnchor="middle" fontSize="10" fill="#94a3b8">{label}</text>
        ))}
        {/* 데이터 라인 */}
        {keys.map((k, ki) => {
          const pts = data.map((d, i) => `${xOf(i)},${yOf(num(d[k]))}`).join(' ')
          return (
            <g key={k}>
              <polyline points={pts} fill="none" stroke={colors[ki]} strokeWidth="2.2" strokeLinejoin="round" />
              {data.map((d, i) => (
                <circle key={i} cx={xOf(i)} cy={yOf(num(d[k]))} r="3"
                  fill={colors[ki]} opacity={i % 3 === 0 ? 1 : 0} />
              ))}
            </g>
          )
        })}
        {/* 축 */}
        <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#cbd5e1" strokeWidth="1" />
        {/* 호버 크로스헤어 + 강조점 */}
        {hover != null && (
          <g>
            <line x1={xOf(hover)} x2={xOf(hover)} y1={PAD.t} y2={H - PAD.b}
              stroke="#0369A1" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            {keys.map((k, ki) => (
              <circle key={k} cx={xOf(hover)} cy={yOf(num(data[hover][k]))} r="4.5"
                fill="#fff" stroke={colors[ki]} strokeWidth="2.5" />
            ))}
          </g>
        )}
      </svg>
      {/* 툴팁 */}
      {hover != null && (
        <div style={{
          position: 'absolute', top: 34,
          left: `${(xOf(hover) / W) * 100}%`,
          transform: `translateX(${hover > data.length / 2 ? '-105%' : '8px'})`,
          background: '#0f172a', color: '#fff', borderRadius: 8,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 5, whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#bae6fd' }}>{hoverDate}</div>
          {keys.map((k, ki) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[ki], display: 'inline-block' }} />
              {labels[ki]}: <b>{num(data[hover][k]).toLocaleString()}{unit || '천'}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
