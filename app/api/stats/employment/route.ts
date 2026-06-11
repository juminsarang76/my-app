import { NextResponse } from 'next/server'

const KOSIS_API_KEY = process.env.KOSIS_API_KEY

// KOSIS 경제활동인구조사 — 성별(DT_1DA7004S), 산업별(DT_1DA7013)
const KOSIS_BASE = 'https://kosis.kr/openapi/Param/statisticsParameterData.do'

function kosisUrl(tblId: string, itmId: string, objL1: string, start: string, end: string) {
  const p = new URLSearchParams({
    method: 'getList',
    apiKey: KOSIS_API_KEY!,
    itmId,
    objL1,
    format: 'json',
    jsonVD: 'Y',
    prdSe: 'M',
    startPrdDe: start,
    endPrdDe: end,
    orgId: '101',
    tblId,
  })
  return `${KOSIS_BASE}?${p}`
}

interface KosisRow { PRD_DE: string; DT: string; ITM_NM: string; CLF_NM: string }

async function fetchKosis(url: string): Promise<KosisRow[]> {
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`KOSIS ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json)) throw new Error('KOSIS 응답 형식 오류')
  return json as KosisRow[]
}

// ── 데모 데이터 (KOSIS 키 없을 때) ─────────────────────────────────
function genMonthly() {
  // 한국 경제활동인구조사 근사치 (단위: 천명)
  const BASE = {
    total:  [27894,27650,28040,28310,28510,28490,28460,28550,28620,28490,28210,27980],
    male:   [15210,15060,15290,15450,15540,15520,15510,15570,15600,15510,15320,15180],
    female: [12684,12590,12750,12860,12970,12970,12950,12980,13020,12980,12890,12800],
    urate:  [3.5,3.8,3.4,2.9,2.7,2.8,2.9,2.5,2.6,2.8,3.0,3.2],  // 실업률 %
    erate:  [61.8,61.4,62.1,62.6,62.9,62.8,62.7,62.9,63.0,62.8,62.3,61.9],  // 고용률 %
  }
  const months: {date:string;total:number;male:number;female:number;urate:number;erate:number}[] = []
  const years = [2024, 2025, 2026]
  years.forEach((yr, yi) => {
    const len = yr === 2026 ? 6 : 12
    for (let m = 0; m < len; m++) {
      const idx = m % 12
      const drift = yi * 150  // 연간 소폭 증가
      months.push({
        date:    `${yr}.${String(m + 1).padStart(2, '0')}`,
        total:   BASE.total[idx]  + drift + Math.round((Math.random() - 0.5) * 80),
        male:    BASE.male[idx]   + Math.round(drift * 0.55) + Math.round((Math.random() - 0.5) * 40),
        female:  BASE.female[idx] + Math.round(drift * 0.45) + Math.round((Math.random() - 0.5) * 40),
        urate:   +(BASE.urate[idx]  + (Math.random() - 0.5) * 0.2 - yi * 0.1).toFixed(1),
        erate:   +(BASE.erate[idx]  + yi * 0.3 + (Math.random() - 0.5) * 0.2).toFixed(1),
      })
    }
  })
  return months
}

function genIndustry() {
  // 산업별 취업자 (최신 기준, 단위: 천명)
  return [
    { name: '제조업',          value: 4512 },
    { name: '도소매·음식·숙박', value: 5680 },
    { name: '사업·개인서비스',  value: 3820 },
    { name: '건강·복지',        value: 2940 },
    { name: '건설업',           value: 2070 },
    { name: '교육서비스',       value: 1890 },
    { name: '운수·창고',        value: 1560 },
    { name: '농림어업',         value: 1320 },
    { name: '금융·보험',        value:  890 },
    { name: '정보통신',         value:  830 },
    { name: '기타',             value: 2840 },
  ]
}

// 주요 산업별 월별 추이 (단위: 천명)
const IND_TREND_BASE = [
  { name: '제조업',          base: 4480, season: [-60,-40,10,40,50,40,20,30,40,20,-10,-40], drift:  6 },
  { name: '도소매·음식·숙박', base: 5600, season: [-120,-80,40,90,110,80,60,70,90,60,-30,-90], drift: 10 },
  { name: '사업·개인서비스',  base: 3760, season: [-50,-30,20,40,50,40,30,40,40,30,0,-30],   drift: 12 },
  { name: '건강·복지',        base: 2840, season: [10,20,30,40,40,40,40,40,40,40,30,20],     drift: 30 },
  { name: '건설업',           base: 2110, season: [-90,-70,0,50,70,50,30,40,50,30,-20,-80],  drift: -8 },
  { name: '농림어업',         base: 1300, season: [-180,-150,-40,80,160,140,100,90,110,60,-80,-160], drift: -2 },
]

function genIndustryMonthly() {
  const series = IND_TREND_BASE.map(s => ({ name: s.name, data: [] as { date: string; value: number }[] }))
  const years = [2024, 2025, 2026]
  years.forEach((yr, yi) => {
    const len = yr === 2026 ? 6 : 12
    for (let m = 0; m < len; m++) {
      const date = `${yr}.${String(m + 1).padStart(2, '0')}`
      IND_TREND_BASE.forEach((s, si) => {
        const value = s.base + s.season[m] + s.drift * (yi * 12 + m) / 6 + Math.round((Math.random() - 0.5) * 30)
        series[si].data.push({ date, value: Math.round(value) })
      })
    }
  })
  return series
}

// 산업별 실업률(직전 직장 기준, %) — 건설·제조 높고 건강복지 낮음
const IND_URATE_BASE = [
  { name: '건설업',           base: 4.2, season: [1.8,1.5,0.6,-0.4,-0.6,-0.4,-0.2,-0.3,-0.4,-0.2,0.6,1.4], drift: -0.02 },
  { name: '제조업',           base: 3.1, season: [0.6,0.5,0.1,-0.2,-0.3,-0.2,-0.1,-0.1,-0.2,-0.1,0.2,0.5], drift: -0.01 },
  { name: '도소매·음식·숙박', base: 3.6, season: [0.9,0.7,0.2,-0.3,-0.4,-0.3,-0.2,-0.2,-0.3,-0.1,0.3,0.7], drift: -0.015 },
  { name: '사업·개인서비스',  base: 2.8, season: [0.5,0.4,0.1,-0.2,-0.2,-0.2,-0.1,-0.1,-0.2,-0.1,0.2,0.4], drift: -0.01 },
  { name: '농림어업',         base: 2.0, season: [1.2,1.0,0.3,-0.5,-0.8,-0.7,-0.5,-0.4,-0.5,-0.3,0.4,1.0], drift: 0 },
  { name: '건강·복지',        base: 1.6, season: [0.3,0.2,0.1,-0.1,-0.1,-0.1,-0.1,-0.1,-0.1,0,0.1,0.2],   drift: -0.005 },
]

function genIndustryUrate() {
  const series = IND_URATE_BASE.map(s => ({ name: s.name, data: [] as { date: string; value: number }[] }))
  const years = [2024, 2025, 2026]
  years.forEach((yr, yi) => {
    const len = yr === 2026 ? 6 : 12
    for (let m = 0; m < len; m++) {
      const date = `${yr}.${String(m + 1).padStart(2, '0')}`
      IND_URATE_BASE.forEach((s, si) => {
        const v = s.base + s.season[m] + s.drift * (yi * 12 + m) + (Math.random() - 0.5) * 0.2
        series[si].data.push({ date, value: +Math.max(0.3, v).toFixed(1) })
      })
    }
  })
  return series
}

// 나이별 취업자 (단위: 천명)
const AGE_BASE = [
  { name: '15~29세', base: 3780, season: [-90,-70,30,70,80,60,40,50,70,40,-30,-80], drift: -12 },
  { name: '30~39세', base: 5460, season: [-40,-30,10,30,40,30,20,30,30,20,0,-30],   drift:  4 },
  { name: '40~49세', base: 6280, season: [-30,-20,10,20,30,20,20,20,20,20,0,-20],   drift: -3 },
  { name: '50~59세', base: 6390, season: [-40,-30,10,30,40,30,20,30,30,20,0,-30],   drift:  6 },
  { name: '60세 이상', base: 6480, season: [-200,-160,-40,90,170,150,110,100,120,70,-80,-180], drift: 24 },
]

function genAgeMonthly() {
  const series = AGE_BASE.map(s => ({ name: s.name, data: [] as { date: string; value: number }[] }))
  const years = [2024, 2025, 2026]
  years.forEach((yr, yi) => {
    const len = yr === 2026 ? 6 : 12
    for (let m = 0; m < len; m++) {
      const date = `${yr}.${String(m + 1).padStart(2, '0')}`
      AGE_BASE.forEach((s, si) => {
        const v = s.base + s.season[m] + s.drift * (yi * 12 + m) / 6 + Math.round((Math.random() - 0.5) * 25)
        series[si].data.push({ date, value: Math.round(v) })
      })
    }
  })
  return series
}

// ── 실제 KOSIS 호출 ──────────────────────────────────────────────────
async function fetchReal() {
  const [rows4S, rows13] = await Promise.all([
    fetchKosis(kosisUrl('DT_1DA7004S', 'T10+T50+T40', 'ALL', '202401', '202606')),
    fetchKosis(kosisUrl('DT_1DA7013',  'T10',          'ALL', '202601', '202606')),
  ])

  // 월별 통합
  const byDate: Record<string, { total?:number; male?:number; female?:number; urate?:number; erate?:number }> = {}
  for (const r of rows4S) {
    const d = `${r.PRD_DE.slice(0,4)}.${r.PRD_DE.slice(4)}`
    byDate[d] ??= {}
    const v = parseFloat(r.DT.replace(/,/g,''))
    if (r.CLF_NM === '전체' && r.ITM_NM === '취업자')   byDate[d].total  = v
    if (r.CLF_NM === '남'   && r.ITM_NM === '취업자')   byDate[d].male   = v
    if (r.CLF_NM === '여'   && r.ITM_NM === '취업자')   byDate[d].female = v
    if (r.CLF_NM === '전체' && r.ITM_NM === '실업률')   byDate[d].urate  = v
    if (r.CLF_NM === '전체' && r.ITM_NM === '고용률')   byDate[d].erate  = v
  }
  const monthly = Object.entries(byDate)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  // 산업별 (최신 6개월 평균)
  const indMap: Record<string, number[]> = {}
  for (const r of rows13) {
    const nm = r.CLF_NM
    if (!nm || nm === '전체') continue
    indMap[nm] ??= []
    indMap[nm].push(parseFloat(r.DT.replace(/,/g,'')))
  }
  const industry = Object.entries(indMap).map(([name, vals]) => ({
    name,
    value: Math.round(vals.reduce((a,b)=>a+b,0)/vals.length),
  })).sort((a,b) => b.value - a.value).slice(0, 11)

  // 산업별 월별 추이 — 전체 기간(202401~202606) 재조회 후 상위 6개 산업
  const indMonthlyMap: Record<string, { date: string; value: number }[]> = {}
  try {
    const rowsAll = await fetchKosis(kosisUrl('DT_1DA7013', 'T10', 'ALL', '202401', '202606'))
    for (const r of rowsAll) {
      const nm = r.CLF_NM
      if (!nm || nm === '전체') continue
      const date = `${r.PRD_DE.slice(0,4)}.${r.PRD_DE.slice(4)}`
      indMonthlyMap[nm] ??= []
      indMonthlyMap[nm].push({ date, value: parseFloat(r.DT.replace(/,/g,'')) })
    }
  } catch { /* 월별 산업 실패 시 빈 배열 */ }

  const topNames = industry.slice(0, 6).map(i => i.name)
  const industryMonthly = topNames
    .filter(n => indMonthlyMap[n]?.length)
    .map(name => ({
      name,
      data: indMonthlyMap[name].sort((a,b) => a.date.localeCompare(b.date)),
    }))

  return { monthly, industry, industryMonthly }
}

// ── Route Handler ────────────────────────────────────────────────────
export async function GET() {
  if (KOSIS_API_KEY) {
    try {
      const data = await fetchReal()
      return NextResponse.json({ ...data, source: 'KOSIS', demo: false })
    } catch (e) {
      console.warn('KOSIS 실패, 데모 데이터 사용:', (e as Error).message)
    }
  }
  return NextResponse.json({
    monthly:         genMonthly(),
    industry:        genIndustry(),
    industryMonthly: genIndustryMonthly(),
    industryUrate:   genIndustryUrate(),
    ageMonthly:      genAgeMonthly(),
    source: 'demo',
    demo: true,
  })
}
