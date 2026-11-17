# HANDOFF — OpenKEY · configurador para Attack Shark X820 Ultra

> **Nombre actual: OpenKEY.** El paquete Python sigue llamándose `butler` para mantener la compatibilidad. Los lanzadores actuales son `OpenKEY.bat` y `OpenKEY (sin consola).vbs`; los antiguos quedan como accesos compatibles.

> **Iluminación:** hay una vista previa local aproximada de apagado, fijo, respiración, neón, ola y serpiente sobre la geometría del teclado, además de un preajuste local en el navegador. No escriben en el teclado hasta pulsar Aplicar. No se importaron comandos del proyecto OpenKeyboard para otros dispositivos.

> **Color por tecla:** el editor lee 384 bytes con `0x8C`, y solo modifica posiciones visibles; compara la lectura original antes de escribir. El driver oficial escribe 378 bytes con `0x0C` en siete bloques (seis de 56 y uno de 42), no 384. Se verificó en hardware la escritura de Esc, la lectura posterior, la activación de `LightUserPicture` y la persistencia del mapa al cambiar de efecto; se restauraron el mapa completo y el efecto anterior. Tras desconectar y reconectar el USB, los 384 bytes y el modo de iluminación se conservaron idénticos. No se comprobó un apagado completo, pues el dispositivo puede tener alimentación por batería. Cerrar el driver oficial antes de aplicar.

> **Traslado:** el proyecto se consolidó en este repositorio. El paquete Python conserva el nombre `butler` por compatibilidad. El servidor actual en `127.0.0.1:8737` ejecuta la versión empaquetada `dist\OpenKEY\OpenKEY.exe`; para desarrollar, cierra el exe y usa `python run.py`.

> **Actualización de fiabilidad:** la matriz se carga al abrir Teclas, se eliminaron consultas de estado duplicadas y el estado obtiene ID y versión USB con una sola respuesta. El gestor reintenta lecturas ante errores HID, pero no repite escrituras fallidas; estas pueden haber quedado aplicadas parcialmente. La matriz devuelve datos sin encabezado de comando; se comprueba su longitud. Pruebas con mocks: `python -m unittest discover -s tests -v`.

> **Interfaz:** el panel de asignación permite buscar funciones por nombre o categoría y muestra el número de resultados. La lectura de teclas y las operaciones principales tienen estados de carga; las respuestas antiguas de perfil/capa se descartan. La vista previa de iluminación incluye un ajuste local de velocidad (0.25×–4×, guardado en `localStorage`) para calibrarla contra el teclado; no cambia lo que se envía. El valor calibrado para el X820 Ultra es 2.60× y quedó como default.

> **Rueda:** en Teclas se dibuja una sola rueda y su panel permite seleccionar por separado giro izquierdo, pulsación y giro derecho; cada función conserva su índice de matriz.

> **Interfaz:** `web/cobalto.css` contiene la base visual grafito/amarillo; `web/themes.css` añade los temas Cobalto (azul tinta y ámbar) y Mercurio (grafito y verde salvia). En Teclas, las pulsaciones con la ventana enfocada se resaltan localmente sin registrarse ni enviarse; se omiten campos de texto y combinaciones con modificadores y se respeta movimiento reducido. La fuente de la app es la del sistema para conservar el funcionamiento sin red.

> **Tema por defecto:** Grafito, con grises claros y amarillo inspirados en el teclado físico. Los desplegables conservan controles nativos y usan listas personalizadas cuando el navegador admite `base-select`; en otros navegadores el aspecto de la lista depende del sistema.

> **Diagnóstico de música (histórico):** en el teclado se leyó `LightMusicFollow2` con brillo 4 y byte de modo `0x04`; no reaccionaba a la música. En ese momento OpenKEY solo seleccionaba el modo y no capturaba audio; la implementación posterior se describe más abajo. El driver oficial tiene un `rhythm_service.exe` que expone datos de espectro para una visualización. Se corrigió la lectura de Dazzle para los modos de música (`0` activo, `4` desactivado) y se añadieron pruebas.

> **Investigación posterior de música:** el usuario confirmó que «Music Follow» sí reacciona con el driver oficial. Este driver usa `rhythm_service.exe` para datos de espectro y una ruta de sincronización de iluminación que produce una imagen RGB de 21×6 y la envía con `sendSyncColor` (`0x0F`, trozos de hasta 56 bytes). La lectura real `0x8F` de este X820 Ultra devuelve `byte[11] == 1`, que el driver interpreta como soporte de sincronización por USB. Sigue sin verificarse si la opción «Music Follow» probada utiliza exactamente esa ruta y qué modo de iluminación requiere; en ese momento OpenKEY aún no capturaba audio. La implementación posterior se describe más abajo. Evitar escribir comandos de prueba mientras el driver oficial esté activo.

