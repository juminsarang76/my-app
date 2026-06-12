// DART(금융감독원 전자공시) 연동 — 기업 재무·직원수 조회
// corpCode.xml(ZIP)은 콜드스타트 1회만 다운로드 후 모듈 캐시 재사용

import AdmZip from 'adm-zip'

const DART_API_KEY = process.env.DART_API_KEY
const DART_BASE = 'https://opendart.fss.or.kr/api'

interface CorpEntry { code: string; name: string; stock: string }

// 모듈 레벨 캐시 (웜 인스턴스 재사용)
let corpListCache: CorpEntry[] | null = null

async function loadCorpList(): Promise<CorpEntry[]> {
  if (corpListCache) return corpListCache
  const res = await fetch(`${DART_BASE}/corpCode.xml?crtfc_key=${DART_API_KEY}`)
  if (!res.ok) throw new Error(`DART corpCode ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const zip = new AdmZip(buf)
  const xml = zip.readAsText('CORPCODE.xml', 'utf8')

  const list: CorpEntry[] = []
  for (const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)) {
    const c = m[1]
    const code  = c.match(/<corp_code>(.*?)<\/corp_code>/)?.[1] ?? ''
    const name  = c.match(/<corp_name>(.*?)<\/corp_name>/)?.[1] ?? ''
    const stock = (c.match(/<stock_code>(.*?)<\/stock_code>/)?.[1] ?? '').trim()
    if (code && name) list.push({ code, name, stock })
  }
  corpListCache = list
  return list
}

// 기업명 → corp_code (정확일치 → startsWith → includes, 각 단계 상장사 우선)
export async function getCorpCode(companyName: string): Promise<CorpEntry | null> {
  if (!DART_API_KEY) return null
  const list = await loadCorpList()
  const q = companyName.trim()
  const norm = (s: string) => s.replace(/주식회사|\(주\)|㈜|\s/g, '')
  const nq = norm(q)

  const pick = (cands: CorpEntry[]) =>
    cands.find(c => c.stock) ?? cands[0] ?? null

  const exact = list.filter(c => norm(c.name) === nq)
  if (exact.length) return pick(exact)
  const starts = list.filter(c => norm(c.name).startsWith(nq))
  if (starts.length) return pick(starts)
  const incl = list.filter(c => norm(c.name).includes(nq))
  return incl.length ? pick(incl) : null
}

const toNum = (s?: string) => {
  if (!s) return null
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}
const toEok = (n: number | null) => n == null ? null : Math.round(n / 1e8)  // 원 → 억원

interface FinRow {
  revenue: number | null       // 분기보고서: 해당 분기 3개월 단독 / 사업보고서: 연간
  profit: number | null
  revenueCum: number | null    // 누적 (thstrm_add_amount, 분기보고서만)
  profitCum: number | null
}

// 단일 보고서의 매출액·영업이익 (연결재무제표 우선)
// DART 분기보고서(11013/11012/11014)의 thstrm_amount는 해당 분기 3개월 단독,
// thstrm_add_amount가 누적. 사업보고서(11011)는 thstrm_amount가 연간 전체.
async function fetchFin(corpCode: string, year: number, reprt: string): Promise<FinRow | null> {
  const res = await fetch(
    `${DART_BASE}/fnlttSinglAcnt.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprt}`
  )
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== '000' || !Array.isArray(data.list)) return null

  const find = (fs: string, acct: RegExp) =>
    data.list.find((it: Record<string, string>) => it.fs_nm === fs && acct.test(it.account_nm))
  const get = (acct: RegExp) => find('연결재무제표', acct) ?? find('재무제표', acct)

  const rev = get(/^(매출액|영업수익)$/)
  const prof = get(/^영업이익/)
  if (!rev && !prof) return null
  return {
    revenue:    toNum(rev?.thstrm_amount),
    profit:     toNum(prof?.thstrm_amount),
    revenueCum: toNum(rev?.thstrm_add_amount),
    profitCum:  toNum(prof?.thstrm_add_amount),
  }
}

// 단일 보고서의 직원수 합계
async function fetchEmp(corpCode: string, year: number, reprt: string): Promise<number | null> {
  const res = await fetch(
    `${DART_BASE}/empSttus.json?crtfc_key=${DART_API_KEY}&corp_code=${corpCode}&bsns_year=${year}&reprt_code=${reprt}`
  )
  if (!res.ok) return null
  const data = await res.json()
  if (data.status !== '000' || !Array.isArray(data.list)) return null
  let total = 0
  for (const it of data.list) {
    const n = toNum(it.sm)
    if (n != null) total += n
  }
  return total > 0 ? Math.round(total) : null
}

export interface DartSummary {
  corpName: string
  stockCode: string
  year: number
  revenueEok: number | null      // 억원
  revenuePrevEok: number | null
  profitEok: number | null
  profitPrevEok: number | null
  employees: number | null
}

// 요약 카드용 — 최신 사업보고서 (올해-1 → 올해-2 역순 시도)
export async function fetchDartFinancials(companyName: string): Promise<DartSummary | null> {
  if (!DART_API_KEY) return null
  try {
    const corp = await getCorpCode(companyName)
    if (!corp) return null
    const thisYear = new Date().getFullYear()

    for (const year of [thisYear - 1, thisYear - 2]) {
      const res = await fetch(
        `${DART_BASE}/fnlttSinglAcnt.json?crtfc_key=${DART_API_KEY}&corp_code=${corp.code}&bsns_year=${year}&reprt_code=11011`
      )
      if (!res.ok) continue
      const data = await res.json()
      if (data.status !== '000' || !Array.isArray(data.list)) continue

      const find = (fs: string, acct: RegExp) =>
        data.list.find((it: Record<string, string>) => it.fs_nm === fs && acct.test(it.account_nm))
      const get = (acct: RegExp) => find('연결재무제표', acct) ?? find('재무제표', acct)
      const rev = get(/^(매출액|영업수익)$/)
      const prof = get(/^영업이익/)
      if (!rev && !prof) continue

      const employees = await fetchEmp(corp.code, year, '11011')
      return {
        corpName: corp.name,
        stockCode: corp.stock,
        year,
        revenueEok:     toEok(toNum(rev?.thstrm_amount)),
        revenuePrevEok: toEok(toNum(rev?.frmtrm_amount)),
        profitEok:      toEok(toNum(prof?.thstrm_amount)),
        profitPrevEok:  toEok(toNum(prof?.frmtrm_amount)),
        employees,
      }
    }
    return null
  } catch (e) {
    console.warn('DART summary 실패:', (e as Error).message)
    return null
  }
}

export interface SeriesPoint { period: string; revenue: number | null; profit: number | null; employees: number | null }
export interface DartTimeseries { quarterly: SeriesPoint[]; yearly: SeriesPoint[] }

// 그래프용 시계열 — 연별 10년 + 분기별 2년 (병렬)
export async function fetchDartTimeseries(companyName: string): Promise<DartTimeseries | null> {
  if (!DART_API_KEY) return null
  try {
    const corp = await getCorpCode(companyName)
    if (!corp) return null
    const code = corp.code
    const thisYear = new Date().getFullYear()

    // ── 연별 10년 (올해-10 ~ 올해-1) ──
    const years = Array.from({ length: 10 }, (_, i) => thisYear - 10 + i)
    const yearlyResults = await Promise.allSettled(
      years.map(async y => ({
        year: y,
        fin: await fetchFin(code, y, '11011'),
        emp: await fetchEmp(code, y, '11011'),
      }))
    )
    const yearly: SeriesPoint[] = []
    for (const r of yearlyResults) {
      if (r.status !== 'fulfilled') continue
      const { year, fin, emp } = r.value
      if (!fin && emp == null) continue
      yearly.push({
        period: String(year),
        revenue: toEok(fin?.revenue ?? null),
        profit: toEok(fin?.profit ?? null),
        employees: emp,
      })
    }

    // ── 분기별 2년 (누적 → 분기 단독 환산) ──
    // reprt: 11013=1Q, 11012=반기(누적), 11014=3Q(누적), 11011=연간(누적)
    const qYears = [thisYear - 2, thisYear - 1, thisYear]
    const REPRTS = ['11013', '11012', '11014', '11011'] as const
    const qRaw = await Promise.allSettled(
      qYears.flatMap(y => REPRTS.map(async rc => ({
        year: y, reprt: rc,
        fin: await fetchFin(code, y, rc),
        emp: await fetchEmp(code, y, rc),
      })))
    )
    const cum: Record<string, { fin: FinRow | null; emp: number | null }> = {}
    for (const r of qRaw) {
      if (r.status !== 'fulfilled') continue
      cum[`${r.value.year}_${r.value.reprt}`] = { fin: r.value.fin, emp: r.value.emp }
    }

    const quarterly: SeriesPoint[] = []
    const sub = (a: number | null | undefined, b: number | null | undefined) =>
      a != null && b != null ? a - b : null
    for (const y of qYears) {
      const q1 = cum[`${y}_11013`], h = cum[`${y}_11012`], q3 = cum[`${y}_11014`], yr = cum[`${y}_11011`]
      // 분기보고서 thstrm_amount = 해당 분기 단독값. 4Q = 연간 − 3Q 누적(없으면 1~3Q 단독 합)
      const cumRev3 = q3?.fin?.revenueCum ?? (
        q1?.fin?.revenue != null && h?.fin?.revenue != null && q3?.fin?.revenue != null
          ? q1.fin.revenue + h.fin.revenue + q3.fin.revenue : null)
      const cumProf3 = q3?.fin?.profitCum ?? (
        q1?.fin?.profit != null && h?.fin?.profit != null && q3?.fin?.profit != null
          ? q1.fin.profit + h.fin.profit + q3.fin.profit : null)
      const pts: { label: string; rev: number | null; prof: number | null; emp: number | null }[] = [
        { label: `${y}.1Q`, rev: q1?.fin?.revenue ?? null, prof: q1?.fin?.profit ?? null, emp: q1?.emp ?? null },
        { label: `${y}.2Q`, rev: h?.fin?.revenue ?? null,  prof: h?.fin?.profit ?? null,  emp: h?.emp ?? null },
        { label: `${y}.3Q`, rev: q3?.fin?.revenue ?? null, prof: q3?.fin?.profit ?? null, emp: q3?.emp ?? null },
        { label: `${y}.4Q`, rev: sub(yr?.fin?.revenue, cumRev3), prof: sub(yr?.fin?.profit, cumProf3), emp: yr?.emp ?? null },
      ]
      for (const p of pts) {
        if (p.rev == null && p.prof == null && p.emp == null) continue
        quarterly.push({ period: p.label, revenue: toEok(p.rev), profit: toEok(p.prof), employees: p.emp })
      }
    }
    // 최근 8개 분기만
    const quarterly8 = quarterly.slice(-8)

    if (!yearly.length && !quarterly8.length) return null
    return { quarterly: quarterly8, yearly }
  } catch (e) {
    console.warn('DART timeseries 실패:', (e as Error).message)
    return null
  }
}
