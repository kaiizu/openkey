"""Local web server for OpenKEY — a lightweight AK820 Ultra configurator."""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import subprocess
import sys
import threading
import traceback
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from .audio import MusicSync
from .core import (Keyboard, HidError, LIGHT_LABELS_ES, LIGHT_MODES, MACRO_BYTES,
                   MACRO_SLOTS, REPORT_RATES, SIDE_LIGHT_MODES, SYSTEMS)
from .ripple import RippleSync, WATER_DROP_DEFAULTS

if getattr(sys, "frozen", False):
    # PyInstaller onedir/onefile: bundled data lives in _MEIPASS (the
    # _internal directory for onedir builds).
    ROOT = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
else:
    ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"


def _read_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return default


LAYOUT = _read_json(WEB / "layout_ak820.json", {"width": 773, "height": 299, "keys": []})
KEYMAP = _read_json(ROOT / "data/keymap.json", [])
BY_HID = {}
for _e in KEYMAP:
    _h = _e.get("hidCode")
    if isinstance(_h, int) and _h not in BY_HID:
        BY_HID[_h] = _e
BY_SLOT = {}
for _k in LAYOUT.get("keys", []):
    if _k.get("index") is not None:
        BY_SLOT[_k["index"]] = _k

COMBO_NAMES = {0xE0: "Ctrl", 0xE1: "Shift", 0xE2: "Alt", 0xE3: "Win",
               0xE4: "Ctrl", 0xE5: "Shift", 0xE6: "Alt", 0xE7: "Win"}


def key_label(hid: int) -> str:
    if hid == 0:
        return "Desactivada"
    if hid <= 0xFF and hid in BY_HID:
        return BY_HID[hid]["value"]
    if hid > 0xFFFF:
        # Find the first entry with that exact composite code.
        for e in KEYMAP:
            if e.get("hidCode") == hid:
                return e["value"]
    return f"0x{hid:X}"


def decode_group(group: bytes) -> dict:
    g = list(group)
    if g == [0, 0, 0, 0]:
        return {"type": "disabled", "label": "Desactivada"}
    if g[0] == 0 and g[1] == 0 and g[3] == 0:
        return {"type": "key", "hid": g[2], "label": key_label(g[2])}
    if g[0] == 9:
        mode_names = {0: "Repetir", 1: "Alternar", 2: "Mantener"}
        mode_label = mode_names.get(g[1], "Repetir")
        return {
            "type": "macro",
            "label": f"Macro {g[2] + 1} · {mode_label}",
            "macroIndex": g[2],
            "macroMode": g[1],
        }
    if g[0] == 10:
        if g[1] == 1 and g[2] == 0:
            return {"type": "fn", "label": "Fn"}
        return {"type": "function", "label": "Función especial"}
    if g[0] == 1:
        return {"type": "mouse", "label": "Botón de ratón"}
    if g[0] == 0:
        mods = []
        if g[1] in COMBO_NAMES:
            mods.append(COMBO_NAMES[g[1]])
        main = key_label(g[2])
        if g[3]:
            mods.append(key_label(g[3]))
        return {"type": "combo", "label": " + ".join(mods + [main])}
    # Vendor "function" groups (0x03, 0x06, 0x08, 0x13, ...) pack the code
    # into the four bytes, the same way matrixToHid does.
    packed = (g[0] << 24) | (g[1] << 16) | (g[2] << 8) | g[3]
    label = key_label(packed)
    if not label.startswith("0x"):
        return {"type": "function", "hid": packed, "label": label}
    return {"type": "function", "label": f"Función 0x{g[0]:02X}"}


class DeviceManager:
    def __init__(self):
        self.lock = threading.RLock()
        self.kb: Keyboard | None = None
        self.last_error: str | None = None

    def close(self):
        with self.lock:
            if self.kb is not None:
                try:
                    self.kb.close()
                except Exception:  # noqa: BLE001
                    pass
                self.kb = None

    def _connect(self) -> Keyboard:
        self.close()
        self.kb = Keyboard()
        self.last_error = None
        return self.kb

    def call(self, fn, *, write=False):
        with self.lock:
            kb = self.kb or self._connect()
            try:
                return fn(kb)
            except (HidError, OSError) as exc:
                self.last_error = str(exc)
                if write:
                    self.close()
                    raise HidError("No se pudo confirmar la escritura; puede haberse aplicado. "
                                   "Reconecta y lee la configuración antes de volver a intentar.") from exc
                # One reconnect attempt for stale handles / replugged devices.
                try:
                    kb = self._connect()
                    return fn(kb)
                except Exception as exc2:  # noqa: BLE001
                    self.last_error = str(exc2)
                    self.close()
                    raise

    def status(self) -> dict:
        try:
            return self.call(lambda kb: kb.status())
        except Exception as exc:  # noqa: BLE001
            return {"connected": False, "error": str(exc)}


