# Herramientas de desarrollo

Estos scripts no hacen falta para usar OpenKEY. Sirven para regenerar los datos que usa la app a partir del driver oficial instalado.

- `extract_vendor_data.js` — lee el renderer desempaquetado del driver oficial y extrae:
  - `data/keymap.json` (tabla de keycodes del driver).
  - `data/layout.json` (geometría del layout `Common80_SG9045`).
  - `data/default_matrix.json` (matriz por defecto del modelo X820 Ultra).
- `build_layout.py` — combina los datos anteriores con la tabla de keycodes y genera `web/layout_ak820.json`.
- `build_keycodes.py` — genera `web/keycodes.json` con los destinos de remapeo agrupados.
- `probe_hid.py` — enumera los *collections* HID y muestra VID/PID, usage page, tamaños de report.
- `hidctl.py` — mini cliente de bajo nivel para leer comandos del teclado (útil para depurar).
- `make_icon.ps1` — regenera `web/logo.png` y `web/logo.ico` desde `logo.png`.

## Regenerar

```powershell
node tools/extract_vendor_data.js
python tools/build_layout.py
python tools/build_keycodes.py
```

El script de Node asume que el driver oficial está en:

```
C:\Users\<usuario>\AppData\Local\Programs\Attack Shark Driver v4\resources\app\dist\js
```

Si tu instalación está en otra ruta, cambia `root` al principio de `extract_vendor_data.js`.

## Compilar el .exe

`build_exe.ps1` crea un entorno virtual local `.venv-build`, instala PyInstaller ahí (no global) y genera el ejecutable en `dist\OpenKEY\`:

```powershell
.\tools\build_exe.ps1
```

El build es **onedir** y sin consola. Incluye `web/` y `data/`, usa `web/logo.ico` y resuelve las rutas con `sys._MEIPASS` cuando corre empaquetado. No muevas solo `OpenKEY.exe`: la carpeta `_internal` debe quedar al lado. **No uses `build\OpenKEY\OpenKEY.exe`**: es un stub intermedio y falla con “Failed to load Python DLL”; el script lo elimina al terminar. El ejecutable correcto es `dist\OpenKEY\OpenKEY.exe`. Cierra OpenKEY antes de recompilar. El script crea `.venv-build` e instala PyInstaller desde `requirements-dev.txt`; se probó con Python 3.15.

## Sondeo rápido

```powershell
python tools/probe_hid.py
python tools/hidctl.py
```

`hidctl.py` requiere el teclado conectado por USB y el mismo *collection* de vendor (`usage_page=0xFFFF`, `usage=2`).
