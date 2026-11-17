const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  status: null,
  meta: null,
  layout: null,
  keycodes: [],
  keys: null,
  profile: 0,
  layer: 0,
  selected: null,
  image: null,
  rate: null,
  keysRequest: 0,
  keysLoading: false,
  keyWriting: false,
  keyAssignMode: "key",
  capturingKey: false,
  music: { running: false, timer: null, polling: false, configTimer: null },
  ripple: { running: false, timer: null, polling: false, configTimer: null },
  screen: { fit: "cover", rotate: 0, rawFile: null, playing: true, frameIndex: 0 },
  macros: { slot: 0, macro: { repeat: 1, events: [] }, names: {}, recording: false, recordStart: 0, recordLast: 0, recordEvents: [] },
};

const PAGE_META = {
  overview: ["Resumen", "Todo lo importante del teclado, de un vistazo."],
  lighting: ["Iluminación", "Efectos del firmware, onda reactiva Water drop y pintura tecla por tecla."],
  music: ["Música", "Sincronización de audio en tiempo real, solo mientras está activa."],
  screen: ["Pantalla", "Sube una imagen o GIF de 128×128, sincroniza el reloj y controla la reproducción."],
  keys: ["Teclas", "Remapea teclas, combinaciones o macros y respalda tus perfiles."],
  macros: ["Macros", "Graba o edita hasta 50 secuencias en la memoria del teclado."],
  settings: ["Ajustes", "Rendimiento, perfiles, suspensión y opciones del firmware."],
};

const THEME_KEY = "openkey.theme.v1";
const LANGUAGE_KEY = "openkey.language.v1";
const THEMES = new Set(["grafito", "cobalto", "mercurio"]);

function queryParam(name) {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

function clearQueryParam(name) {
  try {
    const url = new URL(location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch { /* ignore */ }
}

function initialTheme() {
  const query = (queryParam("theme") || "").toLowerCase();
  if (THEMES.has(query)) return query;
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (THEMES.has(saved)) return saved;
  } catch { /* ignore */ }
  return "grafito";
}

function initialLanguage() {
  const query = (queryParam("lang") || "").toLowerCase();
  if (query === "en") return "en";
  try {
    if (localStorage.getItem(LANGUAGE_KEY) === "en") return "en";
  } catch { /* ignore */ }
  return "es";
}

function applyTheme(theme, persist = true) {
  const next = THEMES.has(theme) ? theme : "grafito";
  document.documentElement.dataset.theme = next;
  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    clearQueryParam("theme");
  }
  $$("#themeOptions .theme-option").forEach((button) => {
    const active = button.dataset.themeValue === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
}

function applyLanguage(language, { announce = false } = {}) {
  const next = language === "en" ? "en" : "es";
  $("#languageSelect").value = next;
  document.documentElement.lang = next;
  if (window.OpenKEYi18n) {
    window.OpenKEYi18n.setLanguage(next);
  } else {
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* ignore */ }
  }
  clearQueryParam("lang");
  if (announce) toast("Idioma actualizado.", "ok");
}

function bindAppearance() {
  applyTheme(initialTheme(), false);
  const select = $("#languageSelect");
  select.value = initialLanguage();
  $$("#themeOptions .theme-option").forEach((button) => {
    button.addEventListener("click", () => {
      applyTheme(button.dataset.themeValue);
      toast("Tema aplicado.", "ok");
    });
  });
  select.addEventListener("change", () => applyLanguage(select.value, { announce: true }));
}

/* ------------------------------------------------------------------ utils */
function toast(message, type = "ok", title = null) {
  const box = $("#toasts");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.innerHTML = `<div>${title ? `<b>${escapeHtml(title)}</b><br>` : ""}${escapeHtml(message)}</div><button class="close" aria-label="Cerrar">×</button>`;
  box.appendChild(el);
  const close = () => el.remove();
  el.querySelector(".close").addEventListener("click", close);
  setTimeout(close, type === "err" ? 7000 : 4200);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setButtonBusy(button, busy, label = "Procesando…") {
  if (busy) {
    button.dataset.idleLabel = button.textContent;
    button.textContent = label;
  } else if (button.dataset.idleLabel !== undefined) {
    button.textContent = button.dataset.idleLabel;
    delete button.dataset.idleLabel;
  }
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
}

const PRETTY_LABELS = {
  "(space)": "Espacio",
  "BackSpace": "Retroceso",
  "Caps Lock": "Bloq Mayús",
  "r_Ctrl": "Ctrl der",
  "r_Shift": "Shift der",
  "r_Alt": "Alt der",
  "r_Win": "Win der",
  "Page\nUp": "Re Pág",
  "Page\nDown": "Av Pág",
};

function pretty(label) {
  return PRETTY_LABELS[label] || label;
}

async function api(path, options = {}) {
  const opts = { method: options.method || "GET", headers: {} };
  if (options.body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(options.body);
  }
  const res = await fetch(path, opts);
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) throw new Error(data?.error || `Error HTTP ${res.status}`);
  return data;
}

function rgbIntToHex(n) {
  return "#" + (Number(n) >>> 0).toString(16).padStart(6, "0").slice(-6);
}

function hexToInt(h) {
  const s = String(h || "").replace("#", "").trim();
  return /^[0-9a-f]{6}$/i.test(s) ? parseInt(s, 16) : 0;
}

function minutes(seconds) {
  return Math.max(0, Math.round((Number(seconds) || 0) / 60));
}

function confirmDialog(title, text, okLabel = "Continuar") {
  return new Promise((resolve) => {
    const dlg = $("#confirmDialog");
    $("#confirmTitle").textContent = title;
    $("#confirmText").textContent = text;
    $("#confirmOk").textContent = okLabel;
    const onClose = () => {
      dlg.removeEventListener("close", onClose);
      resolve(dlg.returnValue === "ok");
    };
    dlg.addEventListener("close", onClose);
    dlg.returnValue = "cancel";
    dlg.showModal();
  });
}

/* -------------------------------------------------------------- navigation */
function setPage(name) {
  $$(".nav-item").forEach((b) => {
    const active = b.dataset.page === name;
    b.classList.toggle("active", active);
    if (active) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
  $$(".page").forEach((p) => p.classList.toggle("active", p.id === `page-${name}`));
  const [title, subtitle] = PAGE_META[name] || ["OpenKEY", ""];
  $("#pageTitle").textContent = title;
  $("#pageSubtitle").textContent = subtitle;
  if (name === "lighting") {
    const activeTab = $("#lightingTabs .subnav-tab.active")?.dataset.lightTab || "effects";
    if (location.hash !== `#lighting/${activeTab}`) history.replaceState(null, "", `#lighting/${activeTab}`);
  } else if (location.hash !== `#${name}`) {
    history.replaceState(null, "", `#${name}`);
  }
  if (name === "keys" && !state.keys) loadKeys();
  if (name === "macros" && !state.macros.loaded && state.status?.connected) {
    state.macros.loaded = true;
    readMacroFromKeyboard(true);
  }
  scheduleMusicPoll();
  scheduleRipplePoll();
}

$$(".nav-item").forEach((b) => b.addEventListener("click", () => setPage(b.dataset.page)));
$$("[data-goto]").forEach((b) => b.addEventListener("click", () => setPage(b.dataset.goto)));

/* ------------------------------------------------------------------ status */
async function loadStatus(fillForms = true) {
  try {
    const s = await api("/api/status");
    state.status = s;
    try {
      renderStatus(fillForms);
    } catch (err) {
      console.error("renderStatus failed", err);
      toast("Error dibujando el estado: " + err.message, "err");
    }
    return s;
  } catch (err) {
    state.status = { connected: false, error: err.message };
    renderStatus(false);
    return state.status;
  }
}

function renderStatus(fillForms = true) {
  const s = state.status || {};
  const connected = !!s.connected;
  const connBadge = $("#connBadge");
  connBadge.className = `conn ${connected ? "conn--on" : "conn--off"}`;
  $("#connText").textContent = connected
    ? `${s.product || "X820 Ultra"} · ${s.usbVersion ? "USB" : "conectado"}`
    : (s.error ? "No detectado" : "Buscando…");
  $("#devicePill").textContent = connected ? `${s.product || "X820 Ultra"} · USB` : "Sin conexión";
  $("#devicePill").className = `pill ${connected ? "on" : "off"}`;
  $("#offlineBanner").classList.toggle("hidden", connected);

  if (!connected) {
    $("#statFirmware").textContent = "—";
    $("#statScreen").textContent = "—";
    $("#statLight").textContent = "—";
    $("#statSideLight").textContent = "—";
    return;
  }

  $("#heroName").textContent = s.product || "X820 Ultra";
  $("#heroConn").textContent = "USB";
  $("#heroProfile").textContent = `Perfil ${s.profile ?? 0}`;
  $("#heroRate").textContent = s.reportRate ? `${s.reportRate} Hz` : "— Hz";
  $("#heroDebounce").textContent = s.debounce != null ? `Debounce ${s.debounce} ms` : "Debounce —";

  const fw = s.usbVersion;
  const fwText = fw ? `${Math.floor(fw / 100)}.${String(fw % 100).padStart(2, "0")}` : "—";
  $("#statFirmware").textContent = fw ? `v${fwText}` : "—";
  $("#statScreen").textContent = s.oled?.oled ? "128 × 128" : "—";
  $("#statLight").textContent = s.light?.label || "—";
  $("#statSideLight").textContent = s.sideLight?.label || "—";

  $("#statusStamp").textContent = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  $("#kvProduct").textContent = s.product || "—";
  $("#kvVidPid").textContent = s.vid ? `${s.vid.toUpperCase()} / ${s.pid.toUpperCase()}` : "—";
  $("#kvOled").textContent = s.oled?.oled ? `0x${Number(s.oled.oled).toString(16).toUpperCase()}` : "—";
  $("#kvFlash").textContent = s.oled?.flash ? `0x${Number(s.oled.flash).toString(16).toUpperCase()}` : "—";
  $("#kvSystem").textContent = s.kbOption?.system === "mac" ? "macOS" : "Windows";
  $("#kvPath").textContent = s.path || "—";
  $("#kvPath").title = s.path || "";

  // Settings info panel
  $("#infoProduct").textContent = s.product || "—";
  $("#infoVidPid").textContent = s.vid ? `${s.vid.toUpperCase()} / ${s.pid.toUpperCase()}` : "—";
  $("#infoUsb").textContent = fw ? `v${fwText}` : "—";
  $("#infoOled").textContent = s.oled?.oled ? `0x${Number(s.oled.oled).toString(16).toUpperCase()}` : "—";
  $("#infoFlash").textContent = s.oled?.flash ? `0x${Number(s.oled.flash).toString(16).toUpperCase()}` : "—";
  $("#infoSystem").textContent = s.kbOption?.system === "mac" ? "macOS" : "Windows";

  // Settings controls
  if (fillForms) {
    $("#debounce").value = s.debounce ?? 1;
    $("#debounceOut").textContent = s.debounce ?? 1;
    $("#profileSelect").value = String(s.profile ?? 0);
    $("#systemSelect").value = s.kbOption?.system === "mac" ? "mac" : "win";
    if (s.sleep) {
      $("#sleepBt").value = minutes(s.sleep.bt);
      $("#sleepWired").value = minutes(s.sleep.wired);
      $("#sleepDeepBt").value = minutes(s.sleep.deepBt);
      $("#sleepDeepWired").value = minutes(s.sleep.deepWired);
    }
    renderRateButtons(s.reportRate);
    setLightForm("main", s.light);
    setLightForm("side", s.sideLight);
  }
}

/* ---------------------------------------------------------------- lighting */
const LIGHT_CATEGORIES = {
  LightOff: "static",
  LightAlwaysOn: "static",
  LightUserColor: "static",
  LightUserPicture: "static",
  LightBreath: "animated",
  LightNeon: "animated",
  LightWave: "animated",
  LightRaindrop: "animated",
  LightSnake: "animated",
  LightConverage: "animated",
  LightSineWave: "animated",
  LightKaleidoscope: "animated",
  LightLineWave: "animated",
  LightCircleWave: "animated",
  LightDazzing: "animated",
  LightRainDown: "animated",
  LightMeteor: "animated",
  LightTrain: "animated",
  LightFireWorks: "animated",
  LightRipple: "reactive",
  LightPressAction: "reactive",
  LightLaser: "reactive",
  LightPressActionOff: "reactive",
  LightMusicFollow3: "special",
  LightMusicFollow2: "special",
  LightScreenColor: "special",
};

let activeEffectCat = "all";

function fillModeSelect(sel, modes) {
  sel.innerHTML = modes.map((m) => `<option value="${escapeHtml(m.name)}">${escapeHtml(m.label)}</option>`).join("");
  if (sel.id === "mainMode") renderEffectGrid();
}

function renderEffectGrid() {
  const grid = $("#mainEffectGrid");
  if (!grid || !state.meta?.lightModes) return;
  const current = $("#mainMode")?.value;
  grid.innerHTML = "";
  for (const mode of state.meta.lightModes) {
    const cat = LIGHT_CATEGORIES[mode.name] || "animated";
    if (activeEffectCat !== "all" && cat !== activeEffectCat) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `effect-chip${mode.name === current ? " active" : ""}`;
    btn.dataset.mode = mode.name;
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(mode.name === current));
    btn.innerHTML = `<span>${escapeHtml(mode.label)}</span><i class="effect-dot"></i>`;
    btn.addEventListener("click", () => {
      $("#mainMode").value = mode.name;
      updateLightPreview("main");
    });
    grid.appendChild(btn);
  }
}

function bindLightingTabs() {
  const activate = (target) => {
    $$("#lightingTabs .subnav-tab").forEach((b) => {
      const on = b.dataset.lightTab === target;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    $("#lightingPaneEffects")?.classList.toggle("active", target === "effects");
    $("#lightingPaneRipple")?.classList.toggle("active", target === "ripple");
    $("#lightingPanePerKey")?.classList.toggle("active", target === "perkey");
    scheduleRipplePoll();
    return target;
  };
  window.setLightingTab = (target) => {
    const next = activate(target);
    if (location.hash !== `#lighting/${next}`) history.replaceState(null, "", `#lighting/${next}`);
  };

  $$("#lightingTabs .subnav-tab").forEach((tab) => {
    tab.addEventListener("click", () => window.setLightingTab(tab.dataset.lightTab));
  });

  $$("#effectCatPills .cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      activeEffectCat = pill.dataset.cat || "all";
      $$("#effectCatPills .cat-pill").forEach((p) => p.classList.toggle("active", p === pill));
      renderEffectGrid();
    });
  });

  $$("#mainColorSwatches button").forEach((sw) => {
    sw.addEventListener("click", () => {
      const hex = sw.dataset.hex;
      if (!hex) return;
      $("#mainColor").value = hex.toLowerCase();
      $("#mainColorHex").value = hex.toUpperCase();
      $("#mainDazzle").checked = false;
      updateLightPreview("main");
    });
  });
}

function setLightForm(prefix, data) {
  if (!data) return;
  const isSide = prefix === "side";
  const modeSel = isSide ? $("#sideMode") : $("#mainMode");
  const color = isSide ? $("#sideColor") : $("#mainColor");
  const hex = isSide ? $("#sideColorHex") : $("#mainColorHex");
  const bright = isSide ? $("#sideBright") : $("#mainBright");
  const speed = isSide ? $("#sideSpeed") : $("#mainSpeed");
  const dazzle = isSide ? $("#sideDazzle") : $("#mainDazzle");
  const option = isSide ? $("#sideOption") : $("#mainOption");
  const brightOut = isSide ? $("#sideBrightOut") : $("#mainBrightOut");
  const speedOut = isSide ? $("#sideSpeedOut") : $("#mainSpeedOut");
  const optionOut = isSide ? $("#sideOptionOut") : $("#mainOptionOut");
  const rawSel = isSide ? "#sideLightRaw" : "#mainLightRaw";

  modeSel.value = data.mode;
  color.value = rgbIntToHex(data.rgb);
  hex.value = rgbIntToHex(data.rgb).toUpperCase();
  bright.value = data.brightness ?? 4;
  speed.value = data.speed ?? 2;
  dazzle.checked = !!data.dazzle;
  option.value = data.option ?? 0;
  brightOut.textContent = bright.value;
  speedOut.textContent = speed.value;
  optionOut.textContent = option.value;
  if (data.raw != null) $(rawSel).textContent = data.raw;
  updateLightPreview(prefix);
}

function readLightForm(prefix) {
  const isSide = prefix === "side";
  return {
    mode: (isSide ? $("#sideMode") : $("#mainMode")).value,
    brightness: Number((isSide ? $("#sideBright") : $("#mainBright")).value),
    speed: Number((isSide ? $("#sideSpeed") : $("#mainSpeed")).value),
    rgb: hexToInt((isSide ? $("#sideColorHex") : $("#mainColorHex")).value),
    dazzle: (isSide ? $("#sideDazzle") : $("#mainDazzle")).checked,
    option: Number((isSide ? $("#sideOption") : $("#mainOption")).value),
  };
}

const DEFAULT_PREVIEW_SCALE = 2.6;

function updateLightPreview(prefix) {
  const isSide = prefix === "side";
  const color = (isSide ? $("#sideColor") : $("#mainColor")).value;
  const mode = (isSide ? $("#sideMode") : $("#mainMode")).value;
  $(isSide ? "#sideMusicNote" : "#mainMusicNote").classList.toggle("hidden", !["LightMusicFollow2", "LightMusicFollow3"].includes(mode));
  const preview = isSide ? $("#sidePreview") : $("#mainPreview");
  preview.style.setProperty("--preview", color);
  if (isSide) {
    preview.querySelector("span").style.opacity = mode === "LightOff" ? "0.06" : "0.9";
    return;
  }
  const effects = { LightOff: "off", LightAlwaysOn: "fixed", LightUserColor: "fixed",
    LightBreath: "breath", LightNeon: "spectrum", LightWave: "wave", LightSnake: "snake" };
  const effect = effects[mode] || "unknown";
  preview.dataset.effect = effect;
  preview.style.setProperty("--brightness", String(Number($("#mainBright").value) / 5));
  const scale = Math.max(0.25, Math.min(4, Number($("#previewScale")?.value) || DEFAULT_PREVIEW_SCALE));
  preview.style.setProperty("--duration", `${Math.max(0.1, (5.5 - Number($("#mainSpeed").value)) / scale)}s`);
  $("#previewMessage").textContent = effect === "unknown"
    ? "Vista previa no disponible para este efecto"
    : "Simulación aproximada · no modifica el teclado";

  // Sync effect chip selection & dim controls that do not apply to this mode
  $$("#mainEffectGrid .effect-chip").forEach((chip) => {
    const on = chip.dataset.mode === mode;
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-selected", String(on));
  });
  const noColor = ["LightOff", "LightUserPicture", "LightScreenColor", "LightNeon"].includes(mode);
  const noSpeed = ["LightOff", "LightAlwaysOn", "LightUserColor", "LightUserPicture", "LightScreenColor"].includes(mode);
  $("#mainColorBox")?.classList.toggle("is-dimmed", noColor);
  $("#mainBrightField")?.classList.toggle("is-dimmed", mode === "LightOff");
  $("#mainSpeedField")?.classList.toggle("is-dimmed", noSpeed);
}

function loadPreviewScale() {
  const input = $("#previewScale");
  const output = $("#previewScaleOut");
  if (!input || !output) return;
  let value = DEFAULT_PREVIEW_SCALE;
  try {
    const saved = Number(localStorage.getItem("openkey.previewScale.v1"));
    if (Number.isFinite(saved) && saved >= 0.25 && saved <= 4) value = saved;
  } catch { /* localStorage unavailable */ }
  input.value = String(value);
  output.textContent = `${value.toFixed(2)}×`;
  input.addEventListener("input", () => {
    const current = Math.max(0.25, Math.min(4, Number(input.value) || DEFAULT_PREVIEW_SCALE));
    output.textContent = `${current.toFixed(2)}×`;
    try { localStorage.setItem("openkey.previewScale.v1", String(current)); } catch { /* ignore */ }
    updateLightPreview("main");
  });
  updateLightPreview("main");
}

function buildLightPreview() {
  const preview = $("#mainPreview");
  preview.innerHTML = "";
  const layout = state.layout;
  if (!layout?.keys) return;
  for (const key of layout.keys) {
    if (key.type === "knob-group" || key.type === "knob") continue;
    const element = document.createElement("span");
    element.className = "light-key";
    element.style.left = `${100 * key.x / layout.width}%`;
    element.style.top = `${100 * key.y / layout.height}%`;
    element.style.width = `${100 * key.w / layout.width}%`;
    element.style.height = `${100 * key.h / layout.height}%`;
    element.style.setProperty("--phase", `${-(key.x / layout.width) * 4}s`);
    preview.appendChild(element);
  }
  updateLightPreview("main");
}

function buildHeroKeyboard() {
  const element = $("#heroKeyboard");
  const layout = state.layout;
  if (!element || !layout?.keys) return;
  element.replaceChildren();
  for (const key of layout.keys) {
    if (key.type === "knob") continue;
    const cap = document.createElement("span");
    cap.className = key.type === "knob-group" ? "hero-knob" : "hero-cap";
    if (["Escape", "Enter", "Space"].includes(key.code)) cap.classList.add("hero-cap--accent");
    else if (key.code.startsWith("F") || /^(Control|Shift|Alt|Meta|Backspace|CapsLock|Tab)/.test(key.code)) cap.classList.add("hero-cap--dark");
    cap.style.left = `${100 * key.x / layout.width}%`;
    cap.style.top = `${100 * key.y / layout.height}%`;
    cap.style.width = `${100 * key.w / layout.width}%`;
    cap.style.height = `${100 * key.h / layout.height}%`;
    element.appendChild(cap);
  }
  const light = document.createElement("span");
  light.className = "hero-led";
  const screen = document.createElement("span");
  screen.className = "hero-screen";
  screen.innerHTML = '<i></i><i></i><i></i>';
  element.append(light, screen);
}

function bindLightPreset() {
  const storageKey = "openkey.lightPreset.v1";
  const load = $("#loadLightPreset");
  try { load.disabled = !localStorage.getItem(storageKey); } catch { load.disabled = true; }
  $("#saveLightPreset").addEventListener("click", () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(readLightForm("main")));
      load.disabled = false;
      toast("Preajuste guardado en este navegador.", "ok");
    } catch { toast("No se pudo guardar el preajuste en este navegador.", "err"); }
  });
  load.addEventListener("click", () => {
    try {
      const preset = JSON.parse(localStorage.getItem(storageKey));
      if (!preset || !state.meta?.lightModes.some((m) => m.name === preset.mode) ||
          !Number.isInteger(preset.rgb) || preset.rgb < 0 || preset.rgb > 0xffffff ||
          !Number.isInteger(preset.brightness) || preset.brightness < 0 || preset.brightness > 5 ||
          !Number.isInteger(preset.speed) || preset.speed < 0 || preset.speed > 4 ||
          !Number.isInteger(preset.option) || preset.option < 0 || preset.option > 15 ||
          typeof preset.dazzle !== "boolean") throw new Error("Preajuste no válido");
      setLightForm("main", preset);
      toast("Preajuste cargado. Pulsa Aplicar iluminación para enviarlo al teclado.", "ok");
    } catch { toast("No se pudo cargar el preajuste.", "err"); }
  });
}

