# 컴퓨터에 로그인하면 Docker Desktop → 이 프로젝트 DB(invest-db-5433) → API 서버를 켠다.
# 서버가 켜져 있어야 07·14시 수집, 08:20 아침 브리핑, 15:40 장 마감 요약이 저절로 돈다 (2026-10-16: 서버가 꺼져 브리핑을 놓쳤다).
# 잔고·시세·주문은 증권사 키가 폰에만 있어서 앱(폰)이 켜져 있어야 한다.
# 등록: 작업 스케줄러 "InvestAgentServer" (로그인 시). 지우기: Unregister-ScheduledTask -TaskName InvestAgentServer -Confirm:$false
# 로그: %LOCALAPPDATA%\invest-agent\server.log

$ErrorActionPreference = 'Continue'
$api = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA 'invest-agent'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir 'server.log'
function Note($text) { Add-Content -Path $log -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text" -Encoding utf8 }

# 이미 켜져 있으면 아무것도 안 한다
try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 http://localhost:8000/docs | Out-Null; Note '서버가 이미 켜져 있음'; exit 0 } catch {}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    $desktop = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'
    if (-not (Test-Path $desktop)) { $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe' }
    Note "Docker Desktop 켜기: $desktop"
    Start-Process $desktop
    for ($i = 0; $i -lt 60; $i++) { Start-Sleep 5; docker info *> $null; if ($LASTEXITCODE -eq 0) { break } }
}
docker start invest-db-5433 *>> $log
for ($i = 0; $i -lt 30; $i++) { docker exec invest-db-5433 pg_isready -q *> $null; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep 2 }

# .env의 DATABASE_URL은 5432(다른 프로젝트 DB와 겹침)라서 이 프로젝트 DB 5433으로 바꿔 쓴다
$url = (Get-Content (Join-Path $api '.env') | Where-Object { $_ -like 'DATABASE_URL=*' } | Select-Object -First 1).Substring(13)
$env:DATABASE_URL = $url -replace ':5432/', ':5433/'
$env:PYTHONIOENCODING = 'utf-8'
Note '서버 켜기'
# 2026-10-20: 서버가 이 PowerShell 콘솔에 붙어 있다가 06:2x에 콘솔과 함께 꺼졌다 (작업 결과 0xC000013A = 창 닫힘·Ctrl+C, 무엇이 닫았는지는 미확인).
# 서버를 따로 띄워(자기 숨은 창) 이 콘솔이 닫혀도 계속 돌게 한다. 출력은 UTF-8 파일로 (전에는 UTF-16과 섞여 읽기 어려웠다)
$out = Join-Path $logDir 'server.out.log'
$err = Join-Path $logDir 'server.err.log'
$proc = Start-Process -FilePath 'uv' -ArgumentList 'run', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000' `
    -WorkingDirectory $api -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
Note "서버 프로세스 $($proc.Id) (로그: server.out.log, server.err.log)"
