import type { NextConfig } from "next";

// 모든 응답에 적용할 보안 헤더.
// CSP는 기존 페이지(인라인 스타일·스크립트를 쓰는 정적 HTML 다수)를 깨뜨릴 수 있어
// 우선 프레이밍·MIME 스니핑·리퍼러 유출만 막는다.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  async redirects() {
    return [
      { source: '/%EC%A7%84%EC%A3%BC', destination: '/jinju', permanent: true },
      { source: '/%EC%A7%84%EC%A3%BC/%ED%8C%A8%EC%85%98%EC%A1%B0%EC%82%AC', destination: '/jinju/fashion', permanent: true },
    ]
  },
};

export default nextConfig;
