import http.server
import json
import os
import sys
import urllib.parse
import time
import queue

# --- Cola global para logs en tiempo real y tracking de requests ---
log_queue = queue.Queue(maxsize=500)
SERVER_START_TIME = time.time()
request_counter = {"total": 0, "timestamps": []}

# --- Detección de modo empaquetado (.exe) ---
IS_FROZEN = getattr(sys, "frozen", False)

# Redirigir stdout/stderr para capturar logs en la interfaz.
class LogEmitter:
    def write(self, text):
        if text.strip():
            timestamp = time.strftime("%H:%M:%S")
            log_queue.put_nowait(f"[{timestamp}] {text.strip()}")
    def flush(self):
        pass

sys.stdout = LogEmitter()
sys.stderr = LogEmitter()

# Imprimir banner inicial para que aparezca en los logs de la interfaz
print("=" * 40)
print("INICIANDO SERVIDOR FGC OVERLAY")
print("========================================")
print("Cargando módulos y configuraciones...")

def get_base_dir():
    """Retorna la carpeta donde están los archivos estáticos empaquetados.
    - En modo .exe: _MEIPASS (carpeta _internal/ de PyInstaller)
    - En modo desarrollo: carpeta donde vive server.py
    """
    if IS_FROZEN:
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def get_data_dir():
    """Retorna la carpeta donde viven los datos del usuario (overlays, etc).
    - En modo .exe: carpeta donde vive el ejecutable
    - En modo desarrollo: carpeta donde vive server.py
    """
    if IS_FROZEN:
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

BASE_DIR = get_base_dir()
DATA_DIR = get_data_dir()

class FGCHandler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        # Servir archivos estáticos desde BASE_DIR
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # Endpoint: /api/recursos — devuelve lista de archivos en escudos/ y redes/
        if parsed.path == '/api/recursos':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            def list_folder(folder):
                path = os.path.join(DATA_DIR, folder)
                if not os.path.exists(path):
                    return []
                exts = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'}
                return sorted([
                    f for f in os.listdir(path)
                    if os.path.splitext(f)[1].lower() in exts
                ])

            result = {
                'shields': list_folder('escudos'),
                'socials': list_folder('redes')
            }

            self.wfile.write(json.dumps(result).encode())
            return

        # Endpoint: /api/lista_overlays — devuelve lista de archivos .json en overlays/
        if parsed.path == '/api/lista_overlays':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()

            path = os.path.join(DATA_DIR, 'overlays')
            if not os.path.exists(path):
                overlays = []
            else:
                overlays = sorted([
                    f for f in os.listdir(path)
                    if f.lower().endswith('.json')
                ])

            self.wfile.write(json.dumps(overlays).encode())
            return

        # Servir archivos de carpetas del usuario desde DATA_DIR
        # (overlays, banderas, escudos, redes viven al lado del .exe)
        user_folders = ('/overlays/', '/banderas/', '/escudos/', '/redes/')
        if parsed.path.lower().startswith(user_folders):
            rel_path = urllib.parse.unquote(parsed.path[1:])  # quitar el / inicial
            file_path = os.path.join(DATA_DIR, rel_path)
            if os.path.isfile(file_path):
                self.send_response(200)
                # Determinar Content-Type
                ext = os.path.splitext(file_path)[1].lower()
                content_types = {
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml',
                }
                self.send_header('Content-Type', content_types.get(ext, 'application/octet-stream'))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
                return
            else:
                self.send_error(404, 'File not found')
                return

        # Todo lo demás: servir archivos estáticos normal
        super().do_GET()

    def log_message(self, format, *args):
        # Enviar cada request al console. Usa print para pasarlo por sys.stdout -> LogEmitter
        msg = format % args if args else format
        print(f"Petición Web: {msg}")
        
        # Tracking de requests/min
        now = time.time()
        request_counter["total"] += 1
        request_counter["timestamps"].append(now)
        # Limpiar timestamps > 60s
        request_counter["timestamps"] = [t for t in request_counter["timestamps"] if now - t < 60]

