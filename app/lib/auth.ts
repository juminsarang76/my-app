import { createHash } from 'crypto'

export const ADMIN_EMAIL = 'juminsarang76@gmail.com'

export const ALL_MENUS = [
  { key: 'reports',   label: '정기요약',   href: '/reports',   desc: '양자뉴스 · AI 일일 요약' },
  { key: 'realtime',  label: '실시간요약', href: '/realtime',  desc: '실시간 뉴스 요약' },
  { key: 'stocks',    label: '재무',       href: '/stocks',    desc: '증시 지수 모니터링' },
  { key: 'todos',     label: '할 일',      href: '/todos',     desc: '개인 할 일 관리' },
  { key: 'battery',   label: '배터리',     href: '/battery',   desc: '배터리 현황' },
  { key: 'jinju',     label: '진주',       href: '/jinju',     desc: '진주 관련 정보' },
  { key: 'jungdeung', label: '교회',       href: '/jungdeung', desc: '교회 — 찬양 선곡 · 가정예배' },
  { key: 'products',  label: '상품',       href: '/products',  desc: 'AI 상품 이미지 기획' },
  { key: 'garden',    label: '가든',       href: '/garden',    desc: '하루꽃 일기' },
  { key: 'youtube',   label: '유튜브 자막', href: '/youtube',   desc: 'YouTube 자막 번역·요약' },
  { key: 'stats',     label: '통계',        href: '/stats',     desc: '취업·경제 국가통계' },
  { key: 'minjun',    label: '민준입시',    href: '/민준입시.html', desc: '민준 입시 정보' },
  { key: 'lecture',   label: '강의',        href: '/강의.html',     desc: '강의 자료' },
  { key: 'mdjob',     label: 'MDjob',       href: '/mdjob',         desc: 'MD 취업준비 · 기업분석/VOC' },
  { key: 'articlemd', label: 'ArticleMD',   href: '/articlemd',     desc: '마크다운 아티클 뷰어' },
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

// 서버에서 최신 권한을 가져와 갱신한다.
// admin은 항상 ALL_MENUS 전체. 일반 유저는 Supabase에 승인된 권한만.
// 실패 시 기존 stored 값을 그대로 반환(메뉴가 갑자기 비지 않도록).
export async function fetchFreshUser(stored: AuthUser): Promise<AuthUser> {
  if (isAdmin(stored.email)) {
    return { ...stored, permissions: ALL_MENUS.map(m => m.key) }
  }
  try {
    const res = await fetch(`/api/auth/me?email=${encodeURIComponent(stored.email)}`, { cache: 'no-store' })
    if (!res.ok) return stored
    const data = await res.json()
    if (!data || data.error) return stored
    return {
      ...stored,
      name: data.name ?? stored.name,
      permissions: Array.isArray(data.permissions) ? data.permissions : stored.permissions,
    }
  } catch {
    return stored
  }
}
