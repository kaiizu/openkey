"""Protocol implementation for the Attack Shark X820 Ultra / YC3123 family.

The official Electron app talks to the keyboard through WebHID feature reports.
This module reproduces the same 64-byte feature-report protocol with ctypes.
"""
from __future__ import annotations

import datetime as _dt
import threading
import time
from typing import Any

from .hidwin import HidDevice, HidError, find_keyboard, sleep_ms

# ---------------------------------------------------------------- constants
LIGHT_MODES = [
    "LightOff", "LightAlwaysOn", "LightBreath", "LightNeon", "LightWave",
    "LightRipple", "LightRaindrop", "LightSnake", "LightPressAction",
    "LightConverage", "LightSineWave", "LightKaleidoscope", "LightLineWave",
    "LightUserPicture", "LightLaser", "LightCircleWave", "LightDazzing",
    "LightRainDown", "LightMeteor", "LightPressActionOff", "LightMusicFollow3",
    "LightScreenColor", "LightMusicFollow2", "LightTrain", "LightFireWorks",
    "LightUserColor",
]
LIGHT_LABELS_ES = {
    "LightOff": "Apagado",
    "LightAlwaysOn": "Fijo",
    "LightBreath": "Respiración",
    "LightNeon": "Neón",
    "LightWave": "Ola",
    "LightRipple": "Onda",
    "LightRaindrop": "Lluvia",
    "LightSnake": "Serpiente",
    "LightPressAction": "Al presionar",
    "LightConverage": "Cobertura",
    "LightSineWave": "Onda sinusoidal",
    "LightKaleidoscope": "Caleidoscopio",
    "LightLineWave": "Onda lineal",
    "LightUserPicture": "Imagen de usuario",
    "LightLaser": "Láser",
    "LightCircleWave": "Onda circular",
    "LightDazzing": "Destello",
    "LightRainDown": "Lluvia descendente",
    "LightMeteor": "Meteoro",
    "LightPressActionOff": "Al presionar (apagado)",
    "LightMusicFollow3": "Música 3",
    "LightScreenColor": "Color de pantalla",
    "LightMusicFollow2": "Música 2",
    "LightTrain": "Tren",
    "LightFireWorks": "Fuegos artificiales",
    "LightUserColor": "Color de usuario",
}

SIDE_LIGHT_MODES = ["LightOff", "LightAlwaysOn", "LightBreath", "LightNeon",
                    "LightWave", "LightSnake", "LightMusicFollow2"]
SIDE_LIGHT_INDEX = {name: i for i, name in enumerate(SIDE_LIGHT_MODES)}

REPORT_RATES = [8000, 4000, 2000, 1000, 500, 250, 125]
REPORT_RATE_INDEX = {rate: i for i, rate in enumerate(REPORT_RATES)}

SYSTEMS = {"win": 0, "mac": 1, "ios": 2, "android": 3}
SYSTEMS_REV = {v: k for k, v in SYSTEMS.items()}

MAX_SPEED = 4
DAZZLE = 8
NORMAL = 7
MACRO_BYTES = 256
MACRO_SLOTS = 50
COMMON_COLORS = {
    0: 0xFF0000, 1: 0xFF4400, 2: 0xFFFF00, 3: 0x00FF00,
    4: 0x00FFFF, 5: 0x0000FF, 6: 0xFF00FF,
}


