// SK증권 WMCA c8201 (주식잔고조회) 응답 매핑

export type Holding = {
  code: string         // issue_code (6자리)
  name: string         // issue_name
  qty: number          // bal_qty
  avgPrice: number     // slby_amt (평균매입가)
  curPrice: number     // prsnt_price (현재가)
  marketValue: number  // ass_amt (평가금액)
  pnl: number          // lsnpf_amt (평가손익, 원 단위)
  pnlRate: number      // earn_rate (손익률 %)
}

export type AccountSummary = {
  netAsset: number      // asset_tot_amt (순자산액)
  totalPurchase: number // bal_buy_ttamt (매입원가합산)
  totalValue: number    // bal_ass_ttamt (평가금액합산)
  totalPnl: number      // tot_eal_pls (총평가손익)
  pnlRate: number       // pft_rt (수익률)
  deposit: number       // dpsit_amt (예수금)
  orderable: number     // order_pos_csamt (주문가능액)
}

export type TrendPoint = {
  date: string  // YYYY-MM-DD 또는 M/D
  asset: number // 순자산 평가액
}

export type PortfolioPayload = {
  summary: AccountSummary
  holdings: Holding[]
  trend: TrendPoint[]
  updatedAt: string  // ISO timestamp
  source: 'wmca' | 'mock'
}
