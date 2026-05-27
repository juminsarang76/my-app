"""
NH투자증권 나무 WMCA OpenAPI → Next.js Portfolio 브리지 (완전 구현)

▌요구사항
    - Windows 32-bit Python 3.x (wmca.dll이 32-bit 전용)
    - pip install requests

▌환경변수 (.env 또는 PowerShell)
    $env:PORTFOLIO_BRIDGE_SECRET = "임의의긴문자열"
    $env:PORTFOLIO_API           = "http://localhost:3000/api/portfolio"
    $env:WMCA_DLL_PATH           = "C:\\Users\\Desktop\\Downloads\\openapi.nm\\bin\\wmca.dll"
    $env:WMCA_ID                 = "당사 OpenAPI ID"
    $env:WMCA_PW                 = "OpenAPI 비밀번호"
    $env:WMCA_CERT_PW            = "공인인증서 비밀번호"
    $env:WMCA_ACCOUNT_PWD        = "계좌 비밀번호"
    $env:WMCA_ACCOUNT_INDEX      = "1"  # 첫 번째 계좌

▌실행
    python scripts/wmca_bridge.py                # 1회 실행
    python scripts/wmca_bridge.py --loop 300     # 5분마다 반복

▌주의사항
    1) 반드시 32-bit Python에서 실행 (wmca.dll은 32-bit DLL)
       64-bit Python으로 실행 시 OSError 발생.
       32-bit Python 다운로드: https://www.python.org/downloads/windows/
       "Windows installer (32-bit)" 선택
    2) 첫 실행 시 공동인증서 선택 다이얼로그가 뜰 수 있음
       → 이 경우 wmcaConnect 대신 wmcaConnectCert를 사용해야 할 수 있음
    3) bin 폴더의 다른 DLL들(SKComm*.dll, libeay32.dll 등)이 wmca.dll과 같은 폴더에 있어야 함
"""

import os
import sys
import time
import json
import ctypes
from ctypes import (
    WINFUNCTYPE, c_int, c_char, c_char_p, c_void_p, c_bool,
    POINTER, Structure, sizeof, byref, cast, c_uint, c_long, c_ulong,
)
from ctypes.wintypes import (
    HWND, DWORD, WPARAM, LPARAM, MSG, HINSTANCE, UINT, BOOL, LPCSTR,
)
import argparse
from datetime import datetime

try:
    import requests
except ImportError:
    print('[ERROR] requests 패키지 필요: pip install requests')
    sys.exit(1)

# ─── 환경변수 ───
WMCA_DLL_PATH   = os.environ.get('WMCA_DLL_PATH',          r'C:\Users\Desktop\Downloads\openapi.nm\bin\wmca.dll')
API_URL         = os.environ.get('PORTFOLIO_API',          'http://localhost:3000/api/portfolio')
BRIDGE_SECRET   = os.environ.get('PORTFOLIO_BRIDGE_SECRET', '')
WMCA_ID         = os.environ.get('WMCA_ID',                '')
WMCA_PW         = os.environ.get('WMCA_PW',                '')
WMCA_CERT_PW    = os.environ.get('WMCA_CERT_PW',           '')
ACCOUNT_PWD     = os.environ.get('WMCA_ACCOUNT_PWD',       '')
ACCOUNT_INDEX   = int(os.environ.get('WMCA_ACCOUNT_INDEX', '1'))

# ─── WMCA 이벤트 코드 ───
WM_USER             = 0x0400
CA_WMCAEVENT        = WM_USER + 8400
CA_CONNECTED        = WM_USER + 110
CA_DISCONNECTED     = WM_USER + 120
CA_SOCKETERROR      = WM_USER + 130
CA_RECEIVEDATA      = WM_USER + 210
CA_RECEIVESISE      = WM_USER + 220
CA_RECEIVEMESSAGE   = WM_USER + 230
CA_RECEIVECOMPLETE  = WM_USER + 240
CA_RECEIVEERROR     = WM_USER + 250