> **Música implementada:** `butler/audio.py` captura la salida predeterminada de Windows con WASAPI loopback, calcula una FFT de 1024 muestras y envía frames RGB de 21×6 con `0x0F` (7 paquetes de 56 bytes). Se verificó en hardware: el teclado reacciona a los frames. La función es **on-demand**: no hay hilo, captura ni tráfico HID cuando está detenida. Mientras está activa, la luz principal queda en `LightAlwaysOn` y los frames toman el control; al detener se restaura el efecto anterior. Medición real del proceso: ~8 % de un núcleo a 20 fps, ~6 % a 15 fps y ~11 % a 30 fps; la estimación de la UI es conservadora. La RAM extra es de ~4–5 MB. Al detener se envía un frame negro y se restaura la iluminación anterior. Limitación: solo salida predeterminada, sin selector de dispositivo. La tecla **Fn** tiene un LED rojo fijo de carga (no es RGB) y no se puede apagar desde software.

> **GIF animado:** la pantalla acepta varios cuadros. El navegador decodifica el GIF con `ImageDecoder`, compone cada cuadro a 128×128, calcula el rectángulo común y envía un solo `0xA5` con `frameNum = N` seguido de `N` conjuntos de `0x25` con `currentFrame`, `frameNum` y `delay` (ms). Límite de OpenKEY: 60 cuadros y 2 MB; la subida puede tardar varios segundos por cuadro. Si supera 1,5 MB, la UI permite subirlo completo (más lento) o comprimirlo a 1,5 MB. Si supera los 60 cuadros, permite comprimir la animación (quita cuadros intermedios y ajusta la duración) o usar solo los primeros 60. **Verificado en hardware: el GIF de 3 cuadros anima en la pantalla.** La decodificación y las estrategias se probaron en navegador con GIFs de 3, 90 y 60 cuadros.

> **Reproducción de pantalla (`0x2F`):** el comando que el driver llama `setScreenMenu` **no es un menú**: selecciona entre mantener la página (`0`) y rotar páginas automáticamente cada N segundos (`1`). Ese modo automático era la causa de que un GIF volviera solo a la última imagen fija después de unos segundos. OpenKEY ahora llama a `set_screen_playback(False, 1)` después de cada subida (opción «Mantener esta página después de subir», activada por defecto) y ofrece el modo de reproducción en la pestaña Pantalla.

> **Indicadores retirados:** la tarjeta de batería/OpenCode Go se eliminó de la UI y `/api/widgets` se retiró del servidor. La imagen que ya estuviera guardada en la pantalla puede seguir existiendo hasta que se suba otra; el modo de reproducción `0x2F` explicaba que reapareciera sola.

> **Empaquetado:** `dist\OpenKEY\OpenKEY.exe` es un build **onedir sin consola** con PyInstaller y el Python del entorno de build, icono `web\logo.ico`, `web/` y `data/` incluidos. Ocupa ~22 MB en total. Se probó desde otra carpeta de trabajo: sirve la UI, `/api/status`, `/api/music/status` y `/api/ripple/status`. El script `tools\build_exe.ps1` crea un venv local `.venv-build`, instala `requirements-dev.txt` y recompila sin instalar nada global. No mover solo el `.exe`: `_internal` debe quedar al lado. **No ejecutar `build\OpenKEY\OpenKEY.exe`**: es el stub intermedio de PyInstaller y falla con “Failed to load Python DLL”; el script lo elimina tras compilar. Usar siempre `dist\OpenKEY\OpenKEY.exe`.

> **Idioma y temas:** la UI tiene español (origen) e inglés (`web/i18n.js`, observer para textos dinámicos). En Ajustes se elige idioma y tema (`Grafito`, `Cobalto`, `Mercurio`). Las preferencias se guardan en `localStorage`; `?lang=en` y `?theme=cobalto` permiten previsualizar sin guardar.

**Fecha:** 2026-11-17  
**Estado:** v1.2 funcional, probada contra el teclado físico.  
**Para:** siguiente agente o colaborador que continúe el proyecto.

---

## 0. TL;DR

- Proyecto en este repositorio; el paquete Python conserva el nombre `butler`.
- App local: backend Python + interfaz web estática. **No usa Electron.**
- El protocolo HID se reverse-engineereó del driver oficial **Attack Shark Driver v4 3.2.20** y se verificó contra el teclado por USB.
- Funciona: estado, luces principal/lateral, pantalla 128×128 (imagen y GIF animado), reloj, modo de reproducción de páginas, remapeo de teclas, perfiles, report rate, debounce, suspensión, color por tecla, macros, onda reactiva y sincronización de audio.
- No implementado: 2.4G/Bluetooth y actualización de firmware.
- Servidor actual: `http://127.0.0.1:8737/` (proceso `OpenKEY.exe` empaquetado; el PID cambia al reiniciar). Para desarrollo, cierra el exe y arranca `python run.py`.
- Versión empaquetada: `dist\OpenKEY\OpenKEY.exe` (onedir, sin consola, ~22 MB).
- Si el servidor no responde, reiniciar con el comando de la sección 4.

