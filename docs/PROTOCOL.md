# Protocolo del Attack Shark X820 Ultra (YC3123)

Este documento resume lo que OpenKEY usa para hablar con el teclado. Está separado en **observado** (lo vimos responder al teclado), **inferido** (lo dedujimos del JavaScript del driver oficial) y **desconocido**.

## 1. Objetivo analizado

- Driver oficial: `Attack Shark Driver v4` **3.2.20**.
- Ruta: `%LOCALAPPDATA%\Programs\Attack Shark Driver v4\resources\app`.
- La app es Electron con el renderer desempaquetado en `dist/js/` (no hace falta desempaquetar un ASAR).
- El modelo del teclado está definido en `dist/js/index.9b3cb33f.js`:

```js
{
  id: 3461,
  vid: 0x3151,
  pid: 0x5002,
  name: "yc3123_sg_sg9045_b_3m_1k_rgb_kb",
  displayName: "X820UItra",
  company: "AttackShark",
  layer: 2,
  keyLayout: Common80_SG9045,
  other: {
    screen: { size: { w: 128, h: 128 }, mode: "16" },
    knobKeyCodes: ["AudioVolumeDown", "AudioVolumeMute", "AudioVolumeUp"]
  }
}
```

- La clase base del protocolo está en `dist/js/f2bae3a7.js` (`CommonKb`), y el modelo concreto en `dist/js/1bcd6146.js` (`Yc3123_sg_sg9045_b_3m_1k_rgb_kb`).

## 2. Interfaz HID

**Observado** con la API de Windows:

| Campo | Valor |
| --- | --- |
| Vendor ID | `0x3151` |
| Product ID (cable) | `0x5002` |
| Product string | `X820UItra` |
| Usage page | `0xFFFF` |
| Usage | `0x0002` |
| Feature report length | `65` bytes (report ID 0 + 64 datos) |
| Input report length | `0` (el vendor collection no usa input reports) |

OpenKEY abre el dispositivo con `CreateFileW` (lectura/escritura, compartido) y usa:

- `HidD_SetFeature(handle, buffer, 65)` para enviar.
- `HidD_GetFeature(handle, buffer, 65)` para leer.
- El primer byte del buffer es el report ID (`0`); los 64 restantes son el paquete.

Las lecturas con respuesta inesperada se reintentan y, si se agotan los intentos, producen un error. Si falla una escritura, OpenKEY no repite la operación completa: puede haberse aplicado antes del fallo. Una operación de varios ajustes puede quedar parcialmente aplicada. Hay que reconectar y leer los valores antes de volver a intentar.

La interfaz permite filtrar las funciones disponibles para remapear una tecla; el filtro es local y no cambia el protocolo HID.

La rueda se presenta como un único control físico en la interfaz, con tres funciones seleccionables que siguen usando sus respectivas posiciones en la matriz.

El resaltado de pulsaciones de la vista de Teclas usa eventos locales del navegador mientras la ventana tiene foco; no envía eventos al backend ni cambia el protocolo HID.

La simulación de iluminación y el preajuste local se ejecutan en el navegador y no envían comandos HID. Los efectos seleccionables siguen siendo los modos propios del firmware YC3123; no se usan los paquetes de OpenKeyboard para otros teclados.

El driver oficial llega al mismo sitio por WebHID (`navigator.hid`), no por un driver de kernel.

## 3. Formato del paquete

Cada comando ocupa hasta 64 bytes. Los primeros 9 bytes son significativos; el resto se rellena con ceros.

```
byte 0..6   campos del comando
byte 7      checksum para comandos "Bit7"
byte 8      checksum para comandos "Bit8" (y dato si el comando es Bit7)
byte 9..63  datos / relleno
```

Checksum:

- **Bit7**: `byte[7] = 255 - (suma(byte[0..6]) & 0xFF)`.
- **Bit8**: `byte[8] = 255 - (suma(byte[0..7]) & 0xFF)`.

En los comandos con payload (imagen, matriz completa), el byte 7 es el checksum y el payload empieza en el byte 8.

## 4. Comandos

La columna **Estado** indica si OpenKEY lo usa y si lo verificamos contra el teclado.

