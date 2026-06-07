import json
import re
from http.server import BaseHTTPRequestHandler

def extract_video_id(url: str):
    for p in [r'youtu\.be/([a-zA-Z0-9_-]{11})', r'v=([a-zA-Z0-9_-]{11})', r'^([a-zA-Z0-9_-]{11})$']:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None

def fetch_transcript(video_id: str):
    """버전 무관하게 자막 가져오기 시도"""
    from youtube_transcript_api import YouTubeTranscriptApi

    lang_combos = [['ko'], ['en'], None]

    # 방법 1: get_transcript 클래스 메서드 (0.6.1 이하)
    if hasattr(YouTubeTranscriptApi, 'get_transcript'):
        for langs in lang_combos:
            try:
                t = YouTubeTranscriptApi.get_transcript(video_id, *([{'languages': langs}] if langs else []))
                return t, langs[0] if langs else 'auto'
            except Exception:
                continue

    # 방법 2: 인스턴스 메서드 (0.6.2+ 또는 최신)
    try:
        api = YouTubeTranscriptApi()
        for langs in lang_combos:
            try:
                if hasattr(api, 'fetch'):
                    t = api.fetch(video_id, languages=langs) if langs else api.fetch(video_id)
                elif hasattr(api, 'get_transcript'):
                    t = api.get_transcript(video_id, languages=langs) if langs else api.get_transcript(video_id)
                else:
                    break
                return list(t), langs[0] if langs else 'auto'
            except Exception:
                continue
    except Exception:
        pass

    # 방법 3: list_transcripts (0.6.x)
    if hasattr(YouTubeTranscriptApi, 'list_transcripts'):
        tl = YouTubeTranscriptApi.list_transcripts(video_id)
        for lang in ['ko', 'en']:
            try:
                t = tl.find_transcript([lang]).fetch()
                return list(t), lang
            except Exception:
                continue
        try:
            first = next(iter(tl))
            return list(first.fetch()), 'auto'
        except Exception:
            pass

    raise Exception('자막을 가져올 수 없습니다.')


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}
        url = body.get('url', '')

        video_id = extract_video_id(url)
        if not video_id:
            self._json(400, {'error': '유효한 YouTube URL이 아닙니다.'})
            return

        try:
            raw, lang = fetch_transcript(video_id)
            items = [{'text': t.get('text', '') if isinstance(t, dict) else getattr(t, 'text', str(t)),
                      'start': int(t.get('start', 0) if isinstance(t, dict) else getattr(t, 'start', 0)),
                      'duration': int(t.get('duration', 0) if isinstance(t, dict) else getattr(t, 'duration', 0))}
                     for t in raw]
            self._json(200, {'videoId': video_id, 'items': items, 'lang': lang, 'total': len(items)})
        except Exception as e:
            msg = str(e)
            if any(k in msg.lower() for k in ['disabled', 'no transcript', 'subtitles']):
                self._json(500, {'error': '이 영상은 자막이 비활성화되어 있습니다.\n\nWhisper AI로 시도해보세요.'})
            else:
                self._json(500, {'error': f'자막 가져오기 실패: {msg}'})

    def _json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def log_message(self, *args):
        pass