---

## 1. Qué es este proyecto

OpenKEY es una alternativa ligera al driver oficial para el teclado **Attack Shark X820 Ultra** (comercialmente **AK820 Ultra**). La app oficial es Electron, arranca varios servicios y tiene una UI pesada. OpenKEY ofrece solo lo necesario, en una ventana local, sin nube ni telemetría.

El usuario quiere una app **más optimizada** para configurar el teclado. No pidió explícitamente reemplazar todas las funciones del driver, pero sí una experiencia más rápida y clara.

---

## 2. Hardware y entorno

- Teclado conectado por **USB**.
- USB descriptor: `X820UItra`.
- VID/PID: `0x3151 / 0x5002`.
- Device ID reportado por firmware: `3461` (`0x0D85`).
- Pantalla: **128×128**, modo RGB565 (`mode: "16"`).
- Chip/protocolo: familia **YC3123**.
- Windows 10/11, Python **3.10+**; en esta máquina se probó con Python **3.15.2** (`python` y `pythonw` están en el `PATH`).
- Driver oficial instalado en:
  `C:\Users\<usuario>\AppData\Local\Programs\Attack Shark Driver v4\`
- App oficial (procesos que pueden estar abiertos): `Attack Shark Driver v4.exe`, `iot_manager_rs.exe`, `rhythm_service.exe`, `screen_capture_service.exe`, `keyboard_monitor_service.exe`.

### Estado actual del teclado

Comprobado con `http://127.0.0.1:8737/api/status`:

```json
{
  "connected": true,
  "product": "X820 Ultra",
  "vid": "3151",
  "pid": "5002",
  "profile": 0,
  "reportRate": 4000,
  "debounce": 1
}
```

---

## 3. Arquitectura

```
Navegador / ventana Edge --app
        │  HTTP JSON (127.0.0.1:8737)
        ▼
butler/server.py  ──►  DeviceManager (lock + reconexión)
        │
        ▼
butler/core.py  ──►  Keyboard (protocolo YC3123)
        │
        ▼
butler/hidwin.py  ──►  HidD_SetFeature / HidD_GetFeature (ctypes)
        │
        ▼
Feature report de 64 bytes (report ID 0)  ──►  teclado
```

No hay dependencias externas. Todo el acceso HID usa `ctypes` contra `hid.dll` y `setupapi.dll`.

### Archivos principales

| Archivo | Rol |
| --- | --- |
| `butler/hidwin.py` | Enumeración HID, apertura del device path, `get_feature`/`set_feature`. |
| `butler/core.py` | Protocolo: comandos, checksum, luces, pantalla, matriz, ajustes. |
| `butler/server.py` | Servidor HTTP, API JSON, archivos estáticos, `open_ui()`. |
| `butler/audio.py` | WASAPI loopback, FFT, frames 21×6 y gestor on-demand de música. |
| `butler/ripple.py` | Onda reactiva «Water drop»: lectura de teclas con `GetAsyncKeyState`, render 21×6 y stream `0x0F` on-demand. |
| `web/index.html` | Estructura de la UI base en español. |
| `web/style.css` | Tema oscuro, layout responsive. |
| `web/cobalto.css` | Base visual grafito/amarillo y controles. |
| `web/themes.css` | Temas Cobalto y Mercurio + selector de tema. |
| `web/i18n.js` | Traducción ES/EN de textos estáticos y dinámicos. |
| `web/app.js` | Lógica de la UI, estado, llamadas a la API. |
| `web/layout_ak820.json` | Layout físico + índice de slot + binding por defecto (generado). |
| `web/keycodes.json` | Destinos de remapeo agrupados (generado). |
| `data/keymap.json` | Tabla de keycodes extraída del driver (generado). |
| `data/layout.json` | Geometría del layout `Common80_SG9045` (generado). |
| `data/default_matrix.json` | Matriz por defecto del modelo (generado). |
| `docs/PROTOCOL.md` | Protocolo detallado, comandos y formato de paquetes. |
| `tools/` | Scripts de extracción y sondeo; no hacen falta para usar la app. |
| `run.py` | Lanzador. |
| `OpenKEY.bat` | Lanzador con consola. |
| `OpenKEY (sin consola).vbs` | Lanzador oculto con `pythonw`. |
| `Butler.bat` | Alias heredado del lanzador con consola. |
| `Butler (sin consola).vbs` | Alias heredado del lanzador oculto. |

---

## 4. Cómo ejecutar, parar y reiniciar

### Ejecutar en primer plano (para desarrollo)

```powershell
cd <ruta-al-repositorio>
python run.py
```

- Abre una ventana Edge/Chrome en modo `--app` (sin barras de navegador).
- `--no-browser` evita abrir la ventana.
- `--port 8737` cambia el puerto.
- `Ctrl+C` detiene el servidor.

