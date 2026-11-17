"""Tiny Windows HID layer using ctypes only.

No third-party packages. The keyboard exposes a vendor HID collection
(usage page 0xFFFF, usage 2) with a 64-byte feature report (report ID 0).
"""
from __future__ import annotations

import ctypes
import time
from ctypes import wintypes
from dataclasses import dataclass
from typing import Iterator

setupapi = ctypes.WinDLL("setupapi", use_last_error=True)
hid = ctypes.WinDLL("hid", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
ole32 = ctypes.WinDLL("ole32", use_last_error=True)

GUID_DEVINTERFACE_HID = "{4D1E55B2-F16F-11CF-88CB-001111000030}"

DIGCF_PRESENT = 0x02
DIGCF_DEVICEINTERFACE = 0x10
INVALID_HANDLE_VALUE = wintypes.HANDLE(-1).value
FILE_SHARE_READ = 0x01
FILE_SHARE_WRITE = 0x02
OPEN_EXISTING = 3
GENERIC_READ = 0x80000000
GENERIC_WRITE = 0x40000000


class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", ctypes.c_ubyte * 8),
    ]


class SP_DEVICE_INTERFACE_DATA(ctypes.Structure):
    _fields_ = [
        ("cbSize", wintypes.DWORD),
        ("InterfaceClassGuid", GUID),
        ("Flags", wintypes.DWORD),
        ("Reserved", ctypes.POINTER(wintypes.ULONG)),
    ]


class SP_DEVICE_INTERFACE_DETAIL_DATA_W(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD), ("DevicePath", wintypes.WCHAR * 1)]


class HIDD_ATTRIBUTES(ctypes.Structure):
    _fields_ = [
        ("Size", wintypes.ULONG),
        ("VendorID", wintypes.USHORT),
        ("ProductID", wintypes.USHORT),
        ("VersionNumber", wintypes.USHORT),
    ]


class HIDP_CAPS(ctypes.Structure):
    _fields_ = [
        ("Usage", wintypes.USHORT),
        ("UsagePage", wintypes.USHORT),
        ("InputReportByteLength", wintypes.USHORT),
        ("OutputReportByteLength", wintypes.USHORT),
        ("FeatureReportByteLength", wintypes.USHORT),
        ("Reserved", wintypes.USHORT * 17),
        ("NumberLinkCollectionNodes", wintypes.USHORT),
        ("NumberInputButtonCaps", wintypes.USHORT),
        ("NumberInputValueCaps", wintypes.USHORT),
        ("NumberInputDataIndices", wintypes.USHORT),
        ("NumberOutputButtonCaps", wintypes.USHORT),
        ("NumberOutputValueCaps", wintypes.USHORT),
        ("NumberOutputDataIndices", wintypes.USHORT),
        ("NumberFeatureButtonCaps", wintypes.USHORT),
        ("NumberFeatureValueCaps", wintypes.USHORT),
        ("NumberFeatureDataIndices", wintypes.USHORT),
    ]


def _guid_from_string(value: str) -> GUID:
    g = GUID()
    ole32.CLSIDFromString(ctypes.c_wchar_p(value), ctypes.byref(g))
    return g


setupapi.SetupDiGetClassDevsW.restype = wintypes.HANDLE
setupapi.SetupDiGetClassDevsW.argtypes = [
    ctypes.POINTER(GUID), wintypes.LPCWSTR, wintypes.HWND, wintypes.DWORD]
setupapi.SetupDiEnumDeviceInterfaces.argtypes = [
    wintypes.HANDLE, ctypes.c_void_p, ctypes.POINTER(GUID), wintypes.DWORD,
    ctypes.POINTER(SP_DEVICE_INTERFACE_DATA)]
setupapi.SetupDiGetDeviceInterfaceDetailW.argtypes = [
    wintypes.HANDLE, ctypes.POINTER(SP_DEVICE_INTERFACE_DATA),
    ctypes.POINTER(SP_DEVICE_INTERFACE_DETAIL_DATA_W), wintypes.DWORD,
    ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p]
setupapi.SetupDiDestroyDeviceInfoList.argtypes = [wintypes.HANDLE]

hid.HidD_GetAttributes.argtypes = [wintypes.HANDLE, ctypes.POINTER(HIDD_ATTRIBUTES)]
hid.HidD_GetPreparsedData.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_void_p)]
hid.HidD_FreePreparsedData.argtypes = [ctypes.c_void_p]
hid.HidP_GetCaps.argtypes = [ctypes.c_void_p, ctypes.POINTER(HIDP_CAPS)]
hid.HidD_GetProductString.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]
hid.HidD_GetManufacturerString.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]
hid.HidD_GetFeature.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]
hid.HidD_SetFeature.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]

kernel32.CreateFileW.restype = wintypes.HANDLE
kernel32.CreateFileW.argtypes = [
    wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.c_void_p,
    wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]


def _get_string(fn, handle) -> str:
    buf = ctypes.create_unicode_buffer(256)
    if fn(handle, buf, ctypes.sizeof(buf)):
        return buf.value
    return ""


@dataclass(frozen=True)
class HidDeviceInfo:
    path: str
    vid: int
    pid: int
    version: int
    product: str
    manufacturer: str
    usage: int
    usage_page: int
    input_len: int
    output_len: int
    feature_len: int


