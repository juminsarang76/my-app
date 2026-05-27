<#
.SYNOPSIS
NH투자증권 나무 WMCA 브리지 대화식 실행 스크립트.

.DESCRIPTION
1) .env.local에서 PORTFOLIO_BRIDGE_SECRET 자동 로드
2) NH 계정 정보를 대화식으로 입력받음 (비밀번호는 화면에 표시 X)
3) 환경변수 세팅 후 32-bit Python으로 브리지 실행
4) 종료 시 환경변수 자동 정리

.PARAMETER Loop
지정 시 해당 초 간격으로 무한 반복 (예: -Loop 300 → 5분마다)

.EXAMPLE
.\run-bridge.ps1                # 1회 실행
.\run-bridge.ps1 -Loop 300      # 5분마다 반복
#>

param(
    [int]$Loop = 0
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$envLocal    = Join-Path $projectRoot '.env.local'
$bridgeScript = Join-Path $PSScriptRoot 'wmca_bridge.py'
$pythonExe   = 'C:\Python312-32\python.exe'

# ─── 사전 확인 ───
if (-not (Test-Path $pythonExe)) {
    Write-Host "[FATAL] 32-bit Python not found at $pythonExe" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $bridgeScript)) {
    Write-Host "[FATAL] bridge script not found: $bridgeScript" -ForegroundColor Red
    exit 1
}

# ─── SECRET 읽기 ───
$secret = $null
if (Test-Path $envLocal) {
    foreach ($line in Get-Content $envLocal) {
        if ($line -match '^\s*PORTFOLIO_BRIDGE_SECRET\s*=\s*(.+?)\s*$') {
            $secret = $matches[1].Trim('"').Trim("'")
            break
        }
    }
}

if (-not $secret) {
    Write-Host "[FATAL] PORTFOLIO_BRIDGE_SECRET not found in $envLocal" -ForegroundColor Red
    Write-Host "        Add it: echo 'PORTFOLIO_BRIDGE_SECRET=<random>' >> .env.local" -ForegroundColor Yellow
    exit 1
}

Write-Host "[OK] PORTFOLIO_BRIDGE_SECRET loaded from .env.local" -ForegroundColor Green

# ─── Helper: SecureString → 평문 변환 ───
function Convert-SecureToPlain {
    param([System.Security.SecureString]$Secure)
    $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    }
    finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}

# ─── 대화식 입력 ───
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " NH투자증권 나무 OpenAPI 로그인 정보 입력" -ForegroundColor Cyan
Write-Host " (비밀번호는 화면에 표시되지 않습니다)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$wmcaId = Read-Host -Prompt 'WMCA_ID (OpenAPI ID)'
if ([string]::IsNullOrWhiteSpace($wmcaId)) {
    Write-Host "[FATAL] ID is required" -ForegroundColor Red
    exit 1
}

$wmcaPwSec     = Read-Host -Prompt 'WMCA_PW (OpenAPI 비밀번호)'           -AsSecureString
$wmcaCertPwSec = Read-Host -Prompt 'WMCA_CERT_PW (공인인증서 비밀번호)'   -AsSecureString
$acctPwdSec    = Read-Host -Prompt 'WMCA_ACCOUNT_PWD (계좌 비밀번호)'     -AsSecureString
$acctIdx       = Read-Host -Prompt 'WMCA_ACCOUNT_INDEX (계좌 번호 인덱스, 기본=1)'
if ([string]::IsNullOrWhiteSpace($acctIdx)) { $acctIdx = '1' }

# ─── 환경변수 세팅 ───
$env:PORTFOLIO_BRIDGE_SECRET = $secret
$env:PORTFOLIO_API           = 'http://localhost:3000/api/portfolio'
$env:WMCA_ID                 = $wmcaId
$env:WMCA_PW                 = Convert-SecureToPlain -Secure $wmcaPwSec
$env:WMCA_CERT_PW            = Convert-SecureToPlain -Secure $wmcaCertPwSec
$env:WMCA_ACCOUNT_PWD        = Convert-SecureToPlain -Secure $acctPwdSec
$env:WMCA_ACCOUNT_INDEX      = $acctIdx

Write-Host ""
Write-Host "[OK] Credentials set in session env. Running bridge..." -ForegroundColor Green
Write-Host ""

# ─── 브리지 실행 ───
try {
    if ($Loop -gt 0) {
        & $pythonExe $bridgeScript --loop $Loop
    } else {
        & $pythonExe $bridgeScript
    }
}
finally {
    # ─── 종료 시 환경변수 정리 ───
    Write-Host ""
    Write-Host "[CLEANUP] Clearing credentials from session..." -ForegroundColor Yellow
    Remove-Item Env:WMCA_ID            -ErrorAction SilentlyContinue
    Remove-Item Env:WMCA_PW            -ErrorAction SilentlyContinue
    Remove-Item Env:WMCA_CERT_PW       -ErrorAction SilentlyContinue
    Remove-Item Env:WMCA_ACCOUNT_PWD   -ErrorAction SilentlyContinue
    Remove-Item Env:WMCA_ACCOUNT_INDEX -ErrorAction SilentlyContinue
    Remove-Item Env:PORTFOLIO_BRIDGE_SECRET -ErrorAction SilentlyContinue
    Write-Host "[CLEANUP] Done." -ForegroundColor Green
}
