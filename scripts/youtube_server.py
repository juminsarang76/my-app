#!/usr/bin/env python3
"""
YouTube 자막 로컬 서버 (HTTP)
haruflower.vercel.app에서 자막 가져오기 버튼 사용 가능

실행: python scripts/youtube_server.py
설치: pip install youtube-transcript-api

Chrome은 HTTPS 사이트에서 localhost HTTP 허용 — 인증서 불필요
"""

import sys
import json
import re
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

# Windows 한국어 터미널 UTF-8 출력 설정
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8765

def extract_video_id(url: str):
    for p in [r'youtu\.be/([a-zA-Z0-9_-]{11})',
              r'v=([a-zA-Z0-9_-]{11})',
              r'^([a-zA-Z0-9_-]{11})$']:
        m = re.search(p, url.strip())
        if m: return m.group(1)
    return None

def get_transcript(video_id: str):
    from youtube_transcript_api import YouTubeTranscriptApi
    api = YouTubeTranscriptApi()
    tl = api.list(video_id)
    transcript, lang = None, 'auto'
    for lg in ['ko', 'en']:
        try:
            transcript = tl.find_transcript([lg]); lang = lg; break
        except Exception:
            continue
    if transcript is None:
        transcript = next(iter(tl)); lang = transcript.language_code
    data = transcript.fetch()
    items = [{'text':  (t.text  if hasattr(t, 'text')  else t['text']).replace('\n', ' ').strip(),
              'start': int(t.start if hasattr(t, 'start') else t['start']),
              'duration': int(t.duration if hasattr(t, 'duration') else t.get('duration', 5))}
             for t in data if (t.text if hasattr(t, 'text') else t.get('text', '')).strip()]
    return items, lang

class Handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200); self._cors(); self.end_headers()

    def do_GET(self):
        p = urlparse(self.path)
        qs = parse_qs(p.query)

        if p.path == '/':
            body = b'<h2>YouTube Transcript Server OK</h2>'
            self.send_response(200); self._cors()
            self.send_header('Content-Type', 'text/html')
            self.end_headers(); self.wfile.write(body); return

        if p.path == '/health':
            self._json(200, {'status': 'ok'}); return

        if p.path == '/transcript':
            url = (qs.get('url') or [''])[0]
            if not url:
                self._json(400, {'error': 'url 파라미터 없음'}); return
            video_id = extract_video_id(url)
            if not video_id:
                self._json(400, {'error': '유효하지 않은 URL'}); return
            try:
                items, lang = get_transcript(video_id)
                self._json(200, {'videoId': video_id, 'items': items, 'lang': lang, 'total': len(items)})
            except Exception as e:
                self._json(500, {'error': str(e)})
            return

        self._json(404, {'error': 'not found'})

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status); self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def log_message(self, fmt, *args):
        print(f"  [{args[1]}] {args[0]}")

def main():
    print("=" * 45)
    print("  YouTube Transcript Local Server")
    print("=" * 45)
    print()
    print("패키지 확인 중...")
    os.system('pip install youtube-transcript-api -q')
    print()

    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f"[OK] 서버 시작: http://localhost:{PORT}")
    print()
    print("haruflower.vercel.app 에서 '자막 가져오기' 버튼 클릭하면 됩니다.")
    print()
    print("종료: Ctrl+C")
    print("-" * 45)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버 종료")
        server.shutdown()

if __name__ == '__main__':
    main()
