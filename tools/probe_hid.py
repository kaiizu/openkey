"""Enumerate HID interfaces and show the ones belonging to the keyboard.

Pure ctypes, no third-party packages. Run:  python probe_hid.py
"""
import ctypes
from ctypes import wintypes

# ---------- SetupAPI / hid.dll ----------
setupapi = ctypes.WinDLL("setupapi", use_last_error=True)
hid = ctypes.WinDLL("hid", use_last_error=True)
kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

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
    _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]


class SP_DEVICE_INTERFACE_DATA(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD),
                ("InterfaceClassGuid", GUID),
                ("Flags", wintypes.DWORD),
                ("Reserved", ctypes.POINTER(wintypes.ULONG))]


class SP_DEVICE_INTERFACE_DETAIL_DATA_W(ctypes.Structure):
    _fields_ = [("cbSize", wintypes.DWORD), ("DevicePath", wintypes.WCHAR * 1)]


class HIDD_ATTRIBUTES(ctypes.Structure):
    _fields_ = [("Size", wintypes.ULONG), ("VendorID", wintypes.USHORT),
                ("ProductID", wintypes.USHORT), ("VersionNumber", wintypes.USHORT)]


class HIDP_CAPS(ctypes.Structure):
    _fields_ = [
        ("Usage", wintypes.USHORT), ("UsagePage", wintypes.USHORT),
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


def guid_from_string(s):
    g = GUID()
    ctypes.windll.ole32.CLSIDFromString(ctypes.c_wchar_p(s), ctypes.byref(g))
    return g


setupapi.SetupDiGetClassDevsW.restype = wintypes.HANDLE
setupapi.SetupDiGetClassDevsW.argtypes = [ctypes.POINTER(GUID), wintypes.LPCWSTR,
                                         wintypes.HWND, wintypes.DWORD]
setupapi.SetupDiEnumDeviceInterfaces.argtypes = [wintypes.HANDLE, ctypes.c_void_p,
                                                 ctypes.POINTER(GUID), wintypes.DWORD,
                                                 ctypes.POINTER(SP_DEVICE_INTERFACE_DATA)]
setupapi.SetupDiGetDeviceInterfaceDetailW.argtypes = [wintypes.HANDLE,
                                                     ctypes.POINTER(SP_DEVICE_INTERFACE_DATA),
                                                     ctypes.POINTER(SP_DEVICE_INTERFACE_DETAIL_DATA_W),
                                                     wintypes.DWORD, ctypes.POINTER(wintypes.DWORD),
                                                     ctypes.c_void_p]
setupapi.SetupDiDestroyDeviceInfoList.argtypes = [wintypes.HANDLE]

hid.HidD_GetAttributes.argtypes = [wintypes.HANDLE, ctypes.POINTER(HIDD_ATTRIBUTES)]
hid.HidD_GetPreparsedData.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_void_p)]
hid.HidD_FreePreparsedData.argtypes = [ctypes.c_void_p]
hid.HidP_GetCaps.argtypes = [ctypes.c_void_p, ctypes.POINTER(HIDP_CAPS)]
hid.HidD_GetProductString.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]
hid.HidD_GetManufacturerString.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]

kernel32.CreateFileW.restype = wintypes.HANDLE
kernel32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                 ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD,
                                 wintypes.HANDLE]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]

hid.HidD_GetFeature.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]
hid.HidD_SetFeature.argtypes = [wintypes.HANDLE, ctypes.c_void_p, wintypes.ULONG]


def get_string(fn, handle):
    buf = ctypes.create_unicode_buffer(256)
    if fn(handle, buf, ctypes.sizeof(buf)):
        return buf.value
    return ""


def enum_hid():
    g = guid_from_string(GUID_DEVINTERFACE_HID)
    info = setupapi.SetupDiGetClassDevsW(ctypes.byref(g), None, None,
                                         DIGCF_PRESENT | DIGCF_DEVICEINTERFACE)
    if info == INVALID_HANDLE_VALUE:
        raise ctypes.WinError(ctypes.get_last_error())
    did = SP_DEVICE_INTERFACE_DATA()
    did.cbSize = ctypes.sizeof(did)
    idx = 0
    try:
        while setupapi.SetupDiEnumDeviceInterfaces(info, None, ctypes.byref(g), idx,
                                                  ctypes.byref(did)):
            idx += 1
            need = wintypes.DWORD()
            setupapi.SetupDiGetDeviceInterfaceDetailW(info, ctypes.byref(did), None, 0,
                                                      ctypes.byref(need), None)
            raw = ctypes.create_string_buffer(need.value)
            detail = ctypes.cast(raw, ctypes.POINTER(SP_DEVICE_INTERFACE_DETAIL_DATA_W))
            detail.contents.cbSize = ctypes.sizeof(SP_DEVICE_INTERFACE_DETAIL_DATA_W)
            if not setupapi.SetupDiGetDeviceInterfaceDetailW(
                    info, ctypes.byref(did), detail, need.value, ctypes.byref(need), None):
                continue
            # DevicePath is a variable-length WCHAR array starting at offset 4.
            path = ctypes.wstring_at(ctypes.addressof(raw) + 4)
            h = kernel32.CreateFileW(path, 0, FILE_SHARE_READ | FILE_SHARE_WRITE,
                                     None, OPEN_EXISTING, 0, None)
            if h == INVALID_HANDLE_VALUE:
                continue
            try:
                attrs = HIDD_ATTRIBUTES()
                attrs.Size = ctypes.sizeof(attrs)
                if not hid.HidD_GetAttributes(h, ctypes.byref(attrs)):
                    continue
                pp = ctypes.c_void_p()
                caps = HIDP_CAPS()
                if hid.HidD_GetPreparsedData(h, ctypes.byref(pp)):
                    hid.HidP_GetCaps(pp, ctypes.byref(caps))
                    hid.HidD_FreePreparsedData(pp)
                yield {
                    "path": path,
                    "vid": attrs.VendorID, "pid": attrs.ProductID,
                    "version": attrs.VersionNumber,
                    "product": get_string(hid.HidD_GetProductString, h),
                    "manufacturer": get_string(hid.HidD_GetManufacturerString, h),
                    "usage": caps.Usage, "usage_page": caps.UsagePage,
                    "in_len": caps.InputReportByteLength,
                    "out_len": caps.OutputReportByteLength,
                    "feat_len": caps.FeatureReportByteLength,
                    "handle": h,
                }
            finally:
                kernel32.CloseHandle(h)
    finally:
        setupapi.SetupDiDestroyDeviceInfoList(info)


if __name__ == "__main__":
    for d in enum_hid():
        if d["vid"] == 0x3151:
            print(f'VID={d["vid"]:04x} PID={d["pid"]:04x} usage_page={d["usage_page"]:04x} '
                  f'usage={d["usage"]:04x} in={d["in_len"]} out={d["out_len"]} '
                  f'feat={d["feat_len"]} ver={d["version"]:#06x}')
            print(f'  product={d["product"]!r} manufacturer={d["manufacturer"]!r}')
            print(f'  path={d["path"]}')
