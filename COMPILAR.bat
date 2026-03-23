@echo off
title Compilando OverlayPropio...
color 0E

cd /d "%~dp0"

echo ========================================================
echo      COMPILANDO OVERLAY PROPIO A .EXE
echo ========================================================
echo.

:: Verificar que PyInstaller esté instalado
pyinstaller --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] PyInstaller no esta instalado.
    echo  Ejecuta: pip install pyinstaller
    echo.
    pause
    exit /b 1
)

echo  [INFO] Limpiando carpetas de compilacion previas...
if exist "build" rd /s /q "build"
if exist "dist" rd /s /q "dist"
echo.

echo  [INFO] Iniciando compilacion con el nuevo icono (logo3.ico)...
echo.

pyinstaller overlay.spec --noconfirm

if errorlevel 1 (
    echo.
    echo  [ERROR] La compilacion fallo. Revisa los errores arriba.
    echo.
    pause
    exit /b 1
)

echo.
echo  [INFO] Copiando carpetas de recursos al lado del .exe...
echo.

:: Copiar carpetas editables al lado del .exe
xcopy /E /I /Y "banderas" "dist\FGCOverlay-Caster\banderas" >nul
xcopy /E /I /Y "escudos" "dist\FGCOverlay-Caster\escudos" >nul
xcopy /E /I /Y "redes" "dist\FGCOverlay-Caster\redes" >nul
xcopy /E /I /Y "assets" "dist\FGCOverlay-Caster\assets" >nul

:: Crear carpeta overlays vacía si no existe
if not exist "dist\FGCOverlay-Caster\overlays" mkdir "dist\FGCOverlay-Caster\overlays"

:: Ocultar carpeta interna para apariencia profesional
if exist "dist\FGCOverlay-Caster\_internal" attrib +h "dist\FGCOverlay-Caster\_internal"

echo.
echo ========================================================
echo  [OK] Compilacion exitosa!
echo.
echo  El ejecutable esta en: dist\FGCOverlay-Caster\FGCOverlay-Caster.exe
echo.
echo  Carpetas copiadas al lado del .exe:
echo    - banderas/  (banderas de paises)
echo    - escudos/   (escudos de equipos - editable)
echo    - redes/     (iconos de redes sociales - editable)
echo    - overlays/  (archivos de overlays guardados)
echo.
echo  [NOTA] La carpeta _internal ha sido cultada para una apariencia mas limpia.
echo.
echo  Para distribuir, comprime la carpeta dist\FGCOverlay-Caster\
echo  en un archivo .zip.
echo ========================================================
echo.
pause
