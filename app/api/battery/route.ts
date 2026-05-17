import { NextResponse } from 'next/server'
import type { StepDetail, TrainingInfo, TrainingSample, LossCurve, WeightSet } from '../../battery/types'

// ── 상수 ──────────────────────────────────────────────────
const LATITUDE         = 37.24
const LONGITUDE        = 127.18
const REF_W_TEMP       = 0.5
const REF_W_HUMIDITY   = 0.2
const REF_W_RAINFALL   = 0.3
const NOISE_STD        = 2.0
const THRESHOLD_NORMAL = 80
const THRESHOLD_SAVE   = 70
const GD_EPOCHS        = 2000
const GD_RECORD_EVERY  = 20
const GD_LRS           = [0.001, 0.01, 0.1]

// ── 시각 헬퍼 ─────────────────────────────────────────────

function getUltraSrtBaseTime() {
  const kst  = new Date(Date.now() + 9 * 3_600_000)
  const h = kst.getUTCHours(), m = kst.getUTCMinutes()
  const adjH = m < 10 ? (h - 1 + 24) % 24 : h
  return {
    base_date: kst.toISOString().slice(0, 10).replace(/-/g, ''),
    base_time: String(adjH).padStart(2, '0') + '00',
  }
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10) }

// ── 난수 ──────────────────────────────────────────────────

function randn(): number {
  const u1 = Math.max(1e-10, Math.random())
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * Math.random())
}

// ── 선형 대수 ─────────────────────────────────────────────

// 정규방정식 θ = (XᵀX)⁻¹Xᵀy (가우시안 소거법)
function fitLinear(X: number[][], y: number[]): number[] {
  const d   = X[0].length
  const XtX = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0))
  )
  const Xty = Array.from({ length: d }, (_, i) => X.reduce((s, r, k) => s + r[i] * y[k], 0))
  const n   = d
  const aug = XtX.map((row, i) => [...row, Xty[i]])
  for (let col = 0; col < n; col++) {
    let mx = col
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[mx][col])) mx = row
    }
    ;[aug[col], aug[mx]] = [aug[mx], aug[col]]
    if (Math.abs(aug[col][col]) < 1e-10) return []
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = aug[row][col] / aug[col][col]
      for (let k = col; k <= n; k++) aug[row][k] -= f * aug[col][k]
    }
  }
  return aug.map((row, i) => row[n] / row[i])
}

// 열 평균 / 표준편차
function colStats(X: number[][], col: number) {
  const vals = X.map(r => r[col])
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  return { mean, std: std < 1e-10 ? 1 : std }
}

// 경사하강법 (표준화된 X에서 실행)
function gradientDescent(
  X: number[][], y: number[], lr: number, epochs: number, recordEvery: number
): { weights: number[]; losses: number[] } {
  const n = X.length, d = X[0].length
  let w   = new Array(d).fill(0)
  const losses: number[] = []

  for (let e = 0; e < epochs; e++) {
    const errors = X.map((row, i) => row.reduce((s, x, j) => s + x * w[j], 0) - y[i])
    const grad   = Array.from({ length: d }, (_, j) =>
      (2 / n) * X.reduce((s, row, i) => s + row[j] * errors[i], 0)
    )
    w = w.map((wj, j) => wj - lr * grad[j])
    if (e % recordEvery === 0) {
      const mse = errors.reduce((s, e) => s + e * e, 0) / n
      losses.push(parseFloat(mse.toFixed(4)))
    }
  }
  return { weights: w, losses }
}

// 표준화 가중치 → 원래 스케일로 변환
function descaleWeights(wScaled: number[], means: number[], stds: number[]): number[] {
  const w = new Array(4).fill(0)
  for (let i = 0; i < 3; i++) w[i + 1] = wScaled[i + 1] / stds[i]
  w[0] = wScaled[0] - means.reduce((s, m, i) => s + wScaled[i + 1] * m / stds[i], 0)
  return w
}

function predict(w: number[], t: number, h: number, r: number): number {
  return Math.min(100, Math.max(0, w[0] + w[1] * t + w[2] * h + w[3] * r))
}

function mse(X: number[][], y: number[], w: number[]): number {
  return X.reduce((s, row, i) => {
    const p = row.reduce((ss, x, j) => ss + x * w[j], 0)
    return s + (p - y[i]) ** 2
  }, 0) / X.length
}