def encode_macro(macro: dict[str, Any] | None) -> bytes:
    """Encode a macro dict `{repeat, events}` into the 256-byte YC3123 blob."""
    data = macro or {}
    repeat = max(1, min(65535, int(data.get("repeat", 1) or 1)))
    out = bytearray([repeat & 0xFF, (repeat >> 8) & 0xFF])
    for event in data.get("events") or []:
        kind = event.get("kind", "key")
        delay = max(0, min(65535, int(event.get("delayMs", 0) or 0)))
        if kind == "mouseMove":
            dx = max(-127, min(127, int(event.get("dx", 0) or 0))) & 0xFF
            dy = max(-127, min(127, int(event.get("dy", 0) or 0))) & 0xFF
            if 1 <= delay <= 127:
                out.extend([0xF9, (delay << 1) & 0xFF, dx, dy])
            else:
                out.extend([0xF9, 0, dx, dy, delay & 0xFF, (delay >> 8) & 0xFF])
            continue
        pressed = bool(event.get("pressed", True))
        high = 0x80 if pressed else 0x00
        if kind == "mouseButton":
            button = max(0, min(4, int(event.get("button", 0) or 0)))
            code = 0xF0 + button
        else:
            code = max(4, min(239, int(event.get("usage", 4) or 4)))
        if 1 <= delay <= 127:
            out.extend([code, high | delay])
        else:
            out.extend([code, high, delay & 0xFF, (delay >> 8) & 0xFF])
    if len(out) > MACRO_BYTES - 4:
        raise ValueError(f"La macro supera el límite de {MACRO_BYTES - 4} bytes ({len(out)} bytes)")
    out.extend(bytes(MACRO_BYTES - len(out)))
    return bytes(out[:MACRO_BYTES])


def decode_macro(blob: bytes | bytearray) -> dict[str, Any]:
    """Decode a 256-byte YC3123 macro blob into `{repeat, events}`."""
    raw = bytes(blob or b"").ljust(MACRO_BYTES, b"\0")[:MACRO_BYTES]
    repeat = raw[0] | (raw[1] << 8)
    if repeat <= 0:
        repeat = 1
    events: list[dict[str, Any]] = []
    i = 2
    while i + 1 < len(raw):
        code = raw[i]
        if code == 0:
            break
        if code == 0xF9:
            if i + 3 >= len(raw):
                break
            dx = raw[i + 2] - 256 if raw[i + 2] >= 128 else raw[i + 2]
            dy = raw[i + 3] - 256 if raw[i + 3] >= 128 else raw[i + 3]
            if raw[i + 1] != 0:
                delay = raw[i + 1] >> 1
                i += 4
            else:
                if i + 5 >= len(raw):
                    break
                delay = raw[i + 4] | (raw[i + 5] << 8)
                i += 6
            events.append({"kind": "mouseMove", "dx": dx, "dy": dy, "delayMs": delay})
            continue
        pressed = bool(raw[i + 1] & 0x80)
        low = raw[i + 1] & 0x7F
        if low != 0:
            delay = low
            i += 2
        else:
            if i + 3 >= len(raw):
                break
            delay = raw[i + 2] | (raw[i + 3] << 8)
            i += 4
        if 4 <= code <= 239:
            events.append({"kind": "key", "usage": code, "pressed": pressed, "delayMs": delay})
        elif 0xF0 <= code <= 0xF4:
            events.append({"kind": "mouseButton", "button": code - 0xF0, "pressed": pressed, "delayMs": delay})
        else:
            break
    return {"repeat": repeat, "events": events}


def rgb_to_num(r: int, g: int, b: int) -> int:
    return (r << 16) | (g << 8) | b


def num_to_rgb(n: int) -> tuple[int, int, int]:
    return (n >> 16) & 255, (n >> 8) & 255, n & 255


def u16(b: bytes, off: int) -> int:
    return b[off] | (b[off + 1] << 8)


def u32(b: bytes, off: int) -> int:
    return b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)


