import { createHash } from 'crypto'

export const ADMIN_EMAIL = 'juminsarang76@gmail.com'

export const ALL_MENUS = [
  { key: 'reports',   label: '정기요약',   href: '/reports',   desc: '양자뉴스 · AI 일일 요약' },
  { key: 'realtime',  label: '실시간요약', href: '/realtime',  desc: '실시간 뉴스 요약' },
  { key: 'stocks',    label: '재무',       href: '/stocks',    desc: '증시 지수 모니터링' },
  { key: 'todos',     label: '할 일',      href: '/todos',     desc: '개인 할 일 관리' },
  { key: 'battery',   label: '배터리',     href: '/battery',   desc: '배터리 현황' },
  { key: 'jinju',     label: '진주',       href: '/jinju',     desc: '진주 관련 정보' },
  { key: 'jungdeung', label: '중등부',     href: '/jungdeung', desc: '중등부 찬양 선곡' },
  { key: 'products',  label: '상품',       href: '/products',  desc: 'AI 상품 이미지 기획' },
  { key: 'garden',    label: '가든',       href: '/garden',    desc: '하루꽃 일기' },
] as const

export type MenuKey = (typeof ALL_MENUS)[number]['key']
export type UserRole = 'admin' | 'viewer'
export type UserStatus = 'pending' | 'approved' | 'rejected'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  permissions: string[]
}

export function hashPassword(pwd: string): string {
  return createHash('sha256').update(pwd).digest('hex')
}

const STORAGE_KEY = 'haru_user'

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch { return null }
}

export function setStoredUser(user: AuthUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function clearStoredUser() {
  localStorage.removeItem(STORAGE_KEY)
}

export function isAdmin(email: string) {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}
