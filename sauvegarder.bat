@echo off
rem ============================================================
rem  Myth of Eden : enregistre et envoie les modifications sur GitHub
rem  Double-clic, ou dans un terminal :  sauvegarder "message"
rem  Mode automatique (toutes les 10 minutes) :  sauvegarder auto
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"

if /i "%~1"=="auto" goto auto

set "MSG=%~1"
if "%MSG%"=="" set /p "MSG=Description des changements (Entree = date et heure) : "
if "%MSG%"=="" set "MSG=Sauvegarde du %date% a %time:~0,5%"

call :save "%MSG%"
echo.
pause
exit /b

:auto
echo Sauvegarde automatique toutes les 10 minutes. Ferme cette fenetre pour arreter.
:loop
call :save "Sauvegarde automatique du %date% a %time:~0,5%"
timeout /t 600 /nobreak >nul
goto loop

:save
git add -A
git diff --cached --quiet
if %errorlevel%==0 (
    echo [%time:~0,5%] Aucune modification a enregistrer.
    exit /b
)
git commit -m "%~1"
git pull --rebase origin main
git push origin main
if %errorlevel%==0 (echo [%time:~0,5%] Modifications envoyees sur GitHub.) else (echo [%time:~0,5%] ERREUR : envoi impossible, voir le message ci-dessus.)
exit /b
