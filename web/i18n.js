/*
 * OpenKEY i18n (ES -> EN).
 *
 * The source language is Spanish. This module translates existing text nodes
 * and attributes without touching the API values (light mode names, key
 * labels, etc. stay in Spanish on the wire). A MutationObserver keeps
 * dynamically rendered fragments translated while English is active.
 */
(function () {
  const STORAGE_KEY = "openkey.language.v1";
  const EN = {
    "Control de teclado": "Keyboard control",
    "Retroceso": "Backspace",
    "Espacio": "Space",
    "Bloq Mayús": "Caps Lock",
    "Supr": "Delete",
    "Inicio": "Home",
    "Fin": "End",
    "Re Pág": "PgUp",
    "Av Pág": "PgDn",
    "Impr Pant": "Print Screen",
    "Bloq Despl": "Scroll Lock",
    "Pausa": "Pause",
    "Menú contextual": "Context menu",
    "Win der": "Right Win",
    "Bloq Num": "Num Lock",
    "Reproducir / Pausa": "Play / Pause",
    "Ahorro de energía": "Power save",
    "Resumen": "Overview",
    "Personalizar": "Customize",
    "Iluminación": "Lighting",
    "Música": "Music",
    "Pantalla": "Screen",
    "Teclas": "Keys",
    "Macros": "Macros",
    "Dispositivo": "Device",
    "Ajustes": "Settings",
    "Mi teclado": "My keyboard",
    "Buscando teclado…": "Searching for keyboard…",
    "Reconectar": "Reconnect",
    "Cerrar OpenKEY": "Close OpenKEY",
    "Cierra el driver oficial antes de aplicar cambios": "Close the official driver before applying changes",
    "Todo lo importante del teclado, de un vistazo.": "Everything important about your keyboard at a glance.",
    "Efectos del firmware, onda reactiva Water drop y pintura tecla por tecla.": "Firmware effects, reactive Water drop ripple and per-key painting.",
    "Sincronización de audio en tiempo real, solo mientras está activa.": "Real-time audio sync, only while active.",
    "Sube una imagen o GIF de 128×128, sincroniza el reloj y controla la reproducción.": "Upload a 128×128 image or GIF, sync the clock and control playback.",
    "Remapea teclas, combinaciones o macros y respalda tus perfiles.": "Remap keys, combos or macros and back up your profiles.",
    "Graba o edita hasta 50 secuencias en la memoria del teclado.": "Record or edit up to 50 sequences in keyboard memory.",
    "Rendimiento, perfiles, suspensión y opciones del firmware.": "Performance, profiles, sleep and firmware options.",
    "Sin conexión": "Disconnected",
    "Teclado no detectado.": "Keyboard not detected.",
    "Conecta el X820 Ultra por USB o revisa que la app oficial no lo esté bloqueando.": "Connect the X820 Ultra via USB or check that the official app is not blocking it.",
    "Reintentar": "Retry",
    "Configura iluminación, pantalla y teclas desde tu equipo.": "Configure lighting, screen and keys from your PC.",
    "Perfil 0": "Profile 0",
    "Debounce —": "Debounce —",
    "Firmware": "Firmware",
    "Luz activa": "Active light",
    "principal": "main",
    "Luz lateral": "Side light",
    "tira lateral": "side strip",
    "Acciones rápidas": "Quick actions",
    "Cambiar iluminación": "Change lighting",
    "Modo, color y brillo": "Mode, color and brightness",
    "Subir una imagen": "Upload an image",
    "128×128 en segundos": "128×128 in seconds",
    "Remapear teclas": "Remap keys",
    "Capa base y capa 1": "Base layer and layer 1",
    "Ajustar rendimiento": "Adjust performance",
    "Polling y debounce": "Polling and debounce",
    "Estado del dispositivo": "Device status",
    "Producto": "Product",
    "Versión OLED": "OLED version",
    "Versión flash": "Flash version",
    "Sistema": "System",
    "Ruta HID": "HID path",

    "Apagado": "Off",
    "Fijo": "Solid",
    "Respiración": "Breathing",
    "Neón": "Neon",
    "Ola": "Wave",
    "Onda": "Ripple",
    "Lluvia": "Rain",
    "Serpiente": "Snake",
    "Al presionar": "On key press",
    "Cobertura": "Coverage",
    "Onda sinusoidal": "Sine wave",
    "Caleidoscopio": "Kaleidoscope",
    "Onda lineal": "Line wave",
    "Imagen de usuario": "User picture",
    "Láser": "Laser",
    "Onda circular": "Circle wave",
    "Destello": "Flash",
    "Lluvia descendente": "Rain down",
    "Meteoro": "Meteor",
    "Al presionar (apagado)": "On key press (off)",
    "Música 3": "Music 3",
    "Color de pantalla": "Screen color",
    "Música 2": "Music 2",
    "Tren": "Train",
    "Fuegos artificiales": "Fireworks",
    "Color de usuario": "User color",

    "Efectos del teclado": "Keyboard effects",
    "Principal y tira lateral": "Main and side strip",
    "Onda reactiva · Water drop": "Reactive ripple · Water drop",
    "Personalizada · 0x0F": "Custom · 0x0F",
    "Color por tecla": "Per-key color",
    "Mapa estático de 80 teclas": "Static 80-key map",
    "Iluminación principal": "Main lighting",
    "Simulación aproximada · no modifica el teclado": "Approximate preview · does not modify the keyboard",
    "Aplicar iluminación": "Apply lighting",
    "Leer del teclado": "Read from keyboard",
    "Preajuste local:": "Local preset:",
    "Guardar": "Save",
    "Cargar": "Load",
    "Calibrar velocidad de la simulación (": "Calibrate preview speed (",
    "Solo ajusta la vista previa local; no cambia lo que se envía al teclado.": "Only affects the local preview; it does not change what is sent to the keyboard.",
    "Efecto": "Effect",
    "Todos": "All",
    "Estáticos": "Static",
    "Animados": "Animated",
    "Al pulsar": "On press",
    "Especiales": "Special",
    "Este modo depende del firmware. Para sincronización real con el audio de Windows usa la pestaña": "This mode depends on the firmware. For real Windows audio sync use the",
    "Color del efecto": "Effect color",
    "Arcoíris (Dazzle)": "Rainbow (Dazzle)",
    "Brillo": "Brightness",
    "Velocidad": "Speed",
    "Variante / dirección": "Variant / direction",
    "Iluminación lateral": "Side lighting",
    "Tira LED de los costados del teclado": "LED strip on the sides of the keyboard",
    "Modo lateral": "Side mode",
    "Este modo depende del firmware.": "This mode depends on the firmware.",
    "Aplicar lateral": "Apply side lighting",
    "Color": "Color",
    "Variante avanzada": "Advanced variant",
    "Opción / variante": "Option / variant",
    "Anillos circulares suaves desde cada tecla que pulsas, enviados por": "Soft circular rings from every key you press, sent over",
    "sin escribir en flash.": "without writing to flash.",
    "Detenido": "Stopped",
    "Estado": "Status",
    "Pulsaciones / ondas": "Presses / ripples",
    "0 teclas · 0 activas": "0 keys · 0 active",
    "Tiempo de envío HID": "HID send time",
    "CPU estimada": "Estimated CPU",
    "Probar onda en el centro": "Test ripple at center",
    "Cargar preset «Water drop»": "Load “Water drop” preset",
    "Aplicar Onda del firmware (sin app)": "Apply firmware Ripple (standalone)",
    "Ajustes de la onda": "Ripple settings",
    "Preset Water drop": "Water drop preset",
    "Modo de color": "Color mode",
    "Color fijo": "Solid color",
    "Arcoíris por distancia": "Distance rainbow",
    "Color aleatorio por tecla": "Random color per key",
    "Color base": "Base color",
    "Expansión": "Expansion",
    "Duración": "Duration",
    "Grosor del anillo": "Ring thickness",
    "Radio máximo": "Max radius",
    "Cuadros por segundo": "Frames per second",
    "15 fps · ligero": "15 fps · light",
    "20 fps · equilibrado": "20 fps · balanced",
    "30 fps · máxima fluidez": "30 fps · smoothest",
    "Incluir Ctrl / Shift / Alt": "Include Ctrl / Shift / Alt",
    "Iniciar onda reactiva": "Start reactive ripple",
    "Detener": "Stop",
    "Solo usa la posición física de la tecla pulsada; no registra ni guarda lo que escribís. Al detener se restaura tu iluminación anterior.": "It only uses the physical position of the pressed key; it does not record or store what you type. Stopping restores your previous lighting.",
    "Lee el diseño guardado y pinta sobre la vista previa": "Read the saved layout and paint over the preview",
    "Sin leer": "Not read",
    "Pincel": "Brush",
    "Apagar tecla": "Turn key off",
    "Colorear todas": "Color all",
    "Lee los colores actuales para comenzar": "Read the current colors to begin",
    "Aplicar colores": "Apply colors",
    "La vista previa no cambia el teclado. Aplicar guarda los colores y activa el modo personalizado. Cierra el driver oficial antes de aplicar.": "The preview does not change the keyboard. Apply saves the colors and enables custom mode. Close the official driver before applying.",
    "Nota": "Note",
    "Los efectos estándar y el mapa por tecla se guardan en el firmware del teclado. La onda reactiva personalizada («Water drop») transmite cuadros en tiempo real por USB mientras esté activa.": "Standard effects and the per-key map are stored in the keyboard firmware. The custom reactive ripple (“Water drop”) streams frames over USB while active.",

    "Sincronización de audio": "Audio sync",
    "Captura la salida de audio de Windows y envía colores al teclado en tiempo real. No se ejecuta nada hasta pulsar": "Captures Windows audio output and sends colors to the keyboard in real time. Nothing runs until you press",
    "Iniciar": "Start",
    "Fuente": "Source",
    "Audio del sistema (salida predeterminada)": "System audio (default output)",
    "Demostración (sin audio)": "Demo (no audio)",
    "Sensibilidad": "Sensitivity",
    "Frecuencia": "Frame rate",
    "15 fps · mínimo consumo": "15 fps · lowest power",
    "Espectro": "Spectrum",
    "Iniciar sincronización": "Start sync",
    "Vista previa": "Preview",
    "RAM del proceso": "Process RAM",
    "Cuadros enviados": "Frames sent",
    "Audio — · FFT — · HID —": "Audio — · FFT — · HID —",
    "Cómo funciona": "How it works",
    "OpenKEY captura la mezcla de salida de Windows por WASAPI loopback, calcula una FFT de 1024 muestras y envía un frame RGB de 21×6 con el comando": "OpenKEY captures the Windows output mix via WASAPI loopback, computes a 1024-sample FFT and sends a 21×6 RGB frame with the",
    ". Al detener, envía un frame negro y restaura el efecto que tenías.": " command. On stop it sends a black frame and restores your previous effect.",
    "Mientras está activa, la luz principal queda en modo Fijo y los frames toman el control. Consumo: el hilo solo existe entre «Iniciar» y «Detener». El envío HID es la parte más costosa; 15 fps reduce el consumo casi a la mitad. En esta máquina el proceso real midió ~8 % de un núcleo a 20 fps; la estimación mostrada es conservadora. Cierra el driver oficial antes de usar esta función.": "While active, the main light stays in Solid mode and frames take over. Power: the thread only exists between Start and Stop. HID sending is the most expensive part; 15 fps nearly halves consumption. On this machine the process measured ~8% of one core at 20 fps; the estimate shown is conservative. Close the official driver before using this feature.",

    "Imagen de la pantalla": "Screen image",
    "Arrastra una imagen o GIF o haz clic": "Drag an image or GIF, or click",
    "PNG, JPG, WebP o GIF animado": "PNG, JPG, WebP or animated GIF",
    "Estática": "Still",
    "Área": "Area",
    "Datos": "Data",
    "Cuadros": "Frames",
    "Archivo": "File",
    "Encuadre": "Fit",
    "Cubrir": "Cover",
    "Ajustar": "Contain",
    "Estirar": "Stretch",
    "Rotación": "Rotation",
    "Mantener esta página después de subir": "Keep this page after upload",
    "Subir a la pantalla": "Upload to screen",
    "Quitar selección": "Clear selection",
    "Cargar patrón de prueba": "Load test pattern",
    "Los GIF se envían completos y la pantalla los reproduce en bucle. Máximo 60 cuadros y 2 MB; si supera 1,5 MB podés comprimirlo o subirlo completo (más lento). Si supera 60 cuadros, podés comprimir la animación o usar los primeros 60. La subida puede tardar varios segundos por cuadro.": "GIFs are sent in full and loop on the screen. Max 60 frames and 2 MB; above 1.5 MB you can compress it or upload it in full (slower). Above 60 frames you can compress the animation or use the first 60. Upload can take several seconds per frame.",
    "Reloj y reproducción": "Clock and playback",
    "La pantalla tiene un reloj interno. Sincronízalo con tu PC y elige si las páginas se quedan fijas o rotan solas.": "The screen has an internal clock. Sync it with your PC and choose whether pages stay fixed or rotate on their own.",
    "Sincronizar reloj": "Sync clock",
    "Modo de reproducción": "Playback mode",
    "Mantener página": "Keep page",
    "Rotación automática": "Auto-rotate",
    "«Mantener página» deja visible la página actual; la rueda cambia de página al pulsarla. «Rotación automática» alterna las páginas cada N segundos: eso hace que un GIF vuelva solo a una imagen fija.": "“Keep page” leaves the current page visible; press the knob to change pages. “Auto-rotate” switches pages every N seconds: that is what makes a GIF return to a still image.",
    "Intervalo de rotación": "Rotation interval",
    "Aplicar modo de reproducción": "Apply playback mode",
    "Fijar página ahora": "Pin page now",
    "¿El GIF vuelve solo a una imagen fija?": "Does the GIF return to a still image on its own?",
    "Es el modo de": "It is the",
    "rotación automática": "auto-rotate",
    "del firmware, no un fallo del GIF. Cambia a «Mantener página», o deja marcado «Mantener esta página después de subir»: OpenKEY enviará el ajuste después de cada subida y el GIF se quedará visible hasta que tú cambies de página con la rueda.": "mode of the firmware, not a GIF bug. Switch to “Keep page”, or leave “Keep this page after upload” checked: OpenKEY will send the setting after every upload and the GIF will stay visible until you change pages with the knob.",

    "Perfil": "Profile",
    "Capa": "Layer",
    "0 · base": "0 · base",
    "1 · alternativa": "1 · alternate",
    "Recargar": "Reload",
    "Exportar respaldo JSON": "Export JSON backup",
    "Importar y restaurar JSON": "Import and restore JSON",
    "Original": "Original",
    "Remapeada": "Remapped",
    "Macro": "Macro",
    "Desactivada": "Disabled",
    "Distribución del teclado": "Keyboard layout",
    "Las teclas reaccionan mientras esta ventana está activa": "Keys react while this window is focused",
    "Leyendo teclas…": "Reading keys…",
    "Selecciona una tecla": "Select a key",
    "Haz clic en cualquier tecla del teclado para ver y cambiar su función.": "Click any key on the keyboard to view and change its function.",
    "Función de la rueda": "Knob function",
    "En el teclado, Fn + pulsar la rueda alterna entre control de pantalla y volumen.": "On the keyboard, Fn + press the knob switches between screen control and volume.",
    "Tecla física": "Physical key",
    "Función actual": "Current function",
    "Función original": "Original function",
    "Modo de asignación": "Assignment mode",
    "Tecla": "Key",
    "Combinación": "Combo",
    "Pulsar una tecla física para capturar…": "Press a physical key to capture…",
    "Buscar función": "Search function",
    "Asignar": "Assign",
    "Modificador 1": "Modifier 1",
    "Ctrl izq": "Left Ctrl",
    "Shift izq": "Left Shift",
    "Alt izq": "Left Alt",
    "Win izq": "Left Win",
    "Ctrl der": "Right Ctrl",
    "Shift der": "Right Shift",
    "Alt der": "Right Alt",
    "Modificador 2 (opcional)": "Modifier 2 (optional)",
    "Ninguno": "None",
    "Tecla principal": "Main key",
    "Slot de macro": "Macro slot",
    "Modo de disparo": "Trigger mode",
    "Repetir según el contador de la macro": "Repeat according to the macro counter",
    "Alternar encendido / apagado al pulsar": "Toggle on / off when pressed",
    "Repetir mientras mantengas pulsada la tecla": "Repeat while holding the key",
    "Aplicar cambio": "Apply change",
    "Restablecer tecla": "Reset key",
    "Desactivar tecla": "Disable key",
    "Los cambios se guardan en el perfil y capa seleccionados. La tecla Fn no se puede reasignar.": "Changes are saved to the selected profile and layer. The Fn key cannot be remapped.",

    "Slots de macros": "Macro slots",
    "50 posiciones en la memoria del teclado": "50 positions in keyboard memory",
    "0 con nombre": "0 named",
    "Slot 1": "Slot 1",
    "0 eventos · 6 / 256 bytes": "0 events · 6 / 256 bytes",
    "6 / 256 B": "6 / 256 B",
    "Nombre local (se guarda en este equipo)": "Local name (saved on this PC)",
    "Repeticiones": "Repeats",
    "● Grabar secuencia": "● Record sequence",
    "+ Tecla (pulsar y soltar)": "+ Key (press and release)",
    "+ Clic de ratón": "+ Mouse click",
    "+ Movimiento ratón": "+ Mouse move",
    "Vaciar lista": "Clear list",
    "Guardar macro en el teclado": "Save macro to keyboard",
    "Después de guardar una macro aquí, ve a": "After saving a macro here, go to",
    ", elige una tecla y asígnala en el modo": ", choose a key and assign it in",
    "Sin eventos en este slot": "No events in this slot",
    "Pulsa «Grabar secuencia» y escribe en tu teclado, o añade pasos manualmente.": "Press “Record sequence” and type on your keyboard, or add steps manually.",
    "Clic ratón": "Mouse click",
    "Mover ratón": "Mouse move",
    "Botón izquierdo": "Left button",
    "Botón derecho": "Right button",
    "Botón central": "Middle button",
    "Atrás": "Back",
    "Adelante": "Forward",
    "Pulsar ↓": "Press ↓",
    "Soltar ↑": "Release ↑",

    "Rendimiento": "Performance",
    "Frecuencia de sondeo": "Polling rate",
    "Más Hz = menos latencia, más consumo. El X820 Ultra anuncia hasta 8 kHz según firmware.": "More Hz = less latency, more power. The X820 Ultra advertises up to 8 kHz depending on firmware.",
    "Debounce": "Debounce",
    "Tiempo mínimo entre pulsaciones. 1–3 ms suele ser ideal.": "Minimum time between presses. 1–3 ms is usually ideal.",
    "Aplicar rendimiento": "Apply performance",
    "Perfil y sistema": "Profile and system",
    "Perfil activo": "Active profile",
    "Perfil 1": "Profile 1",
    "Distribución": "Layout",
    "Aplicar": "Apply",
    "Suspensión": "Sleep",
    "Tiempo en minutos antes de dormir. El modo profundo ahorra más batería pero tarda más en despertar.": "Minutes before sleeping. Deep sleep saves more battery but takes longer to wake.",
    "Inalámbrico": "Wireless",
    "Cable": "Wired",
    "Profundo inalámbrico": "Deep wireless",
    "Profundo cable": "Deep wired",
    "Aplicar suspensión": "Apply sleep",
    "Información": "Information",
    "Versión USB": "USB version",
    "Zona de riesgo": "Danger zone",
    "Restablece el teclado a los valores de fábrica. Se pierden perfiles, macros, iluminación y la imagen de la pantalla.": "Resets the keyboard to factory values. Profiles, macros, lighting and the screen image are lost.",
    "Restablecer de fábrica": "Factory reset",
    "OpenKEY · app local para Attack Shark X820 Ultra": "OpenKEY · local app for Attack Shark X820 Ultra",
    "Sin telemetría. Sin Electron. Todo se queda en tu PC.": "No telemetry. No Electron. Everything stays on your PC.",

    "Apariencia": "Appearance",
    "Idioma": "Language",
    "Tema de color": "Color theme",
    "El idioma se guarda en este equipo.": "The language is saved on this PC.",
    "El tema se guarda en este equipo.": "The theme is saved on this PC.",
    "Idioma y tema de color de la interfaz.": "Language and color theme for the interface.",
    "Se aplica al instante": "Applies instantly",
    "Grafito": "Graphite",
    "Cobalto": "Cobalt",
    "Mercurio": "Mercury",
    "Grafito y amarillo": "Graphite and yellow",
    "Azul tinta y ámbar": "Ink blue and amber",
    "Verde salvia y grafito": "Sage green and graphite",
    "Idioma actualizado.": "Language updated.",
    "Tema aplicado.": "Theme applied.",

    "Se borrarán perfiles, macros, iluminación e imagen de pantalla. El teclado se reiniciará y puede desaparecer unos segundos.": "Profiles, macros, lighting and the screen image will be erased. The keyboard will restart and may disappear for a few seconds.",
    "Descartar cambios": "Discard changes",
    "Se perderán los colores que todavía no aplicaste.": "Unapplied colors will be lost.",
    "¿Seguro?": "Are you sure?",
    "Esta acción no se puede deshacer.": "This action cannot be undone.",
    "Cancelar": "Cancel",
    "Continuar": "Continue",
    "GIF demasiado largo": "GIF too long",
    "Comprimir a 60 cuadros": "Compress to 60 frames",
    "Usar los primeros 60": "Use the first 60",
    "GIF pesado": "Heavy GIF",
    "Comprimir a 1,5 MB": "Compress to 1.5 MB",
    "Subir completo (hasta 2 MB)": "Upload in full (up to 2 MB)",

    "No se pudo confirmar la escritura; puede haberse aplicado. Reconecta y lee la configuración antes de volver a intentar.": "Could not confirm the write; it may have been applied. Reconnect and read the configuration before trying again.",
    "La escritura se envió, pero no se pudo comprobar. Reconecta y lee la configuración antes de volver a intentar.": "The write was sent, but it could not be verified. Reconnect and read the configuration before trying again.",
    "Color no válido": "Invalid color",
    "El teclado no devolvió los valores solicitados": "The keyboard did not return the requested values",
    "Esa tecla no existe en el mapa": "That key does not exist in the map",
    "La tecla Fn no se puede reasignar desde OpenKEY": "The Fn key cannot be remapped from OpenKEY",
    "Falta la tecla destino": "Missing target key",
    "Datos de colores no válidos": "Invalid color data",
    "La matriz de colores debe tener 384 bytes": "The color matrix must be 384 bytes",
    "No se puede cambiar una posición desconocida": "Cannot change an unknown position",
    "Los colores del teclado cambiaron. Vuelve a leerlos antes de aplicar.": "The keyboard colors changed. Read them again before applying.",
    "No se pudo leer el modo de iluminación actual": "Could not read the current lighting mode",
    "La lectura posterior no coincide con los colores enviados": "The read-back does not match the colors sent",
    "No se pudo confirmar la activación del modo personalizado": "Could not confirm custom mode activation",
    "Área de imagen no válida": "Invalid image area",
    "Lista de cuadros no válida": "Invalid frame list",
    "Datos de imagen no válidos": "Invalid image data",
    "La pantalla admite como máximo 255 cuadros": "The screen accepts at most 255 frames",
    "La animación es demasiado grande (máximo 4 MB)": "The animation is too large (max 4 MB)",
    "Detén la sincronización de música u onda reactiva antes de subir una animación": "Stop music sync or the reactive ripple before uploading an animation",
    "El archivo no contiene perfiles de teclas válidos": "The file does not contain valid key profiles",
    "No se encontraron capas válidas para restaurar": "No valid layers found to restore",
    "Modo de color de onda no válido": "Invalid ripple color mode",
    "No se pudo leer la iluminación actual del teclado": "Could not read the current keyboard lighting",
    "La interfaz dejó de responder; onda detenida": "The interface stopped responding; ripple stopped",
    "La interfaz dejó de responder; sincronización detenida": "The interface stopped responding; sync stopped",
    "Velocidad no válida": "Invalid report rate",
    "Respuesta incompleta al leer los colores": "Incomplete response while reading colors",
    "Modo de luz no válido": "Invalid light mode",
    "Modo de luz lateral no válido": "Invalid side light mode",
    "Sistema no válido": "Invalid system",
    "No se pudieron leer las opciones actuales del teclado": "Could not read the keyboard's current options",
    "No se pudieron leer los ajustes actuales de suspensión": "Could not read the current sleep settings",
    "La pantalla no confirmó la imagen (¿está desconectada?)": "The screen did not confirm the image (is it disconnected?)",
    "Los ajustes se enviaron, pero no se pudo leer el estado completo. Reconecta y comprueba los valores antes de volver a intentar.": "The settings were sent, but the full status could not be read. Reconnect and check the values before trying again.",
    "No hay cuadros para enviar": "There are no frames to send",
    "Respuesta incompleta al leer la matriz de teclas": "Incomplete response while reading the key matrix",
    "Posición de tecla no válida": "Invalid key position",
    "El grupo de tecla debe tener 4 bytes": "The key group must be 4 bytes",
    "Código de tecla no válido": "Invalid key code",
    "La matriz completa debe tener 512 bytes": "The full matrix must be 512 bytes",
    "Slot de macro fuera de rango (0–49)": "Macro slot out of range (0–49)",
    "Respuesta incompleta al leer la macro": "Incomplete response while reading the macro",
    "Fuente de música no válida": "Invalid music source",
    "Modo de color no válido": "Invalid color mode",
    "No se pudo detectar el teclado": "Could not detect the keyboard",
    "No encontré el teclado": "I could not find the keyboard",
    "No encontré el teclado. Conecta el X820 Ultra por USB (el receptor 2.4G también sirve) y vuelve a intentar.": "I could not find the keyboard. Connect the X820 Ultra via USB (the 2.4G receiver also works) and try again.",
    "No se pudo iniciar la onda": "Could not start the ripple",
    "No se pudo detener": "Could not stop",
    "No se pudo iniciar": "Could not start",
    "No se pudo ajustar": "Could not adjust",
    "No se pudo aplicar": "Could not apply",
    "No se pudo cambiar": "Could not change",
    "No se pudo subir": "Could not upload",
    "No se pudo exportar": "Could not export",
    "No se pudo restablecer": "Could not reset",
    "No se pudo leer la macro": "Could not read the macro",
    "No se pudo guardar la macro": "Could not save the macro",
    "No se pudo leer la matriz": "Could not read the matrix",
    "No se pudieron leer los colores": "Could not read the colors",
    "No se pudo confirmar el cambio": "Could not confirm the change",
    "No se pudo restaurar el respaldo": "Could not restore the backup",
    "No se pudo cambiar el modo de reproducción": "Could not change playback mode",
    "No se pudo aplicar la onda": "Could not apply the ripple",
    "Preajuste guardado en este navegador.": "Preset saved in this browser.",
    "No se pudo guardar el preajuste en este navegador.": "Could not save the preset in this browser.",
    "Preajuste cargado. Pulsa Aplicar iluminación para enviarlo al teclado.": "Preset loaded. Press Apply lighting to send it to the keyboard.",
    "No se pudo cargar el preajuste.": "Could not load the preset.",
    "Colores aplicados y verificados.": "Colors applied and verified.",
    "Luz lateral aplicada.": "Side lighting applied.",
    "Iluminación aplicada.": "Lighting applied.",
    "Valores leídos del teclado.": "Values read from the keyboard.",
    "Patrón de prueba listo para subir.": "Test pattern ready to upload.",
    "Selecciona un archivo de imagen.": "Select an image file.",
    "Este navegador no puede animar GIF; se usará el primer cuadro.": "This browser cannot animate GIFs; the first frame will be used.",
    "Página fijada: la pantalla no volverá sola a la imagen anterior.": "Page pinned: the screen will not return to the previous image on its own.",
    "La imagen se subió, pero no se pudo fijar la página. Usa «Mantener página actual».": "The image was uploaded, but the page could not be pinned. Use “Pin page now”.",
    "Reloj sincronizado.": "Clock synchronized.",
    "Página fija: la pantalla ya no cambia sola.": "Page fixed: the screen no longer changes on its own.",
    "Tecla restablecida.": "Key reset.",
    "Tecla actualizada.": "Key updated.",
    "Respaldo JSON exportado (perfiles 0 y 1, capas base y Fn).": "JSON backup exported (profiles 0 and 1, base and Fn layers).",
    "No se reconoció esa tecla física.": "That physical key was not recognized.",
    "Inicia la onda reactiva para verla en el teclado.": "Start the reactive ripple to see it on the keyboard.",
    "Onda reactiva «Water drop» activa. Pulsa cualquier tecla.": "Reactive ripple “Water drop” active. Press any key.",
    "Onda reactiva detenida. Iluminación restaurada.": "Reactive ripple stopped. Lighting restored.",
    "Preset «Water drop» cargado (expansión 1.0×, 1.1 s, grosor 0.60, radio 6, 30 fps).": "“Water drop” preset loaded (expansion 1.0×, 1.1 s, thickness 0.60, radius 6, 30 fps).",
    "Modo Onda del firmware (modo 5) guardado en el teclado. Funciona con la app cerrada.": "Firmware Ripple mode (mode 5) saved to the keyboard. It works with the app closed.",
    "Sincronización de audio iniciada. Consume solo mientras esté activa.": "Audio sync started. It only uses power while active.",
    "Sincronización detenida. Iluminación restaurada.": "Sync stopped. Lighting restored.",
    "Grabando: pulsa la secuencia de teclas y luego «Detener grabación».": "Recording: press the key sequence, then “Stop recording”.",
    "Rendimiento actualizado.": "Performance updated.",
    "Perfil y sistema actualizados.": "Profile and system updated.",
    "Suspensión actualizada.": "Sleep settings updated.",
    "Teclado restablecido. Reconectando…": "Keyboard reset. Reconnecting…",
    "Estado actualizado.": "Status updated.",
    "No se pudo conectar al teclado.": "Could not connect to the keyboard.",
    "Procesando…": "Processing…",
    "Actualizando…": "Updating…",
    "Enviando…": "Sending…",
    "Leyendo…": "Reading…",
    "Guardando…": "Saving…",
    "Aplicando…": "Applying…",
    "Iniciando…": "Starting…",
    "Deteniendo…": "Stopping…",
    "Conectando…": "Connecting…",
    "Exportando…": "Exporting…",
    "Restaurando…": "Restoring…",
    "Leyendo colores…": "Reading colors…",
    "Aplicando colores…": "Applying colors…",
    "Selecciona una función": "Select a function",
    "Sin resultados": "No results",
    "Busca por nombre o categoría.": "Search by name or category.",
    "Giro a la izquierda": "Turn left",
    "Pulsación": "Press",
    "Giro a la derecha": "Turn right",
    "Funciones de la rueda": "Knob functions",
    "Rueda": "Knob",
    "Ratón": "Mouse",
    "Función": "Function",
    "Función especial": "Special function",
    "Botón de ratón": "Mouse button",
    "Repetir": "Repeat",
    "Alternar": "Toggle",
    "Mantener": "Hold",
    "Buscando…": "Searching…",
    "conectado": "connected",
    "No detectado": "Not detected",
    "Desconectado": "Disconnected",
    "Listo": "Ready",
    "Activo": "Active",
    "Sincronizando": "Syncing",
    "Transmitiendo por USB (0x0F)": "Streaming over USB (0x0F)",
    "Sin imagen": "No image",
    "Estática · 1/1": "Still · 1/1",
    "Actualizar datos": "Refresh data",
    "Enviar a la pantalla": "Send to screen",
    "Datos parciales": "Partial data",
    "Error": "Error",
    "Cerrar": "Close",
    "Aceptar": "OK",
    "Sí, restablecer": "Yes, reset",
    "Restaurar respaldo de teclas": "Restore keymap backup",
    "Se escribirán los perfiles y capas del archivo directamente en el teclado y se comprobará la lectura posterior. La tecla Fn se protege automáticamente.": "The profiles and layers from the file will be written directly to the keyboard and verified afterwards. The Fn key is protected automatically.",
    "Restaurar ahora": "Restore now",
    "Imagen enviada a la pantalla.": "Image sent to the screen.",
    "■ Detener grabación": "■ Stop recording",
    "Demostración · 48 kHz sintéticos": "Demo · 48 kHz synthetic"
  };

  const PATTERNS = [
    [/^Perfil (\d+)$/, "Profile $1"],
    [/^Debounce (\d+) ms$/, "Debounce $1 ms"],
    [/^Macro (\d+) · (Repetir|Alternar|Mantener)$/, (m, n, mode) => `Macro ${n} · ${EN[mode] || mode}`],
    [/^Macro (\d+)$/, "Macro $1"],
    [/^Slot (\d+)$/, "Slot $1"],
    [/^Slot (\d+) · (.+)$/, "Slot $1 · $2"],
    [/^(\d+) con nombre$/, "$1 named"],
    [/^(\d+) eventos$/, "$1 events"],
    [/^(\d+) evento$/, "$1 event"],
    [/^(\d+) eventos · (\d+) \/ (\d+) bytes$/, "$1 events · $2 / $3 bytes"],
    [/^(\d+) eventos · (.+)$/, "$1 events · $2"],
    [/^Grabando secuencia… \((\d+) eventos\)$/, "Recording… ($1 events)"],
    [/^Pintar (.+)$/, "Paint $1"],
    [/^(.+) → (.+)$/, (m, from, to) => `${translateCore(from)} → ${translateCore(to)}`],
    [/^(\d+) teclas · (\d+) activas$/, "$1 keys · $2 active"],
    [/^Activo · (\d+) fps$/, "Active · $1 fps"],
    [/^Estática · (\d+)\/(\d+)$/, "Still · $1/$2"],
    [/^(\d+) resultado$/, "$1 result"],
    [/^(\d+) resultados$/, "$1 results"],
    [/^Actual: (.+)$/, "Current: $1"],
    [/^Rueda · (.+)$/, "Knob · $1"],
    [/^(\d+) % de un núcleo$/, "$1% of one core"],
    [/^GIF de (\d+) cuadros$/, "GIF with $1 frames"],
    [/^Animación enviada \((\d+) cuadros\)\.$/, "Animation sent ($1 frames)."],
    [/^GIF comprimido a (\d+) cuadros para reducir el peso\.$/, "GIF compressed to $1 frames to reduce size."],
    [/^GIF comprimido a (\d+) cuadros\.$/, "GIF compressed to $1 frames."],
    [/^Se usarán los primeros (\d+) cuadros\.$/, "Using the first $1 frames."],
    [/^Rotación automática cada (\d+) s\.$/, "Auto-rotating every $1 s."],
    [/^Se restauraron y verificaron (\d+) capas de teclas\.$/, "Restored and verified $1 key layers."],
    [/^Se capturaron (\d+) eventos\.$/, "Captured $1 events."],
    [/^Slot (\d+) leído del teclado\.$/, "Slot $1 read from the keyboard."],
    [/^Macro guardada en el slot (\d+)\.$/, "Macro saved to slot $1."],
    [/^Tecla capturada: (.+)\. Pulsa «Aplicar cambio» para guardarla\.$/, "Key captured: $1. Press “Apply change” to save it."],
    [/^El límite es (\d+) cuadros\. Comprimir mantiene toda la animación, quitando cuadros intermedios y ajustando la duración; usar los primeros (\d+) conserva solo el comienzo y descarta el resto\.$/, "The limit is $1 frames. Compress keeps the whole animation by removing intermediate frames and adjusting duration; using the first $2 keeps only the beginning and discards the rest."],
    [/^El GIF tiene (\d+) cuadros y ocupa ([\d.,]+) MB\. Subirlo completo puede tardar ~(.+)\. Comprimir a 1,5 MB reduce cuadros intermedios y mantiene la animación\.$/, "The GIF has $1 frames and is $2 MB. Uploading it in full may take ~$3. Compressing to 1.5 MB removes intermediate frames and keeps the animation."],
    [/^GIF de ([\d.,]+) MB$/, "GIF of $1 MB"],
    [/^(\d+) min (\d+) s$/, "$1 min $2 s"],
    [/^(\d+) s$/, "$1 s"],
    [/^(\d+) fps$/, "$1 fps"],
    [/^([\d.]+) MB$/, "$1 MB"],
    [/^([\d.]+) % de un núcleo$/, "$1% of one core"],
    [/^([\d.]+) ms$/, "$1 ms"],
    [/^([\d.]+) ms \/ cuadro$/, "$1 ms / frame"],
    [/^(\d+) Hz · (\d+) canales · (.+)$/, "$1 Hz · $2 channels · $3"],
    [/^Error dibujando el estado: (.+)$/, "Error rendering status: $1"],
    [/^No pude leer esa imagen: (.+)$/, "Could not read that image: $1"],
    [/^No se pudieron cargar los datos de la interfaz: (.+)$/, "Could not load interface data: $1"],
    [/^(.+) Vuelve a leer los colores antes de continuar\.$/, (m, prefix) => `${translateCore(prefix)} Read the colors again before continuing.`],
    [/^([\d.]+) \/ 5$/, "$1 / 5"],
    [/^La matriz del perfil (\d+) capa (\d+) no tiene 512 bytes$/, "Profile $1 layer $2 matrix is not 512 bytes"],
    [/^La verificación falló en el perfil (\d+) capa (\d+)$/, "Verification failed for profile $1 layer $2"],
    [/^Tamaño incorrecto en el cuadro (\d+) \((\d+) != (\d+)\)$/, "Wrong size in frame $1 ($2 != $3)"],
    [/^Tamaño de cuadro incorrecto en el cuadro (\d+)$/, "Wrong frame size in frame $1"],
    [/^La macro supera el límite de (\d+) bytes \((\d+) bytes\)$/, "Macro exceeds the $1-byte limit ($2 bytes)"],
    [/^El frame de sincronización debe tener (\d+) bytes$/, "The sync frame must be $1 bytes"],
    [/^Respuesta inesperada del teclado para el comando 0x([0-9A-F]+)$/, "Unexpected keyboard response for command 0x$1"],
    [/^HidD_GetFeature falló \(error (\d+)\)$/, "HidD_GetFeature failed (error $1)"],
    [/^HidD_SetFeature falló \(error (\d+)\)$/, "HidD_SetFeature failed (error $1)"],
    [/^(\d+) \/ 4$/, "$1 / 4"],
    [/^([\d.]+) \/ 256 B$/, "$1 / 256 B"]
  ];

  const ATTR_EN = {
    "Navegación principal": "Main navigation",
    "Actualizar estado": "Refresh status",
    "Secciones de iluminación": "Lighting sections",
    "Vista previa aproximada de la iluminación del teclado": "Approximate keyboard lighting preview",
    "Filtrar efectos por categoría": "Filter effects by category",
    "Modo de iluminación principal": "Main lighting mode",
    "Efectos de iluminación": "Lighting effects",
    "Alterna colores del arcoíris (Dazzle)": "Toggles rainbow colors (Dazzle)",
    "Colores rápidos": "Quick colors",
    "Cian": "Cyan",
    "Salvia": "Sage",
    "Ámbar": "Amber",
    "Coral": "Coral",
    "Violeta": "Violet",
    "Blanco": "White",
    "Haz clic en cualquier celda para probar una onda ahí": "Click any cell to trigger a ripple there",
    "Vista previa 21 por 6 de la onda reactiva": "21 by 6 reactive ripple preview",
    "Guarda el modo Onda nativo (modo 5) en la memoria del teclado": "Stores the native Ripple mode (mode 5) in keyboard memory",
    "Editor de color por tecla": "Per-key color editor",
    "Vista previa de la sincronización de audio": "Audio sync preview",
    "Cuadro anterior": "Previous frame",
    "Cuadro siguiente": "Next frame",
    "Fija la página actual para que no cambie sola": "Pins the current page so it does not change on its own",
    "Funciones de la rueda": "Knob functions",
    "Por ejemplo, volumen o A": "For example, volume or A",
    "Slots de macros": "Macro slots",
    "Por ejemplo: Copiar y pegar, Salto doble…": "For example: Copy and paste, Double jump…",
    "Secuencia de eventos de la macro": "Macro event sequence",
    "Desplazamiento X": "X offset",
    "Desplazamiento Y": "Y offset",
    "Subir": "Move up",
    "Bajar": "Move down",
    "Eliminar": "Delete",
    "Tema de color": "Color theme",
    "Idioma": "Language",
    "Grafito": "Graphite",
    "Cobalto": "Cobalt",
    "Mercurio": "Mercury"
  };

  const textOriginals = new WeakMap();
  const textLast = new WeakMap();
  const attrOriginals = new WeakMap();
  const attrLast = new WeakMap();
  const ATTRS = ["placeholder", "title", "aria-label", "alt"];

  let lang = "es";
  let observer = null;

  function translateCore(value) {
    if (!value || lang !== "en") return value;
    if (Object.prototype.hasOwnProperty.call(EN, value)) return EN[value];
    for (const [pattern, replacement] of PATTERNS) {
      if (pattern.test(value)) return value.replace(pattern, replacement);
    }
    return value;
  }

  function translatePreservingSpace(value) {
    const match = String(value).match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return value;
    return match[1] + translateCore(match[2]) + match[3];
  }

  function shouldSkip(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return true;
    return !!element.closest("script, style, code, pre, textarea, [data-no-i18n]");
  }

  function translateTextNode(node) {
    if (!node || shouldSkip(node)) return;
    const current = node.nodeValue;
    if (!current || !current.trim()) return;
    const previous = textLast.get(node);
    let source = textOriginals.get(node);
    if (source === undefined || (previous !== undefined && current !== previous)) {
      source = current;
      textOriginals.set(node, source);
    }
    const translated = translatePreservingSpace(source);
    textLast.set(node, translated);
    if (current !== translated) node.nodeValue = translated;
  }

  function translateElementAttrs(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE || shouldSkip(element)) return;
    let originals = attrOriginals.get(element);
    let last = attrLast.get(element);
    if (!originals) {
      originals = {};
      attrOriginals.set(element, originals);
    }
    if (!last) {
      last = {};
      attrLast.set(element, last);
    }
    for (const attr of ATTRS) {
      const current = element.getAttribute(attr);
      if (!current) continue;
      if (!Object.prototype.hasOwnProperty.call(originals, attr) || (Object.prototype.hasOwnProperty.call(last, attr) && current !== last[attr])) {
        originals[attr] = current;
      }
      const translated = lang === "en" ? (ATTR_EN[current] || translateCore(current)) : originals[attr];
      last[attr] = translated;
      if (current !== translated) element.setAttribute(attr, translated);
    }
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    translateElementAttrs(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
    root.querySelectorAll("[placeholder], [title], [aria-label], [alt]").forEach(translateElementAttrs);
  }

  function applyDocumentLanguage() {
    document.documentElement.lang = lang === "en" ? "en" : "es";
    document.documentElement.dataset.lang = lang;
    if (document.title) {
      const source = document.documentElement.dataset.titleSource || document.title;
      document.documentElement.dataset.titleSource = source;
      document.title = lang === "en" ? translateCore(source) : source;
    }
  }

  function setLanguage(next) {
    lang = next === "en" ? "en" : "es";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage can be unavailable in private contexts.
    }
    applyDocumentLanguage();
    translateTree(document.body);
    window.dispatchEvent(new CustomEvent("openkey:language", { detail: { lang } }));
  }

  function t(source) {
    return translateCore(source);
  }

  function startObserver() {
    if (observer || !document.body) return;
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          translateTextNode(mutation.target);
        } else if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => translateTree(node));
        } else if (mutation.type === "attributes") {
          translateElementAttrs(mutation.target);
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS
    });
  }

  const params = new URLSearchParams(location.search);
  const queryLang = params.get("lang");
  let savedLang = "es";
  try {
    savedLang = localStorage.getItem(STORAGE_KEY) || "es";
  } catch {
    // ignore
  }
  lang = queryLang === "en" || (!queryLang && savedLang === "en") ? "en" : "es";
  applyDocumentLanguage();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startObserver();
      translateTree(document.body);
    }, { once: true });
  } else {
    startObserver();
    translateTree(document.body);
  }

  window.OpenKEYi18n = { t, setLanguage, translateTree, getLanguage: () => lang };
})();