TRID_C8201 = 8201


# ─── c8201 입출력 구조체 (각 필드 = 데이터 + 1바이트 separator) ───
class C8201InBlock(Structure):
    _pack_ = 1
    _fields_ = [
        ('pswd_no', c_char * 44),     ('_pswd_no', c_char),       # 비밀번호 (hash 44자)
        ('bnc_bse_cd', c_char * 1),   ('_bnc_bse_cd', c_char),    # 잔고구분 1:체결잔고
        ('aet_bse', c_char * 1),      ('_aet_bse', c_char),       # 자산기준 1:순자산
        ('qut_dit_cd', c_char * 3),   ('_qut_dit_cd', c_char),    # 시세구분 UNT/KRX/NXT
    ]


class C8201OutBlock(Structure):
    _pack_ = 1
    _fields_ = [
        ('dpsit_amt',        c_char * 16), ('_dpsit_amt',        c_char),
        ('mrgn_amt',         c_char * 16), ('_mrgn_amt',         c_char),
        ('mgint_npaid_amt',  c_char * 16), ('_mgint_npaid_amt',  c_char),
        ('chgm_pos_amt',     c_char * 16), ('_chgm_pos_amt',     c_char),
        ('cash_mrgn_amt',    c_char * 16), ('_cash_mrgn_amt',    c_char),
        ('subst_mgamt_amt',  c_char * 16), ('_subst_mgamt_amt',  c_char),
        ('coltr_rate',       c_char *  6), ('_coltr_rate',       c_char),
        ('rcble_amt',        c_char * 16), ('_rcble_amt',        c_char),
        ('order_pos_csamt',  c_char * 16), ('_order_pos_csamt',  c_char),
        ('ecn_pos_csamt',    c_char * 16), ('_ecn_pos_csamt',    c_char),
        ('nordm_loan_amt',   c_char * 16), ('_nordm_loan_amt',   c_char),
        ('etc_lend_amt',     c_char * 16), ('_etc_lend_amt',     c_char),
        ('subst_amt',        c_char * 16), ('_subst_amt',        c_char),
        ('sln_sale_amt',     c_char * 16), ('_sln_sale_amt',     c_char),
        ('bal_buy_ttamt',    c_char * 16), ('_bal_buy_ttamt',    c_char),
        ('bal_ass_ttamt',    c_char * 16), ('_bal_ass_ttamt',    c_char),
        ('asset_tot_amt',    c_char * 16), ('_asset_tot_amt',    c_char),
        ('actvt_type',       c_char * 10), ('_actvt_type',       c_char),
        ('lend_amt',         c_char * 16), ('_lend_amt',         c_char),
        ('accnt_mgamt_rate', c_char *  6), ('_accnt_mgamt_rate', c_char),
        ('sl_mrgn_amt',      c_char * 16), ('_sl_mrgn_amt',      c_char),
        ('pos_csamt1',       c_char * 16), ('_pos_csamt1',       c_char),
        ('pos_csamt2',       c_char * 16), ('_pos_csamt2',       c_char),
        ('pos_csamt3',       c_char * 16), ('_pos_csamt3',       c_char),
        ('pos_csamt4',       c_char * 16), ('_pos_csamt4',       c_char),
        ('dpsit_amt_d1',     c_char * 16), ('_dpsit_amt_d1',     c_char),
        ('dpsit_amt_d2',     c_char * 16), ('_dpsit_amt_d2',     c_char),
        ('notice',           c_char * 30), ('_notice',           c_char),
        ('tot_eal_pls',      c_char * 18), ('_tot_eal_pls',      c_char),
        ('pft_rt',           c_char * 15), ('_pft_rt',           c_char),
        ('nas_tot_amt',      c_char * 18), ('_nas_tot_amt',      c_char),
        ('nas_tot_txt',      c_char *  8), ('_nas_tot_txt',      c_char),
    ]


