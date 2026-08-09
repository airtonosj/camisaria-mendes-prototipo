@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title Iniciar Camisaria Mendes

set "SITE_URL=http://127.0.0.1:4173/"
set "API_URL=http://127.0.0.1:3333/api/health"

echo.
echo ========================================
echo       CAMISARIA MENDES - INICIAR
echo ========================================
echo.

where node.exe >nul 2>&1
if errorlevel 1 goto :node_missing

where npm.cmd >nul 2>&1
if errorlevel 1 goto :node_missing

if not exist "node_modules\vite\bin\vite.js" goto :dependencies_missing

if not exist ".env" (
  echo AVISO: arquivo .env nao encontrado.
  echo A API usara apenas os valores padrao disponiveis.
  echo.
)

call :port_listening 3333
if errorlevel 1 (
  echo Iniciando API na porta 3333...
  start "Camisaria Mendes - API" /min cmd.exe /k "cd /d ""%CD%"" && npm.cmd run api:start"
) else (
  echo API ja esta em execucao na porta 3333.
)

call :port_listening 4173
if errorlevel 1 (
  echo Iniciando site na porta 4173...
  start "Camisaria Mendes - Site" /min cmd.exe /k "cd /d ""%CD%"" && npm.cmd run dev -- --host 127.0.0.1 --port 4173"
) else (
  echo Site ja esta em execucao na porta 4173.
)

echo Aguardando banco, API e site ficarem prontos...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'SilentlyContinue';" ^
  "for ($attempt = 1; $attempt -le 20; $attempt++) {" ^
  "  $health = Invoke-RestMethod -Uri '%API_URL%' -TimeoutSec 2;" ^
  "  $page = Invoke-WebRequest -UseBasicParsing -Uri '%SITE_URL%' -TimeoutSec 2;" ^
  "  if ($health.ok -eq $true -and $health.schema.ready -eq $true -and $health.storage.ready -eq $true -and $page.StatusCode -eq 200 -and $page.Content -match 'Camisaria Mendes') { exit 0 };" ^
  "  Start-Sleep -Milliseconds 500" ^
  "}; exit 1"

if errorlevel 1 goto :startup_failed

echo.
echo Sistema pronto: %SITE_URL%
echo Para encerrar, feche as duas janelas minimizadas da API e do Site.

if /I not "%CAMISARIA_NO_BROWSER%"=="1" start "" "%SITE_URL%"

exit /b 0

:port_listening
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul
exit /b %errorlevel%

:node_missing
echo ERRO: Node.js e npm nao foram encontrados no PATH.
echo Instale o Node.js e tente novamente.
goto :failure

:dependencies_missing
echo ERRO: as dependencias do projeto ainda nao estao instaladas.
echo Abra um terminal nesta pasta e execute: npm install
goto :failure

:startup_failed
echo.
echo ERRO: o sistema nao ficou pronto dentro do tempo esperado.
echo Verifique as janelas minimizadas da API e do Site para consultar o erro.

:failure
echo.
pause
exit /b 1