function bindColorEditor() {
  const surface = $("#colorKeyboard");
  const read = $("#paintRead"), apply = $("#paintApply"), fill = $("#paintFill");
  const status = $("#colorEditorStatus"), empty = $("#colorEditorEmpty");
  let original = null, colors = null, busy = false, erase = false;
  const keys = (state.layout?.keys || []).filter((key) => key.type !== "knob-group" && key.type !== "knob");
  const editable = new Set(keys.filter((key) => Number.isInteger(key.index) && key.index >= 0 && key.index < 126).map((key) => key.index));

  function update() {
    for (const button of $$(".color-key", surface)) {
      const index = Number(button.dataset.index);
      if (colors && editable.has(index)) {
        const offset = index * 3;
        const [r, g, b] = colors.slice(offset, offset + 3);
        button.style.setProperty("--key-color", `rgb(${r}, ${g}, ${b})`);
        const bright = (r * 299 + g * 587 + b * 114) / 1000 > 155;
        button.style.color = bright ? "#171b18" : "#fff";
        button.style.textShadow = bright ? "none" : "0 1px 3px #000";
      }
      button.disabled = busy || !colors || !editable.has(index);
    }
    const dirty = colors && original && colors.some((byte, i) => byte !== original[i]);
    apply.disabled = busy || !dirty;
    fill.disabled = busy || !colors;
    read.disabled = busy;
    $("#paintColor").disabled = busy;
    $("#paintBrush").disabled = busy;
    $("#paintErase").disabled = busy;
    empty.classList.toggle("hidden", !!colors);
    if (!busy) status.textContent = colors ? (dirty ? "Cambios sin aplicar" : "Colores leídos") : "Sin leer";
  }

  for (const key of keys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key color-key";
    button.dataset.index = Number.isInteger(key.index) ? String(key.index) : "-1";
    button.style.left = `${100 * key.x / state.layout.width}%`;
    button.style.top = `${100 * key.y / state.layout.height}%`;
    button.style.width = `${100 * key.w / state.layout.width}%`;
    button.style.height = `${100 * key.h / state.layout.height}%`;
    button.textContent = pretty(key.label || key.code);
    button.setAttribute("aria-label", `Pintar ${pretty(key.label || key.code)}`);
    surface.appendChild(button);
  }
  function paint(index) {
    if (busy || !colors || !editable.has(index)) return;
    const color = erase ? 0 : hexToInt($("#paintColor").value);
    colors.set([(color >> 16) & 255, (color >> 8) & 255, color & 255], index * 3);
    update();
  }
  surface.addEventListener("click", (event) => {
    const button = event.target.closest(".color-key");
    if (button && !button.disabled) paint(Number(button.dataset.index));
  });
  surface.addEventListener("pointerover", (event) => {
    const button = event.target.closest(".color-key");
    if (event.buttons === 1 && button && !button.disabled) paint(Number(button.dataset.index));
  });
  for (const [id, isErase] of [["paintBrush", false], ["paintErase", true]]) {
    $("#" + id).addEventListener("click", () => {
      erase = isErase;
      for (const [name, selected] of [["paintBrush", !erase], ["paintErase", erase]]) {
        $("#" + name).classList.toggle("active", selected);
        $("#" + name).setAttribute("aria-pressed", String(selected));
      }
    });
  }
  fill.addEventListener("click", () => { for (const index of editable) paint(index); });
  read.addEventListener("click", async () => {
    if (colors && colors.some((byte, i) => byte !== original[i]) && !await confirmDialog("Descartar cambios", "Se perderán los colores que todavía no aplicaste.", "Leer del teclado")) return;
    busy = true; status.textContent = "Leyendo colores…"; update();
    try {
      const data = await api("/api/key-colors");
      const bytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
      if (bytes.length !== 384) throw new Error("La respuesta de colores está incompleta");
      original = bytes; colors = bytes.slice();
    } catch (err) { toast(err.message, "err", "No se pudieron leer los colores"); }
    finally { busy = false; update(); }
  });
  apply.addEventListener("click", async () => {
    if (!colors || !original || busy) return;
    busy = true; status.textContent = "Aplicando colores…"; update();
    try {
      const data = await api("/api/key-colors", { method: "POST", body: { original: toBase64(original), data: toBase64(colors) } });
      original = colors.slice();
      if (state.status) state.status.light = data.light;
      setLightForm("main", data.light);
      $("#statLight").textContent = data.light?.label || "—";
      toast("Colores aplicados y verificados.", "ok");
    } catch (err) {
      original = null; colors = null;
      toast(err.message + " Vuelve a leer los colores antes de continuar.", "err", "No se pudo confirmar el cambio");
    } finally { busy = false; update(); }
  });
  update();
}