class C8201OutBlock1(Structure):
    _pack_ = 1
    _fields_ = [
        ('issue_code',        c_char *  6), ('_issue_code',        c_char),
        ('issue_name',        c_char * 40), ('_issue_name',        c_char),
        ('bal_type',          c_char *  6), ('_bal_type',          c_char),
        ('loan_date',         c_char * 10), ('_loan_date',         c_char),
        ('bal_qty',           c_char * 16), ('_bal_qty',           c_char),
        ('unstl_qty',         c_char * 16), ('_unstl_qty',         c_char),
        ('slby_amt',          c_char * 16), ('_slby_amt',          c_char),
        ('prsnt_price',       c_char * 16), ('_prsnt_price',       c_char),
        ('lsnpf_amt',         c_char * 16), ('_lsnpf_amt',         c_char),
        ('earn_rate',         c_char *  9), ('_earn_rate',         c_char),
        ('mrgn_code',         c_char *  4), ('_mrgn_code',         c_char),
        ('jan_qty',           c_char * 16), ('_jan_qty',           c_char),
        ('expr_date',         c_char * 10), ('_expr_date',         c_char),
        ('ass_amt',           c_char * 16), ('_ass_amt',           c_char),
        ('issue_mgamt_rate',  c_char *  6), ('_issue_mgamt_rate',  c_char),
        ('medo_slby_amt',     c_char * 16), ('_medo_slby_amt',     c_char),
        ('post_lsnpf_amt',    c_char * 16), ('_post_lsnpf_amt',    c_char),
    ]


class RECEIVED(Structure):
    _pack_ = 1
    _fields_ = [
        ('szBlockName', c_char_p),
        ('szData',      c_void_p),
        ('nLen',        c_int),
    ]


class OUTDATABLOCK(Structure):
    _pack_ = 1
    _fields_ = [
        ('TrIndex', c_int),
        ('pData',   POINTER(RECEIVED)),
    ]


class ACCOUNTINFO(Structure):
    _pack_ = 1
    _fields_ = [
        ('szAccountNo',   c_char * 11),
        ('szAccountName', c_char * 40),
        ('act_pdt_cd',    c_char *  3),
        ('amn_tab_cd',    c_char *  4),
        ('expr_date',     c_char *  8),
        ('granted',       c_char),
        ('filler',        c_char * 189),
    ]


class LOGININFO(Structure):
    _pack_ = 1
    _fields_ = [
        ('szDate',         c_char * 14),
        ('szServerName',   c_char * 15),
        ('szUserID',       c_char *  8),
        ('szAccountCount', c_char *  3),
        ('accountlist',    ACCOUNTINFO * 999),
    ]


class LOGINBLOCK(Structure):
    _pack_ = 1
    _fields_ = [
        ('TrIndex',     c_int),
        ('pLoginInfo',  POINTER(LOGININFO)),
    ]


# ─── 전역 상태 ───
class State:
    connected = False
    summary = None
    holdings = []
    receive_complete = False
    error = None


state = State()


# ─── 파싱 헬퍼 ───
def parse_int(b: bytes) -> int:
    s = b.decode('ascii', errors='ignore').strip()
    if not s or s == '-':
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def parse_float(b: bytes) -> float:
    s = b.decode('ascii', errors='ignore').strip()
    if not s or s == '-':
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def parse_summary(d: C8201OutBlock) -> dict:
    deposit       = parse_int(d.dpsit_amt)
    asset_tot     = parse_int(d.asset_tot_amt)
    bal_buy_tt    = parse_int(d.bal_buy_ttamt)
    bal_ass_tt    = parse_int(d.bal_ass_ttamt)
    tot_pl        = parse_int(d.tot_eal_pls)
    pft_rt        = parse_float(d.pft_rt)
    order_pos     = parse_int(d.order_pos_csamt)
    return {
        'netAsset':      asset_tot if asset_tot else (bal_ass_tt + deposit),
        'totalPurchase': bal_buy_tt,
        'totalValue':    bal_ass_tt,
        'totalPnl':      tot_pl,
        'pnlRate':       pft_rt,
        'deposit':       deposit,
        'orderable':     order_pos,
    }


