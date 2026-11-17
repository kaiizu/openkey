import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
keymap = json.loads((root / "data/keymap.json").read_text(encoding="utf-8"))
by_hid = {}
for e in keymap:
    h = e.get("hidCode")
    if isinstance(h, int) and h not in by_hid:
        by_hid[h] = e

LABELS = {
    41: "Esc", 42: "Retroceso", 43: "Tab", 44: "Espacio", 57: "Bloq Mayús",
    40: "Enter", 73: "Insert", 76: "Supr", 74: "Inicio", 77: "Fin",
    75: "Re Pág", 78: "Av Pág", 70: "Impr Pant", 71: "Bloq Despl", 72: "Pausa",
    101: "Menú contextual", 79: "→", 80: "←", 81: "↓", 82: "↑",
    83: "Bloq Num", 84: "Num /", 85: "Num *", 86: "Num -", 87: "Num +",
    88: "Num Enter", 99: "Num .",
    224: "Ctrl izq", 225: "Shift izq", 226: "Alt izq", 227: "Win izq",
    228: "Ctrl der", 229: "Shift der", 230: "Alt der", 231: "Win der",
}

groups = []


def add(group, hids, custom=None):
    keys = []
    for h in hids:
        e = by_hid.get(h)
        if not e:
            continue
        label = LABELS.get(h, e["value"])
        keys.append({"hid": h, "label": label})
    if custom:
        keys.extend(custom)
    if keys:
        groups.append({"group": group, "keys": keys})


add("Letras", list(range(4, 30)))
add("Números", list(range(30, 40)))
add("F1–F12", list(range(58, 70)))
add("Edición", [41, 42, 43, 44, 57, 40, 73, 76, 74, 77, 75, 78, 70, 71, 72, 101])
add("Flechas", [80, 82, 81, 79])
add("Símbolos", [53, 45, 46, 47, 48, 49, 51, 52, 54, 55, 56])
add("Modificadores", [224, 225, 226, 227, 228, 229, 230, 231])
add("Teclado numérico", list(range(83, 100)))
add("Multimedia", [], custom=[
    {"hid": 50391552, "label": "Volumen -"},
    {"hid": 50389504, "label": "Silenciar"},
    {"hid": 50391296, "label": "Volumen +"},
    {"hid": 50384128, "label": "Reproducir / Pausa"},
    {"hid": 50378240, "label": "Pista anterior"},
    {"hid": 50377984, "label": "Pista siguiente"},
    {"hid": 50378496, "label": "Detener"},
    {"hid": 50369025, "label": "Calculadora"},
    {"hid": 50340098, "label": "Buscar"},
    {"hid": 50365185, "label": "Música"},
])
add("Sistema", [], custom=[
    {"hid": 168361984, "label": "LED encendido/apagado"},
    {"hid": 218169344, "label": "Cambiar modo LED"},
    {"hid": 134218496, "label": "Cambiar perfil"},
    {"hid": 168689664, "label": "Volumen / Brillo"},
    {"hid": 168558592, "label": "Ahorro de energía"},
])

out = root / "web/keycodes.json"
out.write_text(json.dumps(groups, ensure_ascii=False, indent=2), encoding="utf-8")
print("groups", len(groups), "keys", sum(len(g["keys"]) for g in groups))