function bindLightForm(prefix, applyBtn, resetBtn) {
  const isSide = prefix === "side";
  const color = isSide ? $("#sideColor") : $("#mainColor");
  const hex = isSide ? $("#sideColorHex") : $("#mainColorHex");
  const bright = isSide ? $("#sideBright") : $("#mainBright");
  const speed = isSide ? $("#sideSpeed") : $("#mainSpeed");
  const option = isSide ? $("#sideOption") : $("#mainOption");
  const brightOut = isSide ? $("#sideBrightOut") : $("#mainBrightOut");
  const speedOut = isSide ? $("#sideSpeedOut") : $("#mainSpeedOut");
  const optionOut = isSide ? $("#sideOptionOut") : $("#mainOptionOut");
  const mode = isSide ? $("#sideMode") : $("#mainMode");

  color.addEventListener("input", () => { hex.value = color.value.toUpperCase(); updateLightPreview(prefix); });
  hex.addEventListener("change", () => {
    if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
      color.value = hex.value;
      updateLightPreview(prefix);
    } else {
      hex.value = color.value.toUpperCase();
    }
  });
  bright.addEventListener("input", () => { brightOut.textContent = bright.value; updateLightPreview(prefix); });
  speed.addEventListener("input", () => { speedOut.textContent = speed.value; updateLightPreview(prefix); });
  option.addEventListener("input", () => { optionOut.textContent = option.value; });
  mode.addEventListener("change", () => updateLightPreview(prefix));

  applyBtn.addEventListener("click", async () => {
    setButtonBusy(applyBtn, true, "Aplicando…");
    try {
      const data = await api(isSide ? "/api/side-light" : "/api/light", { method: "POST", body: readLightForm(prefix) });
      const light = isSide ? data.sideLight : data.light;
      if (light) setLightForm(prefix, light);
      if (state.status) {
        if (isSide) state.status.sideLight = light; else state.status.light = light;
        $("#statLight").textContent = state.status.light?.label || "—";
        $("#statSideLight").textContent = state.status.sideLight?.label || "—";
      }
      toast(isSide ? "Luz lateral aplicada." : "Iluminación aplicada.", "ok");
    } catch (err) {
      toast(err.message, "err", "No se pudo aplicar");
    } finally {
      setButtonBusy(applyBtn, false);
    }
  });

  resetBtn.addEventListener("click", async () => {
    setButtonBusy(resetBtn, true, "Leyendo…");
    try {
      const status = await loadStatus(true);
      if (!status.connected) throw new Error(status.error || "No se pudo conectar al teclado.");
      toast("Valores leídos del teclado.", "ok");
    } catch (err) {
      toast(err.message, "err");
    } finally {
      setButtonBusy(resetBtn, false);
    }
  });
}

/* ------------------------------------------------------------------ screen */
const screenCanvas = $("#screenCanvas");
const screenCtx = screenCanvas.getContext("2d", { willReadFrequently: true });
let uploadTimer = null;
let previewTimer = null;

const MAX_GIF_FRAMES = 60;
const MAX_GIF_BYTES = 2 * 1024 * 1024;
const GIF_COMPRESS_BYTES = 1.5 * 1024 * 1024;

function stopPreview() {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
}

function pixelsBounds(px) {
  let left = 128, top = 128, right = 0, bottom = 0, found = false;
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const i = (y * 128 + x) * 4;
      if (px[i] || px[i + 1] || px[i + 2]) {
        found = true;
        if (x < left) left = x;
        if (y < top) top = y;
        if (x + 1 > right) right = x + 1;
        if (y + 1 > bottom) bottom = y + 1;
      }
    }
  }
  return found
    ? { left, top, right, bottom, found: true }
    : { left: 0, top: 0, right: 128, bottom: 128, found: false };
}

function cropToRgb565(px, left, top, right, bottom) {
  const data = new Uint8Array((right - left) * (bottom - top) * 2);
  let p = 0;
  for (let x = left; x < right; x++) {
    for (let y = top; y < bottom; y++) {
      const i = (y * 128 + x) * 4;
      const v = ((px[i] >> 3) << 11) | ((px[i + 1] >> 2) << 5) | (px[i + 2] >> 3);
      data[p++] = (v >> 8) & 0xFF;
      data[p++] = v & 0xFF;
    }
  }
  return data;
}

function drawCover(ctx, image, width, height) {
  const fit = state.screen?.fit || "cover";
  const rotate = ((Number(state.screen?.rotate) || 0) % 360 + 360) % 360;
  const swap = rotate === 90 || rotate === 270;
  const srcW = swap ? height : width;
  const srcH = swap ? width : height;

  ctx.save();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, 128, 128);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  let w = 128;
  let h = 128;
  if (fit !== "stretch") {
    const scale = fit === "contain"
      ? Math.min(128 / srcW, 128 / srcH)
      : Math.max(128 / srcW, 128 / srcH);
    w = Math.max(1, Math.round(srcW * scale));
    h = Math.max(1, Math.round(srcH * scale));
  }

  ctx.translate(64, 64);
  if (rotate) ctx.rotate((rotate * Math.PI) / 180);
  const drawW = swap ? h : w;
  const drawH = swap ? w : h;
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
}

function updatePlaybackControls() {
  const img = state.image;
  const animated = !!(img?.preview?.length > 1);
  const prevBtn = $("#screenPrevFrame");
  const playBtn = $("#screenTogglePlay");
  const nextBtn = $("#screenNextFrame");
  if (!prevBtn || !playBtn || !nextBtn) return;
  prevBtn.disabled = !animated;
  playBtn.disabled = !animated;
  nextBtn.disabled = !animated;
  if (!img) {
    playBtn.textContent = "Sin imagen";
  } else if (!animated) {
    playBtn.textContent = "Estática · 1/1";
  } else {
    const idx = ((state.screen.frameIndex || 0) % img.preview.length) + 1;
    playBtn.textContent = `${state.screen.playing ? "⏸" : "▶"} ${idx}/${img.preview.length}`;
  }
}

function updateScreenMeta(img) {
  const total = img.frames.reduce((sum, frame) => sum + frame.length, 0);
  $("#imgArea").textContent = `${img.right - img.left} × ${img.bottom - img.top} px`;
  $("#imgBytes").textContent = `${(total / 1024).toFixed(1)} KB`;
  $("#imgName").textContent = img.name;
  $("#imgFrames").textContent = String(img.count);
  $("#imgDuration").textContent = img.count > 1 ? `${(img.totalDuration / 1000).toFixed(1)} s` : "—";
  updatePlaybackControls();
}

function startPreview() {
  stopPreview();
  const img = state.image;
  if (!img?.preview?.length) {
    updatePlaybackControls();
    return;
  }
  const draw = () => {
    if (state.image !== img) return;
    const total = img.preview.length;
    const index = ((state.screen.frameIndex || 0) % total + total) % total;
    state.screen.frameIndex = index;
    const px = img.preview[index];
    screenCtx.putImageData(new ImageData(new Uint8ClampedArray(px), 128, 128), 0, 0);
    updatePlaybackControls();
    if (total > 1 && state.screen.playing) {
      const delay = img.previewDelays?.[index] ?? img.delay ?? 100;
      state.screen.frameIndex = (index + 1) % total;
      previewTimer = setTimeout(draw, Math.max(20, delay));
    }
  };
  draw();
}

function framesDiffer(a, b) {
  // Keep frames with any meaningful pixel change; exact/near-identical
  // intermediate frames are the ones we can safely discard.
  for (let i = 0; i < a.length; i += 4) {
    const delta = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (delta > 18) return true;
  }
  return false;
}

function chooseGifStrategy(count) {
  return new Promise((resolve) => {
    const dialog = $("#gifLimitDialog");
    $("#gifLimitTitle").textContent = `GIF de ${count} cuadros`;
    $("#gifLimitText").textContent =
      `El límite es ${MAX_GIF_FRAMES} cuadros. Comprimir mantiene toda la animación, ` +
      `quitando cuadros intermedios y ajustando la duración; usar los primeros ${MAX_GIF_FRAMES} ` +
      `conserva solo el comienzo y descarta el resto.`;
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue || "cancel");
    };
    dialog.addEventListener("close", onClose);
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
}

function formatDuration(seconds) {
  const total = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return minutes ? `${minutes} min ${rest} s` : `${rest} s`;
}

function chooseGifSize(gif) {
  return new Promise((resolve) => {
    const dialog = $("#gifSizeDialog");
    const megabytes = (gif.totalBytes / 1024 / 1024).toFixed(2);
    const seconds = gif.totalBytes / 12000;
    $("#gifSizeTitle").textContent = `GIF de ${megabytes} MB`;
    $("#gifSizeText").textContent =
      `El GIF tiene ${gif.count} cuadros y ocupa ${megabytes} MB. Subirlo completo puede tardar ` +
      `~${formatDuration(seconds)}. Comprimir a 1,5 MB reduce cuadros intermedios y mantiene la animación.`;
    $("#gifSizeFull").disabled = gif.totalBytes > MAX_GIF_BYTES;
    const onClose = () => {
      dialog.removeEventListener("close", onClose);
      resolve(dialog.returnValue || "cancel");
    };
    dialog.addEventListener("close", onClose);
    dialog.returnValue = "cancel";
    dialog.showModal();
  });
}

function compressGifToBytes(gif, maxBytes) {
  const frameBytes = gif.frames[0]?.length || 0;
  if (!frameBytes || gif.count <= 1) return gif;
  const maxFrames = Math.max(1, Math.min(gif.count, Math.floor(maxBytes / frameBytes)));
  if (maxFrames >= gif.count) return gif;
  const frames = [];
  const preview = [];
  for (let i = 0; i < maxFrames; i++) {
    const index = maxFrames === 1 ? 0 : Math.round(i * (gif.count - 1) / (maxFrames - 1));
    frames.push(gif.frames[index]);
    preview.push(gif.preview[index]);
  }
  const sourceDuration = gif.originalDuration ?? gif.totalDuration;
  const delay = Math.max(20, Math.min(255, Math.round(sourceDuration / maxFrames)));
  const totalBytes = frames.reduce((sum, frame) => sum + frame.length, 0);
  return {
    ...gif,
    frames,
    preview,
    previewDelays: frames.map(() => delay),
    count: maxFrames,
    delay,
    totalDuration: delay * maxFrames,
    totalBytes,
    sizeCompressed: true,
  };
}

async function decodeGif(file, options = {}) {
  if (typeof ImageDecoder === "undefined" || typeof ImageDecoder.isTypeSupported !== "function") return null;
  if (!(await ImageDecoder.isTypeSupported("image/gif"))) return null;
  const decoder = new ImageDecoder({ data: await file.arrayBuffer(), type: "image/gif" });
  try {
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    const totalFrames = track?.frameCount || 0;
    if (totalFrames <= 1) return null;
    const strategy = options.strategy;
    if (totalFrames > MAX_GIF_FRAMES && !strategy) {
      return { needsChoice: true, frameCount: totalFrames };
    }

    const useFirst = strategy === "first";
    const decodeCount = useFirst ? Math.min(totalFrames, MAX_GIF_FRAMES) : totalFrames;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const decoded = [];
    let sourceDuration = 0;
    for (let i = 0; i < decodeCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      try {
        drawCover(ctx, image, image.displayWidth || image.codedWidth, image.displayHeight || image.codedHeight);
        const px = ctx.getImageData(0, 0, 128, 128).data;
        const duration = Math.max(20, Math.min(255, Math.round((image.duration || 100000) / 1000)));
        sourceDuration += duration;
        decoded.push({ px, duration });
      } finally {
        image.close();
      }
    }

    let selected = decoded;
    let compressed = false;
    let truncated = false;
    if (strategy === "compress" && totalFrames > MAX_GIF_FRAMES) {
      const kept = [];
      for (const frame of decoded) {
        if (!kept.length || framesDiffer(kept[kept.length - 1].px, frame.px)) {
          kept.push(frame);
        }
      }
      if (kept.length > MAX_GIF_FRAMES) {
        selected = [];
        for (let i = 0; i < MAX_GIF_FRAMES; i++) {
          const index = Math.round(i * (kept.length - 1) / (MAX_GIF_FRAMES - 1));
          selected.push(kept[index]);
        }
      } else {
        selected = kept;
      }
      compressed = true;
    } else if (useFirst && totalFrames > MAX_GIF_FRAMES) {
      truncated = true;
    }
    if (!selected.length) selected = decoded.slice(0, 1);

    let union = { left: 128, top: 128, right: 0, bottom: 0, found: false };
    for (const frame of selected) {
      const bounds = pixelsBounds(frame.px);
      if (!bounds.found) continue;
      union.left = Math.min(union.left, bounds.left);
      union.top = Math.min(union.top, bounds.top);
      union.right = Math.max(union.right, bounds.right);
      union.bottom = Math.max(union.bottom, bounds.bottom);
      union.found = true;
    }
    if (!union.found) union = { left: 0, top: 0, right: 128, bottom: 128 };
    const frames = selected.map((frame) => cropToRgb565(frame.px, union.left, union.top, union.right, union.bottom));
    const totalBytes = frames.reduce((sum, frame) => sum + frame.length, 0);
    const delay = Math.max(20, Math.min(255, Math.round(sourceDuration / selected.length)));
    return {
      frames,
      left: union.left,
      top: union.top,
      right: union.right,
      bottom: union.bottom,
      delay,
      name: file.name,
      preview: selected.map((frame) => frame.px),
      previewDelays: selected.map(() => delay),
      count: frames.length,
      totalBytes,
      totalDuration: delay * selected.length,
      originalDuration: sourceDuration,
      compressed,
      truncated,
    };
  } finally {
    decoder.close();
  }
}