def parse_holding(d: C8201OutBlock1) -> dict:
    code         = d.issue_code.decode('ascii', errors='ignore').strip()
    name         = d.issue_name.decode('cp949', errors='ignore').strip()
    qty          = parse_int(d.jan_qty) or parse_int(d.bal_qty)
    avg_price    = parse_int(d.slby_amt)
    cur_price    = parse_int(d.prsnt_price)
    market_value = parse_int(d.ass_amt)
    pnl_kw       = parse_int(d.lsnpf_amt)   # 천원 단위
    pnl_rate     = parse_float(d.earn_rate)
    return {
        'code':        code,
        'name':        name,
        'qty':         qty,
        'avgPrice':    avg_price,
        'curPrice':    cur_price,
        'marketValue': market_value,
        'pnl':         pnl_kw * 1000,        # 천원 → 원
        'pnlRate':     pnl_rate,
    }


# ─── DLL 로드 ───
def load_dll():
    print(f'[INFO] Python: {64 if sys.maxsize > 2**32 else 32}-bit')
    if sys.maxsize > 2**32:
        print('[FATAL] 64-bit Python detected. wmca.dll requires 32-bit Python.')
        print('        32-bit Python: https://www.python.org/downloads/windows/')
        sys.exit(1)

    print(f'[INFO] Loading {WMCA_DLL_PATH}')
    try:
        # WinDLL = __stdcall calling convention
        return ctypes.WinDLL(WMCA_DLL_PATH)
    except OSError as e:
        print(f'[FATAL] Failed to load wmca.dll: {e}')
        print('        Check that DLL exists and dependent DLLs are in the same folder.')
        sys.exit(1)


def setup_prototypes(wmca):
    wmca.wmcaLoad.restype  = c_bool
    wmca.wmcaLoad.argtypes = []

    wmca.wmcaFree.restype  = c_bool
    wmca.wmcaFree.argtypes = []

    wmca.wmcaIsConnected.restype  = c_bool
    wmca.wmcaIsConnected.argtypes = []

    wmca.wmcaConnect.restype  = c_bool
    wmca.wmcaConnect.argtypes = [HWND, DWORD, c_char, c_char, c_char_p, c_char_p, c_char_p]

    wmca.wmcaConnectCert.restype  = c_bool
    wmca.wmcaConnectCert.argtypes = [HWND, DWORD, c_char, c_char, c_int]

    wmca.wmcaDisconnect.restype  = c_bool
    wmca.wmcaDisconnect.argtypes = []

    wmca.wmcaQuery.restype  = c_bool
    wmca.wmcaQuery.argtypes = [HWND, c_int, c_char_p, c_char_p, c_int, c_int]

    wmca.wmcaSetAccountIndexPwd.restype  = c_bool
    wmca.wmcaSetAccountIndexPwd.argtypes = [c_char_p, c_int, c_char_p]


# ─── Win32 윈도우 생성 (메시지 수신용) ───
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

WNDPROC = WINFUNCTYPE(c_long, HWND, UINT, WPARAM, LPARAM)


class WNDCLASS(Structure):
    _fields_ = [
        ('style',         UINT),
        ('lpfnWndProc',   WNDPROC),
        ('cbClsExtra',    c_int),
        ('cbWndExtra',    c_int),
        ('hInstance',     HINSTANCE),
        ('hIcon',         c_void_p),
        ('hCursor',       c_void_p),
        ('hbrBackground', c_void_p),
        ('lpszMenuName',  LPCSTR),
        ('lpszClassName', LPCSTR),
    ]


user32.DefWindowProcA.restype  = c_long
user32.DefWindowProcA.argtypes = [HWND, UINT, WPARAM, LPARAM]


