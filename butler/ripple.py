"""On-demand global key ripple ("Water drop") renderer for the 0x0F sync path.

Uses Win32 GetAsyncKeyState via ctypes to detect key-down transitions anywhere in
Windows without installing a global hook or external native dependencies.
Nothing runs while stopped (zero threads, zero polling, zero HID traffic).
"""
from __future__ import annotations

import base64
import ctypes
import math
import threading
import time
from typing import Any

from .audio import SYNC_COLS, SYNC_FRAME_BYTES, SYNC_ROWS, _hsv_to_rgb, process_memory_mb

WATER_DROP_DEFAULTS = {
    "colorMode": "fixed",
    "color": "#00E5FF",
    "expansion": 1.0,
    "lifetime": 1.1,
    "thickness": 0.6,
    "maxRadius": 6.0,
    "fps": 30,
    "includeModifiers": False,
}

MODIFIER_CODES = {
    "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight",
    "AltLeft", "AltRight", "MetaLeft", "MetaRight",
}

# Windows Virtual-Key codes for every physical key in layout_ak820.json.
CODE_TO_VK: dict[str, int] = {
    "Escape": 0x1B,
    "F1": 0x70, "F2": 0x71, "F3": 0x72, "F4": 0x73,
    "F5": 0x74, "F6": 0x75, "F7": 0x76, "F8": 0x77,
    "F9": 0x78, "F10": 0x79, "F11": 0x7A, "F12": 0x7B,
    "Delete": 0x2E,
    "Backquote": 0xC0,
    "Digit1": 0x31, "Digit2": 0x32, "Digit3": 0x33, "Digit4": 0x34, "Digit5": 0x35,
    "Digit6": 0x36, "Digit7": 0x37, "Digit8": 0x38, "Digit9": 0x39, "Digit0": 0x30,
    "Minus": 0xBD, "Equal": 0xBB, "Backspace": 0x08, "Home": 0x24,
    "Tab": 0x09,
    "KeyQ": 0x51, "KeyW": 0x57, "KeyE": 0x45, "KeyR": 0x52, "KeyT": 0x54,
    "KeyY": 0x59, "KeyU": 0x55, "KeyI": 0x49, "KeyO": 0x4F, "KeyP": 0x50,
    "BracketLeft": 0xDB, "BracketRight": 0xDD, "Backslash": 0xDC, "PageUp": 0x21,
    "CapsLock": 0x14,
    "KeyA": 0x41, "KeyS": 0x53, "KeyD": 0x44, "KeyF": 0x46, "KeyG": 0x47,
    "KeyH": 0x48, "KeyJ": 0x4A, "KeyK": 0x4B, "KeyL": 0x4C,
    "Semicolon": 0xBA, "Quote": 0xDE, "Enter": 0x0D, "PageDown": 0x22,
    "ShiftLeft": 0xA0,
    "KeyZ": 0x5A, "KeyX": 0x58, "KeyC": 0x43, "KeyV": 0x56, "KeyB": 0x42,
    "KeyN": 0x4E, "KeyM": 0x4D, "Comma": 0xBC, "Period": 0xBE, "Slash": 0xBF,
    "ShiftRight": 0xA1, "ArrowUp": 0x26,
    "ControlLeft": 0xA2, "MetaLeft": 0x5B, "AltLeft": 0xA4,
    "Space": 0x20, "ControlRight": 0xA3,
    "ArrowLeft": 0x25, "ArrowDown": 0x28, "ArrowRight": 0x27,
}

try:
    _user32 = ctypes.WinDLL("user32", use_last_error=True)
    _GetAsyncKeyState = _user32.GetAsyncKeyState
    _GetAsyncKeyState.argtypes = [ctypes.c_int]
    _GetAsyncKeyState.restype = ctypes.c_short
except Exception:  # noqa: BLE001
    _GetAsyncKeyState = None


def ease_out_cubic(p: float) -> float:
    x = max(0.0, min(1.0, p))
    return 1.0 - (1.0 - x) ** 3