| Comando | Nombre | Dirección | Estado |
| --- | --- | --- | --- |
| `0x01` | Reset | Bit7 | Verificado (no se usa en la app salvo reset) |
| `0x03` | Report rate | Bit7 | Verificado |
| `0x04` | Perfil activo | Bit7 | Verificado |
| `0x06` | Debounce | Bit7 | Verificado |
| `0x07` | Luz principal | Bit8 | Verificado |
| `0x08` | Luz lateral | Bit8 | Verificado |
| `0x09` | Opciones de teclado (Win/Mac, FN, RT, WASD) | Bit7 | Verificado parcialmente |
| `0x0A` | Matriz de teclas | Bit7 | Verificado |
| `0x0B` | Macro | Bit7 | Inferido |
| `0x0C` | Imagen de usuario (per-key) | Bit7 | Escritura y lectura posterior verificadas en hardware para una tecla |
| `0x10` | Capa FN | Bit7 | Inferido |
| `0x11` | Tiempos de suspensión | Bit7 | Verificado |
| `0x12` | GIF de usuario | Bit7 | Inferido |
| `0x22` | System info de la pantalla (CPU/RAM/disco/red) | Bit7 | Inferido (driver; pantalla nativa) |
| `0x25` | Datos TFT (16-bit) | Bit7 | Verificado |
| `0x28` | Reloj OLED/TFT | Bit7 | Verificado |
| `0x29` | Datos TFT (24-bit) | Bit7 | Inferido (el modelo usa 16-bit) |
| `0x2F` | Modo de reproducción de pantalla | Bit7 | Verificado |
| `0x80` | Versión RF | Bit7 | Verificado (0 en cable) |
| `0x83` | Leer report rate | Bit7 | Verificado |
| `0x84` | Leer perfil | Bit7 | Verificado |
| `0x86` | Leer debounce | Bit7 | Verificado |
| `0x87` | Leer luz principal | Bit7 | Verificado |
| `0x88` | Leer luz lateral | Bit7 | Verificado |
| `0x89` | Leer opciones | Bit7 | Verificado |
| `0x8A` | Leer matriz | Bit7 | Verificado |
| `0x8C` | Leer colores por tecla | Bit7 | Lectura verificada en hardware |
| `0x8F` | ID / versión USB | Bit7 | Verificado |
| `0x91` | Leer suspensión | Bit7 | Verificado |
| `0xA5` | Iniciar subida TFT | Bit7 | Verificado |
| `0xAD` | Versión OLED/flash | Bit7 | Verificado |
| `0xAF` | Leer menú | Bit7 | Inferido |
| `0xAC` | Borrar flash | Bit7 | Inferido (solo upgrades) |

### 4.1 Report rate

Escritura (`Bit7`):

```
[0x03, 0x00, idx]
```

`idx`: `0=8000`, `1=4000`, `2=2000`, `3=1000`, `4=500`, `5=250`, `6=125`.

Lectura `0x83`: el índice está en `resp[2]`.

### 4.2 Perfil

Escritura (`Bit7`): `[0x04, perfil]` (0–3; el X820 Ultra usa 0–1).
Lectura `0x84`: `resp[1]`.

### 4.3 Debounce

Escritura (`Bit7`): `[0x06, ms]`.
Lectura `0x86`: `resp[1]`.

### 4.4 Luz principal

Escritura (`Bit8`):

```
[0x07, modo, 4-velocidad, brillo, opcion<<4 | modo_extra, r, g, b]
```

- `modo`: índice de `LIGHT_MODES` (0–25).
- `velocidad`: 0–4; se invierte en el paquete (`4 - velocidad`).
- `brillo`: 0–5.
- `modo_extra`:
  - `8` = *dazzle*.
  - `7` = normal.
  - Para `LightUserPicture`: solo `opcion<<4`.
  - Para `LightMusicFollow2/3`: `opcion<<4 | (dazzle ? 0 : 4)`.
  - Para `LightScreenColor`: `0`.
- `LightUserPicture` fuerza RGB `(0, 200, 200)` en el paquete.
- `LightUserColor` usa el RGB elegido.

Lectura `0x87`:

```
resp[1] = modo
resp[2] = 4 - velocidad
resp[3] = brillo
resp[4] = opcion<<4 | extra
resp[5..7] = r, g, b
```

Para los modos de música, el nibble inferior `0` indica Dazzle activo y `4` indica desactivado; se aplica también a la luz lateral. Estos modos son efectos del firmware y no reciben audio de OpenKEY. La sincronización real se hace con `0x0F`; véase la sección 4.13.

