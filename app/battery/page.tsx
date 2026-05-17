// @ts-nocheck
'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import type { ApiResult, StepDetail } from './types'

// ── 상수 ──────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  '일반 충전':        '#16a34a',
  '절전 충전':        '#d97706',
  '배터리 보호 모드':  '#dc2626',
}

const ROW_DEFS: { key: keyof StepDetail; label: string }[] = [
  { key: 'request',   label: '요청' },
  { key: 'received',  label: '수신' },
  { key: 'functions', label: '함수' },
  { key: 'model',     label: '모델' },
  { key: 'method',    label: '방법' },
  { key: 'constants', label: '상수' },
]

// ── 히스토그램 빈 계산 ────────────────────────────────────
function histogram(values: number[], bins: number) {
  if (!values.length) return []
  const min = Math.min(...values), max = Math.max(...values)
  const w = (max - min) / bins || 1
  const counts = new Array(bins).fill(0)
  values.forEach(v => { counts[Math.min(Math.floor((v - min) / w), bins - 1)]++ })
  return counts.map((y, i) => ({ x: `${(min + i * w).toFixed(0)}`, y }))
}

// ── 공통 컴포넌트 ─────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', ...style }}>
      {children}
    </div>
  )
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 12, color: '#64748b', marginTop: 3, lineHeight: 1.5 }}>{sub}</p>}
    </div>
  )
}

function ChartTitle({ children }: { children: string }) {
  return <p style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>{children}</p>
}