def render_ripple_frame(
    ripples: list[dict[str, float]],
    now: float,
    *,
    color_mode: str = "fixed",
    color: tuple[int, int, int] = (0, 229, 255),
    expansion: float = 1.0,
    lifetime: float = 1.1,
    thickness: float = 0.6,
    max_radius: float = 6.0,
) -> bytes:
    """Render one 21x6 RGB frame (378 bytes) from active ripples."""
    life = max(0.3, float(lifetime)) / max(0.3, float(expansion))
    thick = max(0.2, float(thickness))
    radius_max = max(1.0, float(max_radius))
    cell_width = 18.5 / SYNC_COLS
    base_r, base_g, base_b = (max(0, min(255, int(c))) for c in color)

    frame = bytearray(SYNC_FRAME_BYTES)
    for row in range(SYNC_ROWS):
        for col in range(SYNC_COLS):
            r = base_r * 0.045
            g = base_g * 0.045
            b = base_b * 0.045
            for item in ripples:
                age = now - item["born"]
                if age < 0 or age >= life:
                    continue
                progress = max(0.0, min(1.0, age / life))
                radius = radius_max * ease_out_cubic(progress)
                dx = (col + 0.5 - item["x"]) * cell_width
                dy = (row + 0.5 - item["y"])
                distance = math.hypot(dx, dy)
                fade = (1.0 - progress) ** 1.65
                crest = math.exp(-((distance - radius) ** 2) / (2.0 * thick * thick))
                echo = 0.32 * math.exp(-((distance - radius * 0.72) ** 2) / (2.0 * (thick * 1.9) ** 2))
                amplitude = (crest + echo) * fade
                if amplitude < 0.002:
                    continue
                if color_mode == "rainbow":
                    hue = ((item["hue"] + distance * 9.0 + now * 12.0) % 360.0) / 360.0
                    cr, cg, cb = _hsv_to_rgb(hue, 0.92, 1.0)
                elif color_mode == "random":
                    hue = (item["hue"] % 360.0) / 360.0
                    cr, cg, cb = _hsv_to_rgb(hue, 0.90, 1.0)
                else:
                    cr, cg, cb = base_r, base_g, base_b
                r += cr * amplitude
                g += cg * amplitude
                b += cb * amplitude
            offset = (row * SYNC_COLS + col) * 3
            frame[offset] = max(0, min(255, int(round(r))))
            frame[offset + 1] = max(0, min(255, int(round(g))))
            frame[offset + 2] = max(0, min(255, int(round(b))))
    return bytes(frame)


