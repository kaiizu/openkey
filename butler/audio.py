"""WASAPI loopback capture and 21x6 RGB frames for the 0x0F music-sync mode.

The module is intentionally dependency-free: COM and the Core Audio interfaces
are accessed through ctypes, and the FFT is a small radix-2 implementation.
Nothing here runs until MusicSync.start() is called.
"""
from __future__ import annotations

import array
import base64
import ctypes
import math
import threading
import time
import uuid
from collections import deque
from ctypes import POINTER, Structure, byref, c_ubyte, c_void_p, wintypes

SYNC_COLS = 21
SYNC_ROWS = 6
SYNC_FRAME_BYTES = SYNC_COLS * SYNC_ROWS * 3
DEFAULT_FPS = 20
DEFAULT_GAIN = 10.0
DEFAULT_COLOR = (0, 255, 255)


class AudioError(RuntimeError):
    """Raised when loopback capture or the sync thread cannot start."""


# --------------------------------------------------------------- COM helpers
_HRESULT = ctypes.c_long
_ole32 = ctypes.WinDLL("ole32", use_last_error=True)
_ole32.CoInitializeEx.argtypes = [c_void_p, wintypes.DWORD]
_ole32.CoInitializeEx.restype = _HRESULT
_ole32.CoCreateInstance.argtypes = [POINTER(ctypes.c_ubyte), c_void_p, wintypes.DWORD,
                                    POINTER(ctypes.c_ubyte), POINTER(c_void_p)]
_ole32.CoCreateInstance.restype = _HRESULT
_ole32.CoTaskMemFree.argtypes = [c_void_p]
_ole32.CoTaskMemFree.restype = None
_ole32.CoUninitialize.argtypes = []
_ole32.CoUninitialize.restype = None

CLSCTX_ALL = 23
COINIT_MULTITHREADED = 0
RPC_E_CHANGED_MODE = -2147417850
AUDCLNT_SHAREMODE_SHARED = 0
AUDCLNT_STREAMFLAGS_LOOPBACK = 0x00020000
AUDCLNT_BUFFERFLAGS_SILENT = 0x2


class GUID(Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", c_ubyte * 8),
    ]


def _guid(text: str) -> GUID:
    return GUID.from_buffer_copy(uuid.UUID(text).bytes_le)


CLSID_MMDeviceEnumerator = _guid("BCDE0395-E52F-467C-8E3D-C4579291692E")
IID_IMMDeviceEnumerator = _guid("A95664D2-9614-4F35-A746-DE8DB63617E6")
IID_IAudioClient = _guid("1CB9AD4C-DBFA-4c32-B178-C2F568A703B2")
IID_IAudioCaptureClient = _guid("C8ADBD64-E71E-48a0-A4DE-185C395CD317")
KSDATAFORMAT_SUBTYPE_IEEE_FLOAT = _guid("00000003-0000-0010-8000-00AA00389B71")
KSDATAFORMAT_SUBTYPE_PCM = _guid("00000001-0000-0010-8000-00AA00389B71")


class WAVEFORMATEX(Structure):
    _pack_ = 1
    _fields_ = [
        ("wFormatTag", wintypes.WORD),
        ("nChannels", wintypes.WORD),
        ("nSamplesPerSec", wintypes.DWORD),
        ("nAvgBytesPerSec", wintypes.DWORD),
        ("nBlockAlign", wintypes.WORD),
        ("wBitsPerSample", wintypes.WORD),
        ("cbSize", wintypes.WORD),
    ]


class WAVEFORMATEXTENSIBLE(Structure):
    _pack_ = 1
    _fields_ = [
        ("Format", WAVEFORMATEX),
        ("wValidBitsPerSample", wintypes.WORD),
        ("dwChannelMask", wintypes.DWORD),
        ("SubFormat", GUID),
    ]


def _method(ptr, index: int, restype, *argtypes):
    """Build a stdcall callable for one COM vtable slot."""
    vtable = ctypes.cast(ptr, POINTER(POINTER(c_void_p)))[0]
    return ctypes.WINFUNCTYPE(restype, c_void_p, *argtypes)(vtable[index])


def _check(hr: int, what: str) -> None:
    if hr < 0:
        raise AudioError(f"{what} falló (HRESULT 0x{hr & 0xFFFFFFFF:08X})")


def _release(ptr) -> None:
    if ptr:
        _method(ptr, 2, _HRESULT)(ptr)


