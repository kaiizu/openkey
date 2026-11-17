<p align="center">
  <img src="web/logo.png" width="112" alt="OpenKEY">
</p>

<h1 align="center">OpenKEY</h1>

<p align="center">
  <strong>Centro de control local para Attack Shark X820 Ultra / AK820 Ultra</strong><br>
  Sin Electron · Sin nube · Sin telemetría · USB HID directo
</p>

<p align="center">
  <a href="https://github.com/kaiizu/openkey/releases/latest"><img alt="Release" src="https://img.shields.io/badge/release-v1.2.0-2ea44f?style=flat-square"></a>
  <img alt="Windows" src="https://img.shields.io/badge/Windows-10%2F11-0078D4?style=flat-square&logo=windows&logoColor=white">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white">
  <img alt="UI" src="https://img.shields.io/badge/UI-vanilla%20JS-F7DF1E?style=flat-square&logo=javascript&logoColor=black">
  <img alt="License" src="https://img.shields.io/github/license/kaiizu/openkey?style=flat-square">
</p>

<p align="center">
  <img src="docs/screenshots/overview.jpeg" alt="Vista de resumen de OpenKEY">
</p>

OpenKEY es una alternativa local y ligera al driver oficial del **Attack Shark X820 Ultra** (también vendido como **AK820 Ultra**). Habla directamente con el teclado por USB HID y sirve la interfaz desde tu propio PC en `127.0.0.1`: no hay cuenta, nube, telemetría ni servicios de fondo.

> [!TIP]
> Si solo querés usar la app, descargá la última release, descomprimila y ejecutá `OpenKEY.exe`. No hace falta Python.

## Descarga

<p align="center">
  <a href="https://github.com/kaiizu/openkey/releases/latest"><img alt="Descargar OpenKEY" src="https://img.shields.io/badge/Descargar-OpenKEY%20para%20Windows-2ea44f?style=for-the-badge&logo=windows&logoColor=white"></a>
</p>