function StepCard({ step }: { step: StepDetail }) {
  const [open, setOpen] = useState(true)
  const ok = step.status === 'ok'
  return (
    <div style={{ border: `1px solid ${ok ? '#bae6fd' : '#fecaca'}`, borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: ok ? '#f0f9ff' : '#fef2f2',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: ok ? '#0369a1' : '#dc2626', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
        }}>{ok ? '✓' : '✗'}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          Step {step.step} — {step.label}
        </span>
        {step.message && <span style={{ fontSize: 11, color: '#dc2626' }}>{step.message}</span>}
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, background: 'white' }}>
          <tbody>
            {ROW_DEFS.map(({ key, label }) => {
              const val = step[key]
              if (!val) return null
              const arr = Array.isArray(val) ? val : [val]
              return (
                <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ width: 44, padding: '5px 10px', fontWeight: 600, color: '#475569', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{label}</td>
                  <td style={{ padding: '5px 10px' }}>
                    {arr.map((v, i) => (
                      <span key={i} style={{
                        display: 'inline-block', marginRight: 4, marginBottom: 3,
                        background: '#f1f5f9', borderRadius: 4, padding: '1px 6px', fontFamily: 'monospace',
                      }}>{v}</span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────

export default function BatteryPage() {
  const [data, setData]    = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [steps, setSteps]  = useState<StepDetail[]>([])

  const load = async () => {
    setLoading(true); setData(null); setSteps([])
    try {
      const json = await fetch('/api/battery').then(r => r.json()) as ApiResult
      for (const s of json.steps) {
        await new Promise(r => setTimeout(r, 500))
        setSteps(prev => [...prev, s])
      }
      setData(json)
    } catch {
      setSteps([{ step: 1, label: 'API 연결', status: 'error', message: '서버 오류' }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ── 차트 데이터 사전 계산 ─────────────────────────────
  const tempHist     = data ? histogram(data.trainSamples.map(s => s.temp), 20) : []
  const rainHist     = data ? histogram(data.trainSamples.filter(s => s.rainfall > 0).map(s => s.rainfall), 15) : []
  const tempScatter  = data ? data.trainSamples.filter((_,i) => i%2===0).map(s => ({ x: s.temp, y: s.label, z: s.humidity })) : []
  const trainScat    = data ? data.trainSamples.filter((_,i) => i%3===0).map(s => ({ x: s.temp, y: s.label })) : []
  const testScat     = data ? data.testSamples.filter((_,i)  => i%3===0).map(s => ({ x: s.temp, y: s.label })) : []
  const testPredScat = data ? data.testSamples.filter((_,i)  => i%2===0).map(s => ({ x: s.label, y: s.predicted })) : []
  const gdNeScat     = data ? data.trainSamples.filter((_,i) => i%3===0).map(s => ({ x: s.label, y: s.predicted   })) : []
  const gdGdScat     = data ? data.trainSamples.filter((_,i) => i%3===0).map(s => ({ x: s.label, y: s.gdPredicted })) : []

  const lossData = data ? data.lossCurves[0].data.map((_, i) => ({
    epoch: i * 20,
    ...Object.fromEntries(data.lossCurves.map(c => [`lr${c.lr}`, c.data[i]])),
  })) : []

  const wBarData = data ? ['θ0 절편','θ1 온도','θ2 습도','θ3 강수'].map((name, i) => {
    const ne  = [data.training.learnedWeights.intercept, data.training.learnedWeights.temp,
                 data.training.learnedWeights.humidity,  data.training.learnedWeights.rainfall][i]
    const gd  = [data.training.gdWeights.intercept, data.training.gdWeights.temp,
                 data.training.gdWeights.humidity,  data.training.gdWeights.rainfall][i]
    const ref = [100, -0.5, -0.2, -0.3][i]
    return { name, 기준: ref, NE: parseFloat(ne.toFixed(3)), GD: parseFloat(gd.toFixed(3)) }
  }) : []

  const mseData = data ? [
    { name: '훈련(NE)',  value: data.training.trainMSE,   fill: '#0369a1' },
    { name: '훈련(GD)',  value: data.training.gdTrainMSE, fill: '#f97316' },
    { name: '테스트',    value: data.training.testMSE,    fill: '#8b5cf6' },
  ] : []

  const ac      = data ? (ACTION_COLOR[data.action] ?? '#64748b') : '#64748b'
  const trainRMSE = data ? Math.sqrt(data.training.trainMSE).toFixed(2) : '-'
  const testRMSE  = data ? Math.sqrt(data.training.testMSE).toFixed(2)  : '-'

  return (
    <div style={{ maxWidth: 920, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>

      {/* ══ 헤더 ═════════════════════════════════════════ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: 0 }}>
            배터리 효율 모니터링 시스템
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 6, lineHeight: 1.7 }}>
            날씨 데이터 기반 배터리 충전 방식 자동 결정 · 경기도 용인시<br />
            <code style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
              efficiency = 100 − 0.5·T − 0.2·H − 0.3·R + ε
            </code>
            &nbsp; 2024 학습 → 2025 검증 → 오늘 예측
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          padding: '9px 20px', borderRadius: 8, border: 'none', flexShrink: 0, marginLeft: 16,
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? '#cbd5e1' : '#0369a1', color: 'white', fontSize: 14, fontWeight: 600,
        }}>{loading ? '조회 중…' : '새로고침'}</button>
      </div>

      {/* ══ 진행 단계 — 동적 프로그레스 바 ════════════ */}
      {(() => {
        const DEFS = [
          { n: 1, icon: '⛅', label: '날씨 수신' },
          { n: 2, icon: '📊', label: '데이터 수집' },
          { n: 3, icon: '🧮', label: '가중치 학습' },
          { n: 4, icon: '🔬', label: '모델 검증' },
          { n: 5, icon: '🎯', label: '효율 예측' },
          { n: 6, icon: '⚡', label: '충전 방식' },
        ]
        const doneSet  = new Set(steps.filter(s => s.status === 'ok').map(s => s.step))
        const errorSet = new Set(steps.filter(s => s.status === 'error').map(s => s.step))
        const currentN = loading ? steps.length + 1 : null
        const allDone  = !loading && steps.length === 6

        return (
          <div style={{
            background: allDone ? '#f0fdf4' : '#f8fafc',
            border: `1px solid ${allDone ? '#86efac' : '#e2e8f0'}`,
            borderRadius: 16, padding: '20px 24px', marginBottom: 32,
            transition: 'background 0.4s, border-color 0.4s',
          }}>
            <style>{`
              @keyframes pulse-ring {
                0%   { box-shadow: 0 0 0 0 rgba(3,105,161,0.5); }
                70%  { box-shadow: 0 0 0 8px rgba(3,105,161,0); }
                100% { box-shadow: 0 0 0 0 rgba(3,105,161,0); }
              }
              @keyframes spin-step { to { transform: rotate(360deg) } }
            `}</style>

            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                {loading ? `처리 중… (${steps.length}/6단계)` : allDone ? '✅ 모든 단계 완료' : '대기 중'}
              </span>
              {loading && (
                <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>
                  {DEFS[steps.length]?.label} 진행 중
                </span>
              )}
            </div>

            {/* 스텝 타임라인 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
              {DEFS.map((def, idx) => {
                const isDone    = doneSet.has(def.n)
                const isError   = errorSet.has(def.n)
                const isCurrent = def.n === currentN
                const isPending = !isDone && !isError && !isCurrent
                const stepData  = steps.find(s => s.step === def.n)

                const circleBg    = isError ? '#dc2626' : isDone ? '#0369a1' : isCurrent ? '#f59e0b' : '#e2e8f0'
                const circleColor = isPending ? '#94a3b8' : 'white'
                const labelColor  = isError ? '#dc2626' : isDone ? '#0369a1' : isCurrent ? '#b45309' : '#94a3b8'
                const lineFill    = isDone ? '#0369a1' : '#e2e8f0'

                return (
                  <div key={def.n} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}>

                    {/* 원 + 연결선 행 */}
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 8 }}>
                      {/* 왼쪽 연결선 */}
                      {idx > 0 && (
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: doneSet.has(def.n - 1) ? '#0369a1' : '#e2e8f0', transition: 'background 0.4s' }} />
                      )}
                      {/* 원 */}
                      <div style={{
                        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                        background: circleBg, color: circleColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: isDone || isError ? 18 : 20, fontWeight: 700,
                        transition: 'background 0.3s',
                        animation: isCurrent ? 'pulse-ring 1.4s ease-out infinite' : 'none',
                      }}>
                        {isError ? '✗' : isDone ? '✓'
                          : isCurrent ? <span style={{ display: 'inline-block', animation: 'spin-step 1s linear infinite' }}>⟳</span>
                          : def.icon}
                      </div>
                      {/* 오른쪽 연결선 */}
                      {idx < 5 && (
                        <div style={{ flex: 1, height: 3, borderRadius: 2, background: lineFill, transition: 'background 0.4s' }} />
                      )}
                    </div>

                    {/* 레이블 */}
                    <span style={{ fontSize: 11, fontWeight: 700, color: labelColor, textAlign: 'center', marginBottom: 6 }}>
                      {def.label}
                    </span>

                    {/* 진행 방법 */}
                    {(isDone || isError) && stepData?.request && (
                      <div style={{
                        fontSize: 9, color: '#64748b', textAlign: 'center',
                        lineHeight: 1.4, padding: '0 2px', marginBottom: 4,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {stepData.request}
                      </div>
                    )}
                    {isCurrent && (
                      <div style={{ fontSize: 9, color: '#f59e0b', textAlign: 'center', lineHeight: 1.4 }}>
                        처리 중…
                      </div>
                    )}

                    {/* 결과 */}
                    {(isDone || isError) && stepData?.received && (
                      <div style={{
                        fontSize: 9, textAlign: 'center', lineHeight: 1.4, padding: '3px 4px',
                        background: isError ? '#fef2f2' : '#eff8ff',
                        border: `1px solid ${isError ? '#fecaca' : '#bae6fd'}`,
                        borderRadius: 6, color: isError ? '#dc2626' : '#0369a1',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {stepData.received}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 에러 메시지 */}
            {steps.some(s => s.status === 'error') && (
              <div style={{ marginTop: 14, padding: '8px 14px', background: '#fef2f2',
                border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#dc2626' }}>
                {steps.find(s => s.status === 'error')?.message}
              </div>
            )}
          </div>
        )
      })()}

      {/* ══ 상세 단계 카드 (기존) ════════════════════════ */}
      <div style={{ marginBottom: 32 }}>
        <SectionTitle title="단계별 상세" />
        {steps.map(s => <StepCard key={s.step} step={s} />)}
      </div>

      {data && !data.error && (<>

        {/* ══ Step 1: 오늘 날씨 ══════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle
            title="Step 1 — 오늘 실시간 날씨"
            sub={`${data.base_date.slice(0,4)}.${data.base_date.slice(4,6)}.${data.base_date.slice(6)} ${data.base_time.slice(0,2)}시 기준 · 기상청 초단기실황 (T1H·REH·RN1)`}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { icon: '🌡️', label: '기온',   value: `${data.weather.temp} °C`    },
              { icon: '💧', label: '습도',   value: `${data.weather.humidity} %`  },
              { icon: '🌧️', label: '강수량', value: `${data.weather.rainfall} mm` },
            ].map(({ icon, label, value }) => (
              <Card key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{value}</div>
              </Card>
            ))}
          </div>
        </div>

        {/* ══ Step 2: Training Set 시각화 ════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle
            title="Step 2 — 2024년 Training Set"
            sub={`Open-Meteo Archive · ${data.trainSamples.length}일 샘플 · 강수일 ${data.trainSamples.filter(s=>s.rainfall>0).length}일 포함`}
          />

          {/* 분포 차트 3열 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>
            <Card>
              <ChartTitle>기온 분포</ChartTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={tempHist} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="x" tick={{ fontSize: 8 }} interval={4} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip formatter={(v:number) => [v, '일수']} />
                  <Bar dataKey="y" name="일수" fill="#ef4444" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartTitle>강수량 분포 (강수일만)</ChartTitle>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={rainHist} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="x" tick={{ fontSize: 8 }} interval={3} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip formatter={(v:number) => [v, '일수']} />
                  <Bar dataKey="y" name="일수" fill="#3b82f6" opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartTitle>기온 vs 효율 (점 크기=습도)</ChartTitle>
              <ResponsiveContainer width="100%" height={160}>
                <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="x" name="기온" unit="°C" tick={{ fontSize: 8 }} type="number" domain={['auto','auto']} />
                  <YAxis dataKey="y" name="효율" unit="%" tick={{ fontSize: 8 }} domain={[0,100]} />
                  <ZAxis dataKey="z" range={[10,60]} name="습도" />
                  <Tooltip formatter={(v:number,n:string) => [n==='효율'?`${v}%`:n==='기온'?`${v}°C`:`${v}%`,n]} />
                  <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="3 2" />
                  <ReferenceLine y={70} stroke="#d97706" strokeDasharray="3 2" />
                  <Scatter data={tempScatter} fill="#f97316" fillOpacity={0.45} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* 시계열 3행 (syncId 연동) */}
          <Card>
            <ChartTitle>일별 날씨 추이</ChartTitle>
            {(['temp','humidity','rainfall'] as const).map((key, idx) => {
              const colors  = ['#ef4444','#0369a1','#6366f1']
              const ylabels = ['기온 (°C)','습도 (%)','강수 (mm)']
              const domains: [number|string,number|string][] = [['auto','auto'],[0,105],['auto','auto']]
              return (
                <div key={key} style={{ marginBottom: idx < 2 ? 2 : 0 }}>
                  <p style={{ fontSize: 10, color: '#94a3b8', margin: '4px 0 1px' }}>{ylabels[idx]}</p>
                  <ResponsiveContainer width="100%" height={144}>
                    <BarChart data={data.trainSamples} syncId="timeseries" margin={{ top: 2, right: 8, bottom: 0, left: 32 }}>
                      <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" />
                      <XAxis dataKey="date" hide={idx < 2}
                        tickFormatter={(v:string) => v.slice(5,7)+'월'} interval={29} tick={{ fontSize: 8 }} />
                      <YAxis domain={domains[idx]} tick={{ fontSize: 8 }} width={28} />
                      <Tooltip labelFormatter={l => String(l)} formatter={(v:number) => [`${v}`, ylabels[idx]]} />
                      <Bar dataKey={key} fill={colors[idx]} opacity={0.8} maxBarSize={4} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )
            })}
          </Card>
        </div>

        {/* ══ Step 3A: 정규방정식 ═════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle
            title="Step 3A — 정규방정식 가중치 학습"
            sub={`θ = (XᵀX)⁻¹Xᵀy | Train MSE = ${data.training.trainMSE.toFixed(3)} | RMSE = ${trainRMSE}%`}
          />
          <Card>
            <ChartTitle>학습된 가중치 vs 기준값</ChartTitle>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={wBarData} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#000" strokeWidth={0.8} />
                <Bar dataKey="기준" fill="#94a3b8" opacity={0.85} />
                <Bar dataKey="NE"  name="정규방정식" fill="#0369a1" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* ══ Step 3B: 경사하강법 ═════════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle
            title="Step 3B — 경사하강법 비교"
            sub={`θ := θ − α∇MSE | 표준화(z-score) 후 적용 | GD Train MSE = ${data.training.gdTrainMSE.toFixed(3)}`}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>

            <Card>
              <ChartTitle>학습률별 손실(MSE) 곡선</ChartTitle>
              <ResponsiveContainer width="100%" height={190}>
                <LineChart data={lossData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="epoch" tick={{ fontSize: 8 }} />
                  <YAxis tick={{ fontSize: 8 }} scale="log" domain={['auto','auto']} />
                  <Tooltip formatter={(v:number,k:string) => [`${v.toFixed(3)}`, k.replace('lr','lr=')]} />
                  <Legend wrapperStyle={{ fontSize: 9 }} formatter={v => v.replace('lr','lr=')} />
                  <ReferenceLine y={data.training.trainMSE} stroke="#000" strokeDasharray="4 2"
                    label={{ value:'NE', position:'right', fontSize:9 }} />
                  <Line type="monotone" dataKey="lr0.001" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="lr0.01"  stroke="#f97316" strokeWidth={1.5} dot={false} />
                  <Line type="monotone" dataKey="lr0.1"   stroke="#0369a1" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartTitle>학습된 가중치 비교 (NE vs GD)</ChartTitle>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={wBarData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <ReferenceLine y={0} stroke="#000" strokeWidth={0.8} />
                  <Bar dataKey="NE" name="정규방정식" fill="#0369a1" opacity={0.85} />
                  <Bar dataKey="GD" name="경사하강법" fill="#f97316" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartTitle>예측 vs 실제 산포도</ChartTitle>
              <ResponsiveContainer width="100%" height={190}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="x" name="실제" unit="%" tick={{ fontSize: 8 }} type="number" domain={['auto','auto']} />
                  <YAxis dataKey="y" name="예측" unit="%" tick={{ fontSize: 8 }} domain={['auto','auto']} />
                  <Tooltip formatter={(v:number,n:string) => [`${v}%`,n]} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <ReferenceLine segment={[{x:50,y:50},{x:100,y:100}]} stroke="#dc2626" strokeDasharray="4 2" />
                  <Scatter name="정규방정식" data={gdNeScat} fill="#0369a1" fillOpacity={0.3} r={2} />
                  <Scatter name="경사하강법" data={gdGdScat} fill="#f97316" fillOpacity={0.3} r={2} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {/* ══ Step 4: Test Set 검증 ═══════════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle
            title="Step 4 — 2025년 Test Set 검증"
            sub={`${data.testSamples.length}일 샘플 | Train MSE ${data.training.trainMSE.toFixed(3)} / Test MSE ${data.training.testMSE.toFixed(3)} | RMSE ${testRMSE}%`}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Card>
              <ChartTitle>2025년 월별 평균 효율 — 예측 vs 실제</ChartTitle>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.predChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={(v:string) => v.slice(5)+'월'} tick={{ fontSize: 9 }} />
                  <YAxis domain={[50,100]} tick={{ fontSize: 9 }} unit="%" />
                  <Tooltip formatter={(v:number,n:string) => [`${v}%`, n==='predicted'?'예측':'실제']} />
                  <Legend wrapperStyle={{ fontSize: 10 }} formatter={v => v==='predicted'?'예측':'실제 레이블'} />
                  <Line type="monotone" dataKey="predicted" stroke="#0369a1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="actual"    stroke="#f97316" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <ChartTitle>예측 vs 실제 산포도 (Test RMSE = {testRMSE}%)</ChartTitle>
              <p style={{ fontSize: 10, color: '#94a3b8', marginBottom: 4 }}>점이 대각선에 가까울수록 정확</p>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="x" name="실제" unit="%" tick={{ fontSize: 9 }} type="number" domain={['auto','auto']} />
                  <YAxis dataKey="y" name="예측" unit="%" tick={{ fontSize: 9 }} domain={['auto','auto']} />
                  <Tooltip formatter={(v:number,n:string) => [`${v}%`,n]} />
                  <ReferenceLine segment={[{x:50,y:50},{x:100,y:100}]} stroke="#dc2626" strokeDasharray="4 2"
                    label={{ value:'완벽 예측', fontSize:9, position:'insideTopLeft' }} />
                  <Scatter name="2025 검증" data={testPredScat} fill="#0369a1" fillOpacity={0.3} r={2} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>
        </div>

        {/* ══ Step 5/6: 오늘 예측 + 종합 ════════════════ */}
        <div style={{ marginBottom: 32 }}>
          <SectionTitle title="Step 5/6 — 오늘 배터리 효율 예측 + 충전 방식 결정" />

          {/* 예측 결과 통합 카드 */}
          <Card style={{ marginBottom: 16, border: `1px solid ${ac}44` }}>
            <div style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>

              {/* 왼쪽: 예측 배터리 효율 + 오늘 예측 요약 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' }}>

                {/* 예측 배터리 효율 */}
                <div style={{ textAlign: 'center', padding: '16px 28px', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 600, marginBottom: 6 }}>예측 배터리 효율</div>
                  <div style={{ fontSize: 52, fontWeight: 800, color: '#0369a1', lineHeight: 1 }}>{data.efficiency}%</div>
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, fontFamily: 'monospace', lineHeight: 1.5 }}>
                    {data.training.learnedWeights.intercept.toFixed(2)}<br />
                    + ({data.training.learnedWeights.temp.toFixed(4)})×{data.weather.temp}<br />
                    + ({data.training.learnedWeights.humidity.toFixed(4)})×{data.weather.humidity}
                  </div>
                </div>

                {/* 오늘 예측 요약 */}
                <div style={{ padding: '12px 20px', flex: 1 }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>오늘 예측 요약</div>
                  {[
                    ['기온',        `${data.weather.temp} °C`],
                    ['습도',        `${data.weather.humidity} %`],
                    ['강수량',      `${data.weather.rainfall} mm`],
                    ['예측 효율',   `${data.efficiency} %`],
                    ['충전 방식',   data.action],
                    ['학습 데이터', `2024년 ${data.trainSamples.length}일`],
                    ['검증 데이터', `2025년 ${data.testSamples.length}일`],
                    ['훈련 RMSE',  `${trainRMSE} %`],
                    ['테스트 RMSE', `${testRMSE} %`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>{k}</span>
                      <span style={{ fontSize: 10, fontWeight: 700,
                        color: k === '예측 효율' || k === '충전 방식' ? ac : '#0f172a' }}>{v}</span>
                    </div>
                  ))}
                </div>

              </div>

              {/* 오른쪽: 충전 방식 */}
              <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '12px 28px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                background: `${ac}08` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: ac, marginBottom: 6 }}>충전 방식</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: ac, lineHeight: 1.2 }}>{data.action}</div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
                  {data.efficiency >= 80 ? '효율 80% 이상'
                    : data.efficiency >= 70 ? '효율 70~79%'
                    : '효율 70% 미만'}<br />
                  {data.efficiency >= 80 ? '→ 일반 충전'
                    : data.efficiency >= 70 ? '→ 절전 충전'
                    : '→ 보호 모드'}
                </div>
              </div>

            </div>
          </Card>

          {/* 종합 6개 차트 1열 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>

            {/* 1) 기온 변화 → 효율 */}
            <Card>
              <ChartTitle>기온 변화 → 효율 변화</ChartTitle>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={data.chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} />
                  <YAxis domain={[50,100]} tick={{ fontSize: 8 }} unit="%" />
                  <Tooltip formatter={(v:number,n:string) => [`${v}%`, n==='learned'?'학습':'기준']} />
                  <Legend wrapperStyle={{ fontSize: 8 }} formatter={v => v==='learned'?'학습 모델':'기준 모델'} />
                  <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="3 2" />
                  <ReferenceLine y={70} stroke="#d97706" strokeDasharray="3 2" />
                  <Line type="monotone" dataKey="learned"   stroke="#0369a1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reference" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* 2) 기온 vs 효율 산포도 (2024+2025+오늘) */}
            <Card>
              <ChartTitle>기온 vs 효율 산포도</ChartTitle>
              <ResponsiveContainer width="100%" height={170}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="x" name="기온" unit="°C" tick={{ fontSize: 8 }} type="number" domain={['auto','auto']} />
                  <YAxis dataKey="y" name="효율" unit="%" tick={{ fontSize: 8 }} domain={[50,100]} />
                  <Tooltip formatter={(v:number,n:string) => [n==='효율'?`${v}%`:`${v}°C`,n]} />
                  <Legend wrapperStyle={{ fontSize: 8 }} />
                  <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="3 2" />
                  <ReferenceLine y={70} stroke="#d97706" strokeDasharray="3 2" />
                  <Scatter name="2024" data={trainScat}  fill="#0369a1" fillOpacity={0.3} r={2} />
                  <Scatter name="2025" data={testScat}   fill="#f97316" fillOpacity={0.3} r={2} />
                  <Scatter name="오늘" data={[{x:data.weather.temp,y:data.efficiency}]} fill="#dc2626" r={7} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>

            {/* 3) 2025 월별 */}
            <Card>
              <ChartTitle>2025 월별 평균 효율</ChartTitle>
              <ResponsiveContainer width="100%" height={170}>
                <LineChart data={data.predChart} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={(v:string) => v.slice(5)+'월'} tick={{ fontSize: 8 }} />
                  <YAxis domain={[50,100]} tick={{ fontSize: 8 }} unit="%" />
                  <Tooltip formatter={(v:number,n:string) => [`${v}%`, n==='predicted'?'예측':'실제']} />
                  <Legend wrapperStyle={{ fontSize: 8 }} formatter={v => v==='predicted'?'예측':'실제'} />
                  <Line type="monotone" dataKey="predicted" stroke="#0369a1" strokeWidth={1.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="actual"    stroke="#f97316" strokeWidth={1} strokeDasharray="5 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* 4) 가중치 비교 */}
            <Card>
              <ChartTitle>가중치 비교</ChartTitle>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={wBarData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 8 }} />
                  <ReferenceLine y={0} stroke="#000" strokeWidth={0.8} />
                  <Bar dataKey="기준" fill="#94a3b8" opacity={0.85} />
                  <Bar dataKey="NE"  name="정규방정식" fill="#0369a1" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* 5) MSE 비교 */}
            <Card>
              <ChartTitle>모델 성능 (MSE 비교)</ChartTitle>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={mseData} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v:number) => [`${v.toFixed(3)}`, 'MSE']} />
                  <Bar dataKey="value" name="MSE" radius={[4,4,0,0]}>
                    {mseData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

          </div>
        </div>

      </>)}
    </div>
  )
}