function clearScreenPreview() {
  stopPreview();
  screenCtx.fillStyle = "#000";
  screenCtx.fillRect(0, 0, 128, 128);
  state.image = null;
  state.screen.rawFile = null;
  state.screen.frameIndex = 0;
  $("#uploadImage").disabled = true;
  $("#imgArea").textContent = "—";
  $("#imgBytes").textContent = "—";
  $("#imgName").textContent = "—";
  $("#imgFrames").textContent = "—";
  $("#imgDuration").textContent = "—";
  updatePlaybackControls();
}

function loadTestPattern() {
  stopPreview();
  state.screen.rawFile = null;
  state.screen.frameIndex = 0;
  state.screen.playing = false;
  const ctx = screenCtx;
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, "#1f2b37");
  grad.addColorStop(0.5, "#2b3d34");
  grad.addColorStop(1, "#3b341f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#ffcf18";
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, 118, 118);
  ctx.fillStyle = "#f2f2ef";
  ctx.textAlign = "center";
  ctx.font = "bold 15px 'Segoe UI', sans-serif";
  ctx.fillText("OpenKEY", 64, 52);
  ctx.fillStyle = "#ffcf18";
  ctx.font = "bold 10px Consolas, monospace";
  ctx.fillText("X820 ULTRA · 128×128", 64, 72);
  ctx.fillStyle = "#9cc7a4";
  ctx.font = "10px Consolas, monospace";
  ctx.fillText(new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }), 64, 94);
  const px = ctx.getImageData(0, 0, 128, 128).data;
  const img = {
    frames: [cropToRgb565(px, 0, 0, 128, 128)],
    left: 0,
    top: 0,
    right: 128,
    bottom: 128,
    delay: 0,
    name: "patron-prueba.png",
    preview: [px],
    previewDelays: [0],
    count: 1,
    totalDuration: 0,
  };
  state.image = img;
  updateScreenMeta(img);
  startPreview();
  $("#uploadImage").disabled = false;
  toast("Patrón de prueba listo para subir.", "ok");
}

async function handleFile(file, options = {}) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast("Selecciona un archivo de imagen.", "err");
    return;
  }
  state.screen.rawFile = file;
  state.screen.frameIndex = 0;
  state.screen.playing = true;
  stopPreview();
  state.image = null;
  $("#uploadImage").disabled = true;
  $("#imgArea").textContent = "—";
  $("#imgBytes").textContent = "—";
  $("#imgName").textContent = "Leyendo…";
  $("#imgFrames").textContent = "—";
  $("#imgDuration").textContent = "—";
  try {
    if (file.type === "image/gif") {
      let gif = await decodeGif(file, options.strategy ? { strategy: options.strategy } : {});
      if (gif?.needsChoice) {
        const choice = await chooseGifStrategy(gif.frameCount);
        if (choice === "cancel") {
          clearScreenPreview();
          return;
        }
        state.screen.lastGifStrategy = choice;
        gif = await decodeGif(file, { strategy: choice });
      }
      if (gif) {
        if (gif.totalBytes > GIF_COMPRESS_BYTES && !options.skipSizePrompt) {
          const sizeChoice = await chooseGifSize(gif);
          if (sizeChoice === "cancel") {
            clearScreenPreview();
            return;
          }
          state.screen.lastGifSizeChoice = sizeChoice;
          if (sizeChoice === "compress") {
            gif = compressGifToBytes(gif, GIF_COMPRESS_BYTES);
          }
        } else if (gif.totalBytes > GIF_COMPRESS_BYTES && state.screen.lastGifSizeChoice === "compress") {
          gif = compressGifToBytes(gif, GIF_COMPRESS_BYTES);
        }
        state.image = gif;
        updateScreenMeta(gif);
        startPreview();
        $("#uploadImage").disabled = false;
        if (!options.silentToast) {
          if (gif.sizeCompressed) toast(`GIF comprimido a ${gif.count} cuadros para reducir el peso.`, "ok");
          else if (gif.compressed) toast(`GIF comprimido a ${gif.count} cuadros.`, "ok");
          else if (gif.truncated) toast(`Se usarán los primeros ${gif.count} cuadros.`, "ok");
        }
        return;
      }
      toast("Este navegador no puede animar GIF; se usará el primer cuadro.", "err");
    }
    const bmp = await createImageBitmap(file);
    try {
      drawCover(screenCtx, bmp, bmp.width, bmp.height);
    } finally {
      bmp.close?.();
    }
    const px = screenCtx.getImageData(0, 0, 128, 128).data;
    const bounds = pixelsBounds(px);
    const img = {
      frames: [cropToRgb565(px, bounds.left, bounds.top, bounds.right, bounds.bottom)],
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
      delay: 0,
      name: file.name,
      preview: [px],
      previewDelays: [0],
      count: 1,
      totalDuration: 0,
    };
    state.image = img;
    updateScreenMeta(img);
    startPreview();
    $("#uploadImage").disabled = false;
  } catch (err) {
    stopPreview();
    state.image = null;
    screenCtx.fillStyle = "#000";
    screenCtx.fillRect(0, 0, 128, 128);
    $("#imgName").textContent = "—";
    $("#imgFrames").textContent = "—";
    $("#imgDuration").textContent = "—";
    toast("No pude leer esa imagen: " + err.message, "err");
  }
}

function toBase64(u8) {
  let s = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

async function uploadImage() {
  if (!state.image) return;
  const img = state.image;
  const btn = $("#uploadImage");
  const bar = $("#uploadProgress");
  const fill = bar.querySelector("span");
  const totalBytes = img.frames.reduce((sum, frame) => sum + frame.length, 0);
  const estimated = Math.max(3, totalBytes / 12000);
  const started = performance.now();
  if (uploadTimer) clearInterval(uploadTimer);
  btn.disabled = true;
  $("#clearImage").disabled = true;
  $("#fileInput").disabled = true;
  if ($("#testScreen")) $("#testScreen").disabled = true;
  const transformButtons = $$("#screenFitGroup button, #screenRotateGroup button");
  transformButtons.forEach((b) => { b.disabled = true; });
  bar.classList.remove("hidden");
  fill.style.width = "4%";
  uploadTimer = setInterval(() => {
    const pct = Math.min(92, 4 + ((performance.now() - started) / 1000 / estimated) * 88);
    fill.style.width = `${pct}%`;
  }, 200);
  try {
    const result = await api("/api/screen/image", {
      method: "POST",
      body: {
        left: img.left,
        top: img.top,
        right: img.right,
        bottom: img.bottom,
        delay: img.delay,
        pin: $("#screenPinPage")?.checked !== false,
        frames: img.frames.map(toBase64),
      },
    });
    fill.style.width = "100%";
    toast(img.count > 1
      ? `Animación enviada (${img.count} cuadros).`
      : "Imagen enviada a la pantalla.", "ok");
    if (result?.pinned) {
      toast("Página fijada: la pantalla no volverá sola a la imagen anterior.", "ok");
    } else if (result?.pinError) {
      toast("La imagen se subió, pero no se pudo fijar la página. Usa «Mantener página actual».", "err");
    }
  } catch (err) {
    fill.style.width = "0%";
    toast(err.message, "err", "No se pudo subir");
  } finally {
    clearInterval(uploadTimer);
    uploadTimer = null;
    setTimeout(() => { bar.classList.add("hidden"); fill.style.width = "0%"; }, 900);
    btn.disabled = !state.image;
    $("#clearImage").disabled = false;
    $("#fileInput").disabled = false;
    if ($("#testScreen")) $("#testScreen").disabled = false;
    transformButtons.forEach((b) => { b.disabled = false; });
  }
}

function bindScreen() {
  const input = $("#fileInput");
  const drop = $("#dropZone");
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    await handleFile(file);
  });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
  drop.addEventListener("drop", (e) => handleFile(e.dataTransfer?.files?.[0]));
  $("#uploadImage").addEventListener("click", uploadImage);
  $("#clearImage").addEventListener("click", clearScreenPreview);
  $("#testScreen")?.addEventListener("click", loadTestPattern);

  $$("#screenFitGroup button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.screen.fit = btn.dataset.fit || "cover";
      $$("#screenFitGroup button").forEach((b) => b.classList.toggle("active", b === btn));
      if (state.screen.rawFile) {
        handleFile(state.screen.rawFile, {
          strategy: state.screen.lastGifStrategy,
          skipSizePrompt: true,
          silentToast: true,
        });
      }
    });
  });

  $$("#screenRotateGroup button").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.screen.rotate = Number(btn.dataset.rotate) || 0;
      $$("#screenRotateGroup button").forEach((b) => b.classList.toggle("active", b === btn));
      if (state.screen.rawFile) {
        handleFile(state.screen.rawFile, {
          strategy: state.screen.lastGifStrategy,
          skipSizePrompt: true,
          silentToast: true,
        });
      }
    });
  });

  $("#screenTogglePlay")?.addEventListener("click", () => {
    if (!state.image || state.image.preview.length <= 1) return;
    state.screen.playing = !state.screen.playing;
    if (state.screen.playing) startPreview();
    else { stopPreview(); updatePlaybackControls(); }
  });
  $("#screenPrevFrame")?.addEventListener("click", () => {
    if (!state.image || state.image.preview.length <= 1) return;
    state.screen.playing = false;
    stopPreview();
    const total = state.image.preview.length;
    state.screen.frameIndex = ((state.screen.frameIndex || 0) - 1 + total) % total;
    startPreview();
  });
  $("#screenNextFrame")?.addEventListener("click", () => {
    if (!state.image || state.image.preview.length <= 1) return;
    state.screen.playing = false;
    stopPreview();
    const total = state.image.preview.length;
    state.screen.frameIndex = ((state.screen.frameIndex || 0) + 1) % total;
    startPreview();
  });
  $("#syncClock").addEventListener("click", async () => {
    try { await api("/api/screen/clock", { method: "POST", body: {} }); toast("Reloj sincronizado.", "ok"); }
    catch (err) { toast(err.message, "err"); }
  });

  $("#menuSeconds").addEventListener("input", () => { $("#menuSecondsOut").textContent = $("#menuSeconds").value; });

  let playbackMode = "stay";
  try {
    playbackMode = localStorage.getItem("openkey.screenPlayback.v1") === "cycle" ? "cycle" : "stay";
    const savedSeconds = Number(localStorage.getItem("openkey.screenPlaybackSeconds.v1"));
    if (Number.isFinite(savedSeconds) && savedSeconds >= 2 && savedSeconds <= 60) {
      $("#menuSeconds").value = String(savedSeconds);
      $("#menuSecondsOut").textContent = String(savedSeconds);
    }
  } catch { /* localStorage unavailable */ }
  const refreshPlaybackMode = () => {
    $$("#screenPlaybackMode button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.playback === playbackMode);
    });
    $("#screenCycleField").style.display = playbackMode === "cycle" ? "" : "none";
  };
  $$("#screenPlaybackMode button").forEach((btn) => {
    btn.addEventListener("click", () => {
      playbackMode = btn.dataset.playback === "cycle" ? "cycle" : "stay";
      refreshPlaybackMode();
    });
  });
  refreshPlaybackMode();

  const applyPlayback = async (autoCycle) => {
    const btn = autoCycle ? $("#applyPlayback") : $("#stayOnPage");
    setButtonBusy(btn, true, "Aplicando…");
    try {
      const seconds = Number($("#menuSeconds").value) || 10;
      await api("/api/screen/menu", {
        method: "POST",
        body: { autoCycle, seconds },
      });
      playbackMode = autoCycle ? "cycle" : "stay";
      refreshPlaybackMode();
      try {
        localStorage.setItem("openkey.screenPlayback.v1", playbackMode);
        localStorage.setItem("openkey.screenPlaybackSeconds.v1", String(seconds));
      } catch { /* ignore */ }
      toast(
        autoCycle ? `Rotación automática cada ${seconds} s.` : "Página fija: la pantalla ya no cambia sola.",
        "ok",
      );
    } catch (err) {
      toast(err.message, "err", "No se pudo cambiar el modo de reproducción");
    } finally {
      setButtonBusy(btn, false);
    }
  };
  $("#applyPlayback").addEventListener("click", () => applyPlayback(playbackMode === "cycle"));
  $("#stayOnPage").addEventListener("click", () => applyPlayback(false));

  clearScreenPreview();
}