# --------------------------------------------------------------- loopback
class LoopbackCapture:
    """Default Windows output device captured in shared loopback mode."""

    def __init__(self):
        self._ole_initialized = False
        self._enumerator = c_void_p()
        self._device = c_void_p()
        self._client = c_void_p()
        self._capture = c_void_p()
        self.sample_rate = 0
        self.channels = 0
        self.block_align = 0
        self.sample_format = ""
        self.format_label = ""
        self._open()

    def _open(self) -> None:
        hr = _ole32.CoInitializeEx(None, COINIT_MULTITHREADED)
        if hr in (0, 1):
            self._ole_initialized = True
        elif hr != RPC_E_CHANGED_MODE:
            _check(hr, "CoInitializeEx")
        try:
            _check(_ole32.CoCreateInstance(
                ctypes.cast(byref(CLSID_MMDeviceEnumerator), POINTER(ctypes.c_ubyte)),
                None, CLSCTX_ALL,
                ctypes.cast(byref(IID_IMMDeviceEnumerator), POINTER(ctypes.c_ubyte)),
                byref(self._enumerator)), "CoCreateInstance")

            get_default = _method(self._enumerator, 4, _HRESULT, ctypes.c_int,
                                  ctypes.c_int, POINTER(c_void_p))
            _check(get_default(self._enumerator, 0, 0, byref(self._device)),
                   "GetDefaultAudioEndpoint")

            activate = _method(self._device, 3, _HRESULT, POINTER(ctypes.c_ubyte),
                               wintypes.DWORD, c_void_p, POINTER(c_void_p))
            _check(activate(self._device,
                            ctypes.cast(byref(IID_IAudioClient), POINTER(ctypes.c_ubyte)),
                            CLSCTX_ALL, None, byref(self._client)),
                   "IMMDevice::Activate")

            mix_format = c_void_p()
            get_mix = _method(self._client, 8, _HRESULT, POINTER(c_void_p))
            _check(get_mix(self._client, byref(mix_format)), "GetMixFormat")
            try:
                self._parse_format(mix_format)
                initialize = _method(
                    self._client, 3, _HRESULT, ctypes.c_int, wintypes.DWORD,
                    ctypes.c_int64, ctypes.c_int64, c_void_p, c_void_p)
                _check(initialize(self._client, AUDCLNT_SHAREMODE_SHARED,
                                  AUDCLNT_STREAMFLAGS_LOOPBACK,
                                  10_000_000, 0, mix_format, None),
                       "IAudioClient::Initialize")
            finally:
                _ole32.CoTaskMemFree(mix_format)

            get_service = _method(self._client, 14, _HRESULT, POINTER(ctypes.c_ubyte),
                                  POINTER(c_void_p))
            _check(get_service(
                self._client,
                ctypes.cast(byref(IID_IAudioCaptureClient), POINTER(ctypes.c_ubyte)),
                byref(self._capture)), "GetService(IAudioCaptureClient)")

            start = _method(self._client, 10, _HRESULT)
            _check(start(self._client), "IAudioClient::Start")
        except Exception:
            self.close()
            raise

    def _parse_format(self, mix_format: c_void_p) -> None:
        fmt = ctypes.cast(mix_format, POINTER(WAVEFORMATEX)).contents
        tag = int(fmt.wFormatTag)
        bits = int(fmt.wBitsPerSample)
        self.sample_rate = int(fmt.nSamplesPerSec)
        self.channels = int(fmt.nChannels)
        self.block_align = int(fmt.nBlockAlign)

        if tag == 0xFFFE:
            ext = ctypes.cast(mix_format, POINTER(WAVEFORMATEXTENSIBLE)).contents
            sub = ctypes.string_at(byref(ext.SubFormat), ctypes.sizeof(GUID))
            if ext.wValidBitsPerSample:
                bits = int(ext.wValidBitsPerSample)
            if sub == bytes(KSDATAFORMAT_SUBTYPE_IEEE_FLOAT):
                tag = 3
            elif sub == bytes(KSDATAFORMAT_SUBTYPE_PCM):
                tag = 1
            else:
                expected_float = bytes(KSDATAFORMAT_SUBTYPE_IEEE_FLOAT).hex()
                expected_pcm = bytes(KSDATAFORMAT_SUBTYPE_PCM).hex()
                raise AudioError(
                    "El dispositivo usa un formato de audio no soportado "
                    f"(subformat={sub.hex()}, float={expected_float}, pcm={expected_pcm}, "
                    f"bits={bits})")

        if tag == 3 and bits == 32:
            self.sample_format = "float32"
        elif tag == 1 and bits == 16:
            self.sample_format = "pcm16"
        elif tag == 1 and bits == 24:
            self.sample_format = "pcm24"
        elif tag == 1 and bits == 32:
            self.sample_format = "pcm32"
        else:
            raise AudioError(f"Formato de audio no soportado (tag={tag}, bits={bits})")

        self.format_label = (f"{self.sample_rate} Hz · {self.channels} canales · "
                             f"{self.sample_format}")

    def _to_mono(self, raw: bytes) -> list[float]:
        if self.sample_format == "float32":
            values = array.array("f")
            values.frombytes(raw)
            scale = 1.0
        elif self.sample_format == "pcm16":
            values = array.array("h")
            values.frombytes(raw)
            scale = 1.0 / 32768.0
        elif self.sample_format == "pcm32":
            values = array.array("i")
            values.frombytes(raw)
            scale = 1.0 / 2147483648.0
        else:  # pcm24
            values = []
            for i in range(0, len(raw), 3):
                v = raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16)
                if v & 0x800000:
                    v -= 1 << 24
                values.append(v / 8388608.0)
            scale = 1.0

        channels = self.channels
        if channels <= 1:
            return [float(v) * scale for v in values]
        if channels == 2:
            return [(float(values[i]) + float(values[i + 1])) * 0.5 * scale
                    for i in range(0, len(values) - 1, 2)]
        out = []
        for i in range(0, len(values) - channels + 1, channels):
            out.append(sum(float(v) for v in values[i:i + channels]) / channels * scale)
        return out

    def read(self) -> list[float]:
        """Drain all available loopback packets and return mono float samples."""
        if not self._capture:
            return []
        samples: list[float] = []
        packet = wintypes.UINT()
        next_packet = _method(self._capture, 5, _HRESULT, POINTER(wintypes.UINT))
        _check(next_packet(self._capture, byref(packet)), "GetNextPacketSize")
        while packet.value:
            data = POINTER(c_ubyte)()
            frames = wintypes.UINT()
            flags = wintypes.DWORD()
            device_pos = ctypes.c_uint64()
            qpc_pos = ctypes.c_uint64()
            get_buffer = _method(
                self._capture, 3, _HRESULT, POINTER(POINTER(c_ubyte)),
                POINTER(wintypes.UINT), POINTER(wintypes.DWORD),
                POINTER(ctypes.c_uint64), POINTER(ctypes.c_uint64))
            _check(get_buffer(self._capture, byref(data), byref(frames), byref(flags),
                              byref(device_pos), byref(qpc_pos)), "GetBuffer")
            try:
                if flags.value & AUDCLNT_BUFFERFLAGS_SILENT or not data:
                    samples.extend([0.0] * int(frames.value))
                else:
                    raw = ctypes.string_at(data, int(frames.value) * self.block_align)
                    samples.extend(self._to_mono(raw))
            finally:
                release = _method(self._capture, 4, _HRESULT, wintypes.UINT)
                _check(release(self._capture, frames.value), "ReleaseBuffer")
            _check(next_packet(self._capture, byref(packet)), "GetNextPacketSize")
        return samples

    def close(self) -> None:
        if self._client:
            try:
                stop = _method(self._client, 11, _HRESULT)
                stop(self._client)
            except Exception:
                pass
        for name in ("_capture", "_client", "_device", "_enumerator"):
            ptr = getattr(self, name)
            if ptr:
                try:
                    _release(ptr)
                finally:
                    setattr(self, name, c_void_p())
        if self._ole_initialized:
            _ole32.CoUninitialize()
            self._ole_initialized = False

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


