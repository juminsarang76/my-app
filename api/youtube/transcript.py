import json
import re
from http.server import BaseHTTPRequestHandler
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound


def extract_video_id(url: str) -> str | None:
    patterns = [
        r'youtu\.be/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/(?:watch\?v=|embed/|shorts/)([a-zA-Z0-9_-]{11})',
        r'^([a-zA-Z0-9_-]{11})$',
    ]
    for p in patterns:
        m = re.search(p, url.strip())
        if m:
            return m.group(1)
    return None


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
            # 한국어 → 영어 → 자동 생성 순으로 시도
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            transcript = None
            lang = 'auto'
            for try_lang in ['ko', 'en']:
                try:
                    transcript = transcript_list.find_transcript([try_lang])
                    lang = try_lang
                    break
                except Exception:
                    continue

            if transcript is None:
                # 자동 생성 자막 (언어 무관)
                transcript = transcript_list.find_generated_transcript(
                    transcript_list._generated_transcripts.keys()
                    if transcript_list._generated_transcripts
                    else ['en', 'ko']
                )
                lang = 'auto'

            data = transcript.fetch()
            items = [
                {
                    'text': t['text'],
                    'start': int(t['start']),
                    'duration': int(t.get('duration', 0)),
                }
                for t in data
            ]
            self._json(200, {
                'videoId': video_id,
                'items': items,
                'lang': lang,
                'total': len(items),
            })

        except TranscriptsDisabled:
            self._json(500, {
                'error': '이 영상은 자막이 비활성화되어 있습니다.\n\n'
                         '자막이 있는 영상을 사용하거나 Whisper AI로 시도해보세요.'
            })
        except NoTranscriptFound:
            self._json(500, {
                'error': '자막(CC)이 없는 영상입니다. Whisper AI로 시도해보세요.'
            })
        except Exception as e:
            self._json(500, {'error': f'자막 가져오기 실패: {str(e)}'})

    def _json(self, status: int, data: dict):
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

    def log_message(self, format, *args):
        pass  # 로그 억제
