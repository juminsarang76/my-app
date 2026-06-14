// 차트 공용 타입
export interface IndRow { name: string; value: number }
export interface IndSeries { name: string; data: { date: string; value: number }[] }
export interface SeriesPoint {
  period: string
  revenue: number | null
  profit: number | null
  employees: number | null
}