def handle_wmca_event(sub_msg: int, lparam: int):
    """wmca.dll 이 보낸 sub-event 디스패치"""
    if sub_msg == CA_CONNECTED:
        try:
            login_block = ctypes.cast(lparam, POINTER(LOGINBLOCK)).contents
            login_info  = login_block.pLoginInfo.contents
            count       = int(login_info.szAccountCount.decode('ascii').strip() or '0')
            print(f'[WMCA] CA_CONNECTED, accounts={count}')
            for i in range(min(count, 5)):
                acc = login_info.accountlist[i]
                acc_no = acc.szAccountNo.decode('ascii', errors='ignore').strip()
                acc_nm = acc.szAccountName.decode('cp949', errors='ignore').strip()
                print(f'        [{i+1}] {acc_no} {acc_nm}')
        except Exception as e:
            print(f'[WARN] LOGINBLOCK parse failed: {e}')
        state.connected = True

    elif sub_msg == CA_DISCONNECTED:
        print('[WMCA] CA_DISCONNECTED')
        state.connected = False

    elif sub_msg == CA_SOCKETERROR:
        print(f'[WMCA] CA_SOCKETERROR: code={lparam}')
        state.error = f'socket error {lparam}'

    elif sub_msg == CA_RECEIVEDATA:
        outblock     = ctypes.cast(lparam, POINTER(OUTDATABLOCK)).contents
        received     = outblock.pData.contents
        block_name   = received.szBlockName.decode('ascii', errors='ignore') if received.szBlockName else ''
        data_addr    = received.szData
        data_len     = received.nLen
        print(f'[WMCA] CA_RECEIVEDATA: block={block_name!r} len={data_len}')

        if block_name == 'c8201OutBlock' and data_len >= sizeof(C8201OutBlock):
            buf = (c_char * sizeof(C8201OutBlock)).from_address(data_addr)
            block = C8201OutBlock.from_buffer_copy(bytes(buf))
            state.summary = parse_summary(block)
            print(f'        순자산={state.summary["netAsset"]:,} 평가={state.summary["totalValue"]:,} 손익={state.summary["totalPnl"]:,}')

        elif block_name == 'c8201OutBlock1':
            n = data_len // sizeof(C8201OutBlock1)
            print(f'        보유종목 {n}개')
            for i in range(n):
                addr  = data_addr + i * sizeof(C8201OutBlock1)
                buf   = (c_char * sizeof(C8201OutBlock1)).from_address(addr)
                block = C8201OutBlock1.from_buffer_copy(bytes(buf))
                h = parse_holding(block)
                state.holdings.append(h)
                print(f'        - {h["name"]:<20} 수량={h["qty"]:>6,} 손익={h["pnl"]:>+12,} ({h["pnlRate"]:+.2f}%)')

    elif sub_msg == CA_RECEIVECOMPLETE:
        print('[WMCA] CA_RECEIVECOMPLETE')
        state.receive_complete = True

    elif sub_msg == CA_RECEIVEERROR:
        try:
            outblock = ctypes.cast(lparam, POINTER(OUTDATABLOCK)).contents
            received = outblock.pData.contents
            buf      = (c_char * received.nLen).from_address(received.szData)
            msg      = bytes(buf).decode('cp949', errors='ignore').strip()
        except Exception:
            msg = '(no detail)'
        print(f'[WMCA] CA_RECEIVEERROR: {msg}')
        state.error = msg
        state.receive_complete = True

    elif sub_msg == CA_RECEIVEMESSAGE:
        try:
            outblock = ctypes.cast(lparam, POINTER(OUTDATABLOCK)).contents
            received = outblock.pData.contents
            buf      = (c_char * received.nLen).from_address(received.szData)
            msg      = bytes(buf).decode('cp949', errors='ignore').strip()
        except Exception:
            msg = '(no detail)'
        print(f'[WMCA] CA_RECEIVEMESSAGE: {msg}')