### Ejecutar oculto (como quedó ahora)

```powershell
Start-Process 'pythonw' -ArgumentList 'run.py' `
  -WorkingDirectory (Get-Location) -WindowStyle Hidden
```

### Parar

```powershell
$c = Get-NetTCPConnection -LocalPort 8737 -State Listen -ErrorAction SilentlyContinue
if ($c) { Stop-Process -Id $c.OwningProcess -Force }
```

### Comprobar que está vivo

```powershell
Invoke-RestMethod http://127.0.0.1:8737/api/ping
Invoke-RestMethod http://127.0.0.1:8737/api/status
```

### Abrir solo la ventana

```powershell
Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  -ArgumentList '--app=http://127.0.0.1:8737/','--window-size=1390,900'
```

---

## 5. API actual

Todas las rutas son locales y devuelven JSON.

| Método | Ruta | Cuerpo / parámetros | Descripción |
| --- | --- | --- | --- |
| GET | `/api/ping` | — | `{ok:true}` |
| GET | `/api/status` | — | Estado completo del teclado. |
| GET | `/api/meta` | — | Modos de luz, report rates, sistemas. |
| GET | `/api/layout` | — | Layout físico generado. |
| GET | `/api/keycodes` | — | Destinos de remapeo. |
| GET | `/api/keys?profile=0&layer=0` | — | Matriz decodificada + binding actual. |
| GET | `/api/keys/backup` | — | Respaldo JSON de perfiles 0/1 y capas base/Fn. |
| GET | `/api/music/status` | — | Estado, CPU/RAM, tiempos y frame actual de música. |
| GET | `/api/ripple/status` | — | Estado, contadores y frame actual de la onda reactiva. |
| GET | `/api/macros?slot=0` | — | Lee un slot de macro (`0x8B`). |
| POST | `/api/music/start` | `{source?,gain?,mode?,color?,fps?}` | Inicia WASAPI + stream `0x0F`. |
| POST | `/api/music/stop` | `{}` | Detiene, limpia el frame y restaura la luz. |
| POST | `/api/music/config` | `{gain?,mode?,color?,fps?}` | Ajusta la sincronización en caliente. |
| POST | `/api/ripple/start` | `{colorMode?,color?,expansion?,lifetime?,thickness?,maxRadius?,fps?}` | Inicia la onda reactiva. |
| POST | `/api/ripple/stop` | `{}` | Detiene, limpia el frame y restaura la luz. |
| POST | `/api/ripple/config` | igual | Ajusta la onda en caliente. |
| POST | `/api/ripple/trigger` | `{x?,y?}` | Lanza una onda manual. |
| POST | `/api/macros` | `{slot,macro}` | Escribe una macro (`0x0B`) y verifica. |
| POST | `/api/light` | `{mode,brightness,speed,rgb,dazzle,option}` | Luz principal. |
| POST | `/api/side-light` | igual | Luz lateral. |
| POST | `/api/settings` | `{profile?,reportRate?,debounce?,system?,sleep?}` | Ajustes. |
| POST | `/api/keys` | `{profile,layer,index,hid?/group?/reset?}` | Remapear/restablecer/desactivar. |
| POST | `/api/keys/restore` | `{profiles}` | Restaura perfiles/capas completos y verifica. |
| POST | `/api/screen/image` | `{left,top,right,bottom,frames[],delay?,pin?}` | Subir imagen o GIF; `pin` fija la página. |
| POST | `/api/screen/clock` | `{}` | Sincronizar reloj. |
| POST | `/api/screen/menu` | `{autoCycle,seconds}` | Mantener página (`false`) o rotar cada N s (`true`). |
| POST | `/api/reset` | `{}` | Reset de fábrica. **Destructivo.** |
| POST | `/api/reconnect` | `{}` | Cerrar y reabrir el HID. |
| POST | `/api/shutdown` | `{}` | Detiene el servidor y cierra OpenKEY. |

Ejemplos:

```powershell
# Luz principal en azul, brillo 4, velocidad 2
Invoke-RestMethod http://127.0.0.1:8737/api/light -Method Post -ContentType 'application/json' `
  -Body '{"mode":"LightAlwaysOn","brightness":4,"speed":2,"rgb":255,"dazzle":false,"option":0}'

# Remapear Esc (slot 0) a A (HID 4), perfil 0, capa 0
Invoke-RestMethod http://127.0.0.1:8737/api/keys -Method Post -ContentType 'application/json' `
  -Body '{"profile":0,"layer":0,"index":0,"hid":4}'

# Restablecer esa tecla
Invoke-RestMethod http://127.0.0.1:8737/api/keys -Method Post -ContentType 'application/json' `
  -Body '{"profile":0,"layer":0,"index":0,"reset":true}'