async function fetchOpenMeteo(start: string, end: string) {
  const p = new URLSearchParams({
    latitude: String(LATITUDE), longitude: String(LONGITUDE),
    start_date: start, end_date: end,
    daily: 'temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum',
    timezone: 'Asia/Seoul',
  })
  const res  = await fetch(`https://archive-api.open-meteo.com/v1/archive?${p}`, { next: { revalidate: 3_600 } })
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`)
  const json = await res.json()
  return {
    times:      json.daily?.time                       ?? [] as string[],
    temps:      json.daily?.temperature_2m_mean        ?? [] as (number|null)[],
    humidities: json.daily?.relative_humidity_2m_mean  ?? [] as (number|null)[],
    rainfalls:  json.daily?.precipitation_sum          ?? [] as (number|null)[],
  }
}

function buildSamples(times: string[], temps: (number|null)[], humidities: (number|null)[], rainfalls: (number|null)[]) {
  const X: number[][] = [], y: number[] = [], dates: string[] = []
  for (let i = 0; i < times.length; i++) {
    const t = temps[i], h = humidities[i], r = rainfalls[i] ?? 0
    if (t === null || h === null) continue
    const label = Math.min(100, Math.max(0,
      100 - REF_W_TEMP * t - REF_W_HUMIDITY * h - REF_W_RAINFALL * r + randn() * NOISE_STD
    ))
    X.push([1, t, h, r]); y.push(label); dates.push(times[i])
  }
  return { X, y, dates }
}

function getAction(eff: number): string {
  if (eff >= THRESHOLD_NORMAL) return '일반 충전'
  if (eff >= THRESHOLD_SAVE)   return '절전 충전'
  return '배터리 보호 모드'
}

function toWeightSet(w: number[]): WeightSet {
  return { intercept: w[0], temp: w[1], humidity: w[2], rainfall: w[3] }
}

// ── 메인 핸들러 ───────────────────────────────────────────

export async function GET() {
  const steps: StepDetail[] = []

  // ── Step 1: 현재 날씨 — Open-Meteo (API 키 불필요) ───
  const { base_date: ud, base_time: ut } = getUltraSrtBaseTime()
  let curTemp = 20, curHumidity = 60, curRainfall = 0

  try {
    const p = new URLSearchParams({
      latitude: String(LATITUDE), longitude: String(LONGITUDE),
      current: 'temperature_2m,relative_humidity_2m,precipitation',
      timezone: 'Asia/Seoul',
    })
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    curTemp     = json.current?.temperature_2m        ?? 20
    curHumidity = json.current?.relative_humidity_2m  ?? 60
    curRainfall = json.current?.precipitation         ?? 0
    steps.push({ step: 1, label: '현재 날씨 수신', status: 'ok',
      request: `Open-Meteo Forecast API — 위도 ${LATITUDE}, 경도 ${LONGITUDE}`,
      received: `기온 ${curTemp}°C / 습도 ${curHumidity}% / 강수량 ${curRainfall}mm`,
      functions: ['fetch()', 'response.json()'],
      method: 'HTTP GET — current: temperature_2m, relative_humidity_2m, precipitation',
      constants: [`위도=${LATITUDE}`, `경도=${LONGITUDE}`, `base_date=${ud}`, `base_time=${ut}`] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '연결 실패'
    steps.push({ step: 1, label: '현재 날씨 수신', status: 'error', message: msg,
      request: 'Open-Meteo Forecast API', received: `오류 — ${msg}`,
      functions: ['fetch()'], method: 'HTTP GET', constants: [] })
    return NextResponse.json({ steps, error: msg }, { status: 502 })
  }

  // ── Step 2: 2024년 Training Set 수집 ─────────────────
  let trainX: number[][] = [], trainY: number[] = [], trainDates: string[] = []

  try {
    const { times, temps, humidities, rainfalls } = await fetchOpenMeteo('2024-01-01', '2024-12-31')
    const built = buildSamples(times, temps, humidities, rainfalls)
    trainX = built.X; trainY = built.y; trainDates = built.dates

    const rainyDays = trainX.filter(r => r[3] > 0).length
    const tMin = Math.min(...trainX.map(r => r[1])).toFixed(1)
    const tMax = Math.max(...trainX.map(r => r[1])).toFixed(1)
    const rMax = Math.max(...trainX.map(r => r[3])).toFixed(1)

    steps.push({ step: 2, label: '2024년 Training Set 수집', status: 'ok',
      request: 'Open-Meteo Archive API — 2024-01-01 ~ 2024-12-31 일별 날씨',
      received: `${trainX.length}일 샘플 — 기온 ${tMin}~${tMax}°C / 강수 있는 날 ${rainyDays}일 / 최대 ${rMax}mm`,
      functions: ['fetchOpenMeteo()', 'buildSamples()', 'randn() — Box-Muller'],
      model: '선형 모델 y = θ0 + θ1·T + θ2·H + θ3·R + ε',
      method: '일별 평균 기온·습도·강수 합계 → 기준 공식으로 레이블 생성 (노이즈 포함)',
      constants: [`기준 가중치: α=${REF_W_TEMP}, β=${REF_W_HUMIDITY}, γ=${REF_W_RAINFALL}`,
                  `ε ~ N(0, ${NOISE_STD}²)`, `위도=${LATITUDE}, 경도=${LONGITUDE}`] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Open-Meteo 오류'
    steps.push({ step: 2, label: '2024년 Training Set 수집', status: 'error', message: msg,
      request: 'Open-Meteo Archive 2024', received: msg, functions: ['fetchOpenMeteo()'],
      method: 'HTTP GET', constants: [] })
    return NextResponse.json({ steps, error: msg }, { status: 502 })
  }

  // ── Step 3: 가중치 학습 — 정규방정식 + 경사하강법 ────
  // 3-A: 정규방정식
  const weights  = fitLinear(trainX, trainY)
  const trainMSE = mse(trainX, trainY, weights)

  // 3-B: 특성 표준화 후 경사하강법 (lr별 비교)
  const means = [1, 2, 3].map(col => colStats(trainX, col).mean)
  const stds  = [1, 2, 3].map(col => colStats(trainX, col).std)

  const X_scaled = trainX.map(row => [
    1,
    (row[1] - means[0]) / stds[0],
    (row[2] - means[1]) / stds[1],
    (row[3] - means[2]) / stds[2],
  ])

  const lossCurves: LossCurve[] = []
  let   bestGdWeights: number[] = []

  for (const lr of GD_LRS) {
    const { weights: wScaled, losses } = gradientDescent(X_scaled, trainY, lr, GD_EPOCHS, GD_RECORD_EVERY)
    const wOriginal = descaleWeights(wScaled, means, stds)
    lossCurves.push({ lr, data: losses })
    if (lr === 0.1) bestGdWeights = wOriginal
  }

  const gdMSE = mse(trainX, trainY, bestGdWeights)

  steps.push({ step: 3, label: '가중치 학습 — 정규방정식 + 경사하강법', status: 'ok',
    request: `${trainX.length}개 샘플로 두 방법 동시 학습`,
    received: [
      `[정규방정식] θ0=${weights[0]?.toFixed(3)} θ1=${weights[1]?.toFixed(4)} θ2=${weights[2]?.toFixed(4)} θ3=${weights[3]?.toFixed(4)} MSE=${trainMSE.toFixed(3)}`,
      `[경사하강법] θ0=${bestGdWeights[0]?.toFixed(3)} θ1=${bestGdWeights[1]?.toFixed(4)} θ2=${bestGdWeights[2]?.toFixed(4)} θ3=${bestGdWeights[3]?.toFixed(4)} MSE=${gdMSE.toFixed(3)}`,
    ].join(' | '),
    functions: ['fitLinear() — 정규방정식', 'gradientDescent() — 경사하강법', 'descaleWeights()'],
    model: '정규방정식: θ=(XᵀX)⁻¹Xᵀy | 경사하강법: θ := θ - α∇MSE',
    method: '정규방정식: 가우시안 소거법 (1회) | 경사하강법: z-score 표준화 후 반복 업데이트',
    constants: [`GD 에폭=${GD_EPOCHS}`, `학습률=${GD_LRS.join('/')}`, '표준화: z-score'] })

  // ── Step 4: 2025년 Test Set 검증 ─────────────────────
  let testX: number[][] = [], testY: number[] = [], testDates: string[] = []

  try {
    const { times, temps, humidities, rainfalls } = await fetchOpenMeteo('2025-01-01', '2025-12-31')
    const built = buildSamples(times, temps, humidities, rainfalls)
    testX = built.X; testY = built.y; testDates = built.dates

    const testMSE    = mse(testX, testY, weights)
    const rainyDays  = testX.filter(r => r[3] > 0).length

    steps.push({ step: 4, label: '2025년 Test Set 수집 및 검증', status: 'ok',
      request: 'Open-Meteo Archive API — 2025-01-01 ~ 2025-12-31 일별 날씨',
      received: `${testX.length}일 샘플 / 강수 있는 날 ${rainyDays}일 | Test MSE = ${testMSE.toFixed(3)} (Train MSE = ${trainMSE.toFixed(3)})`,
      functions: ['fetchOpenMeteo()', 'buildSamples()', 'mse(testX, testY, weights)'],
      model: '학습된 선형 모델 (2024 훈련)',
      method: '2025 데이터에 학습된 가중치 적용 → 예측값 vs 레이블 MSE 계산',
      constants: [`Train MSE = ${trainMSE.toFixed(3)}`, `Test MSE = ${testMSE.toFixed(3)}`,
                  `일반화 오차 = ${Math.abs(testMSE - trainMSE).toFixed(3)}`] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Open-Meteo 오류'
    steps.push({ step: 4, label: '2025년 Test Set 수집', status: 'error', message: msg,
      request: 'Open-Meteo Archive 2025', received: msg, functions: ['fetchOpenMeteo()'],
      method: 'HTTP GET', constants: [] })
    return NextResponse.json({ steps, error: msg }, { status: 502 })
  }

  const testMSE = mse(testX, testY, weights)

  // ── Step 5: 오늘 날씨로 효율 예측 ────────────────────
  const efficiency = parseFloat(predict(weights, curTemp, curHumidity, curRainfall).toFixed(1))

  steps.push({ step: 5, label: '오늘 날씨로 배터리 효율 예측', status: 'ok',
    request: '현재 날씨에 정규방정식 학습 가중치 적용',
    received: `효율 ${efficiency}%`,
    functions: ['predict(weights, temp, humidity, rainfall)'],
    model: `학습된 선형 모델 (θ0=${weights[0]?.toFixed(3)})`,
    method: `${weights[0]?.toFixed(3)} + (${weights[1]?.toFixed(4)})×${curTemp} + (${weights[2]?.toFixed(4)})×${curHumidity} + (${weights[3]?.toFixed(4)})×${curRainfall}`,
    constants: weights.map((w, i) => `θ${i} = ${w.toFixed(4)}`) })

  // ── Step 6: 충전 방식 결정 ───────────────────────────
  const action = getAction(efficiency)

  steps.push({ step: 6, label: '충전 방식 결정', status: 'ok',
    request: '예측 효율 기반 충전 방식 분류', received: action,
    functions: ['getAction(efficiency)'],
    model: 'Rule-based (규칙 기반 분류)',
    method: '임계값(Threshold) 비교 — if-else 분기',
    constants: [`일반 충전 >= ${THRESHOLD_NORMAL}%`, `절전 충전 >= ${THRESHOLD_SAVE}%`,
                `보호 모드 < ${THRESHOLD_SAVE}%`] })

  // ── 차트 데이터 ──────────────────────────────────────
  const chartData = Array.from({ length: 10 }, (_, i) => {
    const t = curTemp - 5 + i
    return {
      label:     `${t.toFixed(1)}°C`,
      learned:   parseFloat(predict(weights, t, curHumidity, curRainfall).toFixed(1)),
      reference: parseFloat(Math.min(100, Math.max(0,
        100 - REF_W_TEMP * t - REF_W_HUMIDITY * curHumidity - REF_W_RAINFALL * curRainfall
      )).toFixed(1)),
    }
  })

  const monthMap = new Map<string, { actualSum: number; predSum: number; count: number }>()
  for (let i = 0; i < testX.length; i++) {
    const month = testDates[i].slice(0, 7)
    if (!monthMap.has(month)) monthMap.set(month, { actualSum: 0, predSum: 0, count: 0 })
    const m = monthMap.get(month)!
    m.actualSum += testY[i]
    m.predSum   += predict(weights, testX[i][1], testX[i][2], testX[i][3])
    m.count++
  }
  const predChart = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { actualSum, predSum, count }]) => ({
      date,
      actual:    parseFloat((actualSum / count).toFixed(1)),
      predicted: parseFloat((predSum   / count).toFixed(1)),
    }))

  const training: TrainingInfo = {
    trainSize:        trainX.length,
    testSize:         testX.length,
    learnedWeights:   toWeightSet(weights),
    gdWeights:        toWeightSet(bestGdWeights),
    referenceWeights: { temp: -REF_W_TEMP, humidity: -REF_W_HUMIDITY, rainfall: -REF_W_RAINFALL },
    trainMSE,
    gdTrainMSE:       gdMSE,
    testMSE,
  }

  const toSamples = (X: number[][], y: number[], dates: string[]): TrainingSample[] =>
    X.map((row, i) => ({
      date:        dates[i],
      temp:        parseFloat(row[1].toFixed(1)),
      humidity:    parseFloat(row[2].toFixed(1)),
      rainfall:    parseFloat(row[3].toFixed(1)),
      label:       parseFloat(y[i].toFixed(2)),
      predicted:   parseFloat(predict(weights,       row[1], row[2], row[3]).toFixed(2)),
      gdPredicted: parseFloat(predict(bestGdWeights, row[1], row[2], row[3]).toFixed(2)),
    }))

  return NextResponse.json({
    steps, weather: { temp: curTemp, humidity: curHumidity, rainfall: curRainfall },
    efficiency, action, base_date: ud, base_time: ut,
    training, lossCurves, chartData, predChart,
    trainSamples: toSamples(trainX, trainY, trainDates),
    testSamples:  toSamples(testX,  testY,  testDates),
  })
}