# ------------------------------------------------------------------- FFT
_TWIDDLE_CACHE: dict[int, list[tuple[int, list[complex]]]] = {}


def _twiddles(n: int) -> list[tuple[int, list[complex]]]:
    cached = _TWIDDLE_CACHE.get(n)
    if cached is not None:
        return cached
    stages: list[tuple[int, list[complex]]] = []
    length = 2
    while length <= n:
        half = length // 2
        step = complex(math.cos(-2.0 * math.pi / length),
                       math.sin(-2.0 * math.pi / length))
        values = [1 + 0j]
        for _ in range(1, half):
            values.append(values[-1] * step)
        stages.append((half, values))
        length <<= 1
    _TWIDDLE_CACHE[n] = stages
    return stages


def _fft(values: list[complex]) -> list[complex]:
    n = len(values)
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            values[i], values[j] = values[j], values[i]
    for half, twiddles in _twiddles(n):
        length = half * 2
        for start in range(0, n, length):
            for k in range(half):
                left = values[start + k]
                right = values[start + k + half] * twiddles[k]
                values[start + k] = left + right
                values[start + k + half] = left - right
    return values


class Spectrum:
    """Turn mono samples into a smoothed 21x6 bar visualization."""

    def __init__(self, sample_rate: int, size: int = 1024):
        self.sample_rate = max(8000, int(sample_rate))
        self.size = size
        self._buffer: deque[float] = deque(maxlen=size)
        self._levels = [0.0] * SYNC_COLS
        self._window = [0.5 - 0.5 * math.cos(2.0 * math.pi * i / (size - 1))
                        for i in range(size)]
        self._bands = self._make_bands()

    def _make_bands(self) -> list[tuple[int, int]]:
        nyquist = self.sample_rate / 2.0
        high = min(16000.0, nyquist * 0.95)
        low = min(40.0, high / 2.0)
        ratio = (high / low) ** (1.0 / SYNC_COLS)
        bands = []
        previous = 1
        for column in range(SYNC_COLS):
            start_hz = low * (ratio ** column)
            end_hz = low * (ratio ** (column + 1))
            start = max(previous, int(start_hz * self.size / self.sample_rate))
            end = max(start + 1, int(end_hz * self.size / self.sample_rate))
            end = min(end, self.size // 2)
            bands.append((start, end))
            previous = start
        return bands

    def push(self, samples: list[float]) -> None:
        if samples:
            self._buffer.extend(samples)

    def frame(self, gain: float = DEFAULT_GAIN, mode: str = "spectrum",
              color: tuple[int, int, int] = DEFAULT_COLOR) -> bytes:
        count = len(self._buffer)
        if count < self.size:
            samples = [0.0] * (self.size - count) + list(self._buffer)
        else:
            samples = list(self._buffer)
        values = [complex(samples[i] * self._window[i], 0.0) for i in range(self.size)]
        spectrum = _fft(values)
        for column, (start, end) in enumerate(self._bands):
            magnitude = (2.0 * sum(abs(spectrum[k]) for k in range(start, end))
                         / max(1, end - start) / self.size)
            db = 20.0 * math.log10(magnitude * gain + 1e-12)
            level = max(0.0, min(1.0, (db + 70.0) / 60.0))
            previous = self._levels[column]
            self._levels[column] = max(level, previous * 0.82)
        return self._build_frame(mode, color)

    def demo_frame(self, now: float, gain: float = DEFAULT_GAIN, mode: str = "spectrum",
                   color: tuple[int, int, int] = DEFAULT_COLOR) -> bytes:
        for column in range(SYNC_COLS):
            wave = 0.5 + 0.5 * math.sin(now * 3.2 + column * 0.55)
            beat = 0.35 + 0.65 * (0.5 + 0.5 * math.sin(now * 7.5 + column * 0.12))
            level = max(0.0, min(1.0, wave * beat * (gain / 10.0)))
            self._levels[column] = max(level, self._levels[column] * 0.82)
        return self._build_frame(mode, color)

    def _build_frame(self, mode: str, color: tuple[int, int, int]) -> bytes:
        frame = bytearray(SYNC_FRAME_BYTES)
        single = tuple(max(0, min(255, int(c))) for c in color)
        for column, level in enumerate(self._levels):
            height = int(round(level * SYNC_ROWS))
            if height <= 0:
                continue
            if mode == "solid":
                rgb = single
            else:
                hue = (column / SYNC_COLS) * 0.83
                red, green, blue = _hsv_to_rgb(hue, 1.0, 1.0)
                rgb = (red, green, blue)
            for row in range(SYNC_ROWS - height, SYNC_ROWS):
                offset = (row * SYNC_COLS + column) * 3
                frame[offset:offset + 3] = bytes(rgb)
        return bytes(frame)


def _hsv_to_rgb(h: float, s: float, v: float) -> tuple[int, int, int]:
    if s <= 0:
        value = int(round(v * 255))
        return value, value, value
    h = (h % 1.0) * 6.0
    sector = int(h)
    fraction = h - sector
    p = v * (1.0 - s)
    q = v * (1.0 - s * fraction)
    t = v * (1.0 - s * (1.0 - fraction))
    red, green, blue = [
        (v, t, p), (q, v, p), (p, v, t),
        (p, q, v), (t, p, v), (v, p, q),
    ][sector % 6]
    return (int(round(red * 255)), int(round(green * 255)), int(round(blue * 255)))


# ------------------------------------------------------------- process stats
class _PROCESS_MEMORY_COUNTERS(Structure):
    _fields_ = [
        ("cb", wintypes.DWORD),
        ("PageFaultCount", wintypes.DWORD),
        ("PeakWorkingSetSize", ctypes.c_size_t),
        ("WorkingSetSize", ctypes.c_size_t),
        ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPagedPoolUsage", ctypes.c_size_t),
        ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
        ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
        ("PagefileUsage", ctypes.c_size_t),
        ("PeakPagefileUsage", ctypes.c_size_t),
    ]


def process_memory_mb() -> float:
    try:
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        psapi = ctypes.WinDLL("psapi", use_last_error=True)
        counters = _PROCESS_MEMORY_COUNTERS()
        counters.cb = ctypes.sizeof(counters)
        psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE,
                                               POINTER(_PROCESS_MEMORY_COUNTERS),
                                               wintypes.DWORD]
        psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
        if psapi.GetProcessMemoryInfo(kernel32.GetCurrentProcess(), byref(counters),
                                      counters.cb):
            return counters.WorkingSetSize / (1024.0 * 1024.0)
    except Exception:
        pass
    return 0.0