El usuario confirmó que «Music Follow» funciona con el driver oficial. La ruta de sincronización del driver genera una matriz de 21×6 píxeles RGB y usa `sendSyncColor`; OpenKEY ya implementa y verificó esa ruta en hardware (sección 4.13). El indicador de compatibilidad USB (`0x8F`, byte 11) se leyó como `1` en este dispositivo.

### 4.5 Luz lateral

Escritura (`Bit8`):

```
[0x08, modo, velocidad, brillo, opcion<<4 | extra, r, g, b]
```

Modos: `0=Off`, `1=AlwaysOn`, `2=Breath`, `3=Neon`, `4=Wave`, `5=Snake`, `6=MusicFollow2`.

`Neon` fuerza `extra=8`; `MusicFollow2` usa `opcion<<4 | (dazzle ? 0 : 4)`.

Lectura `0x88`: mismo formato que la escritura (la velocidad no se invierte).

### 4.6 Suspensión

Escritura (`Bit7`), 16 bytes:

```
[0x11, 0,0,0,0,0,0,0,
 bt_lo, bt_hi,
 wired_lo, wired_hi,
 deep_bt_lo, deep_bt_hi,
 deep_wired_lo, deep_wired_hi]
```

Valores en segundos. Lectura `0x91`: los mismos campos desde `resp[8]`.

### 4.7 Matriz de teclas

Lectura (`Bit7`), 8 paquetes de 64 bytes:

```
[0x8A, perfil, 0xFF, chunk, capa]
```

`chunk` = 0..7, `capa` = 0/1. La respuesta contiene 64 bytes de datos directamente, sin encabezado `0x8A`; se concatenan 512 bytes. Esto se verificó al leer el teclado físico tras el traslado a OpenKEY.

Cada tecla ocupa 4 bytes. Para una tecla básica: `[0, 0, hid, 0]`. Para una función de vendor: los 4 bytes se empaquetan big-endian (por ejemplo `[3, 0, 0xEA, 0]` = `0x0300EA00`, que es `AudioVolumeDown`).

Escritura simple (`Bit7`):

```
[0x0A, perfil, slot, 0, 0, guardar, capa, checksum, b0, b1, b2, b3]
```

- `slot` = índice del layout (0–127).
- `guardar` = 1.
- `b0..b3` = configuración de 4 bytes.

Ejemplo: remapear Esc (slot 0) a A: `[0x0A, 0, 0, 0, 0, 1, 0, checksum, 0, 0, 4, 0]`.

Escritura completa de la matriz (`Bit7`), en trozos de 56 bytes:

```
[0x0A, perfil, 0xFF, chunk, len, ultimo, capa, checksum, datos...]
```

### 4.8 Imagen de pantalla (128×128, RGB565)

La pantalla es de 128×128 y el modelo usa `mode: "16"` (RGB565).

1. **Inicio** (`Bit7`):

```
[0xA5, frame, numFrames, delay,
 len_lo, len_mid, len_hi,
 0,
 left_lo, top_lo, right_lo, bottom_lo,
 left_hi, top_hi, right_hi, bottom_hi,
 len_lo, len_hi, len_3, len_4,
 progreso]
```

El driver solo usa los primeros 19 bytes. `right`/`bottom` son el rectángulo *exclusivo* del área con píxeles distintos de negro. La respuesta debe tener `resp[0] == 0xA5` y `resp[1] == 1`; se reintenta hasta 10 veces con 100 ms.

2. **Datos** (`Bit7`), en trozos de 56 bytes:

```
[0x25, frame, numFrames, delay, chunk_lo, chunk_hi, chunk_len, checksum, datos(56)]
```

Se espera 2 ms entre trozos. Para una imagen completa son 586 trozos (32 768 bytes). En la práctica tarda ~2–3 s.

3. El orden de píxeles es **columna por columna** (`for x: for y:`), y cada píxel son 2 bytes big-endian en RGB565:

```
v = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
byte0 = v >> 8
byte1 = v & 0xFF
```

El área negra exterior se omite; las zonas negras dentro del rectángulo se envían como negro.

#### Animaciones GIF

El mismo mecanismo acepta varios cuadros:

1. Un solo `0xA5` con `frame = 0`, `frameNum = N`, `frameDelay = delay` y la longitud de **un** cuadro (`ancho × alto × 2`). El rectángulo es el común a todos los cuadros (unión de los píxeles no negros).
2. Después, `N` conjuntos de paquetes `0x25`, uno por cuadro. Cada paquete lleva `frame = índice`, `frameNum = N` y el mismo `delay`.
3. La pantalla reproduce los cuadros en bucle. Un GIF estático es el caso `N = 1`.