class Keyboard:
    """One open handle to the keyboard's vendor HID collection."""

    def __init__(self):
        info = find_keyboard()
        if info is None:
            raise HidError(
                "No encontré el teclado. Conecta el X820 Ultra por USB "
                "(el receptor 2.4G también sirve) y vuelve a intentar.")
        self.info = info
        self.dev = HidDevice(info)
        self.lock = threading.RLock()
        self._last_io = 0.0

    def close(self) -> None:
        with self.lock:
            self.dev.close()

    # ------------------------------------------------------------ transport
    def _encode(self, cmd: bytes | bytearray | list[int], bit: int) -> bytes:
        data = bytearray(cmd)
        if len(data) < 9:
            data += bytes(9 - len(data))
        if bit == 7:
            data[7] = 255 - (sum(data[:7]) & 0xFF)
        elif bit == 8:
            data[8] = 255 - (sum(data[:8]) & 0xFF)
        if len(data) < 64:
            data += bytes(64 - len(data))
        return bytes(data)

    def _send(self, cmd, bit: int = 7) -> None:
        self.dev.set_feature(self._encode(cmd, bit))

    def _read(self, delay: float = 0.012) -> bytes:
        if delay:
            time.sleep(delay)
        return self.dev.get_feature(65)

    def cmd(self, payload, bit: int = 7, delay: float = 0.012,
            retries: int = 2, expect: int | None = None) -> bytes:
        """Send a feature report and read the response.

        Retries when the first response byte is not the expected command.
        """
        last: bytes | None = None
        for attempt in range(retries + 1):
            with self.lock:
                self._send(payload, bit)
                last = self._read(delay)
            if expect is None or (last and last[0] == expect):
                return last
            if attempt < retries:
                sleep_ms(20)
        raise HidError(f"Respuesta inesperada del teclado para el comando 0x{payload[0]:02X}")

    # ------------------------------------------------------------- identity
    def get_device_id(self) -> int | None:
        r = self.cmd([143], expect=143, retries=3)
        if r and r[0] == 143:
            version = u32(r, 1)
            return None if version == 0xFFFFFFFF else version
        return None

    def get_identity(self) -> tuple[int | None, int | None]:
        r = self.cmd([143], expect=143, retries=3)
        version = u32(r, 1)
        usb = (r[8] << 8) | r[7]
        return (None if version == 0xFFFFFFFF else version, usb or None)

    def get_usb_version(self) -> int | None:
        r = self.cmd([143], expect=143, retries=3)
        if r and r[0] == 143:
            v = (r[8] << 8) | r[7]
            return v or None
        return None

    def get_rf_version(self) -> int | None:
        r = self.cmd([128], expect=128)
        if r and r[0] == 128:
            v = u16(r, 1)
            return v or None
        return None

    def get_oled_version(self) -> dict[str, int | None]:
        r = self.cmd([173], expect=173)
        if r and r[0] == 173:
            oled = u16(r, 1)
            flash = u16(r, 3)
            return {"oled": oled or None, "flash": flash or None}
        return {"oled": None, "flash": None}

    def get_profile(self) -> int | None:
        r = self.cmd([132], expect=132)
        return r[1] if r and r[0] == 132 else None

    def set_profile(self, profile: int) -> bool:
        profile = max(0, min(3, int(profile)))
        ok = bool(self.cmd([4, profile], expect=None, retries=0))
        time.sleep(0.12)
        return ok

    # -------------------------------------------------------------- reports
    def get_report_rate(self) -> int | None:
        r = self.cmd([131], expect=131)
        if r and r[0] == 131:
            idx = r[2]
            return REPORT_RATES[idx] if idx < len(REPORT_RATES) else None
        return None

    def set_report_rate(self, rate: int) -> bool:
        if rate not in REPORT_RATE_INDEX:
            raise ValueError("Velocidad no válida")
        self.cmd([3, 0, REPORT_RATE_INDEX[rate]], expect=None, retries=0)
        time.sleep(0.12)
        return True

    def get_debounce(self) -> int | None:
        r = self.cmd([134], expect=134)
        return r[1] if r and r[0] == 134 else None

    def set_debounce(self, ms: int) -> bool:
        ms = max(0, min(20, int(ms)))
        self.cmd([6, ms], expect=None, retries=0)
        time.sleep(0.12)
        return True

    # -------------------------------------------------------------- lighting
    @staticmethod
    def _parse_light(r: bytes) -> dict[str, Any] | None:
        if not r or r[0] != 135:
            return None
        idx = r[1]
        name = LIGHT_MODES[idx] if idx < len(LIGHT_MODES) else f"Modo {idx}"
        speed = MAX_SPEED - r[2]
        bright = r[3]
        option = r[4] >> 4
        low = r[4] & 0x0F
        rgb = rgb_to_num(r[5], r[6], r[7])
        # The firmware sometimes reports a "common colour" index instead of RGB.
        if low not in (DAZZLE, NORMAL) and low in COMMON_COLORS:
            rgb = COMMON_COLORS[low]
        if rgb == 0xFB00CB:
            rgb = 0xFFFFFF
        return {
            "mode": name,
            "label": LIGHT_LABELS_ES.get(name, name),
            "modeIndex": idx,
            "brightness": bright,
            "speed": max(0, min(MAX_SPEED, speed)),
            "option": option,
            "rgb": rgb,
            "dazzle": low == 0 if name in ("LightMusicFollow3", "LightMusicFollow2") else low == DAZZLE,
            "raw": r[:9].hex(" "),
        }

    def get_light(self) -> dict[str, Any] | None:
        return self._parse_light(self.cmd([135], expect=135))

    def get_key_colors(self) -> bytes:
        """Read the six raw RGB blocks for custom lighting slot zero."""
        blocks = []
        for chunk in range(6):
            data = self.cmd([140, 0, 255, chunk], expect=None, retries=0)
            if len(data) != 64:
                raise HidError("Respuesta incompleta al leer los colores")
            blocks.append(data)
        return b"".join(blocks)

    def set_key_colors(self, data: bytes) -> None:
        """Send the 378-byte user-picture payload used by the official driver."""
        if len(data) != 384:
            raise ValueError("La matriz de colores debe tener 384 bytes")
        for chunk in range(7):
            piece = data[chunk * 56:min((chunk + 1) * 56, 378)]
            header = bytes([12, 0, 255, chunk, len(piece), int(chunk == 6), 0, 0])
            with self.lock:
                self._send(header + piece.ljust(56, b"\0"), 7)
            sleep_ms(5)
        sleep_ms(120)

    def send_sync_color(self, frame: bytes) -> None:
        """Send one 21x6 RGB frame with the official 0x0F sync-color command.

        The driver uses seven 56-byte chunks (378 bytes total), a constant
        chunk length in byte 3, and a last-packet flag in byte 4. The payload
        is written without waiting for a response; the firmware applies it as
        an audio-sync frame while the stream is active.
        """
        expected = 21 * 6 * 3
        if len(frame) != expected:
            raise ValueError(f"El frame de sincronización debe tener {expected} bytes")
        chunks = (expected + 55) // 56
        for i in range(chunks):
            piece = frame[i * 56:(i + 1) * 56]
            header = bytes([0x0F, 1, i, 56, int(i == chunks - 1), 0, 0, 0])
            with self.lock:
                self._send(header + piece.ljust(56, b"\0"), 7)

    def clear_sync_color(self) -> None:
        """Turn off the last streamed sync frame."""
        self.send_sync_color(bytes(21 * 6 * 3))

    def set_light(self, mode: str | int, brightness: int = 4, speed: int = 2,
                  rgb: int = 0xFFFFFF, dazzle: bool = False,
                  option: int = 0) -> bool:
        idx = LIGHT_MODES.index(mode) if isinstance(mode, str) else int(mode)
        if idx < 0 or idx >= len(LIGHT_MODES):
            raise ValueError("Modo de luz no válido")
        bright = max(0, min(5, int(brightness)))
        spd = max(0, min(MAX_SPEED, int(speed)))
        opt = max(0, min(15, int(option)))
        mode_byte = (opt << 4) | (DAZZLE if dazzle else NORMAL)
        name = LIGHT_MODES[idx]
        if name == "LightUserPicture":
            mode_byte = opt << 4
        elif name in ("LightMusicFollow3", "LightMusicFollow2"):
            mode_byte = (opt << 4) | (0 if dazzle else 4)
        elif name == "LightScreenColor":
            mode_byte = 0
        r, g, b = num_to_rgb(rgb)
        if name == "LightUserPicture":
            r, g, b = 0, 200, 200
        e = bytearray(9)
        e[0] = 7
        e[1] = idx
        e[2] = MAX_SPEED - spd
        e[3] = bright
        e[4] = mode_byte
        e[5], e[6], e[7] = r, g, b
        self.cmd(e, bit=8, expect=None, retries=0)
        time.sleep(0.12)
        return True

    @staticmethod
    def _parse_side_light(r: bytes) -> dict[str, Any] | None:
        if not r or r[0] != 136:
            return None
        idx = r[1]
        name = SIDE_LIGHT_MODES[idx] if idx < len(SIDE_LIGHT_MODES) else f"Modo {idx}"
        return {
            "mode": name,
            "label": LIGHT_LABELS_ES.get(name, name),
            "modeIndex": idx,
            "speed": r[2],
            "brightness": r[3],
            "option": r[4] >> 4,
            "rgb": rgb_to_num(r[5], r[6], r[7]),
            "dazzle": (r[4] & 0x0F) == (0 if name == "LightMusicFollow2" else DAZZLE),
            "raw": r[:9].hex(" "),
        }

    def get_side_light(self) -> dict[str, Any] | None:
        return self._parse_side_light(self.cmd([136], expect=136))

    def set_side_light(self, mode: str | int, brightness: int = 4, speed: int = 2,
                       rgb: int = 0xFFFFFF, dazzle: bool = False,
                       option: int = 0) -> bool:
        idx = SIDE_LIGHT_INDEX[mode] if isinstance(mode, str) else int(mode)
        if idx < 0 or idx >= len(SIDE_LIGHT_MODES):
            raise ValueError("Modo de luz lateral no válido")
        bright = max(0, min(5, int(brightness)))
        spd = max(0, min(MAX_SPEED, int(speed)))
        opt = max(0, min(15, int(option)))
        n = idx
        mode_byte = (opt << 4) | (DAZZLE if dazzle else NORMAL)
        if SIDE_LIGHT_MODES[idx] == "LightNeon":
            mode_byte = 8
        elif SIDE_LIGHT_MODES[idx] == "LightMusicFollow2":
            mode_byte = (opt << 4) | (0 if dazzle else 4)
        r, g, b = num_to_rgb(rgb)
        e = bytearray(9)
        e[0] = 8
        e[1] = n
        e[2] = spd
        e[3] = bright
        e[4] = mode_byte
        e[5], e[6], e[7] = r, g, b
        self.cmd(e, bit=8, expect=None, retries=0)
        time.sleep(0.12)
        return True

    # --------------------------------------------------------------- options
    def get_kb_option(self) -> dict[str, Any] | None:
        r = self.cmd([137], expect=137)
        if not r or r[0] != 137:
            return None
        system = SYSTEMS_REV.get(r[1], "win")
        return {
            "system": system,
            "fnIndex": r[2],
            "flag": bool(r[3]),
            "rtStab": 0 if r[4] > 5 else r[4] * 25,
            "wasdSwap": r[5] == 1,
        }

    def set_os_mode(self, system: str) -> bool:
        if system not in SYSTEMS:
            raise ValueError("Sistema no válido")
        cur = self.get_kb_option()
        if cur is None:
            raise HidError("No se pudieron leer las opciones actuales del teclado")
        e = bytearray(8)
        e[0] = 9
        e[1] = SYSTEMS[system]
        e[2] = int(cur.get("fnIndex", 0))
        e[3] = 1 if cur.get("flag") else 0
        e[4] = int(cur.get("rtStab", 0)) // 25
        e[5] = 1 if cur.get("wasdSwap") else 0
        self.cmd(e, expect=None, retries=0)
        time.sleep(0.12)
        return True

    def get_sleep(self) -> dict[str, int] | None:
        r = self.cmd([145], expect=145)
        if not r or r[0] != 145:
            return None
        return {
            "bt": u16(r, 8),
            "wired": u16(r, 10),
            "deepBt": u16(r, 12),
            "deepWired": u16(r, 14),
        }

    def set_sleep(self, bt: int | None = None, wired: int | None = None,
                  deep_bt: int | None = None, deep_wired: int | None = None) -> bool:
        cur = self.get_sleep()
        if cur is None:
            raise HidError("No se pudieron leer los ajustes actuales de suspensión")
        vals = {
            "bt": cur["bt"] if bt is None else max(0, min(64800, int(bt))),
            "wired": cur["wired"] if wired is None else max(0, min(64800, int(wired))),
            "deepBt": cur["deepBt"] if deep_bt is None else max(0, min(64800, int(deep_bt))),
            "deepWired": cur["deepWired"] if deep_wired is None else max(0, min(64800, int(deep_wired))),
        }
        e = bytearray(16)
        e[0] = 17
        for off, key in ((8, "bt"), (10, "wired"), (12, "deepBt"), (14, "deepWired")):
            e[off] = vals[key] & 0xFF
            e[off + 1] = (vals[key] >> 8) & 0xFF
        self.cmd(e, expect=None, retries=0)
        time.sleep(0.12)
        return True

    # ---------------------------------------------------------------- screen
    def sync_clock(self, when: _dt.datetime | None = None) -> bool:
        when = when or _dt.datetime.now()
        e = bytearray(16)
        e[0] = 40
        e[8] = (when.year >> 8) & 0xFF
        e[9] = when.year & 0xFF
        e[10] = when.month
        e[11] = when.day
        e[12] = when.hour
        e[13] = when.minute
        e[14] = when.second
        self.cmd(e, expect=None, retries=0, delay=0.03)
        return True

    def set_screen_playback(self, auto_cycle: bool, seconds: int = 10) -> bool:
        """Set the screen playback mode.

        The vendor driver calls this `setScreenMenu`, but 0x2F actually chooses
        between staying on a page (0) and rotating pages every N seconds (1).
        """
        self.cmd([47, 1 if auto_cycle else 0, max(1, min(255, int(seconds)))],
                 expect=None, retries=0, delay=0.03)
        return True

    def set_screen_menu(self, enabled: bool, seconds: int = 10) -> bool:
        """Backward-compatible alias for the old (incorrect) menu naming."""
        return self.set_screen_playback(enabled, seconds)

    def _screen_start(self, data_len: int, left: int, top: int, right: int,
                      bottom: int, frame: int = 0, frames: int = 1,
                      delay: int = 0) -> None:
        """Send the 0xA5 header that prepares one frame or an animation."""
        meta = bytearray(64)
        meta[0] = 165
        meta[1] = frame & 0xFF          # currentFrame
        meta[2] = frames & 0xFF         # frameNum
        meta[3] = delay & 0xFF          # frameDelay (ms, as used by the driver)
        meta[4] = data_len & 0xFF
        meta[5] = (data_len >> 8) & 0xFF
        meta[6] = 0
        meta[8] = left & 0xFF
        meta[9] = top & 0xFF
        meta[10] = right & 0xFF
        meta[11] = bottom & 0xFF
        meta[12] = (left >> 8) & 0xFF
        meta[13] = (top >> 8) & 0xFF
        meta[14] = (right >> 8) & 0xFF
        meta[15] = (bottom >> 8) & 0xFF
        meta[16] = (data_len & 0xFFFFFF) >> 16
        meta[17] = (data_len >> 24) & 0xFF
        meta[18] = 0

        ready = False
        for _ in range(10):
            r = self.cmd(meta, bit=7, delay=0.1, retries=0)
            if r and len(r) > 1 and r[0] == 165 and r[1] == 1:
                ready = True
                break
            sleep_ms(100)
        if not ready:
            raise HidError("La pantalla no confirmó la imagen (¿está desconectada?)")

    def _screen_frame(self, data: bytes, frame: int, frames: int, delay: int) -> None:
        """Send one 0x25 frame, split into 56-byte chunks."""
        chunk_size = 56
        total = (len(data) + chunk_size - 1) // chunk_size
        header = bytearray(8)
        header[0] = 37
        header[1] = frame & 0xFF
        header[2] = frames & 0xFF
        header[3] = delay & 0xFF
        for i in range(total):
            piece = data[i * chunk_size:(i + 1) * chunk_size]
            header[4] = i & 0xFF
            header[5] = (i >> 8) & 0xFF
            header[6] = len(piece)
            payload = bytes(header) + piece + bytes(chunk_size - len(piece))
            with self.lock:
                self._send(payload, 7)
            sleep_ms(2)

    def send_images(self, frames: list[bytes], left: int, top: int, right: int,
                    bottom: int, delay: int = 0) -> bool:
        """Upload one image or an animation (0xA5 once + one 0x25 set per frame)."""
        if not frames:
            raise ValueError("No hay cuadros para enviar")
        if len(frames) > 255:
            raise ValueError("La pantalla admite como máximo 255 cuadros")
        if not (0 <= left < right <= 128 and 0 <= top < bottom <= 128):
            raise ValueError("Área de imagen no válida")
        expected = (right - left) * (bottom - top) * 2
        for index, frame in enumerate(frames):
            if len(frame) != expected:
                raise ValueError(f"Tamaño de cuadro incorrecto en el cuadro {index}")
        delay = max(0, min(255, int(delay)))
        self._screen_start(expected, left, top, right, bottom,
                           frame=0, frames=len(frames), delay=delay)
        for index, frame in enumerate(frames):
            self._screen_frame(frame, index, len(frames), delay)
        sleep_ms(100)
        return True

    def send_image(self, data: bytes, left: int, top: int, right: int,
                   bottom: int, delay: int = 0) -> bool:
        """Upload one RGB565 frame. Data must be column-major, big-endian."""
        return self.send_images([data], left, top, right, bottom, delay)

    # --------------------------------------------------------------- matrix
    def get_matrix(self, profile: int = 0, layer: int = 0) -> bytes:
        out = bytearray()
        for chunk in range(8):
            # Matrix responses are raw 64-byte data, not command-echo packets.
            r = self.cmd([138, profile, 255, chunk, layer], expect=None, retries=0)
            if len(r) < 64:
                raise HidError("Respuesta incompleta al leer la matriz de teclas")
            out += r[:64]
        return bytes(out)

    def set_key_group(self, profile: int, slot: int, group: list[int] | bytes,
                      layer: int = 0, save: bool = True) -> bool:
        if slot < 0 or slot > 127:
            raise ValueError("Posición de tecla no válida")
        if len(group) != 4:
            raise ValueError("El grupo de tecla debe tener 4 bytes")
        e = bytearray(12)
        e[0] = 10
        e[1] = max(0, min(3, int(profile)))
        e[2] = slot
        e[5] = 1 if save else 0
        e[6] = max(0, min(3, int(layer)))
        e[8:12] = bytes(group)
        self.cmd(e, bit=7, expect=None, retries=0)
        time.sleep(0.12)
        return True

    def set_key_simple(self, profile: int, slot: int, hid: int,
                       layer: int = 0, save: bool = True) -> bool:
        if hid < 0 or hid > 0xFFFFFFFF:
            raise ValueError("Código de tecla no válido")
        if hid <= 0xFF:
            group = [0, 0, hid, 0]
        else:
            group = [(hid >> 24) & 0xFF, (hid >> 16) & 0xFF,
                     (hid >> 8) & 0xFF, hid & 0xFF]
        return self.set_key_group(profile, slot, group, layer, save)

    def set_matrix_bulk(self, profile: int, layer: int, matrix: bytes) -> None:
        """Write an entire 512-byte key matrix (10 chunks of up to 56 bytes)."""
        if len(matrix) != 512:
            raise ValueError("La matriz completa debe tener 512 bytes")
        prof = max(0, min(3, int(profile)))
        lay = max(0, min(3, int(layer)))
        total_chunks = (len(matrix) + 55) // 56
        for chunk in range(total_chunks):
            piece = matrix[chunk * 56:min((chunk + 1) * 56, len(matrix))]
            header = bytes([10, prof, 255, chunk, len(piece),
                            int(chunk == total_chunks - 1), lay, 0])
            with self.lock:
                self._send(header + piece.ljust(56, b"\0"), 7)
            sleep_ms(12)
        sleep_ms(140)

    # ---------------------------------------------------------------- macros
    def get_macro(self, slot: int) -> dict[str, Any]:
        """Read a 256-byte macro slot (four 64-byte pages with command 0x8B)."""
        if slot < 0 or slot >= MACRO_SLOTS:
            raise ValueError("Slot de macro fuera de rango (0–49)")
        out = bytearray()
        for page in range(4):
            r = self.cmd([139, slot & 0xFF, page], expect=None, retries=0)
            if len(r) < 64:
                raise HidError("Respuesta incompleta al leer la macro")
            chunk = r[:64]
            out += chunk
            if not any(chunk):
                break
        return decode_macro(out)

    def set_macro(self, slot: int, macro: dict[str, Any]) -> dict[str, Any]:
        """Write a 256-byte macro slot (up to five 56-byte pages with 0x0B)."""
        if slot < 0 or slot >= MACRO_SLOTS:
            raise ValueError("Slot de macro fuera de rango (0–49)")
        blob = encode_macro(macro)
        non_zero_pages = 0
        for page in range(5):
            if any(blob[page * 56:(page + 1) * 56]):
                non_zero_pages = page + 1
        pages = max(1, non_zero_pages)
        for page in range(pages):
            piece = blob[page * 56:(page + 1) * 56]
            header = bytes([11, slot & 0xFF, page, 56, int(page == pages - 1), 0, 0, 0])
            with self.lock:
                self._send(header + piece.ljust(56, b"\0"), 7)
            sleep_ms(16)
        sleep_ms(140)
        return self.get_macro(slot)

    # ---------------------------------------------------------------- system
    def reset(self) -> bool:
        self.cmd([1], bit=7, expect=None, retries=0, delay=0.05)
        time.sleep(2.0)
        return True

    # ----------------------------------------------------------------- status
    def status(self) -> dict[str, Any]:
        errors: list[str] = []
        result: dict[str, Any] = {
            "connected": True,
            "product": self.info.product.replace("X820UItra", "X820 Ultra").replace("UItra", "Ultra"),
            "productRaw": self.info.product,
            "vid": f"{self.info.vid:04x}",
            "pid": f"{self.info.pid:04x}",
            "path": self.info.path,
        }
        try:
            result["deviceId"], result["usbVersion"] = self.get_identity()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"identidad y versión USB: {exc}")
        try:
            result["rfVersion"] = self.get_rf_version()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"versión RF: {exc}")
        try:
            result["oled"] = self.get_oled_version()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"versión OLED: {exc}")
        try:
            result["profile"] = self.get_profile()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"perfil: {exc}")
        try:
            result["reportRate"] = self.get_report_rate()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"report rate: {exc}")
        try:
            result["debounce"] = self.get_debounce()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"debounce: {exc}")
        try:
            result["light"] = self.get_light()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"luz: {exc}")
        try:
            result["sideLight"] = self.get_side_light()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"luz lateral: {exc}")
        try:
            result["kbOption"] = self.get_kb_option()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"opciones: {exc}")
        try:
            result["sleep"] = self.get_sleep()
        except Exception as exc:  # noqa: BLE001
            errors.append(f"suspensión: {exc}")
        if errors:
            result["errors"] = errors
        return result
