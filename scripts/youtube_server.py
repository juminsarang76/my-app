#!/usr/bin/env python3
"""
YouTube 자막 로컬 서버
haruflower.vercel.app에서 직접 호출 가능

실행: python scripts/youtube_server.py
브라우저에서 https://localhost:8765 접속 → 인증서 허용 (최초 1회)

필요 패키지: pip install youtube-transcript-api
"""

import json
import re
import ssl
import os
import socket
import ipaddress
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# ── 자가 서명 인증서 생성 (HTTPS용) ──────────────────────────────────
def generate_self_signed_cert():
    """openssl 없이 Python cryptography 라이브러리로 인증서 생성"""
    cert_file = os.path.join(tempfile.gettempdir(), 'yt_local_cert.pem')
    key_file  = os.path.join(tempfile.gettempdir(), 'yt_local_key.pem')

    if os.path.exists(cert_file) and os.path.exists(key_file):
        return cert_file, key_file

    try:
        from cryptography import x509
        from cryptography.x509.oid import NameOID
        from cryptography.hazmat.primitives import hashes, serialization
        from cryptography.hazmat.primitives.asymmetric import rsa
        import datetime

        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
        cert = (
            x509.CertificateBuilder()
            .subject_name(name)
            .issuer_name(name)
            .public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(datetime.datetime.utcnow())
            .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=365))
            .add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'), x509.IPAddress(ipaddress.IPv4Address('127.0.0.1'))]), critical=False)
            .sign(key, hashes.SHA256())
        )
        with open(cert_file, 'wb') as f:
            f.write(cert.public_bytes(serialization.Encoding.PEM))
        with open(key_file, 'wb') as f:
            f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption()))
        return cert_file, key_file
    except ImportError:
        print("⚠️  cryptography 미설치 → HTTP 모드로 실행 (인증서 없음)")
        print("   HTTPS 원하면: pip install cryptography")
        return None, None


def extract_video_id(url: str) -> str | None:
    for p in [r'youtu\.be/([a-zA-Z0-9_-]{11})', r'v=([a-zA-Z0-9_-]{11})', r'^([a-zA-Z0-9_-]{11})$']:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None


def get_transcript(video_id: str) -> tuple[list, str]:
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    tl = api.list(video_id)
    transcript = None
    lang = 'auto'
    for try_lang in ['ko', 'en']:
        try:
            transcript = tl.find_transcript([try_lang]); lang = try_lang; break
        except Exception:
            continue
    if transcript is None:
        transcript = next(iter(tl)); lang = transcript.language_code
    data = transcript.fetch()
    items = [{'text': t.text if hasattr(t, 'text') else t['text'],
               'start': int(t.start if hasattr(t, 'start') else t['start']),
               'duration': int(t.duration if hasattr(t, 'duration') else t.get('duration', 5))}
             for t in data]
    return items, lang


class TranscriptHandler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors(); self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        # 브라우저 인증서 허용 확인 페이지
        if parsed.path == '/':
            body = '<h2>YouTube Transcript Server Running!</h2><p>haruflower.vercel.app OK</p>'.encode('utf-8')
            self.send_response(200); self._cors()
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers(); self.wfile.write(body); return

        if parsed.path == '/health':
            self._json(200, {'status': 'ok', 'server': 'youtube-transcript-local'})
            return

        if parsed.path == '/transcript':
            url = (qs.get('url') or qs.get('v') or [''])[0]
            if not url:
                self._json(400, {'error': 'url 파라미터 없음'}); return
            video_id = extract_video_id(url)
            if not video_id:
                self._json(400, {'error': '유효한 YouTube URL 아님'}); return
            try:
                items, lang = get_transcript(video_id)
                self._json(200, {'videoId': video_id, 'items': items, 'lang': lang, 'total': len(items)})
            except Exception as e:
                self._json(500, {'error': str(e)})
            return

        self._json(404, {'error': '경로 없음'})

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status); self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, fmt, *args):
        print(f"  {self.address_string()} — {fmt % args}")


def main():
    PORT = 8765
    print("=" * 50)
    print("  YouTube Transcript Local Server")
    print("=" * 50)
    print()
    print("패키지 설치 중...")
    os.system('pip install youtube-transcript-api -q')

    cert_file, key_file = generate_self_signed_cert()
    use_https = cert_file is not None

    server = HTTPServer(('127.0.0.1', PORT), TranscriptHandler)

    if use_https:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert_file, key_file)
        server.socket = ctx.wrap_socket(server.socket, server_side=True)
        proto = 'https'
        print(f"✅ HTTPS 서버 시작: https://localhost:{PORT}")
        print()
        print("⚠️  최초 1회: 브라우저에서 아래 주소 접속 후 인증서 허용")
        print(f"   → https://localhost:{PORT}")
    else:
        proto = 'http'
        print(f"✅ HTTP 서버 시작: http://localhost:{PORT}")

    print()
    print(f"haruflower.vercel.app의 설정(⚙️)에서 로컬 서버 활성화 후 사용")
    print()
    print("종료: Ctrl+C")
    print("-" * 50)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버 종료")
        server.shutdown()


if __name__ == '__main__':
    main()
