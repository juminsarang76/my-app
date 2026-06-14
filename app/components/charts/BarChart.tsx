'use client'
import { useState } from 'react'
import type { IndRow } from './types'

/* SVG 가로 막대 차트 (툴팁 포함) */
export function BarChart({ data, title }: { data: IndRow[]; title: string }) {
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const max = sorted[0]?.value ?? 1
  const total = sorted.reduce((a, b) => a + b.value, 0)
  const [hover, setHover] = useState<string | null>(null)
  const COLORS = [
    '#0369A1','#0ea5e9','#38bdf8','#7dd3fc','#bae6fd',
    '#1D9E75','#34d399','#6ee7b7','#a7f3d0',
    '#f59e0b','#fbbf24',
  ]

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map((row, i) => {
          const pct = ((row.value / total) * 100).toFixed(1)
          const on = hover === row.name
          return (
            <div key={row.name}
              onMouseEnter={() => setHover(row.name)} onMouseLeave={() => setHover(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', cursor: 'default' }}>
              <div style={{ width: 100, fontSize: 12, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
                {row.name}
              </div>
              <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 22, position: 'relative' }}>
                <div style={{
                  width: `${(row.value / max) * 100}%`,
                  background: COLORS[i % COLORS.length],
                  height: '100%', borderRadius: 4,
                  transition: 'width 0.6s ease, filter 0.15s',
                  filter: on ? 'brightness(1.1)' : 'none',
                }} />
                {on && (
                  <div style={{
                    position: 'absolute', top: -38, left: '50%', transform: 'translateX(-50%)',
                    background: '#0f172a', color: '#fff', borderRadius: 8, padding: '6px 10px',
                    fontSize: 12, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 5,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}>
                    <b>{row.name}</b> · {row.value.toLocaleString()}천명 · 비중 {pct}%
                  </div>
                )}
              </div>
              <div style={{ width: 60, fontSize: 12, color: '#0369A1', fontWeight: 600, flexShrink: 0 }}>
                {row.value.toLocaleString()}천
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
