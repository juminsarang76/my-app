import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/%EC%A7%84%EC%A3%BC', destination: '/jinju', permanent: true },
      { source: '/%EC%A7%84%EC%A3%BC/%ED%8C%A8%EC%85%98%EC%A1%B0%EC%82%AC', destination: '/jinju/fashion', permanent: true },
    ]
  },
};

export default nextConfig;
