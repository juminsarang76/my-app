# WMCA 브리지 가이드

SK증권 WMCA OpenAPI → Next.js Portfolio 페이지 실시간 연동.

## 사전 준비

### 1. 32-bit Python 설치 (필수)

`wmca.dll`은 **32-bit 전용**입니다. 64-bit Python에서는 절대 로드되지 않습니다.

1. https://www.python.org/downloads/windows/ 접속
2. "Windows installer (32-bit)" 다운로드
3. 설치 후 확인:
   ```powershell
   python -c "import sys; print(sys.maxsize > 2**32)"
   # False 가 나와야 32-bit
   ```

### 2. 패키지 설치

```powershell
pip install requests
```

### 3. WMCA 파일 배치 확인

`C:\Users\Desktop\Downloads\openapi.nm\bin\` 폴더에 다음 파일들이 모두 있어야 함:
- `wmca.dll` (메인)
- `SKComm*.dll` (필수 의존성)
- `libeay32.dll`, `librsa32.dll`, `sha256w32.dll` (암호화)
- `CloudNPKI.dll` (인증서)

## 환경변수 설정

`.env.local` 파일(Next.js)과 별개로, Python 브리지는 PowerShell 세션 환경변수를 사용합니다.

### Next.js 측 (.env.local)

```
PORTFOLIO_BRIDGE_SECRET=임의의긴문자열_예를들어_64자_랜덤_헥스
```

### Python 측 (PowerShell)

```powershell
# 같은 시크릿 (필수)
$env:PORTFOLIO_BRIDGE_SECRET = "임의의긴문자열_예를들어_64자_랜덤_헥스"

# API 엔드포인트 (로컬 개발 시)
$env:PORTFOLIO_API = "http://localhost:3000/api/portfolio"
# 배포 후
# $env:PORTFOLIO_API = "https://your-app.vercel.app/api/portfolio"

# DLL 경로 (기본값 사용 시 생략 가능)
$env:WMCA_DLL_PATH = "C:\Users\Desktop\Downloads\openapi.nm\bin\wmca.dll"

# 로그인 정보 (당사 OpenAPI 신청 후 발급받은 값)
$env:WMCA_ID       = "OpenAPI_ID"
$env:WMCA_PW       = "OpenAPI_비밀번호"
$env:WMCA_CERT_PW  = "공인인증서_비밀번호"

# 계좌 정보
$env:WMCA_ACCOUNT_PWD   = "계좌_비밀번호"
$env:WMCA_ACCOUNT_INDEX = "1"   # 첫 번째 계좌 (계좌가 여러 개면 2,3,...)
```

## 실행

```powershell
# 1회 실행 (테스트)
python scripts/wmca_bridge.py

# 5분마다 자동 갱신 (운영)
python scripts/wmca_bridge.py --loop 300
```

## 정상 출력 예시

```
[INFO] Python: 32-bit
[INFO] Loading C:\Users\...\wmca.dll
[2026-05-25T...] === START ===
[OK] window=...
[INFO] wmcaConnect...
[WMCA] CA_CONNECTED, accounts=2
        [1] 12345678901 홍길동
[INFO] wmcaQuery c8201 (account=1)...
[WMCA] CA_RECEIVEDATA: block='c8201OutBlock' len=...
        순자산=23,357,500 평가=14,907,500 손익=+352,500
[WMCA] CA_RECEIVEDATA: block='c8201OutBlock1' len=...
        보유종목 6개
        - 삼성전자          수량=    50 손익=    +475,000 (+13.19%)
        ...
[WMCA] CA_RECEIVECOMPLETE
[OK] POST → 200 {'ok': True, 'updatedAt': '...'}
```

## 트러블슈팅

### "Failed to load wmca.dll"
- 32-bit Python에서 실행 중인지 확인
- DLL 폴더에 의존 DLL이 모두 있는지 확인
- 경로에 한글 포함 시 `WMCA_DLL_PATH`를 짧은 ASCII 경로로 복사 후 사용

### "wmcaConnect returned FALSE"
- `WMCA_ID`/`WMCA_PW`/`WMCA_CERT_PW` 정확성 확인
- SKComm 서비스가 실행 중인지 확인 (필요 시 `SKCommWB.exe` 실행)
- 인증서가 만료되지 않았는지 확인

### "Connect timeout (CA_CONNECTED 미수신)"
- 네트워크 차단 확인
- 인증서 다이얼로그가 떴는데 클릭하지 않은 경우 → `wmcaConnect` 대신 `wmcaConnectCert` 사용 필요

### "401 unauthorized" (POST 시)
- `PORTFOLIO_BRIDGE_SECRET`이 Next.js `.env.local` 값과 일치하는지 확인
- Next.js 서버 재시작 (`.env.local` 변경 시 재시작 필수)

### 데이터가 LIVE로 표시되지 않음
- `data/portfolio.json` 파일이 생성됐는지 확인
- 페이지 강제 새로고침 (Ctrl+Shift+R)

## 보안

- `WMCA_CERT_PW`, `WMCA_ACCOUNT_PWD`는 PowerShell 세션 변수로만 보관 — 파일에 저장하지 마세요
- `PORTFOLIO_BRIDGE_SECRET`은 충분히 긴 랜덤 문자열 사용 (32자 이상 권장)
- 운영 환경에서는 HTTPS API 엔드포인트 사용 권장
- `data/portfolio.json`은 git에서 자동 제외됨 (`data/.gitignore`)