```

---

## 6. Protocolo (resumen)

La referencia completa está en `docs/PROTOCOL.md`. Lo esencial:

- Feature report de **65 bytes** (report ID `0` + 64 datos).
- `HidD_SetFeature` envía; `HidD_GetFeature` lee.
- Checksum:
  - **Bit7**: `byte[7] = 255 - suma(byte[0..6])`.
  - **Bit8**: `byte[8] = 255 - suma(byte[0..7])`.
- Comandos importantes:
  - `0x8F` ID/versión, `0x84` perfil, `0x83` report rate, `0x86` debounce.
  - `0x87/0x88` luz principal/lateral (Bit8).
  - `0x8A` leer matriz, `0x0A` escribir tecla.
  - `0xA5` iniciar imagen TFT, `0x25` chunks de 56 bytes.
  - `0x28` reloj, `0x2F` modo de reproducción de páginas.
- La matriz tiene 512 bytes; cada tecla ocupa 4 bytes.
- Los códigos de tecla básicos son `[0,0,hid,0]`; los códigos de vendor se empaquetan big-endian (ej. `[3,0,0xEA,0]` = `AudioVolumeDown`).
- La imagen es **columna por columna**, RGB565 big-endian:
  `v = ((r>>3)<<11) | ((g>>2)<<5) | (b>>3)`.
- El firmware solo actualiza el rectángulo con píxeles distintos de negro.

---

## 7. Lo que ya está verificado contra hardware

- [x] Leer ID/versión (`0x8F`, `0xAD`, `0x80`).
- [x] Leer perfil, report rate, debounce, opciones, suspensión.
- [x] Leer luz principal y lateral.
- [x] Escribir luz principal y lateral; verificar cambio y restaurar.
- [x] Leer matriz de teclas.
- [x] Remapear Esc → A → Esc y verificar.
- [x] Restablecer una tecla.
- [x] Subir una imagen completa de 128×128 (32 KB, ~2.8 s).
- [x] Decodificación de GIF y vista previa animada en navegador (prueba de 3 cuadros).
- [x] Paquetes multi-frame `0xA5` + `0x25` probados con mocks.
- [x] Reproducción de GIF en la pantalla física (3 cuadros; anima).
- [x] Sincronizar reloj.
- [x] Modo de reproducción de pantalla `0x2F` (`0` mantener página, `1` rotación automática).
- [x] Cambiar report rate 4000 → 1000 → 4000.
- [x] Cambiar perfil 0 → 1 → 0.
- [x] Sincronización de audio `0x0F` con frames 21×6 verificada en hardware.
- [x] Captura WASAPI loopback (48 kHz, 2 canales, float32) y FFT de 1024 muestras.
- [x] Onda reactiva on-demand (`butler/ripple.py`) con hook por `GetAsyncKeyState` y frames 21×6.
- [ ] Validar en hardware el GIF de 60 cuadros y el límite real de memoria del firmware.
- [x] Ejecutable `.exe` onedir, sin consola, con `web/` y `data/`, probado desde otra carpeta.
- [x] UI completa probada en navegador (Edge/Chromium) sin errores de consola.

---

## 8. Limitaciones, riesgos y cosas que debes saber

1. **App oficial abierta:** OpenKEY puede leer/escribir con la app oficial abierta, pero comparten los mismos feature reports. Recomendación: cerrarla antes de escribir configuración. Si hay errores raros, cerrar la app oficial y pulsar **Reconectar**.
2. **Imagen de pantalla:** durante el desarrollo se subió una imagen de prueba (degradado con “BUTLER”) a la pantalla del teclado. Si el usuario tenía una imagen propia, se perdió; puede volver a subirla desde la pestaña **Pantalla**.
3. **Solo USB:** el receptor 2.4G (`PID 0x5006`) y Bluetooth no están soportados. `find_keyboard()` prioriza `0x5002` y solo cae a otro PID si el producto contiene `X820/AK820`.
4. **Macros:** el protocolo `0x0B` está identificado pero no implementado.
5. **Color por tecla:** implementado después de este handoff; véase la actualización al inicio para la evidencia y limitaciones actuales.
6. **GIF:** implementado en el navegador con `ImageDecoder`; se compone cada cuadro, se calcula el rectángulo común y se envían `N` frames con un solo `0xA5`. Límite actual: 60 cuadros y 2 MB. Si supera 1,5 MB, el diálogo permite subirlo completo (más lento) o comprimirlo a 1,5 MB; si supera 60 cuadros, permite comprimir la animación completa o usar los primeros 60. La animación de 3 cuadros está verificada en la pantalla física.
7. **Firmware:** no hay actualización (`0xAC` y flujo de boot sin explorar).
8. **Python:** el código fuente requiere Python 3.10+; la versión empaquetada en `dist\OpenKEY\OpenKEY.exe` ya incluye el runtime y no necesita Python instalado. Es un build onedir: no mover solo el `.exe`, `_internal` debe quedar al lado. SmartScreen puede pedir confirmación porque no está firmado.
9. **Git:** el proyecto se preparó para publicarse en GitHub; si todavía no hay repositorio local, inicializalo con permiso del usuario y revisá `.gitignore` antes del primer commit.
10. **Archivos generados:** no editar a mano `web/layout_ak820.json`, `web/keycodes.json`, `data/*.json`. Regenerarlos con `tools/`.
11. **Reproducción de pantalla:** `0x2F` elige entre mantener la página (`0`) y rotar páginas cada N segundos (`1`). Si un GIF «vuelve solo» a una imagen fija, es la rotación automática, no un fallo del GIF. OpenKEY fija la página después de cada subida salvo que desactives «Mantener esta página después de subir».
12. **Rueda:** tiene dos modos de firmware: **control de pantalla** (por defecto) y **volumen**. **Fn + pulsar la rueda** alterna entre ambos; en modo volumen, girar baja/sube y pulsar mutea. El mapeo de la matriz está correcto en perfiles 0/1 y capas 0/1 (slots 84, 90 y 91). En modo «mantener página», pulsar la rueda cambia de página; OpenKEY no intercepta la rueda física, solo muestra y remapea sus tres funciones.
13. **Música:** usa solo la salida predeterminada de Windows; no hay selector de dispositivo. El hilo se crea al pulsar **Iniciar** y se destruye al **Detener**; no hay captura ni tráfico HID en reposo. A 20 fps el proceso completo mide ~8 % de un núcleo (15 fps ~6 %, 30 fps ~11 %) y ~4–5 MB extra; el envío HID (7 paquetes por frame) es la parte más costosa. Al detener se envía un frame negro y se restaura la luz anterior.
14. **LED de Fn:** la tecla Fn tiene un LED rojo fijo de fábrica. Es el indicador de carga (rojo fijo cargando, parpadea con batería baja, se apaga al 100 %); no es RGB y no se controla desde OpenKEY ni desde el driver oficial.

---

## 9. Próximos pasos recomendados (en orden)

### 9.1 Empaquetar como `.exe` (implementado)

- Build actual: `dist\OpenKEY\OpenKEY.exe` (PyInstaller, onedir, sin consola, icono `web\logo.ico`, `web/` y `data/` incluidos, ~22 MB).
- Recompilar: `.\tools\build_exe.ps1` crea `.venv-build`, instala PyInstaller en local y genera el `dist` de nuevo.
- La ruta `ROOT` de `server.py` usa `sys._MEIPASS` cuando `sys.frozen` está activo; así encuentra `web/` y `data/` dentro del bundle.
- Probado desde otra carpeta de trabajo; `/`, `/app.js`, `/api/status`, `/api/music/status` y `/api/ripple/status` responden.
- Pendiente: firmar el `.exe` si se distribuye y probarlo en una máquina sin Python/Edge (el navegador sigue siendo necesario para la UI).

### 9.2 Macros (implementado; validar en hardware)

- Comando `0x0B` (set macro), páginas de 56 bytes; lectura `0x8B` en cuatro páginas de 64 bytes.
- Cabecera `[repeatCount_lo, repeatCount_hi]` + eventos; delays de 1–127 ms se empaquetan en un byte, los mayores en dos.
- Asignación a tecla: config `[9, macroType, macroIndex, 0]`; `macroType` 0 repetir, 1 alternar, 2 mantener.
- UI: editor de secuencia, grabación local, 50 slots y nombres guardados en `localStorage`.
- Cuidado: validar longitud máxima (256 bytes) y no romper la tecla Fn.

### 9.3 Color por tecla / `LightUserPicture` (impacto medio)

- Lectura `0x8C` (6 chunks de 64 bytes), escritura `0x0C` (7 chunks de 56).
- La matriz de color tiene 3 bytes por slot del `defaultMatrix` (128 slots × 3 = 384 bytes).
- La UI puede reutilizar `web/layout_ak820.json` para pintar teclas.
- Inicializar siempre desde la lectura actual para no borrar la configuración del usuario.
- Activar modo `LightUserPicture` después de escribir.

### 9.4 GIF animado (implementado; validar 60 cuadros)

- El protocolo `0x25` acepta `frame`, `numFrames`, `delay`; `0xA5` se envía una vez con `frameNum = N`.
- El navegador decodifica con `ImageDecoder`, compone cada cuadro a 128×128 y usa el rectángulo común.
- Límite actual: 60 cuadros y 2 MB. Si supera 1,5 MB, el diálogo ofrece subir completo o comprimir a 1,5 MB; si supera 60 cuadros, ofrece comprimir la animación (deduplicar/samplear y ajustar la duración) o usar los primeros 60.
- La subida es secuencial y puede tardar varios segundos por cuadro; la UI estima el tiempo.
- Verificado en hardware con 3 cuadros. Pendiente: validar la velocidad con GIFs largos y el límite real de memoria del firmware.

### 9.5 Dongle 2.4G (impacto medio, complejidad alta)

- El driver oficial usa una capa extra sobre el dongle: comandos `0xF6` (seleccionar keyboard/mouse), `0xF7` (estado), `0xFC/0xFE` (lectura/escritura).
- Requiere portar `CommonDongle` y `jM` de `dist/js/fec...`/`index`.
- Alternativa más simple: mantener USB como único modo soportado y documentarlo.

### 9.6 Mejoras de UX (impacto medio, riesgo bajo)

- Buscador de keycodes en el panel de teclas (ya hay búsqueda y captura de tecla física).
- Validar el factor 2.60× con otros efectos/velocidades; hoy es el default calibrado para el X820 Ultra y sigue siendo ajustable por navegador (0.25×–4×).
- Deshabilitar el color en modos que lo ignoran (`LightOff`, `LightUserPicture`, `LightScreenColor`) — ya se atenúan en la UI.
- Botón “enviar pantalla en negro”.
- Recordar última página/perfil en `localStorage`.
- Añadir un botón para cerrar el servidor desde la UI (ya existe).
- Tests automáticos de API con `pytest` + mocks del HID.

### 9.7 Tests

- `python -m compileall -q butler run.py tools`
- `node --check web/app.js`
- `Invoke-RestMethod /api/status`, `/api/keys`, `/api/meta`.
- Pruebas de hardware manuales: luces, remapeo, imagen, reloj, report rate.
- Para no escribir en el teclado durante tests, usar un mock de `Keyboard` o un flag `--dry-run` (no implementado).

### 9.8 Música (implementado; mejoras posibles)

- Selector de salida de audio: enumerar `IMMDevice` y mostrar el nombre amigable.
- Ajustar ataque/release y la escala dB con audio real de distintos géneros.
- Probar salidas exclusivas, Bluetooth y cambios de dispositivo en caliente.
- Evaluar 60 fps solo si el usuario lo pide; 15 fps es el modo de bajo consumo.
- La tecla Fn no se puede apagar: es un LED de carga, no RGB.

### 9.9 Pantalla y knob

- Probar actualizaciones parciales de un rectángulo pequeño; si funcionan, reducir el tiempo de envío.
- Evaluar páginas múltiples (hasta 5 imágenes estáticas) con el modo de reproducción/knob.
- Si la rueda física no responde al volumen: revisar perfiles/capas, probar otro puerto USB y, si sigue igual, descartar firmware/hardware antes de un reset.

---

## 10. Convenciones y trampas del código

- `Keyboard.cmd(payload, bit=7, delay=0.012, retries=2, expect=None)`:
  - Envía y lee.
  - Si `expect` no coincide, reintenta.
  - Para comandos que no esperan respuesta (reloj, modo de reproducción, escrituras de imagen), usar `expect=None, retries=0` y `delay` pequeño.
- `Keyboard.send_image` espera `data` de longitud exacta `(right-left)*(bottom-top)*2`.
- `set_key_group` recibe 4 bytes; `set_key_simple` empaqueta HID > 0xFF en 4 bytes big-endian.
- `Keyboard.send_sync_color(frame)` espera 378 bytes (21×6×3) y envía 7 paquetes `0x0F` sin lectura. `clear_sync_color()` manda un frame negro.
- `Keyboard.send_images(frames, left, top, right, bottom, delay)` envía un solo `0xA5` con `frameNum=N` y después `N` secuencias `0x25`; `send_image` es el caso `N=1`. El `delay` va en milisegundos (la UI lo limita a 20–255).
- `Keyboard.set_screen_playback(auto_cycle, seconds)` usa `0x2F`: `0` mantiene la página y `1` rota páginas cada N segundos. `_screen_image` la llama con `false` cuando `pin` no está desactivado.
- `MusicSync` es on-demand: `start()` guarda la luz, cambia a `LightAlwaysOn`, arranca el hilo; `stop()` manda negro, restaura y hace `join`. `/api/music/status` llama `touch()` para el watchdog de 5 minutos.
- `RippleSync` sigue el mismo patrón: `GetAsyncKeyState` en un hilo on-demand, render 21×6 y `send_sync_color`; `stop()` manda negro y restaura la luz. `GetAsyncKeyState` no es un hook: solo consulta el estado físico de las teclas del layout.
- `get_macro`/`set_macro` usan `0x8B` (4 páginas de 64 bytes) y `0x0B` (páginas de 56 bytes). `encode_macro`/`decode_macro` viven en `butler/core.py`.
- La tecla Fn se bloquea en `server.py` (`_set_key`) y en la UI (`remappable=false`).
- `DeviceManager.call` reintenta una lectura una vez tras reconectar. Las escrituras usan `write=True` y no se repiten si falla la comunicación; el resultado puede ser incierto o parcial.
- `renderStatus(fillForms)` en `web/app.js`: si `fillForms` es `false` no toca los formularios; útil para no pisar ediciones del usuario.
- El estado de la UI está en el objeto `state` de `web/app.js`; no hay framework.
- El servidor usa `ThreadingHTTPServer`, pero el HID está serializado por `Keyboard.lock`.
- En PowerShell, usar `$env:PYTHONIOENCODING='utf-8'` para ver bien los acentos en scripts Python.
- `pythonw` no tiene `sys.stderr`: `Handler.log_message` y los `traceback.print_exc()` deben comprobar que el stream exista. Si no, `http.server` intenta registrar la petición antes de responder y los archivos estáticos devuelven una respuesta vacía.
- En modo PyInstaller, `server.py` resuelve `ROOT` con `sys._MEIPASS` cuando `sys.frozen` está activo. El build es onedir: `OpenKEY.exe` y `_internal` deben quedar juntos; no mover solo el ejecutable.
- Para recompilar: `.\tools\build_exe.ps1` (venv local `.venv-build`, PyInstaller no global).
- Los scripts de `tools/` asumen el driver oficial en la ruta de `%LOCALAPPDATA%`; si cambia, editar `extract_vendor_data.js`.
- `web/app.js` usa `container-type: inline-size` y unidades `cqw`; funciona en Chromium/Edge modernos.

---

## 11. Cómo verificar que no rompiste nada

```powershell
cd <ruta-al-repositorio>
python -m compileall -q butler run.py tools
node --check web\app.js
python -m unittest discover -s tests -v
.\tools\build_exe.ps1
```

Prueba del ejecutable en otro puerto/carpeta:

```powershell
Start-Process 'dist\OpenKEY\OpenKEY.exe' -ArgumentList '--no-browser','--port','8751'
Invoke-RestMethod http://127.0.0.1:8751/api/ping
Invoke-RestMethod http://127.0.0.1:8751/api/ripple/status
```

```powershell
# API
Invoke-RestMethod http://127.0.0.1:8737/api/status
Invoke-RestMethod 'http://127.0.0.1:8737/api/keys?profile=0&layer=0'
```

Prueba manual mínima:

1. Abrir la UI.
2. Pestaña **Iluminación** → cambiar brillo → aplicar → leer del teclado.
3. Pestaña **Teclas** → seleccionar Esc → asignar A → aplicar → restablecer.
4. Pestaña **Pantalla** → subir una imagen pequeña → comprobar que la barra termina y no hay error.
5. Pestaña **Ajustes** → 1000 Hz → aplicar → volver a 4000 Hz.

---

## 12. Checklist para el siguiente agente

- [ ] Leer `HANDOFF.md`, `README.md` y `docs/PROTOCOL.md`.
- [ ] Confirmar que el servidor responde (`/api/ping`, `/api/status`).
- [ ] No editar archivos generados a mano; usar `tools/`.
- [ ] Preguntar antes de: reset de fábrica, sobrescribir la pantalla, cambiar el firmware, inicializar git, instalar dependencias globales.
- [ ] Si se agrega una función nueva, actualizar `README.md` y `docs/PROTOCOL.md`.
- [ ] Si se agrega una ruta API, documentarla en la sección 5.
- [ ] Si se cambia el protocolo, probarlo primero con `tools/hidctl.py` o un script de lectura antes de tocar la UI.
- [ ] Mantener la UI en español y el tono directo.

---

## 13. Contexto del usuario

- Habla español.
- Tiene el teclado conectado por USB.
- Quiere una app más ligera/rápida que el driver oficial.
- Ya se le advirtió que la imagen de prueba reemplazó la de la pantalla.
- Se le ofreció empaquetar como `.exe` y agregar macros/color por tecla como siguientes pasos.
- Le importa el consumo: prefiere funciones on-demand y quiere ver CPU/RAM antes de decidir si las usa.

---

## 14. Fuentes y evidencia

- Driver oficial: `C:\Users\Dan\AppData\Local\Programs\Attack Shark Driver v4\resources\app`.
- Renderer: `dist/js/index.9b3cb33f.js`, `dist/js/f2bae3a7.js`, `dist/js/1bcd6146.js`, `dist/js/b3c17b87.js`.
- Layout: `Common80_SG9045` (80 teclas + 3 segmentos de rueda).
- Modelo: `yc3123_sg_sg9045_b_3m_1k_rgb_kb`, id `3461`.
- Verificación HID directa con `HidD_GetFeature`/`HidD_SetFeature`.
- No se usó el MCP de REA en esta sesión; se aplicó el enfoque de REA (artefacto instalado → análisis estático → verificación en runtime) con las herramientas normales y pruebas contra el hardware.

---

**Si algo no cuadra, empieza por `/api/status` y por `docs/PROTOCOL.md`. La app es pequeña; el 90 % de los problemas van a estar en el HID o en el estado de la UI.**