- Descargá `OpenKEY-1.2.0-win64.zip` desde [Releases](https://github.com/kaiizu/openkey/releases/latest).
- Descomprimí la carpeta completa. **No muevas solo el `.exe`**: `_internal` tiene que quedar al lado.
- Ejecutá `OpenKEY.exe`. La primera vez, SmartScreen puede pedir confirmación porque el binario no está firmado.

> [!IMPORTANT]
> OpenKEY **no actualiza el firmware**. Solo configura el teclado mediante los comandos HID que ya existen en el firmware. Si el driver oficial está abierto, cerralo antes de aplicar cambios.

## Características

| Módulo | Qué incluye |
| --- | --- |
| **Resumen** | Modelo, firmware, perfil activo, report rate, debounce, luz principal/lateral y ruta HID. |
| **Iluminación** | Todos los efectos del firmware, brillo, velocidad, color, *dazzle* y variante para la luz principal y la tira lateral. |
| **Onda reactiva** | Efecto «Water drop» renderizado en el PC y enviado por `0x0F`, sin escribir en flash. Preset incluido y disparo manual/global. |
| **Color por tecla** | Editor sobre el layout real de 80 teclas, lectura previa, validación y activación de `LightUserPicture`. |
| **Pantalla** | Imágenes y GIF de 128×128, encuadre/rotación, 60 cuadros, rectángulo común, reloj y modo de reproducción de páginas. |
| **Teclas** | Remapeo de tecla, combinación o macro por perfil/capa, captura de tecla física y protección de Fn. |
| **Macros** | 50 slots de 256 bytes, grabación, edición de eventos y guardado verificado con `0x0B`. |
| **Respaldos** | Exportación/importación JSON de perfiles y capas, restauración completa con verificación. |
| **Música** | Sincronización con la salida de Windows por WASAPI loopback, FFT propia y frames RGB de 21×6. |
| **Apariencia** | Interfaz **Español/English** y temas **Grafito**, **Cobalto** y **Mercurio**. |

## Capturas

| Iluminación | Onda reactiva |
| :---: | :---: |
| ![Iluminación](docs/screenshots/lighting.jpeg) | ![Onda reactiva](docs/screenshots/ripple.jpeg) |

| Pantalla | Teclas |
| :---: | :---: |
| ![Pantalla](docs/screenshots/screen.jpeg) | ![Teclas](docs/screenshots/keys.jpeg) |

| Macros | Ajustes |
| :---: | :---: |
| ![Macros](docs/screenshots/macros.jpeg) | ![Ajustes](docs/screenshots/settings.jpeg) |

<p align="center">
  <img src="docs/screenshots/appearance.jpeg" alt="OpenKEY en inglés con el tema Cobalto" width="820">
  <br>
  <sub>English + tema Cobalto · la apariencia se elige en Ajustes → Apariencia.</sub>
</p>

## Cómo funciona

```mermaid
flowchart LR
    UI["Interfaz web<br/>HTML + CSS + JS"] -->|HTTP JSON<br/>127.0.0.1| Server["Servidor Python<br/>butler/server.py"]
    Server -->|Feature reports HID<br/>ctypes| KB["Teclado X820 Ultra"]
    Audio["Audio de Windows<br/>WASAPI loopback"] --> Server
    Server -->|Frames 0x0F| KB
```

- **Backend:** Python + `ctypes` sobre `hid.dll` / `setupapi.dll`. Nada de Node, Electron ni WebHID.
- **Frontend:** HTML, CSS y JavaScript sin framework, servido localmente.
- **HID:** *feature reports* de 64 bytes. Los comandos y paquetes están documentados en [`docs/PROTOCOL.md`](docs/PROTOCOL.md).
- **Sin dependencias de runtime:** todo lo necesario está en la biblioteca estándar de Python y en `web/`.

### Dispositivo

| Campo | Valor |
| --- | --- |
| Modelo | Attack Shark X820 Ultra / AK820 Ultra |
| VID / PID (cable) | `0x3151` / `0x5002` |
| Device ID | `3461` (`0x0D85`) |
| Pantalla | 128 × 128, RGB565 |
| Firmware de referencia | Attack Shark Driver v4 3.2.20 |

## Instalación desde el código

Requisitos: **Windows 10/11**, Python **3.10+** (probado con 3.15) y el teclado conectado por USB.

```powershell
git clone https://github.com/kaiizu/openkey.git
cd openkey
python run.py
```

También podés usar los lanzadores:

```text
OpenKEY.bat                 # con consola
OpenKEY (sin consola).vbs   # en segundo plano
```

La UI queda disponible en `http://127.0.0.1:8737/`. Si el puerto está ocupado, la segunda instancia usa el siguiente puerto libre.

### Compilar el `.exe`

```powershell
.\tools\build_exe.ps1
```

El script crea un entorno local `.venv-build`, instala PyInstaller desde `requirements-dev.txt` y genera `dist\OpenKEY\OpenKEY.exe` en modo *onedir*, sin consola. Cerrá OpenKEY antes de recompilar.

## Uso rápido

<details>
<summary><strong>Iluminación y onda reactiva</strong></summary>

La pestaña se divide en **Efectos del teclado**, **Onda reactiva · Water drop** y **Color por tecla**.

- **Efectos:** elegí por categoría, ajustá color/brillo/velocidad y pulsá **Aplicar iluminación**. La tira lateral tiene su propia tarjeta.
- **Water drop:** anillos suaves desde cada tecla, renderizados en el PC y enviados a 15/20/30 fps. Usa `GetAsyncKeyState`, no un hook global. Al detener se restaura la iluminación anterior.
- **Onda del firmware:** guarda el modo Onda nativo para usarlo con la app cerrada.
- **Color por tecla:** lee el mapa actual, pintá sobre el layout y aplicá; OpenKEY verifica la lectura posterior antes de activar el modo personalizado.

</details>

<details>
<summary><strong>Pantalla y GIF</strong></summary>

Arrastrá una imagen o GIF. OpenKEY la ajusta a 128×128, la convierte a RGB565 y envía solamente el rectángulo con píxeles no negros.

- **Hasta 60 cuadros y 2 MB.**
- GIFs de más de 1,5 MB se pueden comprimir o subir completos.
- GIFs de más de 60 cuadros se pueden comprimir (muestreo uniforme) o recortar a los primeros 60.
- La opción **Mantener esta página después de subir** fija la página con `0x2F` para que el GIF no vuelva solo a una imagen anterior.

</details>

<details>
<summary><strong>Teclas, macros y respaldos</strong></summary>

- Elegí perfil y capa; seleccioná una tecla y asigná tecla, combinación o macro.
- **Fn** está protegida para no romper la capa de funciones.
- Los respaldos JSON incluyen perfiles 0/1 y capas base/Fn; la restauración escribe y verifica.
- Las macros tienen 50 slots de 256 bytes y se guardan con `0x0B`; después se asignan desde **Teclas → Macro**.

</details>

<details>
<summary><strong>Música y apariencia</strong></summary>

- **Música** captura la salida predeterminada de Windows por WASAPI loopback, calcula una FFT de 1024 muestras y envía frames de 21×6 por `0x0F`. Solo corre mientras está activa.
- **Apariencia** permite cambiar entre **Español/English** y los temas **Grafito**, **Cobalto** y **Mercurio**. Las preferencias se guardan en `localStorage`.
- Para previsualizar sin cambiar tus preferencias: `?lang=en`, `?theme=cobalto`.

</details>

## Estado y limitaciones

- Probado contra el teclado físico por USB.
- El receptor **2.4G** y **Bluetooth** todavía no están soportados.
- La música usa solo la **salida predeterminada** de Windows.
- No hay actualización de firmware ni recuperación por USB.
- La tecla **Fn** tiene un LED rojo de carga que no es RGB y no se controla por software.
- El ejecutable no está firmado; SmartScreen puede pedir confirmación.

> [!WARNING]
> No flashes firmware de otros teclados, incluido el AJAZZ AK820 Pro: usa otra MCU, otro bootloader y otro formato de actualización. OpenKEY no modifica el firmware.

## Desarrollo

```powershell
# Comprobaciones rápidas
python -m compileall -q butler run.py tools
node --check web\app.js
node --check web\i18n.js
python -m unittest discover -s tests -v

# Servidor de desarrollo
python run.py --no-browser

# Ejecutable
.\tools\build_exe.ps1
```

### i18n y temas

- **Idioma:** el español es el idioma de origen. Las traducciones inglesas viven en `web/i18n.js`; un `MutationObserver` traduce también los textos generados dinámicamente.
- **Temas:** la base está en `web/cobalto.css`; `web/themes.css` contiene Cobalto y Mercurio, además del selector de Apariencia.
- **Datos generados:** no editar a mano `web/layout_ak820.json`, `web/keycodes.json` ni `data/*.json`; se regeneran con `tools/`.

### Estructura

```text
butler/                 backend Python
  core.py               protocolo YC3123, luces, pantalla, matriz y macros
  audio.py              WASAPI loopback, FFT y frames 0x0F
  ripple.py             onda reactiva Water drop
  hidwin.py             HID con ctypes
  server.py             servidor HTTP local y API JSON
web/                    interfaz
  index.html
  style.css
  cobalto.css
  themes.css            Grafito, Cobalto y Mercurio
  app.js
  i18n.js               Español → English
  logo.png / logo.ico
data/                   datos extraídos del driver oficial
docs/                   protocolo, capturas y prototipos
tests/                  tests con mocks del HID
tools/                  extracción, sondeo y build
dist/OpenKEY/           ejecutable empaquetado (no versionado)
```

El protocolo completo, checksums y comandos están en [`docs/PROTOCOL.md`](docs/PROTOCOL.md).

## Seguridad

- Todo se ejecuta en `127.0.0.1`; no se envía nada a Internet.
- No instala drivers ni toca el registro.
- Las escrituras HID no se repiten automáticamente si falla la comunicación: reconectá y leé el estado antes de reintentar.
- El driver oficial y OpenKEY comparten los mismos *feature reports*; cerrá el driver oficial antes de aplicar cambios.

## Licencia

MIT. Ver [`LICENSE`](LICENSE).

## Créditos

Proyecto personal, no oficial. «Attack Shark», «X820 Ultra» y «AK820 Ultra» son marcas de sus respectivos dueños. El protocolo se obtuvo analizando la app oficial instalada y verificando las respuestas del teclado; no se distribuye código propietario del driver. La inspiración para la vista previa y el preajuste local viene de [OpenKeyboard](https://openkeyboard.abhicracker.com/), que usa protocolos distintos.

Usá OpenKEY bajo tu propio riesgo y guardá una copia de tu configuración.
