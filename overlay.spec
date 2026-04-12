# -*- mode: python ; coding: utf-8 -*-
import os

block_cipher = None

# Carpeta raíz del proyecto
PROJECT_DIR = os.path.dirname(os.path.abspath(SPEC))

a = Analysis(
    [os.path.join(PROJECT_DIR, 'server.py')],
    pathex=[PROJECT_DIR],
    binaries=[],
    datas=[
        # Archivos HTML (ahora empaquetados en memoria)
        (os.path.join(PROJECT_DIR, 'assets', '*'), 'assets'),
        # banderas/, escudos/, redes/ van al lado del .exe (copiadas por COMPILAR.bat)
    ],
    hiddenimports=['psutil', 'PySide6'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FGCOverlay-Caster',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    icon=os.path.join(PROJECT_DIR, 'Ico', 'logo3.ico'),
    upx=True,
    console=False,  # Sin ventana de consola – usamos GUI PySide6
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='FGCOverlay-Caster',
)