def enumerate_hid() -> Iterator[HidDeviceInfo]:
    g = _guid_from_string(GUID_DEVINTERFACE_HID)
    info = setupapi.SetupDiGetClassDevsW(
        ctypes.byref(g), None, None, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE)
    if info == INVALID_HANDLE_VALUE:
        raise ctypes.WinError(ctypes.get_last_error())
    did = SP_DEVICE_INTERFACE_DATA()
    did.cbSize = ctypes.sizeof(did)
    idx = 0
    try:
        while setupapi.SetupDiEnumDeviceInterfaces(
                info, None, ctypes.byref(g), idx, ctypes.byref(did)):
            idx += 1
            need = wintypes.DWORD()
            setupapi.SetupDiGetDeviceInterfaceDetailW(
                info, ctypes.byref(did), None, 0, ctypes.byref(need), None)
            if not need.value:
                continue
            raw = ctypes.create_string_buffer(need.value)
            detail = ctypes.cast(raw, ctypes.POINTER(SP_DEVICE_INTERFACE_DETAIL_DATA_W))
            detail.contents.cbSize = ctypes.sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W)
            if not setupapi.SetupDiGetDeviceInterfaceDetailW(
                    info, ctypes.byref(did), detail, need.value, ctypes.byref(need), None):
                continue
            path = ctypes.wstring_at(ctypes.addressof(raw) + 4)
            h = kernel32.CreateFileW(
                path, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, None, OPEN_EXISTING, 0, None)
            if h == INVALID_HANDLE_VALUE:
                continue
            try:
                attrs = HIDD_ATTRIBUTES()
                attrs.Size = ctypes.sizeof(attrs)
                if not hid.HidD_GetAttributes(h, ctypes.byref(attrs)):
                    continue
                caps = HIDP_CAPS()
                pp = ctypes.c_void_p()
                if hid.HidD_GetPreparsedData(h, ctypes.byref(pp)):
                    hid.HidP_GetCaps(pp, ctypes.byref(caps))
                    hid.HidD_FreePreparsedData(pp)
                yield HidDeviceInfo(
                    path=path,
                    vid=attrs.VendorID,
                    pid=attrs.ProductID,
                    version=attrs.VersionNumber,
                    product=_get_string(hid.HidD_GetProductString, h),
                    manufacturer=_get_string(hid.HidD_GetManufacturerString, h),
                    usage=caps.Usage,
                    usage_page=caps.UsagePage,
                    input_len=caps.InputReportByteLength,
                    output_len=caps.OutputReportByteLength,
                    feature_len=caps.FeatureReportByteLength,
                )
            finally:
                kernel32.CloseHandle(h)
    finally:
        setupapi.SetupDiDestroyDeviceInfoList(info)


# Known Attack Shark / YC3123 family IDs.
ATTACK_SHARK_VID = 0x3151
AK820_PID = 0x5002


def find_keyboard() -> HidDeviceInfo | None:
    devices = list(enumerate_hid())
    candidates = [d for d in devices if d.vid == ATTACK_SHARK_VID]
    # The wired X820 Ultra exposes a vendor collection with a 64-byte feature report.
    for d in candidates:
        if d.pid == AK820_PID and d.usage_page == 0xFFFF and d.usage == 2:
            return d
    # Some firmware revisions keep the same collection but expose another PID.
    for d in candidates:
        if ("X820" in d.product or "AK820" in d.product) and d.feature_len >= 9:
            return d
    return None


class HidError(RuntimeError):
    pass


class HidDevice:
    def __init__(self, info: HidDeviceInfo):
        self.info = info
        self._handle = kernel32.CreateFileW(
            info.path, GENERIC_READ | GENERIC_WRITE,
            FILE_SHARE_READ | FILE_SHARE_WRITE, None, OPEN_EXISTING, 0, None)
        if self._handle == INVALID_HANDLE_VALUE:
            err = ctypes.get_last_error()
            raise HidError(
                f"No se pudo abrir el teclado (error {err}). "
                "Cierra la app oficial si la tienes abierta y reconecta el teclado.")

    def close(self) -> None:
        if self._handle and self._handle != INVALID_HANDLE_VALUE:
            kernel32.CloseHandle(self._handle)
            self._handle = None

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def get_feature(self, length: int = 65) -> bytes:
        length = max(length, self.info.feature_len or 65)
        buf = (ctypes.c_ubyte * length)()
        buf[0] = 0
        if not hid.HidD_GetFeature(self._handle, buf, length):
            raise HidError(f"HidD_GetFeature falló (error {ctypes.get_last_error()})")
        return bytes(buf[1:length])

    def set_feature(self, data: bytes, length: int = 65) -> None:
        length = max(length, self.info.feature_len or 65)
        buf = (ctypes.c_ubyte * length)()
        buf[0] = 0
        for i, b in enumerate(data[:length - 1]):
            buf[i + 1] = b
        if not hid.HidD_SetFeature(self._handle, buf, length):
            raise HidError(f"HidD_SetFeature falló (error {ctypes.get_last_error()})")


def sleep_ms(ms: float) -> None:
    time.sleep(ms / 1000.0)