class RippleSync:
    """Owns the on-demand key-ripple thread and 0x0F stream."""

    def __init__(self, send_frame, get_light, set_light, layout: dict[str, Any]):
        self._send_frame = send_frame
        self._get_light = get_light
        self._set_light = set_light
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._running = False

        self._color_mode = "fixed"
        self._color = (0, 229, 255)
        self._expansion = 1.0
        self._lifetime = 1.1
        self._thickness = 0.6
        self._max_radius = 6.0
        self._fps = 30
        self._include_modifiers = False

        self._ripples: list[dict[str, float]] = []
        self._pressed: set[str] = set()
        self._keys_count = 0
        self._frames = 0
        self._cpu = 0.0
        self._send_ms = 0.0
        self._error: str | None = None
        self._last_frame = b""
        self._last_seen = 0.0
        self._original_light: dict | None = None
        self._restored = False
        self._key_map = self._build_key_map(layout)

    @staticmethod
    def _build_key_map(layout: dict[str, Any]) -> list[tuple[str, int, float, float, bool]]:
        width = float(layout.get("width") or 773.0)
        height = float(layout.get("height") or 299.0)
        entries: list[tuple[str, int, float, float, bool]] = []
        for key in layout.get("keys", []):
            if key.get("type") in ("knob", "knob-group"):
                continue
            code = key.get("code")
            vk = CODE_TO_VK.get(code)
            if not code or vk is None:
                continue
            cx = ((float(key.get("x", 0)) + float(key.get("w", 0)) * 0.5) / width) * SYNC_COLS
            cy = ((float(key.get("y", 0)) + float(key.get("h", 0)) * 0.5) / height) * SYNC_ROWS
            entries.append((code, vk, cx, cy, code in MODIFIER_CODES))
        return entries

    def touch(self) -> None:
        self._last_seen = time.monotonic()

    def trigger(self, x: float | None = None, y: float | None = None) -> dict[str, Any]:
        """Spawn a ripple manually (for example from the 'Probar centro' button)."""
        with self._lock:
            rx = SYNC_COLS * 0.5 if x is None else max(0.0, min(float(SYNC_COLS), float(x)))
            ry = SYNC_ROWS * 0.5 if y is None else max(0.0, min(float(SYNC_ROWS), float(y)))
            now = time.monotonic()
            hue = (rx * 18.0 + ry * 23.0 + now * 22.0) % 360.0
            self._ripples.append({"x": rx, "y": ry, "hue": hue, "born": now})
            self._keys_count += 1
            return self.status()

    def configure(
        self,
        *,
        color_mode: str | None = None,
        color: tuple[int, int, int] | None = None,
        expansion: float | None = None,
        lifetime: float | None = None,
        thickness: float | None = None,
        max_radius: float | None = None,
        fps: int | None = None,
        include_modifiers: bool | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if color_mode is not None:
                if color_mode not in ("fixed", "rainbow", "random"):
                    raise ValueError("Modo de color de onda no válido")
                self._color_mode = color_mode
            if color is not None:
                self._color = tuple(max(0, min(255, int(c))) for c in color)
            if expansion is not None:
                self._expansion = max(0.4, min(2.5, float(expansion)))
            if lifetime is not None:
                self._lifetime = max(0.4, min(3.5, float(lifetime)))
            if thickness is not None:
                self._thickness = max(0.25, min(2.2, float(thickness)))
            if max_radius is not None:
                self._max_radius = max(3.0, min(24.0, float(max_radius)))
            if fps is not None:
                self._fps = max(15, min(30, int(fps)))
            if include_modifiers is not None:
                self._include_modifiers = bool(include_modifiers)
        return self.status()

    def start(self, **kwargs) -> dict[str, Any]:
        with self._lock:
            if self._running:
                return self.configure(**kwargs)
            self.configure(**kwargs)
            self._error = None
            self._frames = 0
            self._keys_count = 0
            self._cpu = 0.0
            self._send_ms = 0.0
            self._ripples = []
            self._pressed.clear()
            self._last_frame = b""
            self._restored = False
            self._original_light = self._get_light()
            if not self._original_light:
                raise RuntimeError("No se pudo leer la iluminación actual del teclado")
            light = self._original_light
            try:
                self._set_light(
                    "LightAlwaysOn",
                    max(1, int(light.get("brightness", 4))),
                    int(light.get("speed", 2)),
                    int(light.get("rgb", 0x00E5FF)),
                    False,
                    0,
                )
            except Exception:
                self._restore()
                raise
            self._stop.clear()
            self._last_seen = time.monotonic()
            self._running = True
            self._thread = threading.Thread(target=self._run, name="OpenKEY ripple sync", daemon=True)
            self._thread.start()
            return self.status()

    def stop(self) -> dict[str, Any]:
        with self._lock:
            thread = self._thread
            self._stop.set()
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=3.0)
        return self.status()

    def _poll_keys(self, now: float, include_modifiers: bool) -> None:
        if _GetAsyncKeyState is None:
            return
        for code, vk, cx, cy, is_mod in self._key_map:
            state = _GetAsyncKeyState(vk)
            down = bool(state & 0x8000)
            if down:
                if code not in self._pressed:
                    self._pressed.add(code)
                    if include_modifiers or not is_mod:
                        hue = (cx * 18.0 + cy * 23.0 + now * 22.0) % 360.0
                        self._ripples.append({"x": cx, "y": cy, "hue": hue, "born": now})
                        self._keys_count += 1
            else:
                self._pressed.discard(code)

    def _run(self) -> None:
        try:
            # Prime currently held keys so starting the effect doesn't fire a burst.
            if _GetAsyncKeyState is not None:
                for code, vk, _, _, _ in self._key_map:
                    if _GetAsyncKeyState(vk) & 0x8000:
                        self._pressed.add(code)

            last_cpu = time.process_time()
            last_wall = time.monotonic()
            next_frame = last_wall
            send_acc = 0.0
            stat_frames = 0

            while not self._stop.is_set():
                now = time.monotonic()
                if self._last_seen and now - self._last_seen > 300.0:
                    raise RuntimeError("La interfaz dejó de responder; onda detenida")
                with self._lock:
                    color_mode = self._color_mode
                    color = self._color
                    expansion = self._expansion
                    lifetime = self._lifetime
                    thickness = self._thickness
                    max_radius = self._max_radius
                    fps = self._fps
                    include_mods = self._include_modifiers
                    self._poll_keys(now, include_mods)
                    life = max(0.3, lifetime) / max(0.3, expansion)
                    self._ripples = [r for r in self._ripples if 0.0 <= now - r["born"] < life]
                    active_ripples = list(self._ripples)

                frame = render_ripple_frame(
                    active_ripples,
                    now,
                    color_mode=color_mode,
                    color=color,
                    expansion=expansion,
                    lifetime=lifetime,
                    thickness=thickness,
                    max_radius=max_radius,
                )
                t0 = time.perf_counter()
                self._send_frame(frame)
                send_acc += time.perf_counter() - t0
                stat_frames += 1

                with self._lock:
                    self._frames += 1
                    self._last_frame = frame

                wall = time.monotonic()
                if wall - last_wall >= 1.5:
                    self._cpu = (time.process_time() - last_cpu) / (wall - last_wall) * 100.0
                    if stat_frames:
                        self._send_ms = send_acc / stat_frames * 1000.0
                    send_acc = 0.0
                    stat_frames = 0
                    last_cpu = time.process_time()
                    last_wall = wall

                next_frame += 1.0 / fps
                delay = next_frame - time.monotonic()
                if delay > 0:
                    self._stop.wait(delay)
                else:
                    next_frame = time.monotonic()
        except Exception as exc:  # noqa: BLE001
            with self._lock:
                self._error = str(exc)
        finally:
            self._restore()
            with self._lock:
                self._running = False
                self._thread = None
                self._last_frame = b""
                self._ripples = []
                self._pressed.clear()

    def _restore(self) -> None:
        with self._lock:
            if self._restored:
                return
            self._restored = True
            light = self._original_light
            self._original_light = None
        try:
            self._send_frame(bytes(SYNC_FRAME_BYTES))
        except Exception:  # noqa: BLE001
            pass
        if light:
            try:
                self._set_light(
                    light.get("mode", "LightAlwaysOn"),
                    int(light.get("brightness", 4)),
                    int(light.get("speed", 2)),
                    int(light.get("rgb", 0xFFFFFF)),
                    bool(light.get("dazzle", False)),
                    int(light.get("option", 0)),
                )
            except Exception:  # noqa: BLE001
                pass

    def status(self) -> dict[str, Any]:
        with self._lock:
            frame = base64.b64encode(self._last_frame).decode("ascii") if self._last_frame else ""
            return {
                "running": self._running,
                "colorMode": self._color_mode,
                "color": "#{:02X}{:02X}{:02X}".format(*self._color),
                "expansion": round(self._expansion, 2),
                "lifetime": round(self._lifetime, 2),
                "thickness": round(self._thickness, 2),
                "maxRadius": round(self._max_radius, 1),
                "fps": self._fps,
                "includeModifiers": self._include_modifiers,
                "keys": self._keys_count,
                "activeRipples": len(self._ripples),
                "frames": self._frames,
                "sendMs": round(self._send_ms, 1),
                "estimatedCpu": round(self._cpu, 1),
                "memoryMB": round(process_memory_mb(), 1),
                "error": self._error,
                "frame": frame,
            }
