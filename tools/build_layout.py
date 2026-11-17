import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
keymap = json.loads((root / "data/keymap.json").read_text(encoding="utf-8"))
layout = json.loads((root / "data/layout.json").read_text(encoding="utf-8"))
default = json.loads((root / "data/default_matrix.json").read_text(encoding="utf-8"))["matrix"]

by_html = {}
for e in keymap:
    if e.get("htmlCode"):
        by_html.setdefault(e["htmlCode"], []).append(e)


def matrix_to_hid(g):
    if g[0] == 0 and g[1] == 0 and g[3] == 0:
        return g[2]
    return (g[0] << 24) | (g[1] << 16) | (g[2] << 8) | g[3]


slots = []
for i in range(0, len(default), 4):
    g = default[i:i + 4]
    slots.append({"index": i // 4, "group": g, "hid": matrix_to_hid(g)})

used = set()
keys = []
for code, geo in layout["layout"].items():
    entries = by_html.get(code, [])
    hid = entries[0]["hidCode"] if entries else None
    match = None
    if hid is not None:
        for s in slots:
            if s["hid"] == hid and s["index"] not in used:
                match = s
                break
    if match:
        used.add(match["index"])
    keys.append({
        "code": code,
        "label": (entries[0]["value"] if entries else code),
        "x": geo["x"], "y": geo["y"], "w": geo["width"], "h": geo["height"],
        "type": geo.get("type", "key"),
        "index": match["index"] if match else None,
        "hid": hid,
        "default": match["group"] if match else None,
    })

missing = [k for k in keys if k["index"] is None]
print("keys", len(keys), "mapped", len(keys) - len(missing), "missing", len(missing))
for k in missing:
    print("MISSING", k["code"], k["hid"])
print("unused slots", [s["index"] for s in slots if s["index"] not in used and any(s["group"])])

# Add a merged knob rectangle for UI convenience.
knob = [k for k in keys if k["type"] == "knob"]
if knob:
    x = min(k["x"] for k in knob)
    y = min(k["y"] for k in knob)
    right = max(k["x"] + k["w"] for k in knob)
    bottom = max(k["y"] + k["h"] for k in knob)
    keys.append({
        "code": "Knob", "label": "Knob", "x": x, "y": y, "w": right - x, "h": bottom - y,
        "type": "knob-group", "index": None, "hid": None, "default": None,
    })

out = {"width": layout["width"], "height": layout["height"], "keys": keys}
(root / "web").mkdir(exist_ok=True)
(root / "web/layout_ak820.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
print("wrote web/layout_ak820.json")
