import { supabase } from './supabase'

// 서버가 재시작·재배포돼도 남아야 하는 작은 상태를 담는 키-값 저장소.
// (갱신된 카카오 토큰, 마지막 전송 결과 등)
//
// app_state 테이블이 아직 없어도 앱이 깨지면 안 되므로 모든 실패를 삼킨다.
// 테이블 생성은 supabase-app-state.sql 참고.

export type KakaoTokenState = {
  accessToken: string
  refreshToken?: string
  // 액세스 토큰 만료 시각 (epoch ms)
  expiresAt: number
  updatedAt: string
}

export type SendState = {
  ok: boolean
  at: string          // ISO
  label: string       // 무엇을 보냈는지 (예: "오늘 입시뉴스 2026-09-21")
  error?: string
}

export async function getState<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('app_state')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return null
    return data.value as T
  } catch {
    return null
  }
}

export async function setState(key: string, value: unknown): Promise<void> {
  try {
    await supabase
      .from('app_state')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  } catch {
    // 저장 실패가 본 기능을 막으면 안 된다
  }
}

export const KAKAO_TOKEN_KEY = 'kakao_token'
export const KAKAO_SEND_KEY = 'kakao_last_send'
