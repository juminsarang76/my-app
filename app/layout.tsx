import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My App",
  description: "양자뉴스 일일요약 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <nav style={{
          width: 200,
          minHeight: '100vh',
          borderRight: '1px solid #eee',
          padding: '32px 16px',
          fontFamily: 'sans-serif',
          flexShrink: 0
        }}>
          <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 24, color: '#111' }}>
            My App
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link href="/" style={{ fontSize: 13, color: '#555', textDecoration: 'none', padding: '6px 10px', borderRadius: 6 }}>
              할 일 목록
            </Link>
            <Link href="/reports" style={{ fontSize: 13, color: '#555', textDecoration: 'none', padding: '6px 10px', borderRadius: 6 }}>
              양자뉴스 일일요약
            </Link>
          </div>
        </nav>
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </body>
    </html>
  );
}