`delay` está en milisegundos en el driver oficial (su valor por defecto es `50`; al exportar GIF usa `frameDelay / 10` centisegundos). OpenKEY usa el promedio de las duraciones del GIF, limitado a 20–255 ms. El driver oficial calcula el máximo de cuadros según la memoria de pantalla (≈193 para 128×128); OpenKEY limita a 60 cuadros y 2 MB para que la subida no bloquee el HID demasiado tiempo. Si un GIF supera 1,5 MB, la UI permite subirlo completo o comprimirlo a 1,5 MB; si supera 60 cuadros, permite comprimir la animación (quita cuadros intermedios, muestrea 60 y ajusta el `delay`) o usar solo los primeros 60.

### 4.9 System info nativo (0x22)

El driver oficial actualiza una página de sistema cada ~3 s con `0x22` (Bit7). El paquete usa los bytes 8..21:

```
[0x22, 0,0,0,0,0,0,0,
 disco_libre_lo, disco_libre_hi,
 disco_total_lo, disco_total_hi,
 memoria_usada_lo, memoria_usada_hi,
 memoria_total_lo, memoria_total_hi,
 cpu_uso, cpu_temp,
 red_subida_lo, red_subida_hi,
 red_bajada_lo, red_bajada_hi]
```

Los valores de disco/memoria/red se redondean a GB; CPU en porcentaje y temperatura en grados. Es una página **nativa** del firmware: no permite texto ni valores arbitrarios y no requiere reescribir imágenes. La batería de la laptop y los límites de OpenCode no forman parte de este comando; la tarjeta de indicadores de OpenKEY se retiró y ya no se envía ese dashboard.

La pantalla también tiene un modo de reproducción (`0x2F`) con duración configurable y hasta cinco imágenes estáticas + GIF. La rueda tiene dos modos de firmware: **control de pantalla** (por defecto; cambia de página al pulsarla) y **volumen** (girar baja/sube, pulsar mutea). **Fn + pulsar la rueda** alterna entre ambos. OpenKEY no cambia ese modo por HID: es un atajo del teclado.

### 4.10 Reloj

`Bit7`, 16 bytes:

```
[0x28, 0,0,0,0,0,0,0, year_hi, year_lo, mes, día, hora, min, seg, 0]
```

Se envía sin leer respuesta (el driver hace `sendMsg` directamente).

### 4.11 Reproducción de pantalla

`Bit7`: `[0x2F, auto, segundos]`, sin lectura.

- `auto = 0`: mantiene la página actual. La rueda cambia de página al pulsarla.
- `auto = 1`: rota automáticamente las páginas cada `segundos`.

El driver oficial llama a este comando `setScreenMenu`, pero su efecto real es el modo de reproducción. OpenKEY usa `Keyboard.set_screen_playback(auto_cycle, seconds)` y, tras subir una imagen/GIF, envía `auto=0` para que la animación no vuelva sola a una página anterior.

### 4.12 Colores por tecla

Lectura: seis peticiones `[0x8C, 0, 0xFF, chunk]`, `chunk` de 0 a 5. Cada respuesta contiene 64 bytes RGB sin encabezado; se concatenan 384 bytes. Esta lectura se verificó contra el X820 Ultra físico. El índice de color corresponde a la posición en `default_matrix.json`, con tres bytes RGB por posición.

Escritura: el driver oficial envía siete paquetes `[0x0C, 0, 0xFF, chunk, longitud, último, 0, checksum, datos...]`: seis de 56 bytes y el último de 42, 378 bytes en total. El editor conserva los bytes sin modificar, compara la lectura original con la actual y valida la lectura después de la escritura antes de activar `LightUserPicture`. Se verificó en hardware un cambio en Esc y su lectura posterior, incluida la persistencia al cambiar de efecto; el mapa y el efecto iniciales se restauraron y verificaron. Tras desconectar y reconectar el cable USB, se conservaron los 384 bytes y el modo de luz. Esto no demuestra persistencia tras un apagado completo, ya que el teclado puede seguir alimentado por batería. Los otros seis bytes leídos no se escriben.

### 4.13 Sincronización de audio (0x0F)

**Observado** en hardware: el X820 Ultra acepta frames de color por `0x0F`. OpenKEY los envía y el teclado reacciona; al detener se envía un frame negro y luego se restaura el efecto configurado.