if __name__ == '__main__':
    import socketserver
    import threading
    import webbrowser
    import subprocess

    PORT = 8000

    # Crear carpeta overlays si no existe
    overlays_dir = os.path.join(DATA_DIR, 'overlays')
    if not os.path.exists(overlays_dir):
        os.makedirs(overlays_dir)

    # Links en el nuevo orden
    LINKS = [
        ("Arquitecto", "Fuente OBS", f"http://localhost:{PORT}/arquitecto.html?obs=1"),
        ("Controlador", "Panel Dock", f"http://localhost:{PORT}/controlador.html"),
        ("Panel de Datos", "Base de datos", f"http://localhost:{PORT}/Panel.html"),
    ]

    def start_server():
        """Inicia el servidor HTTP en un hilo secundario (daemon)."""
        max_retries = 5
        for i in range(max_retries):
            try:
                with socketserver.TCPServer(('', PORT), FGCHandler) as httpd:
                    print(f"Servidor iniciado en el puerto {PORT}.")
                    httpd.serve_forever()
            except OSError as e:
                if e.errno == 10048: # Puerto ocupado
                    print(f"Puerto {PORT} ocupado, reintentando en 2 segundos... ({i+1}/{max_retries})")
                    time.sleep(2)
                else:
                    raise e
            except Exception as e:
                # Loguear errores a archivo (útil cuando console=False)
                log_path = os.path.join(DATA_DIR, 'server_error.log')
                with open(log_path, 'w', encoding='utf-8') as f:
                    import traceback
                    f.write(traceback.format_exc())

    # --- Intentar importar psutil para CPU ---
    try:
        import psutil
        HAS_PSUTIL = True
    except ImportError:
        HAS_PSUTIL = False

    # --- Selección de Modo: GUI o Consola ---
    # Se entra en modo GUI si está congelado (.exe) Y NO se ha pasado el argumento --console
    if IS_FROZEN and "--console" not in sys.argv:
        # Modificaciones para evitar crashes en webengine si stderr es None
        if sys.stderr is None:
            sys.stderr = open(os.devnull, "w")

        from PySide6.QtGui import QIcon
        from PySide6.QtWidgets import QApplication, QMainWindow, QWidget, QVBoxLayout
        from PySide6.QtWebEngineWidgets import QWebEngineView
        from PySide6.QtCore import Qt, QUrl, QTimer, QPoint, QPropertyAnimation, QEvent
        from PySide6.QtWebChannel import QWebChannel

        # Iniciar servidor en thread daemon
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()

        app = QApplication(sys.argv)
 
        class SplashWindow(QMainWindow):
            def __init__(self, html_file, width, height):
                super().__init__()
                self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
                self.setAttribute(Qt.WA_TranslucentBackground)
                self.resize(width, height)
                
                # Centrar
                screen = app.primaryScreen().geometry()
                x = (screen.width() - width) // 2
                y = (screen.height() - height) // 2
                self.move(x, y)

                self.web_view = QWebEngineView(self)
                self.web_view.setAttribute(Qt.WA_TranslucentBackground)
                self.web_view.page().setBackgroundColor(Qt.transparent)
                self.web_view.resize(width, height)
                
                local_url = QUrl.fromLocalFile(os.path.join(BASE_DIR, html_file))
                self.web_view.load(local_url)
                self.web_view.setZoomFactor(1.0)
                
                # Timer estático para garantizar que se muestran las animaciones css (4s + 2.2s delay)
                QTimer.singleShot(6500, self.start_main_app)

            def start_main_app(self):
                self.main_win = MainWindow("gui_main.html", 1466, 841)
                self.main_win.show()
                self.close()

        class MainWindow(QMainWindow):
            def __init__(self, html_file, width, height):
                super().__init__()
                # Establecer icono de la ventana (.png suele renderizar más nítido que .ico en PySide6)
                icon_path = os.path.join(BASE_DIR, "assets", "logo.png")
                self.setWindowIcon(QIcon(icon_path))
                
                self.resize(width, height)
                
                # Centrar
                screen = app.primaryScreen().geometry()
                x = (screen.width() - width) // 2
                y = (screen.height() - height) // 2
                self.move(x, y)

                self.central_widget = QWidget()
                self.central_widget.setStyleSheet("background-color: #050507;")
                self.setCentralWidget(self.central_widget)
                
                layout = QVBoxLayout(self.central_widget)
                layout.setContentsMargins(0, 0, 0, 0)
                layout.setSpacing(0)

                self.web_view = QWebEngineView()
                
                local_url = QUrl.fromLocalFile(os.path.join(BASE_DIR, html_file))
                self.web_view.load(local_url)
                layout.addWidget(self.web_view)

                self.web_view.loadFinished.connect(self._on_load_finished)
                
                # Timer para las estadísticas
                self.stats_timer = QTimer(self)
                self.stats_timer.timeout.connect(self.update_stats)

            def _on_load_finished(self, ok):
                if ok:
                    print("Interfaz gráfica cargada. Iniciando monitores de sistema...")
                    # Interceptar clicks para open url
                    js_code = """
                    (function() {
                        let container = document.querySelector('[data-purpose="app-window-container"]');
                        if (container) {
                            container.style.boxShadow = "none";
                        }
                        
                        window.open = function(url, target) {
                            let fullUrl = url.startsWith('http') ? url : 'http://localhost:8000/' + url;
                            document.title = 'PYEvent:open|' + fullUrl;
                        };
                        
                        // Interceptar botones
                        document.body.addEventListener('click', function(e) {
                            let link = e.target.closest('a');
                            if(link && !link.href.includes('javascript:void(0)')) {
                                e.preventDefault();
                                window.open(link.href);
                                return;
                            }
                            let btn = e.target.closest('button');
                            if(btn) {
                                let text = btn.innerText;
                                if(text.includes('Manual Pro')) {
                                    document.title = 'PYEvent:open|https://github.com';
                                }
                            }
                        }, true);
                    })();
                    """
                    self.web_view.page().runJavaScript(js_code)
                    self.web_view.titleChanged.connect(self._handle_title_change)
                    self.stats_timer.start(1000)

            def _handle_title_change(self, title):
                if title == 'PYEvent:minimize':
                    self.showMinimized()
                    self.web_view.page().runJavaScript("document.title = 'FGC Overlay Server';")
                elif title == 'PYEvent:close':
                    self.close()
                    QApplication.quit()
                elif title.startswith("PYEvent:open|"):
                    url = title.split("|", 1)[1]
                    import webbrowser
                    webbrowser.open(url)
                    self.web_view.page().runJavaScript("document.title = 'FGC Overlay Server';")
                elif title.startswith("PYEvent:folder|"):
                    cmd = title.split("|", 1)[1]
                    if cmd == "overlays":
                        path = os.path.join(DATA_DIR, "overlays")
                        if not os.path.exists(path): os.makedirs(path)
                        if sys.platform == "win32": os.startfile(path)
                    elif cmd == "resources":
                        if sys.platform == "win32": os.startfile(DATA_DIR)
                    elif cmd == "assets":
                        # Backwards compat: abrir carpeta overlays
                        path = os.path.join(DATA_DIR, "overlays")
                        if not os.path.exists(path): os.makedirs(path)
                        if sys.platform == "win32": os.startfile(path)
                    self.web_view.page().runJavaScript("document.title = 'FGC Overlay Server';")
                elif title == 'PYEvent:ram_save':
                    print("Cambiando a modo Ahorro de RAM (Consola Portátil)...")
                    
                    if IS_FROZEN:
                        # Lanzar una nueva instancia (el mismo ejecutable) diciéndole que inicie en modo consola
                        subprocess.Popen([sys.executable, "--console"])
                    else:
                        # En desarrollo, la forma más rápida es abrir cmd con python
                        subprocess.Popen(['cmd.exe', '/c', 'start', sys.executable, sys.argv[0], "--console"], shell=True)
                    
                    # Forzar el cierre inmediato del proceso actual (libera toda la RAM y el puerto al instante)
                    os._exit(0)

            def update_stats(self):
                elapsed = int(time.time() - SERVER_START_TIME)
                uptime_str = f"{elapsed // 3600:02d}:{(elapsed % 3600) // 60:02d}:{elapsed % 60:02d}"

                now = time.time()
                recent = [t for t in request_counter["timestamps"] if now - t < 60]
                req_min = str(len(recent))

                ram_str = "N/A"
                ram_desc = "Estado: N/A"
                cpu_str = "N/A"
                cpu_desc = "Estado: N/A"
                
                if HAS_PSUTIL:
                    try:
                        mem = psutil.virtual_memory()
                        ram_str = f"{mem.percent:.0f}"
                        # Convertir a GB
                        avail_gb = mem.available / (1024**3)
                        total_gb = mem.total / (1024**3)
                        ram_desc = f"Disponible {avail_gb:.1f} GB de {total_gb:.1f} GB"
                    except:
                        pass
                    try:
                        cpu = psutil.cpu_percent(interval=None)
                        cpu_str = f"{cpu:.0f}"
                        freq = psutil.cpu_freq().current
                        # Frecuencia en GHz
                        cpu_desc = f"Velocidad de base: {freq/1000:.2f} GHz"
                    except:
                        pass
                
                logs_arr = []
                while not log_queue.empty():
                    try:
                        entry = log_queue.get_nowait()
                        logs_arr.append(entry.replace('\\\\', '\\\\\\\\').replace('"', '\\\\"').replace("'", "\\\\'"))
                    except queue.Empty:
                        break
                
                logs_js = "[" + ",".join([f"'{l}'" for l in logs_arr]) + "]"

                js_update = f"""
                (function() {{
                    let elUptime = document.getElementById('uptime-val');
                    if(elUptime) elUptime.innerText = '{uptime_str}';
                    
                    let elReq = document.getElementById('req-min');
                    if(elReq) elReq.innerText = '{req_min}';
                    
                    let elRam = document.getElementById('ram-val');
                    let elRamBar = document.getElementById('ram-bar');
                    let elRamDesc = document.getElementById('ram-desc');
                    if(elRam) elRam.innerText = '{ram_str}';
                    if(elRamBar && '{ram_str}' !== 'N/A') elRamBar.style.width = '{ram_str}%';
                    if(elRamDesc) elRamDesc.innerText = '{ram_desc}';

                    let elCpu = document.getElementById('cpu-val');
                    let elCpuBar = document.getElementById('cpu-bar');
                    let elCpuDesc = document.getElementById('cpu-desc');
                    if(elCpu && '{cpu_str}' !== 'N/A') elCpu.innerText = '{cpu_str}';
                    if(elCpuBar && '{cpu_str}' !== 'N/A') elCpuBar.style.width = '{cpu_str}%';
                    if(elCpuDesc) elCpuDesc.innerText = '{cpu_desc}';

                    let new_logs = {logs_js};
                    if(new_logs.length > 0 && typeof addTerminalLog === 'function') {{
                        new_logs.forEach(l => addTerminalLog(l, true));
                    }}
                }})();
                """
                self.web_view.page().runJavaScript(js_update)

        # Iniciamos con el Splash Screen
        splash = SplashWindow("gui_splash.html", 349, 127)
        splash.show()

        sys.exit(app.exec())


    # --- Modo desarrollo o Consola (--console) ---
    else:
        # En modo empaquetado (.exe) forzamos a Windows a crear una consola negra visible
        if IS_FROZEN:
            import ctypes
            ctypes.windll.kernel32.AllocConsole()
            ctypes.windll.kernel32.SetConsoleTitleW("FGC Overlay Server - Ahorro RAM")
            sys.stdout = open('CONOUT$', 'w', encoding='utf-8')
            sys.stderr = open('CONOUT$', 'w', encoding='utf-8')

        # Banner informativo
        print("=" * 56)
        print("     SERVIDOR INICIADO (Ahorro de RAM) - FGC OVERLAY")
        print("=" * 56)
        print()
        print(f"  [ESTADO] Servidor corriendo en el puerto {PORT}.")
        print()
        print("  [INSTRUCCIONES PARA OBS / NAVEGADOR]")
        for i, (name, sub, url) in enumerate(LINKS, 1):
            print(f"  {i}. {name} ({sub}):  {url}")
        print()
        print("  IMPORTANTE: No cierres esta ventana mientras usas el Overlay.")
        print()
        print("=" * 56)
        print()

        max_retries = 5
        for i in range(max_retries):
            try:
                with socketserver.TCPServer(('', PORT), FGCHandler) as httpd:
                    httpd.serve_forever()
            except OSError as e:
                import time
                if e.errno == 10048:
                    print(f"Puerto {PORT} ocupado, reintentando... ({i+1}/{max_retries})")
                    time.sleep(2)
                else:
                    raise e
