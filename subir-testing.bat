@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   SUBIR CAMBIOS A GIT - RAMA TESTING
echo ============================================
echo.

REM Ir a la carpeta del script
cd /d "%~dp0"

REM Verificar que sea repo git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: Esta carpeta no parece ser un repositorio Git.
  pause
  exit /b 1
)

echo Cambiando a rama testing...
git checkout testing
if errorlevel 1 (
  echo ERROR: No se pudo cambiar a testing.
  pause
  exit /b 1
)

echo.
echo Estado actual:
git status --short
echo.

set /p INCLUDE_SCHEMA=Queres incluir cambios de prisma/schema.prisma? [S/n]: 

set INCLUDE_SCHEMA_NORMALIZED=N
if /I "%INCLUDE_SCHEMA%"=="S" set INCLUDE_SCHEMA_NORMALIZED=S
if "%INCLUDE_SCHEMA%"=="" set INCLUDE_SCHEMA_NORMALIZED=S

echo.
set /p RUN_BUILD=Queres ejecutar bun run build antes de commitear? [S/n]: 

set RUN_BUILD_NORMALIZED=N
if /I "%RUN_BUILD%"=="S" set RUN_BUILD_NORMALIZED=S
if "%RUN_BUILD%"=="" set RUN_BUILD_NORMALIZED=S

if /I "%RUN_BUILD_NORMALIZED%"=="S" (
  echo.
  echo Ejecutando build...
  bun run build
  if errorlevel 1 (
    echo.
    echo ERROR: El build fallo. No se hara commit.
    pause
    exit /b 1
  )
)

echo.
echo Agregando cambios...
git add -A

REM Nunca subir archivos sensibles por accidente
git restore --staged .env 2>nul
git restore --staged .env.local 2>nul
git restore --staged .env.production 2>nul
git restore --staged .env.development 2>nul

REM Si el usuario NO quiere schema, lo sacamos del commit sin borrar cambios locales
if /I "%INCLUDE_SCHEMA_NORMALIZED%"=="N" (
  echo.
  echo Excluyendo prisma/schema.prisma del commit...
  git restore --staged prisma/schema.prisma 2>nul
)

echo.
echo ============================================
echo Archivos que entraran al commit:
echo ============================================
git diff --cached --name-only
echo.

if /I "%INCLUDE_SCHEMA_NORMALIZED%"=="N" (
  echo Verificando que prisma/schema.prisma NO este incluido...
  git diff --cached --name-only | findstr /I "prisma/schema.prisma" >nul
  if not errorlevel 1 (
    echo ERROR: prisma/schema.prisma esta staged. Se cancela.
    pause
    exit /b 1
  )
)

echo.
set /p CONTINUE=Confirmas hacer commit con estos archivos? [S/n]: 

if /I "%CONTINUE%"=="n" (
  echo Cancelado. No se hizo commit.
  pause
  exit /b 0
)

echo.
set /p COMMIT_MSG=Escribi el mensaje del commit: 

if "%COMMIT_MSG%"=="" (
  set COMMIT_MSG=Actualiza cambios en testing
)

echo.
echo Haciendo commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo.
  echo No se pudo hacer commit. Puede que no haya cambios agregados.
  pause
  exit /b 1
)

echo.
echo Trayendo cambios remotos con rebase...
git pull --rebase --autostash origin testing
if errorlevel 1 (
  echo.
  echo ERROR: Hubo un problema con el rebase.
  echo Revisa con: git status
  echo Si hay conflictos, resolvelos y despues usa:
  echo git add archivo
  echo git rebase --continue
  pause
  exit /b 1
)

echo.
echo Subiendo a GitHub...
git push origin testing
if errorlevel 1 (
  echo.
  echo ERROR: No se pudo hacer push.
  pause
  exit /b 1
)

echo.
echo ============================================
echo Cambios subidos correctamente a testing.
echo ============================================
pause