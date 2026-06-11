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

  return { monthly, industry }
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
    monthly:  genMonthly(),
    industry: genIndustry(),
    source: 'demo',
    demo: true,
  })
}