- Soporte: el driver oficial comprueba `0x8F`, `byte[11] == 1`; en este teclado se leyó `1`. La clase específica de este modelo también considera que hay soporte si la conexión es USB.
- Frame: **21 columnas × 6 filas × 3 bytes RGB = 378 bytes**.
- Paquetes: 7, de hasta 56 bytes de datos. Cabecera de 8 bytes:

```
[0x0F, 1, chunk, 56, último, 0, 0, checksum, datos...]
```

  - `chunk` = 0..6.
  - `56` es constante incluso en el último paquete; el último lleva `último = 1`.
  - `checksum` es Bit7 sobre los bytes 0..6.
  - Los datos empiezan en el byte 8. El último paquete lleva 42 bytes útiles y el resto se rellena con ceros.

- Cadencia del driver oficial: `sendSyncColor` se llama cada **30 ms** (~33 fps) desde la página de sincronización de luces, en modo *rhythm*. OpenKEY usa 20 fps por defecto, con opciones de 15 y 30 fps.
- El driver oficial usa `rhythm_service.exe` (gRPC-web en `127.0.0.1:3839`) para obtener el espectro. OpenKEY no depende de ese servicio: captura la salida predeterminada de Windows por WASAPI loopback y calcula una FFT de 1024 muestras.
- El modo **Música 2/3** del firmware es independiente: OpenKEY puede seleccionarlo, pero no lo alimenta con audio. La sincronización real de OpenKEY es la de `0x0F`.
- Al detener, OpenKEY envía un frame negro y restaura el modo de luz que estaba activo antes de iniciar.
- La tecla **Fn** tiene un LED rojo indicador de carga (rojo fijo cargando, parpadeo con batería baja, apagado al 100 %). No forma parte del RGB y no se controla con `0x0F` ni con `0x0C`.

## 5. Diferencias con el driver oficial

- El driver oficial usa WebHID; OpenKEY usa `HidD_*` con `ctypes`. El resultado es el mismo *feature report*.
- El driver oficial hace `vendorSleep(100)` después de la mayoría de escrituras; OpenKEY usa 120 ms.
- El driver oficial puede abrir el dispositivo en modo exclusivo vía HidSharp para algunos modelos; para el X820 Ultra por WebHID no es exclusivo. Aun así, se recomienda cerrar la app oficial.
- El driver oficial soporta 2.4G a través de un dongle con una capa extra (`0xF6`/`0xF7`, selección keyboard/mouse). OpenKEY no implementa esa capa.

## 6. Incógnitas

- Formato exacto de macros (`0x0B`) y sus 5 trozos de 56 bytes.
- Persistencia del mapa de colores tras un apagado completo del teclado.
- Animaciones GIF completas (`0x12`) y sus límites de frames/memoria.
- Comandos de actualización de firmware (`0xAC` y el flujo de boot).
- Comportamiento del dongle 2.4G y Bluetooth.
- Significado de algunos bytes de `0x09` (RTStab, WASD swap, FN index) más allá de lo que muestra el driver.
- Selección de una salida de audio distinta de la predeterminada y comportamiento con salidas exclusivas.
- Relación exacta entre el modo «Music Follow» de la interfaz oficial y el modo Música 2/3 del firmware; OpenKEY usa `0x0F`, que es lo que el driver envía en su página de sincronización.

Cualquier cambio en el firmware puede alterar estos comandos. Si algo deja de funcionar, lo primero es probar el driver oficial y comparar la versión.

## 7. Verificación realizada

- Lectura de `0x8F`, `0x84`, `0x83`, `0x86`, `0x87`, `0x88`, `0x89`, `0x91`, `0xAD`.
- Escritura de luz principal con cambio de brillo y restauración.
- Lectura y escritura de la matriz (Esc → A → Esc).
- Subida de una imagen de 128×128 completa.
- Sincronización de reloj y cambio del modo de reproducción de páginas (`0x2F`).
- Cambio de report rate 4000 → 1000 → 4000.
- Cambio de perfil 0 → 1 → 0.
- Envío de frames `0x0F` de 21×6 y reacción visible del teclado; frame negro de limpieza.
- Onda reactiva «Water drop» con `GetAsyncKeyState` y render local de 21×6.
- Captura WASAPI loopback a 48 kHz, 2 canales, float32, y FFT de 1024 muestras.

Todo se hizo sobre el teclado físico conectado por USB, con la app oficial abierta (no se observaron conflictos en las pruebas, pero se recomienda cerrarla).