/* -------------------------------------------------------------------- keys */
async function loadKeys() {
  if (!state.status?.connected) return;
  const request = ++state.keysRequest;
  const profile = Number($("#keyProfile").value);
  const layer = Number($("#keyLayer").value);
  state.keysLoading = true;
  $("#keyboardLoading").classList.remove("hidden");
  $("#keyboard").setAttribute("aria-busy", "true");
  $("#reloadKeys").disabled = true;
  $("#keyDetails").classList.add("hidden");
  try {
    const data = await api(`/api/keys?profile=${profile}&layer=${layer}`);
    if (request !== state.keysRequest) return;
    state.profile = profile;
    state.layer = layer;
    state.keys = data.keys;
    renderKeyboard();
    if (state.selected) {
      const again = state.keys.find((k) => k.index === state.selected.index && k.code === state.selected.code);
      if (again) selectKey(again, false, true);
      else { state.selected = null; $("#keyEmpty").classList.remove("hidden"); }
    }
  } catch (err) {
    if (request !== state.keysRequest) return;
    state.keys = null;
    state.selected = null;
    $("#keyboard").innerHTML = "";
    $("#keyEmpty").classList.remove("hidden");
    toast(err.message, "err", "No se pudo leer la matriz");
  } finally {
    if (request === state.keysRequest) {
      state.keysLoading = false;
      $("#keyboardLoading").classList.add("hidden");
      $("#keyboard").setAttribute("aria-busy", "false");
      $("#reloadKeys").disabled = false;
      updateKeyActions();
    }
  }
}

function renderKeyboard() {
  const kb = $("#keyboard");
  kb.innerHTML = "";
  if (!state.keys) return;
  const W = state.layout?.width || 773;
  const H = state.layout?.height || 299;
  for (const key of state.keys) {
    if (key.type === "knob") continue;
    if (key.type === "knob-group") {
      const wheel = document.createElement("button");
      wheel.type = "button";
      wheel.className = "key knob-wheel";
      wheel.style.left = `${(key.x / W) * 100}%`;
      wheel.style.top = `${(key.y / H) * 100}%`;
      wheel.style.width = `${(key.w / W) * 100}%`;
      wheel.style.height = `${(key.h / H) * 100}%`;
      wheel.setAttribute("aria-label", "Rueda: seleccionar giro o pulsación");
      wheel.title = "Rueda: giro izquierdo, pulsación y giro derecho";
      wheel.innerHTML = '<span aria-hidden="true">●</span>';
      wheel.addEventListener("click", () => {
        const parts = state.keys.filter((item) => item.type === "knob");
        const chosen = parts.find((item) => item.code === state.selected?.code) || parts.find((item) => item.code === "AudioVolumeMute") || parts[0];
        if (chosen) selectKey(chosen);
      });
      kb.appendChild(wheel);
      continue;
    }
    const el = document.createElement("button");
    el.type = "button";
    el.className = "key";
    el.style.left = `${(key.x / W) * 100}%`;
    el.style.top = `${(key.y / H) * 100}%`;
    el.style.width = `${(key.w / W) * 100}%`;
    el.style.height = `${(key.h / H) * 100}%`;
    el.dataset.index = key.index ?? "";
    el.dataset.code = key.code;
    const current = key.current || { type: "none", label: "—" };
    el.title = `${pretty(key.label)} → ${pretty(current.label || "—")}`;

    if (key.type === "knob") el.classList.add("key--knob");
    if (current.type === "macro") el.classList.add("key--macro");
    if (current.type === "disabled") el.classList.add("key--off");
    if (current.type === "fn") el.classList.add("key--fn");
    if (current.label && key.defaultLabel && current.label !== key.defaultLabel && current.type !== "disabled" && current.type !== "fn") {
      el.classList.add("key--changed");
    }
    if ((key.label || "").length > 5) el.classList.add("key--wide-label");
    el.textContent = pretty(current.label || key.label);
    el.addEventListener("click", () => selectKey(key));
    kb.appendChild(el);
  }
}

// Visual feedback only: keyboard events are never stored or sent to the server.
window.addEventListener("keydown", (event) => {
  if (!$("#page-keys").classList.contains("active") || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
      event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
  const key = $$(".key", $("#keyboard")).find((element) => element.dataset.code === event.code);
  if (!key) return;
  key.classList.add("input-pulse");
  clearTimeout(key.pulseTimer);
  key.pulseTimer = setTimeout(() => key.classList.remove("input-pulse"), 300);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const keyboard = $("#keyboard");
  const ripple = document.createElement("span");
  ripple.className = "key-ripple";
  ripple.style.left = `${key.offsetLeft + key.offsetWidth / 2}px`;
  ripple.style.top = `${key.offsetTop + key.offsetHeight / 2}px`;
  keyboard.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
});

const CODE_TO_HID = {
  KeyA: 4, KeyB: 5, KeyC: 6, KeyD: 7, KeyE: 8, KeyF: 9, KeyG: 10, KeyH: 11, KeyI: 12,
  KeyJ: 13, KeyK: 14, KeyL: 15, KeyM: 16, KeyN: 17, KeyO: 18, KeyP: 19, KeyQ: 20, KeyR: 21,
  KeyS: 22, KeyT: 23, KeyU: 24, KeyV: 25, KeyW: 26, KeyX: 27, KeyY: 28, KeyZ: 29,
  Digit1: 30, Digit2: 31, Digit3: 32, Digit4: 33, Digit5: 34,
  Digit6: 35, Digit7: 36, Digit8: 37, Digit9: 38, Digit0: 39,
  Enter: 40, Escape: 41, Backspace: 42, Tab: 43, Space: 44,
  Minus: 45, Equal: 46, BracketLeft: 47, BracketRight: 48, Backslash: 49,
  Semicolon: 51, Quote: 52, Backquote: 53, Comma: 54, Period: 55, Slash: 56, CapsLock: 57,
  F1: 58, F2: 59, F3: 60, F4: 61, F5: 62, F6: 63, F7: 64, F8: 65, F9: 66, F10: 67, F11: 68, F12: 69,
  PrintScreen: 70, ScrollLock: 71, Pause: 72, Insert: 73, Home: 74, PageUp: 75,
  Delete: 76, End: 77, PageDown: 78, ArrowRight: 79, ArrowLeft: 80, ArrowDown: 81, ArrowUp: 82,
  ControlLeft: 224, ShiftLeft: 225, AltLeft: 226, MetaLeft: 227,
  ControlRight: 228, ShiftRight: 229, AltRight: 230, MetaRight: 231,
};

function hidLabelFromKeycodes(hid) {
  for (const group of state.keycodes || []) {
    for (const item of group.keys || []) {
      if (item.hid === hid) return item.label;
    }
  }
  return `HID ${hid}`;
}

function setKeyAssignMode(mode) {
  state.keyAssignMode = mode;
  $$("#keyAssignModeGroup button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.assignMode === mode);
  });
  $("#keyAssignPaneKey")?.classList.toggle("hidden", mode !== "key");
  $("#keyAssignPaneCombo")?.classList.toggle("hidden", mode !== "combo");
  $("#keyAssignPaneMacro")?.classList.toggle("hidden", mode !== "macro");
  updateKeyActions();
}

function populateComboAndMacroSelects() {
  const comboMain = $("#comboMainKey");
  if (comboMain && !comboMain.options.length) {
    const basic = [];
    for (const group of state.keycodes || []) {
      for (const k of group.keys || []) {
        if (k.hid >= 4 && k.hid <= 231) basic.push(k);
      }
    }
    comboMain.innerHTML = basic.map((k) => `<option value="${k.hid}">${escapeHtml(k.label)}</option>`).join("");
  }
  const macroSel = $("#keyMacroSlot");
  if (macroSel) {
    const cur = macroSel.value || "0";
    macroSel.innerHTML = Array.from({ length: 50 }, (_, i) => {
      const custom = state.macros.names?.[i];
      const label = custom ? `Slot ${i + 1} · ${custom}` : `Slot ${i + 1}`;
      return `<option value="${i}">${escapeHtml(label)}</option>`;
    }).join("");
    macroSel.value = cur;
  }
}