DEV = DeviceManager()


def _music_send(frame: bytes) -> None:
    DEV.call(lambda kb: kb.send_sync_color(frame), write=True)


def _music_get_light():
    return DEV.call(lambda kb: kb.get_light())


def _music_set_light(mode, brightness, speed, rgb, dazzle, option):
    DEV.call(lambda kb: kb.set_light(mode, brightness=brightness, speed=speed,
                                     rgb=rgb, dazzle=dazzle, option=option), write=True)


MUSIC = MusicSync(_music_send, _music_get_light, _music_set_light)
RIPPLE = RippleSync(_music_send, _music_get_light, _music_set_light, LAYOUT)


def _color_tuple(value) -> tuple[int, int, int]:
    if isinstance(value, str):
        text = value.strip().lstrip("#")
        if len(text) == 6:
            try:
                return tuple(int(text[i:i + 2], 16) for i in (0, 2, 4))
            except ValueError:
                pass
    if isinstance(value, (list, tuple)) and len(value) == 3:
        return tuple(max(0, min(255, int(c))) for c in value)
    raise ValueError("Color no válido")


def _read_after_write(fn):
    try:
        result = DEV.call(fn)
        if result is None:
            raise HidError("El teclado no devolvió los valores solicitados")
        return result
    except (HidError, OSError) as exc:
        raise HidError("La escritura se envió, pero no se pudo comprobar. "
                       "Reconecta y lee la configuración antes de volver a intentar.") from exc