# 콜백 reference를 전역에 유지해야 GC에 의해 해제되지 않음
_wnd_proc_ref = None


def wnd_proc(hwnd, msg, wparam, lparam):
    if msg == CA_WMCAEVENT:
        handle_wmca_event(wparam, lparam)
        return 1
    return user32.DefWindowProcA(hwnd, msg, wparam, lparam)


def create_message_window():
    global _wnd_proc_ref
    _wnd_proc_ref = WNDPROC(wnd_proc)

    wndclass = WNDCLASS()
    wndclass.style         = 0
    wndclass.lpfnWndProc   = _wnd_proc_ref
    wndclass.cbClsExtra    = 0
    wndclass.cbWndExtra    = 0
    wndclass.hInstance     = kernel32.GetModuleHandleA(None)
    wndclass.hIcon         = 0
    wndclass.hCursor       = 0
    wndclass.hbrBackground = 0
    wndclass.lpszMenuName  = None
    wndclass.lpszClassName = b'WmcaBridgeWnd'

    atom = user32.RegisterClassA(byref(wndclass))
    if not atom:
        print('[ERROR] RegisterClassA failed')
        return 0

    user32.CreateWindowExA.restype = HWND
    user32.CreateWindowExA.argtypes = [
        DWORD, LPCSTR, LPCSTR, DWORD, c_int, c_int, c_int, c_int,
        HWND, c_void_p, HINSTANCE, c_void_p,
    ]

    hwnd = user32.CreateWindowExA(
        0, b'WmcaBridgeWnd', b'WmcaBridge',
        0, 0, 0, 0, 0,
        0, None, wndclass.hInstance, None,
    )
    return hwnd


def pump_until(timeout: float, until):
    """until() 가 True 반환할 때까지 또는 timeout 초까지 메시지 처리"""
    msg = MSG()
    start = time.time()
    while time.time() - start < timeout:
        if until():
            return True
        # PM_REMOVE = 1 (non-blocking peek + remove)
        while user32.PeekMessageA(byref(msg), 0, 0, 0, 1):
            user32.TranslateMessage(byref(msg))
            user32.DispatchMessageA(byref(msg))
            if until():
                return True
        time.sleep(0.02)
    return until()


# ─── 자산 추이 누적 ───
TREND_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'trend.local.json')


def append_trend(net_asset: int):
    today = datetime.now()
    date_str = f'{today.month}/{today.day}'
    trend = []
    if os.path.exists(TREND_FILE):
        try:
            with open(TREND_FILE, encoding='utf-8') as f:
                trend = json.load(f)
        except Exception:
            trend = []
    trend = [t for t in trend if t.get('date') != date_str]
    trend.append({'date': date_str, 'asset': net_asset})
    trend = trend[-90:]
    os.makedirs(os.path.dirname(TREND_FILE), exist_ok=True)
    with open(TREND_FILE, 'w', encoding='utf-8') as f:
        json.dump(trend, f, ensure_ascii=False, indent=2)
    return trend


# ─── API POST ───
def post_to_api(summary, holdings, trend):
    payload = {'summary': summary, 'holdings': holdings, 'trend': trend}
    try:
        r = requests.post(
            API_URL,
            headers={'x-bridge-secret': BRIDGE_SECRET, 'content-type': 'application/json'},
            data=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
            timeout=10,
        )
        if r.ok:
            print(f'[OK] POST → {r.status_code} {r.json()}')
            return True
        print(f'[ERROR] POST {r.status_code} {r.text}')
        return False
    except Exception as e:
        print(f'[ERROR] POST failed: {e}')
        return False