function selectKey(key, scroll = true, restoring = false) {
  if (!restoring && (state.keysLoading || state.keyWriting)) return;
  state.selected = key;
  $$(".key", $("#keyboard")).forEach((el) => el.classList.toggle("selected", el.classList.contains("knob-wheel") ? key.type === "knob" : el.dataset.index === String(key.index)));
  $("#keyEmpty").classList.add("hidden");
  $("#keyDetails").classList.remove("hidden");
  const knobLabels = { AudioVolumeDown: "Giro a la izquierda", AudioVolumeMute: "Pulsación", AudioVolumeUp: "Giro a la derecha" };
  const knob = key.type === "knob";
  $("#knobOptions").classList.toggle("hidden", !knob);
  if (knob) {
    const actions = $("#knobActions");
    actions.innerHTML = "";
    for (const code of ["AudioVolumeDown", "AudioVolumeMute", "AudioVolumeUp"]) {
      const part = state.keys.find((item) => item.type === "knob" && item.code === code);
      if (!part) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ghost small";
      button.classList.toggle("active", part.code === key.code);
      button.setAttribute("aria-pressed", String(part.code === key.code));
      button.textContent = knobLabels[code];
      button.title = `Actual: ${pretty(part.current?.label || "—")}`;
      button.addEventListener("click", () => selectKey(part, false));
      actions.appendChild(button);
    }
  }
  $("#selKeyName").textContent = knob ? `Rueda · ${knobLabels[key.code] || pretty(key.label)}` : pretty(key.label || key.code);
  $("#selKeySlot").textContent = key.index != null ? `Slot ${key.index}` : "—";
  $("#selCurrent").textContent = pretty(key.current?.label || "—");
  $("#selDefault").textContent = pretty(key.defaultLabel || "—");
  const type = key.current?.type || "none";
  const typeLabels = { key: "Tecla", combo: "Combinación", macro: "Macro", mouse: "Ratón", fn: "Fn", disabled: "Desactivada", function: "Función", none: "—" };
  $("#selType").textContent = typeLabels[type] || type;

  populateComboAndMacroSelects();
  if (type === "macro") {
    $("#keyMacroSlot").value = String(key.current?.macroIndex ?? 0);
    $("#keyMacroMode").value = String(key.current?.macroMode ?? 0);
    setKeyAssignMode("macro");
  } else if (type === "combo" && Array.isArray(key.group)) {
    $("#comboMod1").value = String(key.group[1] || 224);
    $("#comboMainKey").value = String(key.group[2] || 4);
    $("#comboMod2").value = String(key.group[3] || 0);
    setKeyAssignMode("combo");
  } else {
    setKeyAssignMode("key");
  }

  $("#keySearch").value = "";
  renderKeyTargets(key.current?.hid);
  updateKeyActions();
  if (scroll && window.innerWidth < 960) {
    $("#keyPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function renderKeyTargets(selected = $("#keyTarget").value) {
  const key = state.selected;
  if (!key) return;
  const target = $("#keyTarget");
  const query = $("#keySearch").value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  target.innerHTML = "";
  const currentHid = key.current?.hid;
  let count = 0;
  for (const group of state.keycodes) {
    const og = document.createElement("optgroup");
    og.label = group.group;
    for (const k of group.keys) {
      const searchable = `${group.group} ${k.label}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (query && !searchable.includes(query)) continue;
      const opt = document.createElement("option");
      opt.value = String(k.hid);
      opt.textContent = k.label;
      og.appendChild(opt);
      count++;
    }
    if (og.children.length) target.appendChild(og);
  }
  if (!query && currentHid != null) {
    const exists = [...target.options].some((o) => o.value === String(currentHid));
    if (!exists) {
      const opt = document.createElement("option");
      opt.value = String(currentHid);
      opt.textContent = `Actual: ${pretty(key.current.label)}`;
      target.prepend(opt);
    }
  }
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = count ? "Selecciona una función" : "Sin resultados";
  target.prepend(placeholder);
  target.value = selected != null && [...target.options].some((o) => o.value === String(selected)) ? String(selected) : "";
  $("#keySearchHelp").textContent = query ? `${count} ${count === 1 ? "resultado" : "resultados"}` : "Busca por nombre o categoría.";
  updateKeyActions();
}

function updateKeyActions() {
  const key = state.selected;
  const busy = state.keysLoading || state.keyWriting;
  const blocked = !key || key.remappable === false || key.index == null;
  const mode = state.keyAssignMode || "key";
  const canApply = mode === "key" ? $("#keyTarget").value !== "" : true;
  $("#applyKey").disabled = busy || blocked || !canApply;
  $("#resetKey").disabled = busy || blocked;
  $("#disableKey").disabled = busy || blocked;
  $("#keySearch").disabled = busy || blocked;
  $("#keyTarget").disabled = busy || blocked || $("#keyTarget").options.length <= 1;
  if ($("#captureKeyBtn")) $("#captureKeyBtn").disabled = busy || blocked;
  $("#applyKey").title = blocked && key ? "Esta tecla no se puede reasignar." : "";
}

async function applyKey(hid, reset = false, button = $("#applyKey"), customGroup = null) {
  const key = state.selected;
  if (!key || key.index == null || key.remappable === false || state.keysLoading || state.keyWriting) return;
  if (!reset && !customGroup && (hid === "" || hid == null)) return;
  state.keyWriting = true;
  const originalLabel = button.textContent;
  button.textContent = "Guardando…";
  $("#keyProfile").disabled = $("#keyLayer").disabled = true;
  $("#reloadKeys").disabled = true;
  updateKeyActions();
  try {
    const body = { profile: state.profile, layer: state.layer, index: key.index };
    if (reset) body.reset = true;
    else if (customGroup) body.group = customGroup;
    else body.hid = Number(hid);
    await api("/api/keys", { method: "POST", body });
    toast(reset ? "Tecla restablecida." : "Tecla actualizada.", "ok");
    state.keyWriting = false;
    await loadKeys();
  } catch (err) {
    toast(err.message, "err", "No se pudo cambiar");
  } finally {
    state.keyWriting = false;
    button.textContent = originalLabel;
    $("#keyProfile").disabled = $("#keyLayer").disabled = false;
    $("#reloadKeys").disabled = false;
    updateKeyActions();
  }
}

async function exportKeysBackup() {
  const btn = $("#exportKeysBtn");
  setButtonBusy(btn, true, "Exportando…");
  try {
    const data = await api("/api/keys/backup");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "openkey-teclas-respaldo.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Respaldo JSON exportado (perfiles 0 y 1, capas base y Fn).", "ok");
  } catch (err) {
    toast(err.message, "err", "No se pudo exportar");
  } finally {
    setButtonBusy(btn, false);
  }
}

async function importKeysBackup(file) {
  if (!file) return;
  const btn = $("#importKeysBtn");
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed?.profiles || typeof parsed.profiles !== "object") {
      throw new Error("El archivo JSON no contiene perfiles de teclas válidos.");
    }
    const ok = await confirmDialog(
      "Restaurar respaldo de teclas",
      "Se escribirán los perfiles y capas del archivo directamente en el teclado y se comprobará la lectura posterior. La tecla Fn se protege automáticamente.",
      "Restaurar ahora",
    );
    if (!ok) return;
    setButtonBusy(btn, true, "Restaurando…");
    const res = await api("/api/keys/restore", { method: "POST", body: { profiles: parsed.profiles } });
    toast(`Se restauraron y verificaron ${res.restoredLayers} capas de teclas.`, "ok");
    await loadKeys();
  } catch (err) {
    toast(err.message, "err", "No se pudo restaurar el respaldo");
  } finally {
    setButtonBusy(btn, false);
  }
}

function bindKeys() {
  $("#reloadKeys").addEventListener("click", loadKeys);
  $("#keyProfile").addEventListener("change", loadKeys);
  $("#keyLayer").addEventListener("change", loadKeys);
  $("#keySearch").addEventListener("input", () => renderKeyTargets());
  $("#keyTarget").addEventListener("change", updateKeyActions);

  $$("#keyAssignModeGroup button").forEach((btn) => {
    btn.addEventListener("click", () => setKeyAssignMode(btn.dataset.assignMode));
  });

  $("#captureKeyBtn")?.addEventListener("click", () => {
    const btn = $("#captureKeyBtn");
    state.capturingKey = !state.capturingKey;
    btn.classList.toggle("capturing", state.capturingKey);
    btn.textContent = state.capturingKey
      ? "Pulsa cualquier tecla ahora… (Esc cancela)"
      : "Pulsar una tecla física para capturar…";
  });

  window.addEventListener("keydown", (event) => {
    if (!state.capturingKey) return;
    event.preventDefault();
    event.stopPropagation();
    const btn = $("#captureKeyBtn");
    state.capturingKey = false;
    if (btn) {
      btn.classList.remove("capturing");
      btn.textContent = "Pulsar una tecla física para capturar…";
    }
    const hid = CODE_TO_HID[event.code];
    if (!hid) {
      toast("No se reconoció esa tecla física.", "err");
      return;
    }
    $("#keySearch").value = "";
    renderKeyTargets(hid);
    toast(`Tecla capturada: ${hidLabelFromKeycodes(hid)}. Pulsa «Aplicar cambio» para guardarla.`, "ok");
  }, true);

  $("#applyKey").addEventListener("click", () => {
    const mode = state.keyAssignMode || "key";
    if (mode === "combo") {
      const mod1 = Number($("#comboMod1").value) & 0xFF;
      const main = Number($("#comboMainKey").value) & 0xFF;
      const mod2 = Number($("#comboMod2").value) & 0xFF;
      applyKey(null, false, $("#applyKey"), [0, mod1, main, mod2]);
    } else if (mode === "macro") {
      const slot = Math.max(0, Math.min(49, Number($("#keyMacroSlot").value) || 0));
      const macroMode = Math.max(0, Math.min(2, Number($("#keyMacroMode").value) || 0));
      applyKey(null, false, $("#applyKey"), [9, macroMode, slot, 0]);
    } else {
      applyKey($("#keyTarget").value);
    }
  });
  $("#resetKey").addEventListener("click", () => applyKey(null, true, $("#resetKey")));
  $("#disableKey").addEventListener("click", () => applyKey(0, false, $("#disableKey")));

  $("#exportKeysBtn")?.addEventListener("click", exportKeysBackup);
  $("#importKeysBtn")?.addEventListener("click", () => $("#importKeysInput")?.click());
  $("#importKeysInput")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    importKeysBackup(file);
  });
}

/* ------------------------------------------------------------------- music */
const MUSIC_CELLS = 21 * 6;

function buildMusicGrid() {
  const grid = $("#musicGrid");
  if (!grid || grid.children.length) return;
  for (let i = 0; i < MUSIC_CELLS; i++) {
    const cell = document.createElement("span");
    cell.className = "music-cell";
    grid.appendChild(cell);
  }
}

function musicParams() {
  return {
    source: $("#musicSource").value,
    gain: Number($("#musicGain").value),
    mode: $("#musicMode").value,
    color: $("#musicColor").value,
    fps: Number($("#musicFps").value),
  };
}

function renderMusicFrame(encoded) {
  const cells = $$(".music-cell", $("#musicGrid"));
  if (!cells.length) return;
  if (!encoded) {
    cells.forEach((cell) => { cell.style.backgroundColor = ""; });
    return;
  }
  let raw;
  try {
    raw = atob(encoded);
  } catch {
    return;
  }
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  for (let i = 0; i < cells.length; i++) {
    cells[i].style.backgroundColor = `rgb(${bytes[i * 3] || 0}, ${bytes[i * 3 + 1] || 0}, ${bytes[i * 3 + 2] || 0})`;
  }
}

function renderMusicStatus(data) {
  const running = !!data?.running;
  state.music.running = running;
  const pill = $("#musicStatusPill");
  pill.textContent = running ? "Activo" : "Detenido";
  pill.className = `pill ${running ? "on" : "off"}`;
  $("#musicStart").disabled = running;
  $("#musicStop").disabled = !running;
  $("#musicSource").disabled = running;
  $("#musicState").textContent = data?.error ? "Error" : (running ? "Sincronizando" : "Detenido");
  $("#musicFormat").textContent = data?.format || "—";
  $("#musicCpu").textContent = running && data?.estimatedCpu != null
    ? `${data.estimatedCpu}% de un núcleo`
    : "—";
  $("#musicRam").textContent = data?.memoryMB ? `${data.memoryMB} MB` : "—";
  $("#musicFrames").textContent = data?.frames != null ? String(data.frames) : "—";
  $("#musicDetail").textContent = running
    ? `Audio ${data.readMs ?? "—"} ms · FFT ${data.frameMs ?? "—"} ms · HID ${data.sendMs ?? "—"} ms`
    : "Audio — · FFT — · HID —";
  const error = $("#musicError");
  if (data?.error) {
    error.textContent = data.error;
    error.classList.remove("hidden");
  } else {
    error.textContent = "";
    error.classList.add("hidden");
  }
  renderMusicFrame(running ? data.frame : "");
  const nav = $('.nav-item[data-page="music"]');
  if (nav) nav.classList.toggle("nav-item--live", running);
}

async function pollMusic() {
  if (state.music.polling) return;
  state.music.polling = true;
  try {
    renderMusicStatus(await api("/api/music/status"));
  } catch (err) {
    console.error("music status", err);
  } finally {
    state.music.polling = false;
    if (state.music.running) scheduleMusicPoll();
  }
}

function scheduleMusicPoll() {
  if (state.music.timer) clearTimeout(state.music.timer);
  state.music.timer = null;
  if (!state.music.running) return;
  const active = $("#page-music").classList.contains("active");
  state.music.timer = setTimeout(pollMusic, active ? 200 : 1000);
}

async function startMusic() {
  const button = $("#musicStart");
  setButtonBusy(button, true, "Iniciando…");
  try {
    const data = await api("/api/music/start", { method: "POST", body: musicParams() });
    renderMusicStatus(data);
    try {
      renderRippleStatus(await api("/api/ripple/status"));
    } catch { /* the ripple service is optional */ }
    if (data.error) toast(data.error, "err", "No se pudo iniciar");
    else toast("Sincronización de audio iniciada. Consume solo mientras esté activa.", "ok");
    scheduleMusicPoll();
  } catch (err) {
    toast(err.message, "err", "No se pudo iniciar");
  } finally {
    setButtonBusy(button, false);
    $("#musicStart").disabled = state.music.running;
    $("#musicStop").disabled = !state.music.running;
  }
}

async function stopMusic() {
  const button = $("#musicStop");
  setButtonBusy(button, true, "Deteniendo…");
  try {
    const data = await api("/api/music/stop", { method: "POST", body: {} });
    renderMusicStatus(data);
    if (!data.running) toast("Sincronización detenida. Iluminación restaurada.", "ok");
  } catch (err) {
    toast(err.message, "err", "No se pudo detener");
  } finally {
    setButtonBusy(button, false);
    $("#musicStart").disabled = state.music.running;
    $("#musicStop").disabled = !state.music.running;
  }
}

function configureMusic() {
  $("#musicGainOut").textContent = $("#musicGain").value;
  $("#musicFpsOut").textContent = $("#musicFps").value;
  if (!state.music.running) return;
  clearTimeout(state.music.configTimer);
  state.music.configTimer = setTimeout(async () => {
    try {
      renderMusicStatus(await api("/api/music/config", { method: "POST", body: musicParams() }));
    } catch (err) {
      toast(err.message, "err", "No se pudo ajustar");
    }
  }, 150);
}

function bindMusic() {
  buildMusicGrid();
  $("#musicStart").addEventListener("click", startMusic);
  $("#musicStop").addEventListener("click", stopMusic);
  ["musicSource", "musicMode", "musicColor", "musicFps"].forEach((id) =>
    $("#" + id).addEventListener("change", configureMusic));
  $("#musicGain").addEventListener("input", configureMusic);
  window.addEventListener("pagehide", () => {
    if (state.music.running) {
      try { navigator.sendBeacon("/api/music/stop", "{}"); } catch { /* ignore */ }
    }
    if (state.ripple.running) {
      try { navigator.sendBeacon("/api/ripple/stop", "{}"); } catch { /* ignore */ }
    }
  });
}

/* ------------------------------------------------------------------ ripple */
const WATER_DROP_PRESET = {
  colorMode: "fixed",
  color: "#00E5FF",
  expansion: 1.0,
  lifetime: 1.1,
  thickness: 0.6,
  maxRadius: 6.0,
  fps: 30,
  includeModifiers: false,
};
const RIPPLE_STORAGE_KEY = "openkey.ripple.v1";

function buildRippleGrid() {
  const grid = $("#rippleGrid");
  if (!grid || grid.children.length) return;
  for (let i = 0; i < MUSIC_CELLS; i++) {
    const cell = document.createElement("span");
    cell.className = "music-cell";
    const col = i % 21;
    const row = Math.floor(i / 21);
    cell.addEventListener("click", async () => {
      if (!state.ripple.running) {
        toast("Inicia la onda reactiva para verla en el teclado.", "ok");
        return;
      }
      try {
        renderRippleStatus(await api("/api/ripple/trigger", { method: "POST", body: { x: col + 0.5, y: row + 0.5 } }));
      } catch { /* ignore */ }
    });
    grid.appendChild(cell);
  }
}

function readRippleForm() {
  return {
    colorMode: $("#rippleColorMode").value,
    color: $("#rippleColorHex").value,
    expansion: Number($("#rippleExpansion").value),
    lifetime: Number($("#rippleLifetime").value),
    thickness: Number($("#rippleThickness").value),
    maxRadius: Number($("#rippleRadius").value),
    fps: Number($("#rippleFps").value),
    includeModifiers: $("#rippleModifiers").checked,
  };
}

function setRippleForm(cfg) {
  const c = { ...WATER_DROP_PRESET, ...(cfg || {}) };
  $("#rippleColorMode").value = c.colorMode;
  $("#rippleColor").value = String(c.color || "#00E5FF").toLowerCase();
  $("#rippleColorHex").value = String(c.color || "#00E5FF").toUpperCase();
  $("#rippleExpansion").value = String(c.expansion);
  $("#rippleExpansionOut").textContent = `${Number(c.expansion).toFixed(2).replace(/\.00$/, ".0")}×`;
  $("#rippleLifetime").value = String(c.lifetime);
  $("#rippleLifetimeOut").textContent = `${Number(c.lifetime).toFixed(2).replace(/0$/, "")} s`;
  $("#rippleThickness").value = String(c.thickness);
  $("#rippleThicknessOut").textContent = Number(c.thickness).toFixed(2);
  $("#rippleRadius").value = String(c.maxRadius);
  $("#rippleRadiusOut").textContent = String(c.maxRadius);
  $("#rippleFps").value = String(c.fps);
  $("#rippleModifiers").checked = !!c.includeModifiers;
}

function saveRippleLocal() {
  try {
    localStorage.setItem(RIPPLE_STORAGE_KEY, JSON.stringify(readRippleForm()));
  } catch { /* ignore */ }
}

function renderRippleFrame(encoded) {
  const cells = $$(".music-cell", $("#rippleGrid"));
  if (!cells.length) return;
  if (!encoded) {
    cells.forEach((cell) => { cell.style.backgroundColor = ""; });
    return;
  }
  let raw;
  try { raw = atob(encoded); } catch { return; }
  for (let i = 0; i < cells.length; i++) {
    const r = raw.charCodeAt(i * 3) || 0;
    const g = raw.charCodeAt(i * 3 + 1) || 0;
    const b = raw.charCodeAt(i * 3 + 2) || 0;
    cells[i].style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  }
}

function renderRippleStatus(data) {
  const running = !!data?.running;
  state.ripple.running = running;
  const pill = $("#rippleStatusPill");
  if (pill) {
    pill.textContent = running ? `Activo · ${data.fps || 30} fps` : "Detenido";
    pill.className = `pill ${running ? "on" : "off"}`;
  }
  $("#rippleStart").disabled = running;
  $("#rippleStop").disabled = !running;
  $("#rippleState").textContent = data?.error ? "Error" : (running ? "Transmitiendo por USB (0x0F)" : "Detenido");
  $("#rippleKeys").textContent = `${data?.keys ?? 0} teclas · ${data?.activeRipples ?? 0} activas`;
  $("#rippleSendMs").textContent = running && data?.sendMs != null ? `${data.sendMs} ms / cuadro` : "—";
  $("#rippleCpu").textContent = running && data?.estimatedCpu != null ? `${data.estimatedCpu}% de un núcleo` : "—";
  const badge = $("#rippleTabBadge");
  if (badge) badge.textContent = running ? "● Activa en vivo" : "Personalizada · 0x0F";
  const nav = $('.nav-item[data-page="lighting"]');
  if (nav) nav.classList.toggle("nav-item--live", running);

  const error = $("#rippleError");
  if (data?.error) {
    error.textContent = data.error;
    error.classList.remove("hidden");
  } else {
    error.textContent = "";
    error.classList.add("hidden");
  }
  renderRippleFrame(running ? data.frame : "");
}

async function pollRipple() {
  if (state.ripple.polling) return;
  state.ripple.polling = true;
  try {
    renderRippleStatus(await api("/api/ripple/status"));
  } catch (err) {
    console.error("ripple status", err);
  } finally {
    state.ripple.polling = false;
    if (state.ripple.running) scheduleRipplePoll();
  }
}

function scheduleRipplePoll() {
  if (state.ripple.timer) clearTimeout(state.ripple.timer);
  state.ripple.timer = null;
  if (!state.ripple.running) return;
  const visible = $("#page-lighting").classList.contains("active") && $("#lightingPaneRipple")?.classList.contains("active");
  state.ripple.timer = setTimeout(pollRipple, visible ? 180 : 1000);
}

async function startRipple() {
  const btn = $("#rippleStart");
  setButtonBusy(btn, true, "Iniciando…");
  try {
    saveRippleLocal();
    const data = await api("/api/ripple/start", { method: "POST", body: readRippleForm() });
    renderRippleStatus(data);
    if (state.music.running) renderMusicStatus(await api("/api/music/status"));
    if (data.error) toast(data.error, "err", "No se pudo iniciar");
    else toast("Onda reactiva «Water drop» activa. Pulsa cualquier tecla.", "ok");
    scheduleRipplePoll();
  } catch (err) {
    toast(err.message, "err", "No se pudo iniciar la onda");
  } finally {
    setButtonBusy(btn, false);
    $("#rippleStart").disabled = state.ripple.running;
    $("#rippleStop").disabled = !state.ripple.running;
  }
}

async function stopRipple() {
  const btn = $("#rippleStop");
  setButtonBusy(btn, true, "Deteniendo…");
  try {
    const data = await api("/api/ripple/stop", { method: "POST", body: {} });
    renderRippleStatus(data);
    toast("Onda reactiva detenida. Iluminación restaurada.", "ok");
  } catch (err) {
    toast(err.message, "err", "No se pudo detener");
  } finally {
    setButtonBusy(btn, false);
    $("#rippleStart").disabled = state.ripple.running;
    $("#rippleStop").disabled = !state.ripple.running;
  }
}

function configureRipple() {
  const cfg = readRippleForm();
  $("#rippleExpansionOut").textContent = `${cfg.expansion.toFixed(2).replace(/\.00$/, ".0")}×`;
  $("#rippleLifetimeOut").textContent = `${cfg.lifetime.toFixed(2).replace(/0$/, "")} s`;
  $("#rippleThicknessOut").textContent = cfg.thickness.toFixed(2);
  $("#rippleRadiusOut").textContent = String(cfg.maxRadius);
  saveRippleLocal();
  if (!state.ripple.running) return;
  clearTimeout(state.ripple.configTimer);
  state.ripple.configTimer = setTimeout(async () => {
    try {
      renderRippleStatus(await api("/api/ripple/config", { method: "POST", body: cfg }));
    } catch (err) {
      toast(err.message, "err");
    }
  }, 120);
}

function bindRipple() {
  buildRippleGrid();
  try {
    const saved = JSON.parse(localStorage.getItem(RIPPLE_STORAGE_KEY) || "null");
    setRippleForm(saved || WATER_DROP_PRESET);
  } catch {
    setRippleForm(WATER_DROP_PRESET);
  }

  $("#rippleColor").addEventListener("input", () => {
    $("#rippleColorHex").value = $("#rippleColor").value.toUpperCase();
    configureRipple();
  });
  $("#rippleColorHex").addEventListener("change", () => {
    if (/^#[0-9a-f]{6}$/i.test($("#rippleColorHex").value)) {
      $("#rippleColor").value = $("#rippleColorHex").value.toLowerCase();
      configureRipple();
    } else {
      $("#rippleColorHex").value = $("#rippleColor").value.toUpperCase();
    }
  });
  ["rippleColorMode", "rippleFps", "rippleModifiers"].forEach((id) =>
    $("#" + id).addEventListener("change", configureRipple));
  ["rippleExpansion", "rippleLifetime", "rippleThickness", "rippleRadius"].forEach((id) =>
    $("#" + id).addEventListener("input", configureRipple));

  $("#rippleStart").addEventListener("click", startRipple);
  $("#rippleStop").addEventListener("click", stopRipple);

  $("#rippleTestCenter").addEventListener("click", async () => {
    if (!state.ripple.running) {
      await startRipple();
      if (!state.ripple.running) return;
    }
    try {
      renderRippleStatus(await api("/api/ripple/trigger", { method: "POST", body: {} }));
    } catch (err) {
      toast(err.message, "err");
    }
  });

  $("#ripplePresetWaterDrop").addEventListener("click", () => {
    setRippleForm(WATER_DROP_PRESET);
    configureRipple();
    toast("Preset «Water drop» cargado (expansión 1.0×, 1.1 s, grosor 0.60, radio 6, 30 fps).", "ok");
  });

  $("#rippleApplyFirmware").addEventListener("click", async () => {
    const btn = $("#rippleApplyFirmware");
    setButtonBusy(btn, true, "Aplicando…");
    try {
      if (state.ripple.running) await api("/api/ripple/stop", { method: "POST", body: {} });
      const cfg = readRippleForm();
      const data = await api("/api/light", {
        method: "POST",
        body: {
          mode: "LightRipple",
          brightness: Number($("#mainBright")?.value || 4),
          speed: 2,
          rgb: hexToInt(cfg.color),
          dazzle: cfg.colorMode === "rainbow",
          option: 0,
        },
      });
      if (data.light) setLightForm("main", data.light);
      renderRippleStatus(await api("/api/ripple/status"));
      toast("Modo Onda del firmware (modo 5) guardado en el teclado. Funciona con la app cerrada.", "ok");
    } catch (err) {
      toast(err.message, "err", "No se pudo aplicar");
    } finally {
      setButtonBusy(btn, false);
    }
  });
}

/* ------------------------------------------------------------------ macros */
const MACRO_NAMES_KEY = "openkey.macroNames.v1";

function loadMacroNames() {
  try {
    state.macros.names = JSON.parse(localStorage.getItem(MACRO_NAMES_KEY) || "{}") || {};
  } catch {
    state.macros.names = {};
  }
}

function saveMacroNames() {
  try {
    localStorage.setItem(MACRO_NAMES_KEY, JSON.stringify(state.macros.names));
  } catch { /* ignore */ }
}

function macroEventByteLen(ev) {
  const delay = Math.max(0, Math.min(65535, Number(ev.delayMs) || 0));
  if (ev.kind === "mouseMove") return delay >= 1 && delay <= 127 ? 4 : 6;
  return delay >= 1 && delay <= 127 ? 2 : 4;
}

function calcMacroBytes(macro) {
  const events = macro?.events || [];
  return 2 + events.reduce((sum, ev) => sum + macroEventByteLen(ev), 0) + 4;
}

function renderMacroSlotList() {
  const list = $("#macroSlotList");
  if (!list) return;
  const names = state.macros.names || {};
  const namedCount = Object.keys(names).filter((k) => names[k]?.trim()).length;
  $("#macroNamedCount").textContent = `${namedCount} con nombre`;
  list.innerHTML = "";
  for (let slot = 0; slot < 50; slot++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `macro-slot-item${state.macros.slot === slot ? " active" : ""}`;
    const custom = names[slot]?.trim();
    btn.innerHTML = `
      <span class="macro-slot-num">#${String(slot + 1).padStart(2, "0")}</span>
      <span class="ellipsis" style="flex:1" data-no-i18n>${escapeHtml(custom || `Macro ${slot + 1}`)}</span>
    `;
    btn.addEventListener("click", () => selectMacroSlot(slot));
    list.appendChild(btn);
  }
  populateComboAndMacroSelects();
}

function renderMacroEditor() {
  const slot = state.macros.slot;
  const macro = state.macros.macro || { repeat: 1, events: [] };
  const custom = state.macros.names?.[slot] || "";
  $("#macroTitle").textContent = custom ? `Slot ${slot + 1} · ${custom}` : `Slot ${slot + 1}`;
  $("#macroName").value = custom;
  $("#macroRepeat").value = String(macro.repeat || 1);

  const bytes = calcMacroBytes(macro);
  const over = bytes > 256;
  $("#macroSubtitle").textContent = state.macros.recording
    ? `Grabando secuencia… (${state.macros.recordEvents.length} eventos)`
    : `${macro.events.length} ${macro.events.length === 1 ? "evento" : "eventos"} · ${bytes} / 256 bytes`;
  const badge = $("#macroBytesBadge");
  badge.textContent = `${bytes} / 256 B`;
  badge.className = `pill ${over ? "off" : "on"}`;
  $("#macroSaveBtn").disabled = over || state.macros.recording;

  const box = $("#macroEventsList");
  box.innerHTML = "";
  if (!macro.events.length) {
    box.innerHTML = '<div class="key-empty" style="min-height:160px"><strong>Sin eventos en este slot</strong><p>Pulsa «Grabar secuencia» y escribe en tu teclado, o añade pasos manualmente.</p></div>';
    return;
  }

  const basicKeys = [];
  for (const group of state.keycodes || []) {
    for (const k of group.keys || []) {
      if (k.hid >= 4 && k.hid <= 231) basicKeys.push(k);
    }
  }

  macro.events.forEach((ev, idx) => {
    const row = document.createElement("div");
    row.className = "macro-event-row";

    const num = document.createElement("span");
    num.className = "mono muted";
    num.textContent = String(idx + 1).padStart(2, "0");

    const kindSel = document.createElement("select");
    kindSel.innerHTML = `
      <option value="key">Tecla</option>
      <option value="mouseButton">Clic ratón</option>
      <option value="mouseMove">Mover ratón</option>
    `;
    kindSel.value = ev.kind || "key";
    kindSel.addEventListener("change", () => {
      const nextKind = kindSel.value;
      if (nextKind === "key") macro.events[idx] = { kind: "key", usage: 4, pressed: true, delayMs: ev.delayMs ?? 25 };
      else if (nextKind === "mouseButton") macro.events[idx] = { kind: "mouseButton", button: 0, pressed: true, delayMs: ev.delayMs ?? 25 };
      else macro.events[idx] = { kind: "mouseMove", dx: 10, dy: 0, delayMs: ev.delayMs ?? 20 };
      renderMacroEditor();
    });

    const targetWrap = document.createElement("div");
    const actionWrap = document.createElement("div");

    if (ev.kind === "mouseMove") {
      targetWrap.innerHTML = `<input type="number" min="-127" max="127" value="${Number(ev.dx) || 0}" title="Desplazamiento X">`;
      actionWrap.innerHTML = `<input type="number" min="-127" max="127" value="${Number(ev.dy) || 0}" title="Desplazamiento Y">`;
      targetWrap.querySelector("input").addEventListener("change", (e) => { ev.dx = Number(e.target.value) || 0; });
      actionWrap.querySelector("input").addEventListener("change", (e) => { ev.dy = Number(e.target.value) || 0; });
    } else {
      if (ev.kind === "mouseButton") {
        const bSel = document.createElement("select");
        bSel.innerHTML = [
          [0, "Botón izquierdo"],
          [1, "Botón derecho"],
          [2, "Botón central"],
          [3, "Atrás"],
          [4, "Adelante"],
        ].map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
        bSel.value = String(ev.button ?? 0);
        bSel.addEventListener("change", () => { ev.button = Number(bSel.value) || 0; });
        targetWrap.appendChild(bSel);
      } else {
        const kSel = document.createElement("select");
        kSel.innerHTML = basicKeys.map((k) => `<option value="${k.hid}">${escapeHtml(k.label)}</option>`).join("");
        kSel.value = String(ev.usage || 4);
        kSel.addEventListener("change", () => { ev.usage = Number(kSel.value) || 4; });
        targetWrap.appendChild(kSel);
      }

      const dirSel = document.createElement("select");
      dirSel.innerHTML = `<option value="down">Pulsar ↓</option><option value="up">Soltar ↑</option>`;
      dirSel.value = ev.pressed ? "down" : "up";
      dirSel.addEventListener("change", () => { ev.pressed = dirSel.value === "down"; });
      actionWrap.appendChild(dirSel);
    }

    const delayInput = document.createElement("input");
    delayInput.type = "number";
    delayInput.min = "0";
    delayInput.max = "65535";
    delayInput.value = String(ev.delayMs ?? 25);
    delayInput.title = "Demora en milisegundos";
    delayInput.addEventListener("change", () => {
      ev.delayMs = Math.max(0, Math.min(65535, Number(delayInput.value) || 0));
      renderMacroEditor();
    });

    const actions = document.createElement("div");
    actions.className = "macro-event-actions";
    actions.innerHTML = `
      <button type="button" class="ghost small" data-act="up" title="Subir">↑</button>
      <button type="button" class="ghost small" data-act="down" title="Bajar">↓</button>
      <button type="button" class="ghost small danger-text" data-act="del" title="Eliminar">×</button>
    `;
    actions.querySelector('[data-act="up"]').disabled = idx === 0;
    actions.querySelector('[data-act="down"]').disabled = idx === macro.events.length - 1;
    actions.querySelector('[data-act="up"]').addEventListener("click", () => {
      [macro.events[idx - 1], macro.events[idx]] = [macro.events[idx], macro.events[idx - 1]];
      renderMacroEditor();
    });
    actions.querySelector('[data-act="down"]').addEventListener("click", () => {
      [macro.events[idx + 1], macro.events[idx]] = [macro.events[idx], macro.events[idx + 1]];
      renderMacroEditor();
    });
    actions.querySelector('[data-act="del"]').addEventListener("click", () => {
      macro.events.splice(idx, 1);
      renderMacroEditor();
    });

    row.append(num, kindSel, targetWrap, actionWrap, delayInput, actions);
    box.appendChild(row);
  });
}

async function selectMacroSlot(slot, readFromHw = true) {
  state.macros.slot = slot;
  renderMacroSlotList();
  renderMacroEditor();
  if (readFromHw && state.status?.connected) {
    await readMacroFromKeyboard(true);
  }
}

async function readMacroFromKeyboard(silent = false) {
  const btn = $("#macroReadBtn");
  setButtonBusy(btn, true, "Leyendo…");
  try {
    const data = await api(`/api/macros?slot=${state.macros.slot}`);
    state.macros.macro = data.macro || { repeat: 1, events: [] };
    renderMacroEditor();
    if (!silent) toast(`Slot ${state.macros.slot + 1} leído del teclado.`, "ok");
  } catch (err) {
    if (!silent) toast(err.message, "err", "No se pudo leer la macro");
  } finally {
    setButtonBusy(btn, false);
  }
}

async function saveMacroToKeyboard() {
  const btn = $("#macroSaveBtn");
  setButtonBusy(btn, true, "Guardando…");
  try {
    const slot = state.macros.slot;
    const name = $("#macroName").value.trim();
    if (name) state.macros.names[slot] = name;
    else delete state.macros.names[slot];
    saveMacroNames();
    state.macros.macro.repeat = Math.max(1, Math.min(65535, Number($("#macroRepeat").value) || 1));
    const data = await api("/api/macros", {
      method: "POST",
      body: { slot, macro: state.macros.macro },
    });
    state.macros.macro = data.macro || state.macros.macro;
    renderMacroSlotList();
    renderMacroEditor();
    toast(`Macro guardada en el slot ${slot + 1}.`, "ok");
  } catch (err) {
    toast(err.message, "err", "No se pudo guardar la macro");
  } finally {
    setButtonBusy(btn, false);
  }
}

function bindMacros() {
  loadMacroNames();
  renderMacroSlotList();
  renderMacroEditor();

  $("#macroName").addEventListener("input", () => {
    const slot = state.macros.slot;
    const val = $("#macroName").value.trim();
    if (val) state.macros.names[slot] = val;
    else delete state.macros.names[slot];
    saveMacroNames();
    renderMacroSlotList();
    $("#macroTitle").textContent = val ? `Slot ${slot + 1} · ${val}` : `Slot ${slot + 1}`;
  });

  $("#macroRepeat").addEventListener("change", () => {
    state.macros.macro.repeat = Math.max(1, Math.min(65535, Number($("#macroRepeat").value) || 1));
  });

  $("#macroAddKeyBtn").addEventListener("click", () => {
    state.macros.macro.events.push(
      { kind: "key", usage: 4, pressed: true, delayMs: 25 },
      { kind: "key", usage: 4, pressed: false, delayMs: 25 },
    );
    renderMacroEditor();
  });

  $("#macroAddClickBtn").addEventListener("click", () => {
    state.macros.macro.events.push(
      { kind: "mouseButton", button: 0, pressed: true, delayMs: 25 },
      { kind: "mouseButton", button: 0, pressed: false, delayMs: 25 },
    );
    renderMacroEditor();
  });

  $("#macroAddMoveBtn").addEventListener("click", () => {
    state.macros.macro.events.push({ kind: "mouseMove", dx: 15, dy: 0, delayMs: 20 });
    renderMacroEditor();
  });

  $("#macroClearBtn").addEventListener("click", () => {
    state.macros.macro.events = [];
    renderMacroEditor();
  });

  $("#macroRecordBtn").addEventListener("click", () => {
    const btn = $("#macroRecordBtn");
    if (!state.macros.recording) {
      state.macros.recording = true;
      state.macros.recordLast = performance.now();
      state.macros.recordEvents = [];
      btn.textContent = "■ Detener grabación";
      btn.className = "danger small";
      renderMacroEditor();
      toast("Grabando: pulsa la secuencia de teclas y luego «Detener grabación».", "ok");
    } else {
      state.macros.recording = false;
      btn.textContent = "● Grabar secuencia";
      btn.className = "primary small";
      if (state.macros.recordEvents.length) {
        state.macros.macro.events = state.macros.recordEvents.slice();
        toast(`Se capturaron ${state.macros.recordEvents.length} eventos.`, "ok");
      }
      renderMacroEditor();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (!state.macros.recording || event.repeat) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
    const usage = CODE_TO_HID[event.code];
    if (!usage) return;
    event.preventDefault();
    const now = performance.now();
    const delay = Math.max(5, Math.min(65535, Math.round(now - state.macros.recordLast)));
    state.macros.recordLast = now;
    state.macros.recordEvents.push({ kind: "key", usage, pressed: true, delayMs: delay });
    renderMacroEditor();
  }, true);

  window.addEventListener("keyup", (event) => {
    if (!state.macros.recording) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || "")) return;
    const usage = CODE_TO_HID[event.code];
    if (!usage) return;
    event.preventDefault();
    const now = performance.now();
    const delay = Math.max(5, Math.min(65535, Math.round(now - state.macros.recordLast)));
    state.macros.recordLast = now;
    state.macros.recordEvents.push({ kind: "key", usage, pressed: false, delayMs: delay });
    renderMacroEditor();
  }, true);

  $("#macroSaveBtn").addEventListener("click", saveMacroToKeyboard);
  $("#macroReadBtn").addEventListener("click", () => readMacroFromKeyboard(false));
}

/* ---------------------------------------------------------------- settings */
function renderRateButtons(current) {
  const box = $("#rateButtons");
  box.innerHTML = "";
  for (const rate of state.meta?.reportRates || [8000, 4000, 2000, 1000, 500, 250, 125]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${rate} Hz`;
    b.dataset.rate = rate;
    b.classList.toggle("active", rate === current);
    b.addEventListener("click", () => {
      state.rate = rate;
      $$("button", box).forEach((x) => x.classList.toggle("active", x === b));
    });
    box.appendChild(b);
  }
  state.rate = current;
}

function bindSettings() {
  $("#debounce").addEventListener("input", () => { $("#debounceOut").textContent = $("#debounce").value; });

  $("#applyPerf").addEventListener("click", async () => {
    const btn = $("#applyPerf");
    setButtonBusy(btn, true, "Aplicando…");
    try {
      const rate = state.rate || Number($(".segmented button.active")?.dataset.rate || 1000);
      const data = await api("/api/settings", { method: "POST", body: { reportRate: rate, debounce: Number($("#debounce").value) } });
      state.status = data.status;
      renderStatus(true);
      toast("Rendimiento actualizado.", "ok");
    } catch (err) {
      toast(err.message, "err", "No se pudo aplicar");
    } finally { setButtonBusy(btn, false); }
  });

  $("#applyProfile").addEventListener("click", async () => {
    const btn = $("#applyProfile");
    setButtonBusy(btn, true, "Aplicando…");
    try {
      const data = await api("/api/settings", {
        method: "POST",
        body: { profile: Number($("#profileSelect").value), system: $("#systemSelect").value },
      });
      state.status = data.status;
      renderStatus(true);
      toast("Perfil y sistema actualizados.", "ok");
    } catch (err) {
      toast(err.message, "err", "No se pudo aplicar");
    } finally { setButtonBusy(btn, false); }
  });

  $("#applySleep").addEventListener("click", async () => {
    const btn = $("#applySleep");
    setButtonBusy(btn, true, "Aplicando…");
    try {
      const body = { sleep: {
        bt: Number($("#sleepBt").value) * 60,
        wired: Number($("#sleepWired").value) * 60,
        deepBt: Number($("#sleepDeepBt").value) * 60,
        deepWired: Number($("#sleepDeepWired").value) * 60,
      }};
      const data = await api("/api/settings", { method: "POST", body });
      state.status = data.status;
      renderStatus(true);
      toast("Suspensión actualizada.", "ok");
    } catch (err) {
      toast(err.message, "err", "No se pudo aplicar");
    } finally { setButtonBusy(btn, false); }
  });

  $("#factoryReset").addEventListener("click", async () => {
    const ok = await confirmDialog(
      "Restablecer de fábrica",
      "Se borrarán perfiles, macros, iluminación e imagen de pantalla. El teclado se reiniciará y puede desaparecer unos segundos.",
      "Sí, restablecer",
    );
    if (!ok) return;
    const btn = $("#factoryReset");
    btn.disabled = true;
    try {
      await api("/api/reset", { method: "POST", body: {} });
      toast("Teclado restablecido. Reconectando…", "ok");
      setTimeout(() => loadStatus(true), 2500);
    } catch (err) {
      toast(err.message, "err", "No se pudo restablecer");
    } finally { btn.disabled = false; }
  });
}

/* -------------------------------------------------------------------- boot */
async function boot() {
  try {
    const [meta, layout, keycodes] = await Promise.all([
      api("/api/meta"),
      api("/api/layout"),
      api("/api/keycodes"),
    ]);
    state.meta = meta;
    state.layout = layout;
    state.keycodes = keycodes;
    buildLightPreview();
    buildHeroKeyboard();
    fillModeSelect($("#mainMode"), meta.lightModes);
    fillModeSelect($("#sideMode"), meta.sideLightModes);
    loadPreviewScale();
  } catch (err) {
    toast("No se pudieron cargar los datos de la interfaz: " + err.message, "err");
  }

  bindLightingTabs();
  bindLightForm("main", $("#mainApply"), $("#mainReset"));
  bindLightForm("side", $("#sideApply"), $("#sideReset"));
  bindLightPreset();
  bindRipple();
  bindColorEditor();
  bindScreen();
  bindKeys();
  bindMacros();
  bindMusic();
  bindSettings();
  bindAppearance();

  const hashParts = location.hash.replace("#", "").split("/");
  const hashPage = hashParts[0];
  const hashTab = hashParts[1];
  if (PAGE_META[hashPage]) {
    setPage(hashPage);
    if (hashPage === "lighting" && ["effects", "ripple", "perkey"].includes(hashTab)) {
      window.setLightingTab?.(hashTab);
    }
  }

  $("#refreshBtn").addEventListener("click", async () => {
    const btn = $("#refreshBtn");
    setButtonBusy(btn, true, "…");
    try {
      const status = await loadStatus(true);
      if (!status.connected) throw new Error(status.error || "No se pudo conectar al teclado.");
      if (state.keys) await loadKeys();
      toast("Estado actualizado.", "ok");
    } catch (err) { toast(err.message, "err"); }
    finally { setButtonBusy(btn, false); }
  });
  async function reconnect() {
    const buttons = [$("#reconnectBtn"), $("#bannerReconnect")];
    buttons.forEach((button) => setButtonBusy(button, true, "Conectando…"));
    try {
      state.status = await api("/api/reconnect", { method: "POST", body: {} });
      renderStatus(true);
      if (!state.status.connected) throw new Error(state.status.error || "No se pudo conectar al teclado.");
      if ($("#page-keys").classList.contains("active")) await loadKeys();
    } catch (err) { toast(err.message, "err"); }
    finally { buttons.forEach((button) => setButtonBusy(button, false)); }
  }
  $("#reconnectBtn").addEventListener("click", reconnect);
  $("#bannerReconnect").addEventListener("click", reconnect);

  $("#shutdownBtn").addEventListener("click", async () => {
    const ok = await confirmDialog(
      "Cerrar OpenKEY",
      "Se detendrá el servidor local. La configuración del teclado no cambia.",
      "Cerrar",
    );
    if (!ok) return;
    try {
      await api("/api/shutdown", { method: "POST", body: {} });
    } catch {
      // The server may close the connection while shutting down.
    }
    document.body.innerHTML = '<div class="closed-screen"><h2>OpenKEY se cerró</h2><p>Ya podés cerrar esta ventana.</p></div>';
  });

  await loadStatus(true);
  try {
    renderMusicStatus(await api("/api/music/status"));
    scheduleMusicPoll();
  } catch { /* the music service is optional */ }
  try {
    renderRippleStatus(await api("/api/ripple/status"));
    scheduleRipplePoll();
  } catch { /* the ripple service is optional */ }
  if (state.status?.connected && $("#page-keys").classList.contains("active")) await loadKeys();
  if (state.status?.connected && $("#page-macros").classList.contains("active") && !state.macros.loaded) {
    state.macros.loaded = true;
    await readMacroFromKeyboard(true);
  }
}

boot();
