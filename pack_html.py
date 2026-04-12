import base64
import zlib
import os

FILES_TO_PACK = ["arquitecto.html", "controlador.html", "Panel.html", "gui_main.html", "gui_splash.html", "tailwind.js"]
OUTPUT_FILE = "embedded_html.py"

def pack():
    print("Empaquetando HTMLs para protección...")
    out_lines = [
        "# AUTO-GENERATED FILE. DO NOT EDIT.",
        "import zlib",
        "import base64",
        "",
        "ASSETS = {}"
    ]
    
    for f_name in FILES_TO_PACK:
        if not os.path.exists(f_name):
            print(f"  [ERROR] No se encontró {f_name}.")
            continue
            
        with open(f_name, "rb") as f:
            content = f.read()
        
        # Comprimir y codificar
        compressed = zlib.compress(content, level=9)
        encoded = base64.b64encode(compressed).decode('ascii')
        
        out_lines.append(f"ASSETS['{f_name}'] = {repr(encoded)}")
        print(f"  [OK] Empaquetado: {f_name}")

    out_lines.append("")
    out_lines.append("def get_asset(name):")
    out_lines.append("    if name in ASSETS:")
    out_lines.append("        return zlib.decompress(base64.b64decode(ASSETS[name]))")
    out_lines.append("    return None")
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))
        
    print(f"Archivo {OUTPUT_FILE} generado correctamente.")

if __name__ == '__main__':
    pack()