class Handler(BaseHTTPRequestHandler):
    server_version = "OpenKEY/1.2"

    def log_message(self, fmt, *args):  # noqa: D401
        # Keep the console useful but not noisy. pythonw has no stderr, and
        # BaseHTTPRequestHandler writes the request log there before sending
        # the response, so a missing stream would break static files.
        if "/api/" in (args[0] if args else ""):
            return
        if sys.stderr is None:
            return
        super().log_message(fmt, *args)

    # ------------------------------------------------------------- responses
    def _send(self, status: int, body: bytes, ctype: str = "application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def _json(self, data, status: int = 200):
        self._send(status, json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _error(self, exc: Exception, status: int = 503):
        self._json({"error": str(exc)}, status)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        return json.loads(raw.decode("utf-8")) if raw else {}

    # ---------------------------------------------------------------- routing
    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        try:
            if path == "/api/status":
                self._json(DEV.status())
                return
            if path == "/api/meta":
                self._json({
                    "lightModes": [{"name": n, "label": LIGHT_LABELS_ES.get(n, n)} for n in LIGHT_MODES],
                    "sideLightModes": [{"name": n, "label": LIGHT_LABELS_ES.get(n, n)} for n in SIDE_LIGHT_MODES],
                    "reportRates": REPORT_RATES,
                    "systems": list(SYSTEMS.keys()),
                })
                return
            if path == "/api/keycodes":
                data = (WEB / "keycodes.json").read_bytes()
                self._send(200, data)
                return
            if path == "/api/layout":
                data = (WEB / "layout_ak820.json").read_bytes()
                self._send(200, data)
                return
            if path == "/api/key-colors":
                colors = DEV.call(lambda kb: kb.get_key_colors())
                self._json({"data": base64.b64encode(colors).decode("ascii")})
                return
            if path == "/api/music/status":
                MUSIC.touch()
                self._json(MUSIC.status())
                return
            if path == "/api/ripple/status":
                RIPPLE.touch()
                self._json(RIPPLE.status())
                return
            if path == "/api/macros":
                qs = parse_qs(parsed.query)
                slot = int(qs.get("slot", ["0"])[0])
                macro = DEV.call(lambda kb: kb.get_macro(slot))
                self._json({"slot": slot, "macro": macro, "maxBytes": MACRO_BYTES, "slots": MACRO_SLOTS})
                return
            if path == "/api/keys/backup":
                self._json(self._keys_backup())
                return
            if path == "/api/keys":
                qs = parse_qs(parsed.query)
                profile = int(qs.get("profile", ["0"])[0])
                layer = int(qs.get("layer", ["0"])[0])
                self._json(self._keys(profile, layer))
                return
            if path == "/api/ping":
                self._json({"ok": True})
                return
            self._static(path)
        except Exception as exc:  # noqa: BLE001
            if sys.stderr is not None:
                traceback.print_exc()
            self._error(exc)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
            if path == "/api/reconnect":
                DEV.close()
                self._json(DEV.status())
                return
            if path == "/api/shutdown":
                self._json({"ok": True})
                threading.Timer(0.3, self.server.shutdown).start()
                return
            if path == "/api/music/start":
                if RIPPLE.status().get("running"):
                    RIPPLE.stop()
                MUSIC.touch()
                self._json(MUSIC.start(
                    source=str(body.get("source", "audio")),
                    gain=float(body.get("gain", 10)),
                    mode=str(body.get("mode", "spectrum")),
                    color=_color_tuple(body.get("color", "#00FFFF")),
                    fps=int(body.get("fps", 20)),
                ))
                return
            if path == "/api/music/stop":
                self._json(MUSIC.stop())
                return
            if path == "/api/music/config":
                MUSIC.touch()
                color = body.get("color")
                self._json(MUSIC.configure(
                    gain=body.get("gain"),
                    mode=body.get("mode"),
                    color=_color_tuple(color) if color is not None else None,
                    fps=body.get("fps"),
                ))
                return
            if path == "/api/ripple/start":
                if MUSIC.status().get("running"):
                    MUSIC.stop()
                RIPPLE.touch()
                color = body.get("color", WATER_DROP_DEFAULTS["color"])
                self._json(RIPPLE.start(
                    color_mode=str(body.get("colorMode", WATER_DROP_DEFAULTS["colorMode"])),
                    color=_color_tuple(color),
                    expansion=float(body.get("expansion", WATER_DROP_DEFAULTS["expansion"])),
                    lifetime=float(body.get("lifetime", WATER_DROP_DEFAULTS["lifetime"])),
                    thickness=float(body.get("thickness", WATER_DROP_DEFAULTS["thickness"])),
                    max_radius=float(body.get("maxRadius", WATER_DROP_DEFAULTS["maxRadius"])),
                    fps=int(body.get("fps", WATER_DROP_DEFAULTS["fps"])),
                    include_modifiers=bool(body.get("includeModifiers", WATER_DROP_DEFAULTS["includeModifiers"])),
                ))
                return
            if path == "/api/ripple/stop":
                self._json(RIPPLE.stop())
                return
            if path == "/api/ripple/config":
                RIPPLE.touch()
                color = body.get("color")
                self._json(RIPPLE.configure(
                    color_mode=body.get("colorMode"),
                    color=_color_tuple(color) if color is not None else None,
                    expansion=body.get("expansion"),
                    lifetime=body.get("lifetime"),
                    thickness=body.get("thickness"),
                    max_radius=body.get("maxRadius"),
                    fps=body.get("fps"),
                    include_modifiers=body.get("includeModifiers"),
                ))
                return
            if path == "/api/ripple/trigger":
                RIPPLE.touch()
                self._json(RIPPLE.trigger(body.get("x"), body.get("y")))
                return
            if path == "/api/macros":
                self._json(self._set_macro(body))
                return
            if path == "/api/keys/restore":
                self._json(self._keys_restore(body))
                return
            if path == "/api/light":
                self._json(self._set_light(body))
                return
            if path == "/api/side-light":
                self._json(self._set_side_light(body))
                return
            if path == "/api/key-colors":
                self._json(self._set_key_colors(body))
                return
            if path == "/api/settings":
                self._json(self._settings(body))
                return
            if path == "/api/keys":
                self._json(self._set_key(body))
                return
            if path == "/api/screen/image":
                self._json(self._screen_image(body))
                return
            if path == "/api/screen/clock":
                DEV.call(lambda kb: kb.sync_clock(), write=True)
                self._json({"ok": True})
                return
            if path == "/api/screen/menu":
                auto_cycle = bool(body.get("autoCycle", body.get("enabled", False)))
                seconds = int(body.get("seconds", 10))
                DEV.call(lambda kb: kb.set_screen_playback(auto_cycle, seconds), write=True)
                self._json({"ok": True, "autoCycle": auto_cycle, "seconds": seconds})
                return
            if path == "/api/reset":
                DEV.call(lambda kb: kb.reset(), write=True)
                self._json({"ok": True, "status": DEV.status()})
                return
            self._json({"error": "Ruta no encontrada"}, 404)
        except Exception as exc:  # noqa: BLE001
            if sys.stderr is not None:
                traceback.print_exc()
            self._error(exc)

    # ----------------------------------------------------------------- helpers
    def _static(self, path: str):
        if path in ("/", ""):
            path = "/index.html"
        rel = path.lstrip("/")
        candidate = (WEB / rel).resolve()
        try:
            inside = candidate.is_relative_to(WEB.resolve())
        except AttributeError:  # Python < 3.9
            inside = str(candidate).startswith(str(WEB.resolve()) + os.sep)
        if not inside or not candidate.is_file():
            self._send(404, b"No encontrado", "text/plain; charset=utf-8")
            return
        ctype, _ = mimetypes.guess_type(str(candidate))
        ctype = ctype or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        self._send(200, candidate.read_bytes(), ctype)

    def _keys(self, profile: int, layer: int) -> dict:
        matrix = DEV.call(lambda kb: kb.get_matrix(profile, layer))
        keys = []
        for key in LAYOUT.get("keys", []):
            idx = key.get("index")
            item = dict(key)
            if idx is None:
                item["current"] = {"type": "none", "label": "—"}
            else:
                group = matrix[idx * 4:idx * 4 + 4]
                item["current"] = decode_group(group)
                item["group"] = list(group)
                item["defaultLabel"] = decode_group(bytes(key.get("default") or [0, 0, 0, 0]))["label"]
                item["remappable"] = key.get("code") != "Fn"
            keys.append(item)
        return {"profile": profile, "layer": layer, "keys": keys}

    def _set_key(self, body: dict) -> dict:
        profile = int(body.get("profile", 0))
        layer = int(body.get("layer", 0))
        idx = int(body["index"])
        key = BY_SLOT.get(idx)
        if key is None:
            raise ValueError("Esa tecla no existe en el mapa")
        if key.get("code") == "Fn":
            raise ValueError("La tecla Fn no se puede reasignar desde OpenKEY")
        if body.get("reset"):
            group = key.get("default") or [0, 0, 0, 0]
        elif "group" in body:
            group = list(body["group"])
        elif "hid" in body:
            hid = int(body["hid"])
            if hid <= 0xFF:
                group = [0, 0, hid, 0]
            else:
                group = [(hid >> 24) & 0xFF, (hid >> 16) & 0xFF,
                         (hid >> 8) & 0xFF, hid & 0xFF]
        else:
            raise ValueError("Falta la tecla destino")
        DEV.call(lambda kb: kb.set_key_group(profile, idx, group, layer), write=True)
        return {"ok": True}

    def _set_light(self, body: dict) -> dict:
        rgb = body.get("rgb", 0xFFFFFF)
        if isinstance(rgb, str):
            rgb = int(rgb.lstrip("#"), 16)
        DEV.call(lambda kb: kb.set_light(
            body.get("mode", "LightAlwaysOn"),
            brightness=int(body.get("brightness", 4)),
            speed=int(body.get("speed", 2)),
            rgb=int(rgb),
            dazzle=bool(body.get("dazzle", False)),
            option=int(body.get("option", 0)),
        ), write=True)
        return {"ok": True, "light": _read_after_write(lambda kb: kb.get_light())}

    def _set_key_colors(self, body: dict) -> dict:
        try:
            original = base64.b64decode(body["original"], validate=True)
            edited = base64.b64decode(body["data"], validate=True)
        except (KeyError, ValueError) as exc:
            raise ValueError("Datos de colores no válidos") from exc
        if len(original) != 384 or len(edited) != 384:
            raise ValueError("La matriz de colores debe tener 384 bytes")
        allowed = {key["index"] for key in LAYOUT.get("keys", [])
                   if key.get("type") not in ("knob", "knob-group")
                   and isinstance(key.get("index"), int) and 0 <= key["index"] < 126}
        for i in range(384):
            if original[i] != edited[i] and i // 3 not in allowed:
                raise ValueError("No se puede cambiar una posición desconocida")

        def apply(kb):
            current = kb.get_key_colors()
            if current != original:
                raise ValueError("Los colores del teclado cambiaron. Vuelve a leerlos antes de aplicar.")
            light = kb.get_light()
            if light is None:
                raise HidError("No se pudo leer el modo de iluminación actual")
            kb.set_key_colors(edited)
            if kb.get_key_colors()[:378] != edited[:378]:
                raise HidError("La lectura posterior no coincide con los colores enviados")
            kb.set_light("LightUserPicture", brightness=light["brightness"], speed=light["speed"], option=0)
            actual = kb.get_light()
            if actual is None or actual["mode"] != "LightUserPicture":
                raise HidError("No se pudo confirmar la activación del modo personalizado")
            return actual
        light = DEV.call(apply, write=True)
        return {"ok": True, "data": base64.b64encode(edited).decode("ascii"), "light": light}

    def _set_side_light(self, body: dict) -> dict:
        rgb = body.get("rgb", 0xFFFFFF)
        if isinstance(rgb, str):
            rgb = int(rgb.lstrip("#"), 16)
        DEV.call(lambda kb: kb.set_side_light(
            body.get("mode", "LightAlwaysOn"),
            brightness=int(body.get("brightness", 4)),
            speed=int(body.get("speed", 2)),
            rgb=int(rgb),
            dazzle=bool(body.get("dazzle", False)),
            option=int(body.get("option", 0)),
        ), write=True)
        return {"ok": True, "sideLight": _read_after_write(lambda kb: kb.get_side_light())}

    def _settings(self, body: dict) -> dict:
        if "profile" in body:
            DEV.call(lambda kb: kb.set_profile(int(body["profile"])), write=True)
        if "reportRate" in body:
            DEV.call(lambda kb: kb.set_report_rate(int(body["reportRate"])), write=True)
        if "debounce" in body:
            DEV.call(lambda kb: kb.set_debounce(int(body["debounce"])), write=True)
        if "system" in body:
            DEV.call(lambda kb: kb.set_os_mode(str(body["system"])), write=True)
        if "sleep" in body:
            s = body["sleep"] or {}
            DEV.call(lambda kb: kb.set_sleep(
                bt=s.get("bt"), wired=s.get("wired"),
                deep_bt=s.get("deepBt"), deep_wired=s.get("deepWired")), write=True)
        status = DEV.status()
        if not status.get("connected") or status.get("errors"):
            raise HidError("Los ajustes se enviaron, pero no se pudo leer el estado completo. "
                           "Reconecta y comprueba los valores antes de volver a intentar.")
        return {"ok": True, "status": status}

    def _screen_image(self, body: dict) -> dict:
        left = int(body["left"]); top = int(body["top"])
        right = int(body["right"]); bottom = int(body["bottom"])
        if not (0 <= left < right <= 128 and 0 <= top < bottom <= 128):
            raise ValueError("Área de imagen no válida")
        try:
            if "frames" in body:
                raw_frames = body["frames"]
                if not isinstance(raw_frames, list) or not raw_frames:
                    raise ValueError("Lista de cuadros no válida")
                frames = [base64.b64decode(item, validate=True) for item in raw_frames]
                delay = int(body.get("delay", 0))
            else:
                frames = [base64.b64decode(body["data"])]
                delay = 0
        except (TypeError, ValueError) as exc:
            raise ValueError("Datos de imagen no válidos") from exc
        if len(frames) > 255:
            raise ValueError("La pantalla admite como máximo 255 cuadros")
        expected = (right - left) * (bottom - top) * 2
        for index, frame in enumerate(frames):
            if len(frame) != expected:
                raise ValueError(f"Tamaño incorrecto en el cuadro {index} ({len(frame)} != {expected})")
        total = sum(len(frame) for frame in frames)
        if total > 4 * 1024 * 1024:
            raise ValueError("La animación es demasiado grande (máximo 4 MB)")
        if len(frames) > 1 and (MUSIC.status().get("running") or RIPPLE.status().get("running")):
            raise ValueError("Detén la sincronización de música u onda reactiva antes de subir una animación")
        pin = body.get("pin")
        pin = True if pin is None else bool(pin)
        state = {"pinned": False, "pinError": None}

        def upload(kb):
            kb.send_images(frames, left, top, right, bottom, delay)
            if pin:
                # Stay on the page that was just written instead of letting the
                # firmware rotate back to a previous image after a few seconds.
                try:
                    kb.set_screen_playback(False, 1)
                    state["pinned"] = True
                except Exception as exc:  # noqa: BLE001
                    state["pinError"] = str(exc)

        DEV.call(upload, write=True)
        return {"ok": True, "bytes": total, "frames": len(frames),
                "pinned": state["pinned"], "pinError": state["pinError"]}

    def _set_macro(self, body: dict) -> dict:
        slot = int(body.get("slot", 0))
        macro = body.get("macro")
        if not isinstance(macro, dict):
            macro = {"repeat": body.get("repeat", 1), "events": body.get("events", [])}
        saved = DEV.call(lambda kb: kb.set_macro(slot, macro), write=True)
        return {"ok": True, "slot": slot, "macro": saved}

    def _keys_backup(self) -> dict:
        def read_all(kb):
            profiles = {}
            for prof in (0, 1):
                profiles[str(prof)] = {
                    "0": kb.get_matrix(prof, 0).hex(),
                    "1": kb.get_matrix(prof, 1).hex(),
                }
            return profiles
        return {
            "app": "OpenKEY",
            "kind": "keymaps",
            "version": 1,
            "device": "Attack Shark X820 Ultra",
            "profiles": DEV.call(read_all),
        }

    def _keys_restore(self, body: dict) -> dict:
        profiles = body.get("profiles")
        if not isinstance(profiles, dict) or not profiles:
            raise ValueError("El archivo no contiene perfiles de teclas válidos")
        fn_slot = next((k["index"] for k in LAYOUT.get("keys", [])
                        if k.get("code") == "Fn" and isinstance(k.get("index"), int)), 65)
        parsed_matrices: list[tuple[int, int, bytes]] = []
        for prof_str, layers in profiles.items():
            prof = int(prof_str)
            if prof not in (0, 1) or not isinstance(layers, dict):
                continue
            for layer_key, raw_hex in layers.items():
                lay = 0 if str(layer_key) in ("0", "base") else 1 if str(layer_key) in ("1", "fn") else -1
                if lay not in (0, 1) or not isinstance(raw_hex, str):
                    continue
                blob = bytearray(bytes.fromhex(raw_hex.strip()))
                if len(blob) != 512:
                    raise ValueError(f"La matriz del perfil {prof} capa {lay} no tiene 512 bytes")
                # Never overwrite the physical Fn key on layer 0.
                if lay == 0 and 0 <= fn_slot < 128:
                    blob[fn_slot * 4:fn_slot * 4 + 4] = bytes([10, 1, 0, 0])
                parsed_matrices.append((prof, lay, bytes(blob)))
        if not parsed_matrices:
            raise ValueError("No se encontraron capas válidas para restaurar")

        def apply_all(kb):
            for prof, lay, data in parsed_matrices:
                kb.set_matrix_bulk(prof, lay, data)
                readback = kb.get_matrix(prof, lay)
                if readback != data:
                    raise HidError(f"La verificación falló en el perfil {prof} capa {lay}")
            return len(parsed_matrices)

        restored = DEV.call(apply_all, write=True)
        return {"ok": True, "restoredLayers": restored}


def open_ui(url: str) -> None:
    """Open the local UI as a chromeless app window when Edge/Chrome is available."""
    roots = [
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("LOCALAPPDATA", ""),
    ]
    candidates = []
    for root in roots:
        if not root:
            continue
        candidates += [
            os.path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
            os.path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
        ]
    for exe in candidates:
        if os.path.isfile(exe):
            try:
                subprocess.Popen([exe, f"--app={url}", "--window-size=1390,900"])
                return
            except OSError:
                continue
    webbrowser.open(url)


def main(argv=None):
    parser = argparse.ArgumentParser(description="OpenKEY — configurador del AK820 Ultra")
    parser.add_argument("--port", type=int, default=8737)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args(argv)

    port = args.port
    for attempt in range(20):
        try:
            httpd = ThreadingHTTPServer((args.host, port), Handler)
            break
        except OSError:
            port += 1
    else:
        raise SystemExit("No encontré un puerto libre")

    url = f"http://{args.host}:{port}/"
    if sys.stdout is not None:
        print(f"OpenKEY escuchando en {url}")
    if not args.no_browser:
        threading.Timer(0.6, lambda: open_ui(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nCerrando…")
    finally:
        MUSIC.stop()
        RIPPLE.stop()
        DEV.close()
        httpd.server_close()


if __name__ == "__main__":
    main()