# ------------------------------------------------------------------ manager
class MusicSync:
    """Owns the optional audio thread and the keyboard frame stream."""

    def __init__(self, send_frame, get_light, set_light):
        self._send_frame = send_frame
        self._get_light = get_light
        self._set_light = set_light
        self._lock = threading.RLock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self._running = False
        self._source = "audio"
        self._fps = DEFAULT_FPS
        self._gain = DEFAULT_GAIN
        self._mode = "spectrum"
        self._color = DEFAULT_COLOR
        self._frames = 0
        self._cpu = 0.0
        self._read_ms = 0.0
        self._frame_ms = 0.0
        self._send_ms = 0.0
        self._error: str | None = None
        self._last_frame = b""
        self._last_seen = 0.0
        self._original_light: dict | None = None
        self._format = ""
        self._restored = False

    def _config(self) -> tuple[float, str, tuple[int, int, int], int]:
        with self._lock:
            return self._gain, self._mode, self._color, self._fps

    def touch(self) -> None:
        self._last_seen = time.monotonic()

    def start(self, source: str = "audio", gain: float = DEFAULT_GAIN,
              mode: str = "spectrum", color: tuple[int, int, int] = DEFAULT_COLOR,
              fps: int = DEFAULT_FPS) -> dict:
        with self._lock:
            if self._running:
                return self.status()
            if source not in ("audio", "demo"):
                raise ValueError("Fuente de música no válida")
            if mode not in ("spectrum", "solid"):
                raise ValueError("Modo de color no válido")
            self._gain = max(0.5, min(40.0, float(gain)))
            self._mode = mode
            self._color = tuple(max(0, min(255, int(c))) for c in color)
            self._fps = max(8, min(60, int(fps)))
            self._source = source
            self._error = None
            self._frames = 0
            self._cpu = 0.0
            self._read_ms = 0.0
            self._frame_ms = 0.0
            self._send_ms = 0.0
            self._last_frame = b""
            self._format = ""
            self._restored = False
            self._original_light = self._get_light()
            if not self._original_light:
                raise AudioError("No se pudo leer la iluminación actual del teclado")
            light = self._original_light
            try:
                self._set_light("LightAlwaysOn", max(1, int(light.get("brightness", 4))),
                                int(light.get("speed", 2)), int(light.get("rgb", 0xFFFFFF)),
                                bool(light.get("dazzle", False)), int(light.get("option", 0)))
            except Exception:
                self._restore()
                raise
            self._stop.clear()
            self._last_seen = time.monotonic()
            self._running = True
            self._thread = threading.Thread(target=self._run, name="OpenKEY music sync",
                                            daemon=True)
            self._thread.start()
            return self.status()

    def stop(self) -> dict:
        with self._lock:
            thread = self._thread
            was_running = self._running
            self._stop.set()
        if thread is not None and thread is not threading.current_thread():
            thread.join(timeout=3.0)
        elif not was_running:
            self._restore()
        return self.status()

    def configure(self, gain: float | None = None, mode: str | None = None,
                  color=None, fps: int | None = None) -> dict:
        with self._lock:
            if gain is not None:
                self._gain = max(0.5, min(40.0, float(gain)))
            if mode is not None:
                if mode not in ("spectrum", "solid"):
                    raise ValueError("Modo de color no válido")
                self._mode = mode
            if color is not None:
                self._color = tuple(max(0, min(255, int(c))) for c in color)
            if fps is not None:
                self._fps = max(8, min(60, int(fps)))
        return self.status()

    def _run(self) -> None:
        capture: LoopbackCapture | None = None
        try:
            if self._source == "audio":
                capture = LoopbackCapture()
                self._format = capture.format_label
                spectrum = Spectrum(capture.sample_rate)
            else:
                spectrum = Spectrum(48000)
                self._format = "Demostración · 48 kHz sintéticos"

            last_cpu = time.process_time()
            last_wall = time.monotonic()
            next_frame = last_wall
            read_acc = frame_acc = send_acc = 0.0
            stat_frames = 0
            while not self._stop.is_set():
                if self._last_seen and time.monotonic() - self._last_seen > 300.0:
                    raise AudioError("La interfaz dejó de responder; sincronización detenida")
                started = time.perf_counter()
                if capture is not None:
                    samples = capture.read()
                    if samples:
                        spectrum.push(samples)
                after_read = time.perf_counter()
                gain, mode, color, fps = self._config()
                if capture is not None:
                    frame = spectrum.frame(gain, mode, color)
                else:
                    frame = spectrum.demo_frame(time.monotonic(), gain, mode, color)
                after_frame = time.perf_counter()
                self._send_frame(frame)
                after_send = time.perf_counter()
                read_acc += after_read - started
                frame_acc += after_frame - after_read
                send_acc += after_send - after_frame
                stat_frames += 1
                with self._lock:
                    self._frames += 1
                    self._last_frame = frame
                now = time.monotonic()
                if now - last_wall >= 2.0:
                    self._cpu = (time.process_time() - last_cpu) / (now - last_wall) * 100.0
                    if stat_frames:
                        self._read_ms = read_acc / stat_frames * 1000.0
                        self._frame_ms = frame_acc / stat_frames * 1000.0
                        self._send_ms = send_acc / stat_frames * 1000.0
                    read_acc = frame_acc = send_acc = 0.0
                    stat_frames = 0
                    last_cpu = time.process_time()
                    last_wall = now
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
            if capture is not None:
                try:
                    capture.close()
                except Exception:
                    pass
            self._finish()

    def _finish(self) -> None:
        self._restore()
        with self._lock:
            self._running = False
            self._thread = None

    def _restore(self) -> None:
        with self._lock:
            if self._restored:
                return
            original = self._original_light
            self._restored = True
        if not original:
            return
        try:
            self._send_frame(bytes(SYNC_FRAME_BYTES))
        except Exception:
            pass
        try:
            self._set_light(original.get("mode", "LightAlwaysOn"),
                            int(original.get("brightness", 4)),
                            int(original.get("speed", 2)),
                            int(original.get("rgb", 0xFFFFFF)),
                            bool(original.get("dazzle", False)),
                            int(original.get("option", 0)))
        except Exception:
            pass

    def status(self) -> dict:
        with self._lock:
            frame = self._last_frame
            return {
                "running": self._running,
                "source": self._source,
                "fps": self._fps,
                "gain": self._gain,
                "mode": self._mode,
                "color": "#%02X%02X%02X" % self._color,
                "frames": self._frames,
                "cpu": round(self._cpu, 1),
                "readMs": round(self._read_ms, 2),
                "frameMs": round(self._frame_ms, 2),
                "sendMs": round(self._send_ms, 2),
                "estimatedCpu": round((self._read_ms + self._frame_ms + self._send_ms)
                                      * self._fps / 10.0, 1),
                "memoryMB": round(process_memory_mb(), 1),
                "format": self._format,
                "error": self._error,
                "frame": base64.b64encode(frame).decode("ascii") if frame else "",
            }
