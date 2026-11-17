"""Minimal YC3123 / Attack Shark AK820 Ultra HID protocol helper (read-only probe)."""
import ctypes
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import probe_hid as p

GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000

p.hid.HidD_GetFeature.argtypes = [p.wintypes.HANDLE, ctypes.c_void_p, p.wintypes.ULONG]
p.hid.HidD_SetFeature.argtypes = [p.wintypes.HANDLE, ctypes.c_void_p, p.wintypes.ULONG]
p.kernel32.CreateFileW.restype = p.wintypes.HANDLE


def find_path(vid=0x3151, pid=0x5002):
    for d in p.enum_hid():
        if d["vid"] == vid and d["pid"] == pid and d["usage_page"] == 0xFFFF and d["usage"] == 2:
            return d["path"]
    raise RuntimeError("vendor HID interface not found")


class Keyboard:
    def __init__(self, vid=0x3151, pid=0x5002):
        self.path = find_path(vid, pid)
        self.h = p.kernel32.CreateFileW(
            self.path, GENERIC_READ | GENERIC_WRITE,
            p.FILE_SHARE_READ | p.FILE_SHARE_WRITE, None, p.OPEN_EXISTING, 0, None)
        if self.h == p.INVALID_HANDLE_VALUE:
            raise ctypes.WinError(ctypes.get_last_error())

    def close(self):
        if self.h and self.h != p.INVALID_HANDLE_VALUE:
            p.kernel32.CloseHandle(self.h)
            self.h = None

    def send(self, cmd, bit=7, pad=64):
        data = bytearray(cmd)
        if len(data) < 9:
            data += bytes(9 - len(data))
        if bit == 7:
            data[7] = 255 - (sum(data[:7]) & 0xFF)
        elif bit == 8:
            data[8] = 255 - (sum(data[:8]) & 0xFF)
        data += bytes(pad - len(data))
        buf = (ctypes.c_ubyte * (pad + 1))()
        buf[0] = 0
        for i, b in enumerate(data):
            buf[i + 1] = b
        ok = p.hid.HidD_SetFeature(self.h, buf, pad + 1)
        if not ok:
            raise ctypes.WinError(ctypes.get_last_error())
        return True

    def read(self, timeout=0.0):
        if timeout:
            time.sleep(timeout)
        buf = (ctypes.c_ubyte * 65)()
        buf[0] = 0
        ok = p.hid.HidD_GetFeature(self.h, buf, 65)
        if not ok:
            raise ctypes.WinError(ctypes.get_last_error())
        return bytes(buf[1:])

    def cmd(self, cmd, bit=7, delay=0.02):
        self.send(cmd, bit)
        return self.read(delay)


def u16(b, off):
    return b[off] | (b[off + 1] << 8)


def u32(b, off):
    return b[off] | (b[off + 1] << 8) | (b[off + 2] << 16) | (b[off + 3] << 24)


if __name__ == "__main__":
    kb = Keyboard()
    print("path", kb.path)
    tests = {
        "USB version (0x8F)": [0x8F],
        "RF version (0x80)": [0x80],
        "profile (0x84)": [0x84],
        "report rate (0x83)": [0x83],
        "debounce (0x86)": [0x86],
        "light (0x87)": [0x87],
        "side light (0x88)": [0x88],
        "kb option (0x89)": [0x89],
        "sleep (0x91)": [0x91],
        "OLED/mled version (0xAD)": [0xAD],
        "ID (0x8F)": [0x8F],
    }
    for name, c in tests.items():
        try:
            r = kb.cmd(c)
            print(f"{name:28} -> {r[:24].hex(' ')}")
        except Exception as e:
            print(f"{name:28} -> ERROR {e}")
    kb.close()
