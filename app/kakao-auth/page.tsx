'use client'

import Script from 'next/script'
import { useState } from 'react'

declare global {
  interface Window {
    Kakao: {
      init: (key: string) => void
      isInitialized: () => boolean
      Auth: {
        authorize: (options: {
          redirectUri: string
          scope?: string
        }) => void
      }
      API: {
        request: (options: {
          url: string
          data?: Record<string, unknown>
        }) => Promise<{ scopes: { id: string; agreed: boolean }[] }>
      }
    }
  }
}

export default function KakaoAuthPage() {
  const jsKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  const apiUrl = process.env.NEXT_PUBLIC_API_URL
  const [scopeStatus, setScopeStatus] = useState<{ id: string; agreed: boolean }[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)

  const redirectUri = `${apiUrl}/api/kakao/callback`

  function handleSdkLoad() {
    if (jsKey && window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(jsKey)
    }
    setSdkReady(true)
  }

  async function checkScopes() {
    setChecking(true)
    try {
      const res = await window.Kakao.API.request({
        url: '/v2/user/scopes',
        data: { scopes: ['friends', 'talk_message'] },
      })
      setScopeStatus(res.scopes)
    } catch (e) {
      alert('동의 항목 확인 실패. 먼저 카카오 로그인이 필요합니다.\n아래 "동의 추가" 버튼을 바로 눌러주세요.')
    } finally {
      setChecking(false)
    }
  }

  function handleAuthorize() {
    if (!window.Kakao?.isInitialized()) {
      alert('카카오 SDK가 초기화되지 않았습니다. 잠시 후 다시 시도하세요.')
      return
    }
    window.Kakao.Auth.authorize({
      redirectUri,
      scope: 'friends,talk_message',
    })
  }

  const allAgreed = scopeStatus?.every((s) => s.agreed) ?? false

  return (
    <>
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
        integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
        crossOrigin="anonymous"
        onLoad={handleSdkLoad}
      />

      <div style={{
        fontFamily: 'sans-serif', minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FAFAFA',
      }}>
        <div style={{
          maxWidth: 480, width: '100%', margin: '0 auto',
          padding: '40px 24px', background: '#fff',
          borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔑</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
            카카오 추가 동의
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
            하루꽃 <strong>친구에게 보내기</strong> 기능에 필요한<br />
            카카오 스코프 동의를 진행합니다.
          </p>

          {/* 필요 스코프 */}
          <div style={{
            background: '#FFFBEB', border: '1px solid #FDE68A',
            borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 10 }}>필요한 동의 항목</div>
            {[
              { id: 'friends', icon: '👥', label: '카카오톡 친구 목록', desc: '앱을 허용한 친구 목록 조회' },
              { id: 'talk_message', icon: '💬', label: '카카오톡 메시지 전송', desc: '지정 친구에게 꽃 메시지 발송' },
            ].map((item) => {
              const status = scopeStatus?.find((s) => s.id === item.id)
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, marginBottom: 8 }}>
                  <span>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: '#92400E' }}>{item.label}</strong>
                    <span style={{ color: '#78350F', marginLeft: 6, fontSize: 12 }}>— {item.desc}</span>
                  </div>
                  {status && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: status.agreed ? '#D1FAE5' : '#FEE2E2',
                      color: status.agreed ? '#065F46' : '#991B1B',
                    }}>
                      {status.agreed ? '동의됨' : '미동의'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* 동의 상태 확인 */}
          {scopeStatus === null ? (
            <button
              onClick={checkScopes}
              disabled={checking || !sdkReady}
              style={{
                display: 'block', width: '100%', padding: '12px',
                background: '#F8FAFC', border: '1px solid #E2E8F0',
                borderRadius: 8, fontSize: 13, color: '#64748b',
                cursor: 'pointer', marginBottom: 12,
              }}
            >
              {checking ? '확인 중...' : '현재 동의 상태 확인'}
            </button>
          ) : allAgreed ? (
            <div style={{
              padding: '12px', background: '#D1FAE5', borderRadius: 8,
              fontSize: 13, color: '#065F46', fontWeight: 700, marginBottom: 12,
            }}>
              ✅ 모든 항목에 동의됨. 아래에서 새 토큰을 발급받으세요.
            </div>
          ) : null}

          {/* 동의 추가 버튼 */}
          <button
            onClick={handleAuthorize}
            disabled={!sdkReady}
            style={{
              display: 'block', width: '100%',
              padding: '14px', background: sdkReady ? '#FEE500' : '#e2e8f0',
              color: '#3C1E1E', border: 'none', borderRadius: 10,
              fontWeight: 700, fontSize: 16, cursor: sdkReady ? 'pointer' : 'not-allowed',
              marginBottom: 20,
            }}
          >
            {sdkReady ? '💬 카카오 동의 추가 + 토큰 발급' : 'SDK 로딩 중...'}
          </button>

          <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.8, textAlign: 'left' }}>
            <p>• 동의 완료 후 새 <code>KAKAO_ACCESS_TOKEN</code>, <code>KAKAO_REFRESH_TOKEN</code>이 표시됩니다.</p>
            <p>• 발급된 토큰을 Vercel 환경변수에 업데이트하고 Redeploy 하세요.</p>
            <p style={{ marginTop: 6 }}>Redirect URI (콘솔에 등록 필요):<br />
              <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, wordBreak: 'break-all' }}>
                {redirectUri}
              </code>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