# ─── 메인 흐름 ───
def check_env():
    missing = []
    if not BRIDGE_SECRET: missing.append('PORTFOLIO_BRIDGE_SECRET')
    if not WMCA_ID:       missing.append('WMCA_ID')
    if not WMCA_PW:       missing.append('WMCA_PW')
    if not WMCA_CERT_PW:  missing.append('WMCA_CERT_PW')
    if not ACCOUNT_PWD:   missing.append('WMCA_ACCOUNT_PWD')
    if missing:
        print('[FATAL] 환경변수 누락:')
        for m in missing:
            print(f'  - {m}')
        sys.exit(1)


def run_once(wmca):
    state.connected = False
    state.summary = None
    state.holdings = []
    state.receive_complete = False
    state.error = None

    print(f'[{datetime.now().isoformat()}] === START ===')

    # 윈도우 생성
    hwnd = create_message_window()
    if not hwnd:
        sys.exit(1)
    print(f'[OK] window={hwnd}')

    # wmcaLoad
    if not wmca.wmcaLoad():
        print('[ERROR] wmcaLoad failed')
        return False

    try:
        # Connect (ID 로그인)
        print('[INFO] wmcaConnect...')
        ok = wmca.wmcaConnect(
            hwnd, CA_WMCAEVENT,
            b'T',                         # MediaType: 'T'
            b'W',                         # UserType:  'W' (나무 OpenAPI)
            WMCA_ID.encode('cp949'),
            WMCA_PW.encode('cp949'),
            WMCA_CERT_PW.encode('cp949'),
        )
        if not ok:
            print('[ERROR] wmcaConnect returned FALSE')
            return False

        # CA_CONNECTED 대기
        if not pump_until(30, lambda: state.connected or state.error):
            print('[ERROR] Connect timeout (CA_CONNECTED 미수신)')
            return False
        if state.error:
            print(f'[ERROR] Connect: {state.error}')
            return False

        # c8201 입력 준비
        inblock = C8201InBlock()
        ctypes.memset(byref(inblock), 0x20, sizeof(inblock))   # 전체를 공백으로
        inblock.bnc_bse_cd = b'1'                              # 체결잔고
        inblock.aet_bse    = b'1'                              # 순자산
        inblock.qut_dit_cd = b'UNT'                            # 통합시세

        # 계좌 비밀번호 해시
        ok = wmca.wmcaSetAccountIndexPwd(
            inblock.pswd_no, ACCOUNT_INDEX, ACCOUNT_PWD.encode('cp949')
        )
        if not ok:
            print('[ERROR] wmcaSetAccountIndexPwd failed')
            return False

        # c8201 Query
        print(f'[INFO] wmcaQuery c8201 (account={ACCOUNT_INDEX})...')
        ok = wmca.wmcaQuery(
            hwnd, TRID_C8201, b'c8201',
            cast(byref(inblock), c_char_p), sizeof(inblock),
            ACCOUNT_INDEX
        )
        if not ok:
            print('[ERROR] wmcaQuery returned FALSE')
            return False

        # 응답 대기
        if not pump_until(20, lambda: state.receive_complete):
            print('[ERROR] Query timeout (CA_RECEIVECOMPLETE 미수신)')
            return False
        if state.error:
            print(f'[ERROR] Query: {state.error}')
            return False
        if not state.summary:
            print('[ERROR] summary 미수신')
            return False

        # 자산 추이 누적
        trend = append_trend(int(state.summary['netAsset']))

        # API POST
        return post_to_api(state.summary, state.holdings, trend)

    finally:
        # Cleanup
        try:
            wmca.wmcaDisconnect()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--loop', type=int, default=0, help='반복 간격 초 (0=1회)')
    args = parser.parse_args()

    check_env()
    wmca = load_dll()
    setup_prototypes(wmca)

    if args.loop > 0:
        print(f'[INFO] Loop mode: every {args.loop}s')
        while True:
            try:
                run_once(wmca)
            except Exception as e:
                print(f'[ERROR] {e}')
                import traceback
                traceback.print_exc()
            print(f'[INFO] sleeping {args.loop}s...')
            time.sleep(args.loop)
    else:
        ok = run_once(wmca)
        sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
