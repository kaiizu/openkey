# AGENTS.md — OpenKEY (Attack Shark X820 Ultra)

Lee primero **`HANDOFF.md`**. Contiene el estado completo, la arquitectura, la API, el protocolo y los siguientes pasos. Después revisa `README.md` y `docs/PROTOCOL.md`.

## Resumen

- App local: backend Python (`butler/`) + UI web (`web/`). El paquete conserva el nombre `butler/` por compatibilidad histórica.
- Sin Electron, sin dependencias externas; HID por `ctypes`.
- El teclado es un Attack Shark X820 Ultra / AK820 Ultra por USB (`VID 0x3151`, `PID 0x5002`, chip YC3123).
- El MVP ya funciona y está probado contra hardware.
- La sincronización de música (`0x0F`) es **on-demand**: no hay hilo, captura ni tráfico HID cuando está detenida.
- La **onda reactiva** («Water drop») usa el mismo `0x0F`, también on-demand, y lee la posición física de las teclas con `GetAsyncKeyState` (sin hook global ni dependencias externas).
- La pantalla tiene **modo de reproducción** (`0x2F`): mantener la página o rotar automáticamente cada N segundos. OpenKEY fija la página después de subir para que un GIF no vuelva solo a una imagen anterior.
- La versión empaquetada está en `dist\OpenKEY\OpenKEY.exe` (onedir, sin consola). Recompilar con `.\tools\build_exe.ps1`.

## Comandos útiles

```powershell
cd <ruta-al-repositorio>
python run.py --no-browser          # servidor en primer plano
python -m compileall -q butler run.py tools
node --check web\app.js
python -m unittest discover -s tests -v
.\tools\build_exe.ps1
Invoke-RestMethod http://127.0.0.1:8737/api/status
```

Servidor actual: `http://127.0.0.1:8737/` (versión empaquetada `dist\OpenKEY\OpenKEY.exe`). Para desarrollo, cierra el exe y usa `python run.py`. Si no responde:

```powershell
$c = Get-NetTCPConnection -LocalPort 8737 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
Start-Process 'pythonw' -ArgumentList 'run.py' `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

## Reglas

- **No editar a mano** `web/layout_ak820.json`, `web/keycodes.json` ni `data/*.json`; se generan con `tools/`.
- **Preguntar antes de** reset de fábrica, sobrescribir la pantalla, actualizar firmware, inicializar git o instalar dependencias globales.
- Mantener el **español como idioma por defecto**; al añadir textos, agregar la traducción inglesa en `web/i18n.js` y probar ambos idiomas. Mantener el estilo visual y los tres temas (`Grafito`, `Cobalto`, `Mercurio`).
- Si agregas una ruta API o una función, actualiza `README.md`, `HANDOFF.md` y `docs/PROTOCOL.md`.
- La app oficial puede estar abierta; recomendar cerrarla antes de escribir configuración y, especialmente, antes de usar la sincronización de música.

## Prioridades siguientes

1. Probar en hardware las macros (`0x0B`/`0x8B`) y la restauración de keymaps.
2. Dongle 2.4G.
3. Selector de salida de audio para Música.
4. Validar en hardware el GIF de 60 cuadros y el modo de reproducción `0x2F`.
5. Actualizaciones parciales de la pantalla y patrones de prueba.
6. Mejoras de UX y tests.
7. Firmar `OpenKEY.exe` si se distribuye.

Los detalles de implementación y las trampas del protocolo están en `HANDOFF.md` y `docs/PROTOCOL.md`.
