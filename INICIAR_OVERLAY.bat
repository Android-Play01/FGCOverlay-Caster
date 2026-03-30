@echo off
title FGC Overlay Server - NO CERRAR
color 0A

:: El siguiente comando obliga a la consola a ubicarse en la carpeta
:: donde está guardado este archivo, da igual dónde lo pongas.
cd /d "%~dp0"

cls
echo ========================================================
echo      SERVIDOR LOCAL INICIADO - FGC OVERLAY
echo ========================================================
echo.
echo  [ESTADO] El servidor esta corriendo en el puerto 8000.
echo.
echo  [INSTRUCCIONES PARA OBS / NAVEGADOR]
echo  1. Panel de Datos (Base):  http://localhost:8000/Panel.html
echo  2. Controlador (Dock):    http://localhost:8000/controlador.html
echo  3. Arquitecto (Fuente):   http://localhost:8000/arquitecto.html?obs=1
echo.
echo  IMPORTANTE: No cierres esta ventana negra mientras usas el Overlay.
echo              Si la cierras, se desconectan los paneles.
echo.
echo ========================================================
echo.

:: Ejecutar el servidor personalizado que lee las carpetas automaticamente
python server.py

pause
