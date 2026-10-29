// Pip-checklist: taken afvinken, onthouden wie het deed en wanneer, en de voorraad bijhouden.
(function () {
  "use strict";

  const config = window.PIP_CONFIG;
  const STORAGE_KEY = "pip-hub-v1";
  const NIGHT_FROM = 21; // vanaf 21:00 een donker scherm
  const NIGHT_UNTIL = 7; // tot 07:00
  const SHEET_TIMEOUT_MS = 20000; // keuzevenster sluit vanzelf als niemand kiest
  const VOERRAAD_CODE_KEY = "pip-hub-voerraad-code";
  const VOERRAAD_CACHE_KEY = "pip-hub-voerraad-cache";
  const PEOPLE_KEY = "pip-hub-people";
  const MAX_PEOPLE = 6;
  const ACTION_CODE_KEY = "pip-hub-kattenbak-code";
  const FEEDBACK_MS = 2 * 60 * 1000; // zo lang blijft "Gestart om …" staan

  // Foutcodes van het kattenbak-servertje, zoals Pip ze laat zien.
  const ACTION_ERRORS = {
    CAT_INSIDE: "Pip zit erin, later opnieuw",
    OFFLINE: "Kattenbak is offline",
    TOO_SOON: "Draaide net al",
    TUYA_EXPIRED: "Tuya-abonnement verlopen",
    UNAUTHORIZED: "Koppelcode werkt niet",
    NOT_CONFIGURED: "Servertje nog niet ingesteld",
    UNREACHABLE: "Servertje niet bereikbaar",
    FEEDER_OFFLINE: "Voerbak is offline",
    FEEDING: "Voert al, even wachten",
    NO_PERMISSION: "Geen schrijfrechten in Tuya",
    BAD_PORTIONS: "Ongeldig aantal porties",
  };
  // Voerbak: 1 tot 10 porties per keer; het laatst gekozen aantal wordt onthouden.
  const FEED_PORTIONS_KEY = "pip-hub-feed-portions";
  const MAX_PORTIONS = 10;

  // Takenlijst die je op de Hub zelf beheert.
  const SETTINGS_KEY = "pip-hub-settings";
  const MAX_TASKS = 12;
  // Alle taken staan op het startscherm. Het takenblok blijft even hoog: bij meer
  // taken komt er afwisselend een kolom en een rij bij en worden de tegels kleiner.
  // [tot zoveel taken, kolommen, rijen]
  const TASK_LAYOUTS = [[4, 2, 2], [6, 3, 2], [9, 3, 3], [MAX_TASKS, 4, 3]];
  const MAX_TITLE = 30;
  const PAGE_TIMEOUT_MS = 90 * 1000; // pagina "Alle taken" sluit vanzelf
  const REST_AFTER_MS = 2 * 60 * 1000; // zo lang niets aangeraakt: terug naar de ruststand
  const TASK_ICONS = ["sun", "moon", "drop", "bowl", "box", "heart", "paw", "pill", "scissors", "ball"];
  const SUGGESTIONS = [
    { title: "Kattenbak verschonen", icon: "box", repeat: "weekly" },
    { title: "Borstelen", icon: "heart", repeat: "weekly" },
    { title: "Spelen", icon: "ball", repeat: "daily" },
    { title: "Nagels knippen", icon: "scissors", repeat: "biweekly" },
    { title: "Medicijn geven", icon: "pill", repeat: "daily" },
    { title: "Fontein schoonmaken", icon: "drop", repeat: "weekly" },
    { title: "Vlooienmiddel", icon: "pill", repeat: "monthly" },
    { title: "Ontwormen", icon: "pill", repeat: "quarterly" },
  ];
  // Hoe vaak een taak terugkomt. De periode begint om resetHour: een weektaak op
  // maandag, een maandtaak op de 1e, een kwartaaltaak op 1 jan/apr/jul/okt.
  // Met een vaste dag (task.day) begint de periode op die dag: een weekdag
  // (0 = zo … 6 = za) bij week-taken, de zoveelste van de maand (1-28) bij
  // maand- en kwartaaltaken.
  const REPEATS = {
    daily: { label: "Elke dag", todo: "Nog doen", short: "Nog doen" },
    weekly: { label: "Elke week", todo: "Deze week nog doen", short: "Deze week", days: "week" },
    biweekly: { label: "Om de week", todo: "Deze 2 weken nog doen", short: "Deze 2 weken", days: "week" },
    monthly: { label: "Elke maand", todo: "Deze maand nog doen", short: "Deze maand", days: "month" },
    quarterly: { label: "Elk kwartaal", todo: "Dit kwartaal nog doen", short: "Dit kwartaal", days: "month" },
  };
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // keuze in de editor: ma t/m zo
  const MAX_MONTH_DAY = 28; // elke maand heeft een 28e
  const DAYS_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"];
  const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  // Schermtoetsenbord: de Hub heeft zelf geen toetsenbord voor apps.
  const KEY_ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m", "back"],
    ["-", "space", "&"],
  ];

  const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
    "augustus", "september", "oktober", "november", "december"];

  const svg = (body, filled) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${filled
    ? 'fill="currentColor"'
    : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${body}</svg>`;

  const ICONS = {
    paw: svg('<circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M12 11c3 0 6 3.5 6 6.2 0 2-1.6 2.8-3.2 2.8-1.2 0-1.8-.6-2.8-.6s-1.6.6-2.8.6C7.6 20 6 19.2 6 17.2 6 14.5 9 11 12 11z"/>', true),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    drop: svg('<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'),
    box: svg('<path d="M3 10h18l-1.8 8.2a2 2 0 0 1-2 1.8H6.8a2 2 0 0 1-2-1.8z"/><path d="M8 14.5h.01M12 15.5h.01M16 14.5h.01"/>'),
    bowl: svg('<path d="M3 12h18a9 7 0 0 1-18 0z"/><path d="M9 8.5h.01M12 7h.01M15 8.5h.01"/>'),
    heart: svg('<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>'),
    pill: svg('<path d="M10.5 20.5l-7-7a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7z"/><path d="M8.5 8.5l7 7"/>'),
    wind: svg('<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>'),
    scissors: svg('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/>'),
    ball: svg('<circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c3 2 4.5 6 4 11.5M18.5 6.5c-3 2-4.5 6-4 11.5M3.5 11c5-1 12-1 17 0"/>'),
    pencil: svg('<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>'),
    left: svg('<path d="M15 6l-6 6 6 6"/>'),
    right: svg('<path d="M9 6l6 6-6 6"/>'),
    erase: svg('<path d="M9 5h11v14H9l-6-7z"/><path d="M12 9l5 6M17 9l-5 6"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    home: svg('<path d="M4 11l8-7 8 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
    qr: svg('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20v.01M17 20h3v-3"/>'),
  };

  // Zoals in Voerraad (components/ProductCard.tsx).
  const CATEGORIES = {
    food: { label: "Voer", icon: "bowl" },
    litter: { label: "Bakvulling", icon: "box" },
    medication: { label: "Medicatie", icon: "pill" },
    care: { label: "Verzorging", icon: "heart" },
    treats: { label: "Snacks", icon: "paw" },
    toys: { label: "Speelgoed", icon: "paw" },
    other: { label: "Overig", icon: "paw" },
  };
  const LOW_STOCK_DAYS = 5;

  const els = {
    logo: document.getElementById("logo"),
    toGoogle: document.getElementById("to-google"),
    progressText: document.getElementById("progress-text"),
    progressBar: document.getElementById("progress-bar"),
    clock: document.getElementById("clock"),
    date: document.getElementById("date"),
    tasks: document.getElementById("tasks"),
    tasksMore: document.getElementById("tasks-more"),
    page: document.getElementById("page"),
    pageGrid: document.getElementById("page-grid"),
    pageHint: document.getElementById("page-hint"),
    pageEdit: document.getElementById("page-edit"),
    log: document.getElementById("log"),
    logColumns: document.getElementById("log-columns"),
    rest: document.getElementById("rest"),
    restClock: document.getElementById("rest-clock"),
    restDate: document.getElementById("rest-date"),
    restCard: document.getElementById("rest-card"),
    restPhotos: [...document.querySelectorAll(".rest-photo")],
    restQrButton: document.getElementById("rest-qr-button"),
    restQr: document.getElementById("rest-qr"),
    restQrCode: document.getElementById("rest-qr-code"),
    video: document.getElementById("video"),
    videoTitle: document.getElementById("video-title"),
    videoFrame: document.getElementById("video-frame"),
    actions: document.getElementById("actions"),
    stock: document.getElementById("stock"),
    sheet: document.getElementById("sheet"),
    sheetBody: document.getElementById("sheet-body"),
  };

  let state = loadState();
  let voerraad = loadVoerraadCache();
  let kattenbak = null; // laatste status van het servertje
  const actionFeedback = {}; // per actie: { text, kind, until }
  const busyActions = new Set();
  let settings = loadSettingsCache(); // { tasks?, people? } van de Hub of het servertje
  let pushTimer = null;
  let synced = false; // al een keer met het servertje gelijkgetrokken?
  // Alleen een zelf gewijzigde takenlijst gaat mee naar het servertje: zo
  // overschrijft een oude kopie op de Hub geen instellingen die daar staan
  // (zoals een seintje om 22:00).
  let tasksChanged = false;
  let editor = null; // taak die nu gewijzigd wordt: { id, title, icon, confirmDelete }
  let pageOpen = false;
  let pageEditing = false;
  let pageTimer = null;
  let restTimer = null;
  let sheetTask = null;
  let sheetAction = null;
  let sheetTimer = null;

  // ---- Opslag ----

  // De "dag" begint om resetHour, zodat iets om 01:00 nog bij gisteren hoort.
  function shifted(date) {
    return new Date(date.getTime() - config.resetHour * 3600 * 1000);
  }

  function logicalDay(date) {
    const d = shifted(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Dagnummer sinds 1-1-1970 (een donderdag), handig voor weken.
  function dayNumber(date) {
    const d = shifted(date);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function mod(value, by) {
    return ((value % by) + by) % by;
  }

  // Weekdag van een dagnummer (0 = zo); dagnummer 0 was een donderdag.
  function weekdayOf(day) {
    return mod(day + 4, 7);
  }

  function repeatOf(task) {
    return REPEATS[task.repeat] ? task.repeat : "daily";
  }

  // Vaste dag van de taak, of null als die er niet (meer) bij past.
  function dayOf(task) {
    const kind = REPEATS[repeatOf(task)].days;
    const day = task.day;
    if (!Number.isInteger(day)) return null;
    if (kind === "week") return day >= 0 && day <= 6 ? day : null;
    if (kind === "month") return day >= 1 && day <= MAX_MONTH_DAY ? day : null;
    return null;
  }

  // Eerste dag (dagnummer) van de periode waarin `date` valt. "Om de week op
  // zaterdag" telt vanaf de eerste zaterdag nadat die dag gekozen is (task.from).
  function periodStart(task, date) {
    const repeat = repeatOf(task);
    const day = dayOf(task);
    const today = dayNumber(date);
    if (repeat === "daily") return today;
    if (repeat === "weekly" || repeat === "biweekly") {
      const weekday = day === null ? 1 : day; // zonder vaste dag: maandag
      const anchor = repeat === "biweekly" && day !== null && Number.isInteger(task.from)
        ? task.from + mod(weekday - weekdayOf(task.from), 7)
        : weekday - 4;
      return today - mod(today - anchor, repeat === "weekly" ? 7 : 14);
    }
    const d = shifted(date);
    const first = day || 1;
    let month = d.getMonth() - (d.getDate() < first ? 1 : 0);
    if (repeat === "quarterly") month -= mod(month, 3);
    return Math.floor(Date.UTC(d.getFullYear(), month, first) / 86400000);
  }

  function nextPeriodStart(task, start) {
    const repeat = repeatOf(task);
    if (repeat === "daily") return start + 1;
    if (repeat === "weekly") return start + 7;
    if (repeat === "biweekly") return start + 14;
    const d = new Date(start * 86400000);
    const months = repeat === "quarterly" ? 3 : 1;
    return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()) / 86400000);
  }

  // Net een vaste dag gekozen die nog moet komen? Dan het dagnummer van die dag:
  // tot dan staat de taak nog niet open.
  function upcomingDay(task) {
    if (dayOf(task) === null || !Number.isInteger(task.from)) return null;
    const start = periodStart(task, new Date());
    return start < task.from ? nextPeriodStart(task, start) : null;
  }

  // De laatste keer dat de taak gedaan is, als dat in de huidige periode was.
  // Met een vaste dag telt de dag ervoor ook mee: de kattenbak op vrijdag al
  // verschoond is goed voor zaterdag.
  function currentDone(task) {
    const entry = state.done[task.id];
    if (!entry) return null;
    const start = periodStart(task, new Date()) - (dayOf(task) === null ? 0 : 1);
    return dayNumber(new Date(entry.at)) >= start ? entry : null;
  }

  // Taken die nu meetellen: niet de taken waarvan de vaste dag nog moet komen.
  function dueTasks() {
    return tasks().filter((task) => upcomingDay(task) === null);
  }

  function loadState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (error) {
      saved = null;
    }
    const loaded = saved && typeof saved === "object" ? saved : {};
    loaded.day = loaded.day || logicalDay(new Date());
    loaded.done = loaded.done || {};
    loaded.stock = loaded.stock || {};
    config.stock.forEach((item) => {
      if (typeof loaded.stock[item.id] !== "number") loaded.stock[item.id] = item.amount;
    });
    return loaded;
  }

  // De Google Hub gooit zijn opslag weg als Pip herstart, dus de vinkjes en
  // tellers gaan ook naar het servertje (zie pushSettings/pullSettings).
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Geen opslag beschikbaar: dan alleen het servertje.
    }
    schedulePush();
  }

  // Een nieuwe dag wist niets meer: per taak bepaalt de periode of hij weer open
  // staat (zie currentDone). Wel opnieuw tekenen, zodat dat zichtbaar wordt.
  function rollOverIfNewDay() {
    const today = logicalDay(new Date());
    if (state.day === today) return false;
    state.day = today;
    saveState();
    return true;
  }

  // ---- Acties ----

  function markDone(task, person) {
    const entry = { by: person, at: Date.now(), took: 0 };
    const stock = stockFor(task);
    // Met Voerraad gekoppeld telt Voerraad zelf de dagen af.
    if (stock && !voerraadCode() && stock.id in state.stock) {
      const before = state.stock[stock.id];
      state.stock[stock.id] = Math.max(0, before - stock.amount);
      entry.took = before - state.stock[stock.id];
    }
    const wasAllDone = allDueDone();
    state.done[task.id] = entry;
    saveState();
    render();
    if (!wasAllDone && allDueDone()) celebrate();
  }

  function allDueDone() {
    const due = dueTasks();
    return due.length > 0 && due.every((task) => currentDone(task));
  }

  function undo(task) {
    const entry = state.done[task.id];
    if (!entry) return;
    const stock = stockFor(task);
    if (stock && entry.took) state.stock[stock.id] += entry.took;
    delete state.done[task.id];
    saveState();
    render();
  }

  function changeStock(id, delta) {
    state.stock[id] = Math.max(0, (state.stock[id] || 0) + delta);
    saveState();
    render();
  }

  // ---- Voerraad ----

  // Zodra de Hub een koppelcode heeft, komt de voorraad uit Voerraad (alleen
  // lezen). De code staat niet in config.js, want die is openbaar: de startknop
  // stuurt hem via cast.js en de Hub bewaart hem hier.

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (error) {
      // Geen opslag: werkt tot de volgende herstart.
    }
  }

  function voerraadCode() {
    return readStorage(VOERRAAD_CODE_KEY) || "";
  }

  // Alleen bij lokaal testen mag een andere server, bv. ?voerraad=http://localhost:3000
  function localOverride(name) {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    return local ? new URLSearchParams(location.search).get(name) : null;
  }

  function voerraadUrl() {
    return localOverride("voerraad") || config.voerraad.url;
  }

  function loadVoerraadCache() {
    try {
      return JSON.parse(readStorage(VOERRAAD_CACHE_KEY)) || null;
    } catch (error) {
      return null;
    }
  }

  async function refreshVoerraad() {
    const code = voerraadCode();
    if (!code) return;
    try {
      const response = await fetch(`${voerraadUrl()}/api/hub`, {
        headers: { Authorization: `Bearer ${code}` },
        cache: "no-store",
      });
      if (response.status === 401) {
        voerraad = { ...voerraad, error: "code" };
      } else if (!response.ok) {
        throw new Error(String(response.status));
      } else {
        const data = await response.json();
        voerraad = { items: data.items, pets: data.pets || [], fetchedAt: Date.now(), error: null };
        writeStorage(VOERRAAD_CACHE_KEY, JSON.stringify(voerraad));
      }
    } catch (error) {
      voerraad = { ...voerraad, error: "offline" };
    }
    renderStock();
  }

  // ---- Kattenbak (acties) ----

  // De knoppen praten met het servertje op Netlify, dat de Tuya-sleutels heeft.
  // De code voor dat servertje komt, net als de Voerraad-code, via de startknop.

  function actionCode() {
    return readStorage(ACTION_CODE_KEY) || "";
  }

  function kattenbakUrl() {
    return localOverride("kattenbak") || config.kattenbak.url;
  }

  function kattenbakLinked() {
    return !!(actionCode() && kattenbakUrl());
  }

  async function refreshKattenbak() {
    if (!kattenbakLinked()) return renderActions();
    try {
      const response = await fetch(kattenbakUrl(), {
        headers: { Authorization: `Bearer ${actionCode()}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      kattenbak = response.ok ? data : { error: data.error || "UNREACHABLE" };
    } catch (error) {
      kattenbak = { error: "UNREACHABLE" };
    }
    renderActions();
  }

  function portionsText(count) {
    return `${count} ${count === 1 ? "portie" : "porties"}`;
  }

  async function runAction(action, extra = {}) {
    busyActions.add(action.id);
    renderActions();
    let result;
    try {
      const response = await fetch(kattenbakUrl(), {
        method: "POST",
        headers: { Authorization: `Bearer ${actionCode()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.id, ...extra }),
      });
      const data = await response.json().catch(() => ({}));
      const done = action.id === "feed" ? `${portionsText(extra.portions)} om` : "Gestart om";
      result = response.ok
        ? { text: `${done} ${formatTime(new Date())}`, kind: "ok" }
        : { text: ACTION_ERRORS[data.error] || "Niet gelukt", kind: "warn" };
    } catch (error) {
      result = { text: ACTION_ERRORS.UNREACHABLE, kind: "warn" };
    }
    busyActions.delete(action.id);
    actionFeedback[action.id] = { ...result, until: Date.now() + FEEDBACK_MS };
    renderActions();
    refreshKattenbak();
    // Voeren duurt even; daarna staat de voerbeurt in "Laatst …".
    if (action.id === "feed" && result.kind === "ok") {
      playFeedSignal();
      setTimeout(refreshKattenbak, 30 * 1000);
    }
  }

  function setActionCode(code) {
    const clean = String(code || "").trim();
    writeStorage(ACTION_CODE_KEY, clean || null);
    kattenbak = null;
    refreshKattenbak();
    pullSettings();
    refreshPhotos();
    refreshMeow();
    els.restQrButton.hidden = !actionCode();
  }

  // ---- Huisgenoten ----

  // Wie er kan afvinken. Standaard uit config.js; op de startpagina aan te
  // passen, die stuurt de lijst via cast.js en de Hub bewaart hem hier.

  function cleanPeople(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((name) => typeof name === "string")
      .map((name) => name.trim().slice(0, 20))
      .filter(Boolean)
      .slice(0, MAX_PEOPLE);
  }

  function people() {
    const fromSettings = cleanPeople(settings.people);
    if (fromSettings.length) return fromSettings;
    let saved = []; // van vóór de instellingen op het servertje stonden
    try {
      saved = cleanPeople(JSON.parse(readStorage(PEOPLE_KEY)));
    } catch (error) {
      saved = [];
    }
    return saved.length ? saved : config.people;
  }

  function setPeople(list) {
    const clean = cleanPeople(list);
    if (clean.length) {
      saveSettings({ people: clean });
    } else {
      const { people: removed, ...rest } = settings;
      settings = rest;
      writeStorage(SETTINGS_KEY, JSON.stringify(settings));
      writeStorage(PEOPLE_KEY, null);
    }
    closeSheet();
  }

  // ---- Instellingen: takenlijst en huisgenoten ----

  // Bewaard op de Hub en op het servertje (zelfde code als de kattenbak), zodat
  // een herstart van de Hub niets kwijtraakt. Wat op het servertje staat wint.

  function settingsUrl() {
    return localOverride("settings") || config.settings.url;
  }

  function loadSettingsCache() {
    try {
      return JSON.parse(readStorage(SETTINGS_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function saveSettings(patch) {
    settings = { ...settings, ...patch };
    writeStorage(SETTINGS_KEY, JSON.stringify(settings));
    schedulePush();
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushSettings, 800);
  }

  async function pushSettings() {
    // Pas na het eerste ophalen: anders overschrijft een verse start de vinkjes.
    if (!synced || !actionCode() || !settingsUrl()) return;
    const body = {
      done: state.done,
      stock: state.stock,
      voerraadCode: voerraadCode(),
    };
    const sendTasks = tasksChanged && settings.tasks;
    if (sendTasks) body.tasks = settings.tasks;
    if (settings.people) body.people = settings.people;
    try {
      const response = await fetch(settingsUrl(), {
        method: "PUT",
        headers: { Authorization: `Bearer ${actionCode()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (sendTasks && response.ok) tasksChanged = false;
    } catch (error) {
      // Niet bereikbaar: de Hub houdt zijn eigen kopie, de volgende wijziging probeert opnieuw.
    }
  }

  async function pullSettings() {
    if (!actionCode() || !settingsUrl()) return;
    try {
      const response = await fetch(settingsUrl(), {
        headers: { Authorization: `Bearer ${actionCode()}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const remote = await response.json();
      if (remote.tasks || remote.people) {
        settings = { ...settings, tasks: remote.tasks || settings.tasks, people: remote.people || settings.people };
        writeStorage(SETTINGS_KEY, JSON.stringify(settings));
      }
      // Vinkjes terug: per taak de laatste keer (vroegere versies stuurden "today").
      const remoteDone = { ...((remote.today && remote.today.done) || {}), ...(remote.done || {}) };
      Object.entries(remoteDone).forEach(([id, entry]) => {
        if (!state.done[id] || state.done[id].at < entry.at) state.done[id] = entry;
      });
      if (remote.stock) state.stock = { ...state.stock, ...remote.stock };
      if (remote.voerraadCode && !voerraadCode()) setVoerraadCode(remote.voerraadCode);
      // Pip is terug (vanzelf of via de startknop): de pauze is voorbij.
      if (remote.away) putAway(null);
      showGoogleButton(Date.now() - (remote.watcherSeenAt || 0) < WATCHER_FRESH_MS);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        // Geen opslag: het servertje heeft het.
      }
      synced = true;
      render();
      schedulePush(); // ook wat sinds de start op de Hub veranderde
    } catch (error) {
      // Niet bereikbaar: dan maar met de kopie op de Hub, later opnieuw.
    }
  }

  // Pauze: tot wanneer Pip weg moet blijven. Het script op de Mac (start-pip.command
  // --blijf) leest dit en zet Pip pas daarna terug. null = geen pauze.
  async function putAway(until) {
    if (!actionCode() || !settingsUrl()) return;
    try {
      await fetch(settingsUrl(), {
        method: "PUT",
        headers: { Authorization: `Bearer ${actionCode()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ away: until ? { until } : null }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
    } catch (error) {
      // Niet bereikbaar: dan zet het script Pip na de gewone wachttijd terug.
    }
  }

  function tasks() {
    return settings.tasks && settings.tasks.length ? settings.tasks : config.tasks;
  }

  // Voorraadkoppeling (bv. ontbijt → natvoer) hoort bij de standaardtaken in config.js.
  function stockFor(task) {
    const base = config.tasks.find((t) => t.id === task.id);
    return base && base.stock;
  }

  function setTasks(list) {
    const clean = list.map((task) => {
      const item = { id: task.id, title: task.title, icon: task.icon, repeat: repeatOf(task) };
      const day = dayOf(task);
      if (day !== null) Object.assign(item, { day, from: task.from });
      // Melding als hij gedaan is en een seintje op een vaste tijd (op het servertje ingesteld).
      if (task.notify) item.notify = true;
      if (task.remind) item.remind = task.remind;
      return item;
    });
    tasksChanged = true;
    saveSettings({ tasks: clean });
    // Weggehaalde taken ook uit de vinkjes van vandaag.
    Object.keys(state.done).forEach((id) => {
      if (!clean.some((task) => task.id === id)) delete state.done[id];
    });
    saveState();
    render();
  }

  function setVoerraadCode(code) {
    const clean = String(code || "").trim();
    if (clean !== voerraadCode()) {
      writeStorage(VOERRAAD_CODE_KEY, clean || null);
      writeStorage(VOERRAAD_CACHE_KEY, null);
      voerraad = null;
      renderStock();
      schedulePush(); // het servertje onthoudt de code voor na een herstart
    }
    refreshVoerraad();
  }

  // ---- Weergave ----

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function formatTime(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDate(date) {
    return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }

  function isNight(date) {
    const hour = date.getHours();
    return hour >= NIGHT_FROM || hour < NIGHT_UNTIL;
  }

  // "vandaag 14:02", "gisteren 18:10" of "ma 27 okt".
  function whenShort(at) {
    const date = new Date(at);
    const daysAgo = dayNumber(new Date()) - dayNumber(date);
    if (daysAgo === 0) return `vandaag ${formatTime(date)}`;
    if (daysAgo === 1) return `gisteren ${formatTime(date)}`;
    return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  }

  // "vandaag om 14:02" of "op maandag 27 oktober om 14:02".
  function whenLong(at) {
    const date = new Date(at);
    const daysAgo = dayNumber(new Date()) - dayNumber(date);
    if (daysAgo === 0) return `vandaag om ${formatTime(date)}`;
    if (daysAgo === 1) return `gisteren om ${formatTime(date)}`;
    return `op ${formatDate(date)} om ${formatTime(date)}`;
  }

  // "za 1 nov" voor een dagnummer.
  function dayLabel(day) {
    const date = new Date(day * 86400000);
    return `${DAYS_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
  }

  // Wat er onder een open taak staat. Met een vaste dag: wanneer hij open ging
  // ("Vandaag", "Sinds za 25 okt") of wanneer hij voor het eerst komt.
  function todoText(task, compact = false) {
    if (dayOf(task) === null) return REPEATS[repeatOf(task)][compact ? "short" : "todo"];
    const upcoming = upcomingDay(task);
    if (upcoming !== null) return `Op ${dayLabel(upcoming)}`;
    const start = periodStart(task, new Date());
    const today = dayNumber(new Date());
    if (start === today) return "Vandaag";
    if (start === today - 1) return "Sinds gisteren";
    return `Sinds ${dayLabel(start)}`;
  }

  // "Om de week · za" of "Elke maand · de 15e".
  function repeatText(task) {
    const day = dayOf(task);
    const label = REPEATS[repeatOf(task)].label;
    if (day === null) return label;
    return `${label} · ${REPEATS[repeatOf(task)].days === "week" ? DAYS_SHORT[day] : `de ${day}e`}`;
  }

  // compact: kleine tegel op een vol startscherm, dus kortere tekst ("Deze week",
  // "Thijs · 19:00" in plaats van "Deze week nog doen", "Thijs · vandaag 19:00").
  function taskCard(task, compact = false) {
    const done = currentDone(task);
    const later = !done && upcomingDay(task) !== null;
    const when = done && compact
      ? whenShort(done.at).replace(/^vandaag /, "").replace(/^gisteren .*/, "gisteren")
      : done && whenShort(done.at);
    const status = done
      ? `${escapeHtml(done.by)} · ${when}`
      : todoText(task, compact);
    return `
      <button class="task${done ? " done" : ""}${later ? " later" : ""}" data-action="task" data-id="${escapeHtml(task.id)}">
        <span class="icon">${done ? ICONS.check : ICONS[task.icon] || ICONS.paw}</span>
        <span>
          <span class="title">${escapeHtml(task.title)}</span>
          <span class="status">${status}</span>
        </span>
      </button>`;
  }

  // Regel onder een actieknop: wat er net gebeurde, anders de stand van de bak.
  function actionStatus(action) {
    const feedback = actionFeedback[action.id];
    if (busyActions.has(action.id)) return { text: "Bezig…", kind: "" };
    if (feedback && feedback.until > Date.now()) return feedback;
    if (!kattenbakLinked()) return { text: "Nog niet gekoppeld", kind: "" };
    if (!kattenbak) return { text: "Status ophalen…", kind: "" };
    if (kattenbak.error) return { text: ACTION_ERRORS[kattenbak.error] || "Niet bereikbaar", kind: "warn" };
    if (action.id === "feed") return feederStatus(kattenbak.feeder);
    if (!kattenbak.online) return { text: ACTION_ERRORS.OFFLINE, kind: "warn" };
    if (action.id === "clean") {
      if (kattenbak.catInside) return { text: "Pip zit erin", kind: "warn" };
      const parts = [];
      if (kattenbak.catWeightKg) parts.push(`Pip ${String(kattenbak.catWeightKg).replace(".", ",")} kg`);
      if (typeof kattenbak.visitsToday === "number") parts.push(`vandaag ${kattenbak.visitsToday}×`);
      return { text: parts.join(" · ") || "Klaar", kind: "" };
    }
    return kattenbak.binFull ? { text: "Opvangbak vol", kind: "warn" } : { text: "Opvangbak ok", kind: "" };
  }

  // "Laatst 2 porties · vandaag 08:00" (ook de voerbeurten van het schema in de app).
  function feederStatus(feeder) {
    if (!feeder) return { text: "Voerbak nog niet ingesteld", kind: "" };
    if (feeder.error) return { text: ACTION_ERRORS[feeder.error] || "Voerbak niet bereikbaar", kind: "warn" };
    if (!feeder.online) return { text: ACTION_ERRORS.FEEDER_OFFLINE, kind: "warn" };
    if (feeder.feeding) return { text: "Bezig met voeren", kind: "" };
    if (feeder.lastFeed && feeder.lastFeed.at) {
      const when = whenShort(feeder.lastFeed.at).replace(/^vandaag /, "om ").replace(/^gisteren .*/, "· gisteren");
      return { text: `Laatst ${portionsText(feeder.lastFeed.portions)} ${when.startsWith("om") || when.startsWith("·") ? when : `· ${when}`}`, kind: "" };
    }
    return { text: "Klaar", kind: "" };
  }

  function actionCard(action) {
    const status = actionStatus(action);
    const classes = ["task", "action", kattenbakLinked() ? "" : "off", busyActions.has(action.id) ? "busy" : ""];
    return `
      <button class="${classes.filter(Boolean).join(" ")}" data-action="act" data-id="${escapeHtml(action.id)}">
        <span class="icon">${ICONS[action.icon] || ICONS.paw}</span>
        <span>
          <span class="title">${escapeHtml(action.title)}</span>
          <span class="status${status.kind ? ` ${status.kind}` : ""}">${escapeHtml(status.text)}</span>
        </span>
      </button>`;
  }

  function renderActions() {
    els.actions.innerHTML = (config.actions || []).map(actionCard).join("");
  }

  function stockRow(item) {
    const amount = state.stock[item.id];
    const low = amount <= item.low;
    const unit = amount === 1 ? item.units[0] : item.units[1];
    return `
      <div class="stock-row${low ? " low" : ""}">
        <div>
          <div class="stock-name">${escapeHtml(item.title)}</div>
          <div class="stock-amount">${amount} ${escapeHtml(unit)}${low ? '<span class="badge">Bijna op</span>' : ""}</div>
        </div>
        <div class="stepper">
          <button data-action="stock" data-id="${escapeHtml(item.id)}" data-delta="-1" aria-label="Eén ${escapeHtml(item.units[0])} minder">${ICONS.minus}</button>
          <button data-action="stock" data-id="${escapeHtml(item.id)}" data-delta="1" aria-label="Eén ${escapeHtml(item.units[0])} erbij">${ICONS.plus}</button>
        </div>
      </div>`;
  }

  // Kleur zoals de productkaart in Voerraad: honing bij bijna op, klei bij op,
  // grijs als er al iets besteld is (dan hoeft er niets meer).
  function voerraadKind(item) {
    if (item.ordered) return "ordered";
    if (item.daysLeft <= 0) return "empty";
    return item.daysLeft <= LOW_STOCK_DAYS ? "low" : "";
  }

  function voerraadRow(item) {
    const kind = voerraadKind(item);
    const category = CATEGORIES[item.category] || CATEGORIES.other;
    const name = item.brand && !item.name.toLowerCase().includes(item.brand.toLowerCase())
      ? `${item.brand} ${item.name}`
      : item.name;
    const sub = [item.pets.join(", "), category.label].filter(Boolean).join(" · ");
    const photo = item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">` : "";
    const value = item.daysLeft <= 0 ? (item.dosing ? "Nu" : "Op") : item.daysLeft;
    const label = item.ordered ? "Besteld" : item.daysLeft <= 0 ? (item.dosing ? "geven" : "") : "dgn";
    return `
      <div class="vr-row">
        <div class="thumb${photo ? " has-img" : ""}">${ICONS[category.icon]}${photo}</div>
        <div class="vr-text">
          <div class="vr-name">${escapeHtml(name)}</div>
          <div class="vr-sub">${escapeHtml(sub)}</div>
        </div>
        <div class="days${kind ? ` ${kind}` : ""}">
          <span class="days-value">${value}</span>
          ${label ? `<span class="days-label">${label}</span>` : ""}
        </div>
        <div class="bar${kind ? ` ${kind}` : ""}"><span style="width: ${Math.max(4, item.percent || 0)}%"></span></div>
      </div>`;
  }

  function voerraadPanel() {
    if (!voerraad || !voerraad.items) {
      const text = !voerraad || !voerraad.error
        ? "Voorraad ophalen…"
        : voerraad.error === "code"
          ? "De koppelcode werkt niet. Maak een nieuwe in Voerraad."
          : "Voerraad is nu niet bereikbaar.";
      return `<p class="vr-empty">${text}</p>`;
    }
    const shown = voerraad.items.slice(0, config.voerraad.maxItems);
    const more = voerraad.items.length - shown.length;
    const rows = shown.length
      ? `<div class="vr-list">${shown.map(voerraadRow).join("")}</div>`
      : '<p class="vr-empty">Nog niets in Voerraad.</p>';
    const time = formatTime(new Date(voerraad.fetchedAt));
    let foot = voerraad.error === "code"
      ? "Koppelcode werkt niet meer"
      : voerraad.error
        ? `Niet bijgewerkt sinds ${time}`
        : `Uit Voerraad · ${time}`;
    if (more > 0) foot = `+${more} meer · ${foot}`;
    return `${rows}<p class="vr-foot${voerraad.error ? " warn" : ""}">${escapeHtml(foot)}</p>`;
  }

  function renderStock() {
    const linked = !!voerraadCode();
    els.stock.classList.toggle("from-voerraad", linked);
    els.stock.innerHTML = linked ? voerraadPanel() : config.stock.map(stockRow).join("");
    renderLogo();
    renderRest(); // seintjes uit Voerraad meteen in de ruststand
  }

  // Linksboven: de profielfoto uit Voerraad (het dier uit config.petName, anders
  // het eerste met een foto). Zonder koppeling of foto het pootje.
  function renderLogo() {
    const pets = (voerraadCode() && voerraad && voerraad.pets) || [];
    const wanted = String(config.petName || "").toLowerCase();
    const pet = pets.find((p) => p.photo && p.name.toLowerCase() === wanted) || pets.find((p) => p.photo);
    const html = pet ? `<img src="${escapeHtml(pet.photo)}" alt="${escapeHtml(pet.name)}">` : ICONS.paw;
    if (els.logo.dataset.src !== (pet ? pet.photo.slice(-40) : "paw")) {
      els.logo.innerHTML = html;
      els.logo.dataset.src = pet ? pet.photo.slice(-40) : "paw";
      els.logo.classList.toggle("photo", !!pet);
    }
  }

  function renderClock() {
    const now = new Date();
    document.documentElement.dataset.theme = isNight(now) ? "dark" : "light";
    els.clock.textContent = formatTime(now);
    els.date.textContent = formatDate(now);
    els.restClock.textContent = formatTime(now);
    els.restDate.textContent = formatDate(now);
  }

  // ---- Ruststand: wisselende foto's van Pip ----

  // De standaardfoto plus wat jullie via de startpagina sturen (nieuwste eerst).
  // Elke config.photos.seconds een andere, alleen als de ruststand in beeld is.
  const DEFAULT_SLIDE = {
    url: els.restPhotos[0].querySelector(".rest-fg").getAttribute("src"),
    tall: false,
    view: { zoom: 1, x: 50, y: 62 },
  };
  const photoUrls = new Map(); // id → blob-URL van een opgehaalde foto
  let slides = [DEFAULT_SLIDE];
  let slideIndex = 0;
  let frontLayer = 0;

  function photosUrl() {
    return localOverride("fotos") || (config.photos && config.photos.url);
  }

  function photoStyleUrl() {
    return localOverride("fotolijst") || (config.photos && config.photos.styleUrl);
  }

  // Stijl van de fotolijst, in te stellen op fotos.html.
  let photoStyle = { seconds: 20, order: "newest", includeDefault: true, motion: false };
  let slideTimer = null;

  function scheduleSlide() {
    clearTimeout(slideTimer);
    slideTimer = setTimeout(async () => {
      await nextSlide();
      scheduleSlide();
    }, photoStyle.seconds * 1000);
  }

  function applyPhotoStyle(style) {
    const tempoChanged = style.seconds !== photoStyle.seconds;
    photoStyle = { ...photoStyle, ...style };
    els.rest.classList.toggle("motion", photoStyle.motion);
    // Inzoomen duurt net zo lang als een foto in beeld is.
    els.rest.style.setProperty("--slide-seconds", `${photoStyle.seconds + 2}s`);
    if (tempoChanged) scheduleSlide();
  }

  function authHeader() {
    return { Authorization: `Bearer ${actionCode()}` };
  }

  async function refreshPhotos() {
    if (!actionCode() || !photosUrl()) return;
    try {
      const [response, style] = await Promise.all([
        fetch(photosUrl(), { headers: authHeader(), cache: "no-store" }),
        photoStyleUrl()
          ? fetch(photoStyleUrl(), { headers: authHeader(), cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
          : null,
      ]);
      if (style) applyPhotoStyle(style);
      if (!response.ok) return;
      const list = await response.json();
      const ids = new Set(list.map((photo) => photo.id));
      photoUrls.forEach((url, id) => {
        if (ids.has(id)) return;
        URL.revokeObjectURL(url);
        photoUrls.delete(id);
      });
      for (const photo of list) {
        if (photoUrls.has(photo.id)) continue;
        const image = await fetch(`${photosUrl()}/${photo.id}`, { headers: authHeader() });
        if (image.ok) photoUrls.set(photo.id, URL.createObjectURL(await image.blob()));
      }
      const uploaded = [...list].reverse()
        .filter((photo) => photoUrls.has(photo.id))
        .map((photo) => ({
          url: photoUrls.get(photo.id),
          // "Hele foto" (gekozen op fotos.html, of vanzelf bij staande foto's):
          // helemaal tonen, met een vage achtergrond.
          tall: photo.fit ? photo.fit === "contain" : Boolean(photo.width && photo.height && photo.width / photo.height < 1.25),
          // Ingezoomd en verschoven op fotos.html: zoom, en het punt dat in het midden staat.
          view: { zoom: photo.zoom || 1, x: photo.focusX ?? 50, y: photo.focusY ?? 50 },
        }));
      slides = photoStyle.includeDefault || !uploaded.length ? uploaded.concat(DEFAULT_SLIDE) : uploaded;
    } catch (error) {
      // Niet bereikbaar: de foto's die er al waren blijven wisselen.
    }
  }

  // Vullen met zoom en verschuiving, zonder dat er rand zichtbaar wordt. Precies
  // dezelfde berekening als het voorbeeld op fotos.html.
  function placeCover(image, view) {
    const frameWidth = image.parentElement.clientWidth;
    const frameHeight = image.parentElement.clientHeight;
    if (!image.naturalWidth || !frameWidth) return;
    const scale = Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight) * view.zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = Math.min(0, Math.max(frameWidth - width, frameWidth / 2 - (view.x / 100) * width));
    const top = Math.min(0, Math.max(frameHeight - height, frameHeight / 2 - (view.y / 100) * height));
    Object.assign(image.style, {
      inset: "auto",
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      objectFit: "fill",
      // Rustig inzoomen vanuit het midden van wat je ziet.
      transformOrigin: `${frameWidth / 2 - left}px ${frameHeight / 2 - top}px`,
    });
  }

  async function nextSlide() {
    if (els.rest.hidden || slides.length < 2) return;
    if (photoStyle.order === "shuffle") {
      // Door elkaar, maar nooit twee keer dezelfde achter elkaar.
      slideIndex = (slideIndex + 1 + Math.floor(Math.random() * (slides.length - 1))) % slides.length;
    } else {
      slideIndex = (slideIndex + 1) % slides.length;
    }
    const slide = slides[slideIndex];
    const layer = els.restPhotos[1 - frontLayer];
    const front = layer.querySelector(".rest-fg");
    const back = layer.querySelector(".rest-bg");
    front.removeAttribute("style");
    front.src = slide.url;
    if (slide.tall) back.src = slide.url;
    else back.removeAttribute("src");
    layer.classList.toggle("tall", slide.tall);
    // Eerst laden, dan pas overvloeien; hooguit 3 seconden wachten.
    const loaded = await Promise.race([
      front.decode().then(() => true, () => false),
      new Promise((resolve) => setTimeout(() => resolve(front.complete && front.naturalWidth > 0), 3000)),
    ]);
    if (!loaded) return;
    if (!slide.tall) placeCover(front, slide.view);
    layer.classList.add("shown");
    els.restPhotos[frontLayer].classList.remove("shown");
    frontLayer = 1 - frontLayer;
  }

  // ---- Geluid: voersignaal, feestje en Aai Pip ----

  // Alles gemaakt met Web Audio, behalve Pips miauw (via de startpagina). Een
  // browser laat pas geluid toe na een tik; elke tik op het scherm maakt het wakker.
  let audioContext = null;
  let meowBuffer = null;
  let meowAt = null;

  function audio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  }

  // 's Avonds en 's nachts zachter.
  function loudness() {
    return isNight(new Date()) ? 0.5 : 1;
  }

  function tone(ctx, frequency, start, length, volume, type = "sine") {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume * loudness(), start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + length + 0.05);
  }

  // Voersignaal: altijd dezelfde drie tonen omhoog, zodat Pip leert dat het eten is.
  function playFeedSignal() {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.05;
    [[784, 0], [988, 0.16], [1319, 0.32]].forEach(([frequency, delay]) =>
      tone(ctx, frequency, start + delay, 0.6, 0.3, "triangle"));
  }

  // Feestje: een vrolijk loopje, afgesloten met een akkoord.
  function playParty() {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.05;
    [523, 659, 784, 1047].forEach((frequency, index) => tone(ctx, frequency, start + index * 0.11, 0.35, 0.22, "triangle"));
    [523, 659, 784].forEach((frequency) => tone(ctx, frequency * 2, start + 0.5, 1.1, 0.12));
  }

  // Spinnen zonder opname: een laag gebrom dat 24 keer per seconde aanzwelt.
  function playPurr() {
    const ctx = audio();
    if (!ctx) return;
    const start = ctx.currentTime + 0.02;
    const rumble = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const pulse = ctx.createGain();
    const wobble = ctx.createOscillator();
    const depth = ctx.createGain();
    const envelope = ctx.createGain();
    rumble.type = "sawtooth";
    rumble.frequency.value = 55;
    filter.type = "lowpass";
    filter.frequency.value = 380;
    pulse.gain.value = 0.18;
    wobble.frequency.value = 24;
    depth.gain.value = 0.18;
    wobble.connect(depth).connect(pulse.gain);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(loudness(), start + 0.3);
    envelope.gain.setValueAtTime(loudness(), start + 1.4);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 2);
    rumble.connect(filter).connect(pulse).connect(envelope).connect(ctx.destination);
    [rumble, wobble].forEach((node) => {
      node.start(start);
      node.stop(start + 2.1);
    });
  }

  function meowUrl() {
    return localOverride("geluid") || (config.meow && config.meow.url);
  }

  // Pips miauw ophalen, alleen als er een nieuwe is.
  async function refreshMeow() {
    if (!actionCode() || !meowUrl()) return;
    try {
      const info = await fetch(`${meowUrl()}?info=1`, { headers: authHeader(), cache: "no-store" });
      if (info.status === 404) {
        meowBuffer = null;
        meowAt = null;
        return;
      }
      if (!info.ok) return;
      const { at } = await info.json();
      if (at === meowAt) return;
      const response = await fetch(meowUrl(), { headers: authHeader(), cache: "no-store" });
      const ctx = audio();
      if (!response.ok || !ctx) return;
      meowBuffer = await ctx.decodeAudioData(await response.arrayBuffer());
      meowAt = at;
    } catch (error) {
      // Geen miauw: dan spint ze.
    }
  }

  function playMeow() {
    const ctx = audio();
    if (!ctx || !meowBuffer) return playPurr();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = meowBuffer;
    gain.gain.value = loudness();
    source.connect(gain).connect(ctx.destination);
    source.start();
  }

  // ---- Telefoon koppelen met een QR-code in de ruststand ----

  // De QR-code opent de startpagina met de koppelcode achter het #: dat deel gaat
  // nooit naar een server, en de startpagina haalt het meteen uit de adresbalk.
  // De QR-bibliotheek komt pas als je hem nodig hebt, met een vaste versie.
  const QR_LIBRARY = {
    src: "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js",
    integrity: "sha384-mZT2gIty7ZDdOGkxfP6joZcYdMW1Jvj9dRlfpTmaJAKKXTqzygtB22k7FLe+KZC1",
  };
  const QR_OPEN_MS = 2 * 60 * 1000;
  let qrTimer = null;

  function loadQrLibrary() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = QR_LIBRARY.src;
      script.integrity = QR_LIBRARY.integrity;
      script.crossOrigin = "anonymous";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function linkUrl() {
    return `${new URL("fotos.html", location.href).href}#koppel=${encodeURIComponent(actionCode())}`;
  }

  async function showRestQr() {
    if (!actionCode()) return;
    try {
      await loadQrLibrary();
    } catch (error) {
      return; // geen internet: dan geen QR-code
    }
    const code = window.qrcode(0, "M");
    code.addData(linkUrl());
    code.make();
    els.restQrCode.innerHTML = code.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    els.restQr.hidden = false;
    els.restQrButton.hidden = true;
    clearTimeout(qrTimer);
    qrTimer = setTimeout(hideRestQr, QR_OPEN_MS);
    scheduleRest(); // de ruststand niet ondertussen opnieuw opbouwen
  }

  function hideRestQr() {
    clearTimeout(qrTimer);
    els.restQr.hidden = true;
    els.restQrCode.innerHTML = "";
    els.restQrButton.hidden = !actionCode();
  }

  // Aai Pip: tik op de ruststand en ze miauwt (soms spint ze). Het overzicht
  // opent meteen; de miauw klinkt erdoorheen.
  function petPip() {
    if (meowBuffer && Math.random() < 0.75) playMeow();
    else playPurr();
  }

  // Feestje: alle taken van vandaag zijn af. Twee confettikanonnen in de hoeken
  // onderaan schieten schuin omhoog; daarna dwarrelt alles naar beneden.
  const CONFETTI_COLORS = ["#a9642f", "#5b7f4f", "#e0a43a", "#f26b7a", "#6aa6c8", "#f3ece4"];
  const CONFETTI_PER_SIDE = 90;
  const CONFETTI_MS = 5000;

  function celebrate() {
    playParty();
    const canvas = document.createElement("canvas");
    const ratio = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.className = "confetti";
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    document.body.appendChild(canvas);
    const draw = canvas.getContext("2d");
    draw.scale(ratio, ratio);

    const pieces = [];
    [1, -1].forEach((direction) => { // 1 = kanon links (schiet naar rechts), -1 = rechts
      for (let index = 0; index < CONFETTI_PER_SIDE; index++) {
        const angle = ((52 + Math.random() * 28) * Math.PI) / 180; // schuin omhoog
        const speed = 13 + Math.random() * 11; // pixels per beeldje (60 per seconde)
        pieces.push({
          x: direction === 1 ? -10 : width + 10,
          y: height + 10,
          vx: Math.cos(angle) * speed * direction,
          vy: -Math.sin(angle) * speed,
          delay: Math.random() * 250, // niet allemaal tegelijk uit de loop
          spin: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 0.4,
          flip: Math.random() * Math.PI * 2,
          size: 8 + Math.random() * 7,
          color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        });
      }
    });

    const started = performance.now();
    let last = started;
    function frame(now) {
      const step = Math.min(3, (now - last) / (1000 / 60)); // gelijk tempo, ook bij haperen
      last = now;
      draw.clearRect(0, 0, width, height);
      let visible = 0;
      for (const piece of pieces) {
        if (now - started < piece.delay) {
          visible += 1;
          continue;
        }
        piece.vy += 0.38 * step; // zwaartekracht
        piece.vx *= Math.pow(0.985, step); // luchtweerstand
        if (piece.vy > 3.2) piece.vy = 3.2; // eenmaal vallend: dwarrelen
        piece.x += (piece.vx + (piece.vy > 0 ? Math.sin(piece.flip) * 0.8 : 0)) * step;
        piece.y += piece.vy * step;
        piece.spin += piece.spinSpeed * step;
        piece.flip += 0.12 * step;
        if (piece.y > height + 20) continue;
        visible += 1;
        draw.save();
        draw.translate(piece.x, piece.y);
        draw.rotate(piece.spin);
        draw.scale(1, Math.cos(piece.flip)); // omdraaien, zoals echte snippers
        draw.fillStyle = piece.color;
        draw.fillRect(-piece.size / 2, -piece.size * 0.35, piece.size, piece.size * 0.7);
        draw.restore();
      }
      if (visible && now - started < CONFETTI_MS) requestAnimationFrame(frame);
      else canvas.remove();
    }
    requestAnimationFrame(frame);
  }

  // ---- Ruststand ----

  // Kaartje linksboven in de ruststand: open taken, en voorraad die binnenkort op
  // is. Klein gehouden, zodat het boven Pip blijft; niets te melden = geen kaartje.
  const REST_TASKS = 3;
  const REST_STOCK = 2;
  const REST_WHEN = { daily: "vandaag", weekly: "deze week", biweekly: "deze 2 weken", monthly: "deze maand", quarterly: "dit kwartaal" };

  function restRow(icon, name, when, kind = "") {
    return `
      <li class="${kind}">
        <span class="rest-icon">${icon}</span>
        <span class="rest-name">${escapeHtml(name)}</span>
        <span class="rest-when">${escapeHtml(when)}</span>
      </li>`;
  }

  // Alleen uit Voerraad (niet de handmatige standaardvoorraad) en alleen wat
  // binnenkort op is en nog niet besteld.
  function restStock() {
    if (!voerraadCode() || !voerraad || !voerraad.items) return [];
    return voerraad.items
      .filter((item) => !item.ordered && item.daysLeft <= LOW_STOCK_DAYS)
      .map((item) => {
        const category = CATEGORIES[item.category] || CATEGORIES.other;
        const when = item.daysLeft <= 0 ? "op" : `nog ${item.daysLeft} ${item.daysLeft === 1 ? "dag" : "dagen"}`;
        return restRow(ICONS[category.icon], item.name, when, "alert");
      });
  }

  function restWhen(task) {
    return dayOf(task) === null ? REST_WHEN[repeatOf(task)] : todoText(task).toLowerCase();
  }

  function renderRest() {
    const open = dueTasks().filter((task) => !currentDone(task));
    const stock = restStock();
    let html = "";
    if (open.length) {
      const rows = open.slice(0, REST_TASKS).map((task) =>
        restRow(ICONS[task.icon] || ICONS.paw, task.title, restWhen(task)));
      if (open.length > REST_TASKS) rows.push(`<li class="more">+${open.length - REST_TASKS} meer</li>`);
      html += `<div class="rest-title">Nog te doen</div><ul class="rest-list">${rows.join("")}</ul>`;
    }
    if (stock.length) {
      html += `<div class="rest-title">Voorraad</div><ul class="rest-list">${stock.slice(0, REST_STOCK).join("")}</ul>`;
    }
    els.restCard.innerHTML = html;
    els.restCard.hidden = !html;
  }

  function scheduleRest() {
    clearTimeout(restTimer);
    restTimer = setTimeout(showRest, REST_AFTER_MS);
  }

  function showRest() {
    // Niet midden in het typen of tijdens een video: dan later nog eens.
    if (editor || !els.video.hidden) return scheduleRest();
    closeSheet();
    closePage();
    closeLog();
    renderRest();
    els.rest.hidden = false;
  }

  function hideRest() {
    hideRestQr();
    els.rest.hidden = true;
    scheduleRest();
  }

  function render() {
    renderClock();
    const list = tasks();
    const due = dueTasks(); // een vaste dag die nog moet komen telt nog niet mee
    const total = due.length;
    const doneCount = due.filter((task) => currentDone(task)).length;
    const allDone = total > 0 && doneCount === total;
    document.body.classList.toggle("all-done", allDone);
    els.progressText.textContent = allDone ? "Alles gedaan voor vandaag" : `${doneCount} van ${total} gedaan`;
    els.progressBar.style.width = total ? `${(doneCount / total) * 100}%` : "0";
    const [, cols, rows] = TASK_LAYOUTS.find(([max]) => list.length <= max) || TASK_LAYOUTS[TASK_LAYOUTS.length - 1];
    els.tasks.dataset.layout = `${cols}x${rows}`;
    els.tasks.innerHTML = list.map((task) => taskCard(task, cols > 2)).join("");
    els.tasksMore.textContent = "Beheren ›";
    renderActions();
    renderStock();
    renderPage();
  }

  // ---- Pagina "Alle taken" ----

  function editCard(task, index) {
    return `
      <button class="task editing" data-action="edit-task" data-id="${escapeHtml(task.id)}">
        <span class="icon">${ICONS[task.icon] || ICONS.paw}</span>
        <span>
          <span class="title">${escapeHtml(task.title)}</span>
          <span class="status">${repeatText(task)}${task.remind ? ` · seintje ${task.remind}` : ""}</span>
        </span>
        <span class="edit-badge">${ICONS.pencil}</span>
      </button>`;
  }

  function renderPage() {
    if (!pageOpen) return;
    const list = tasks();
    els.pageEdit.textContent = pageEditing ? "Klaar" : "Bewerken";
    els.pageHint.textContent = pageEditing
      ? "Tik op een taak om hem te wijzigen of te verplaatsen."
      : `${list.length} ${list.length === 1 ? "taak" : "taken"} · in deze volgorde op het startscherm`;
    const cards = list.map((task, index) => (pageEditing ? editCard(task, index) : taskCard(task)));
    if (pageEditing && list.length < MAX_TASKS) {
      cards.push(`
        <button class="task add" data-action="add-task">
          <span class="icon">${ICONS.plus}</span>
          <span class="title">Taak toevoegen</span>
        </button>`);
    }
    els.pageGrid.innerHTML = cards.join("");
  }

  function touchPage() {
    clearTimeout(pageTimer);
    pageTimer = setTimeout(() => {
      if (!editor) closePage();
    }, PAGE_TIMEOUT_MS);
  }

  function openPage() {
    pageOpen = true;
    pageEditing = false;
    els.page.hidden = false;
    renderPage();
    touchPage();
  }

  function closePage() {
    pageOpen = false;
    pageEditing = false;
    els.page.hidden = true;
    clearTimeout(pageTimer);
  }

  // ---- Logboek: kattenbak en voeren ----

  // Bezoeken aan de bak komen van Tuya; voerbeurten en het draaien via het
  // overzicht houdt het servertje zelf bij (zie netlify/functions/kattenbak.mjs).
  const LOG_TIMEOUT_MS = 2 * 60 * 1000;
  let logOpen = false;
  let logTimer = null;

  // "Vandaag", "Gisteren" of "dinsdag 27 oktober" (gewone kalenderdagen).
  function logDay(at) {
    const date = new Date(at);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === new Date().toDateString()) return "Vandaag";
    if (date.toDateString() === yesterday.toDateString()) return "Gisteren";
    return formatDate(date);
  }

  function duration(seconds) {
    if (!(seconds > 0)) return "";
    return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
  }

  function logRows(entries, row) {
    if (!entries.length) return '<p class="log-empty">Nog niets deze week.</p>';
    let day = "";
    return entries.map((entry) => {
      const label = logDay(entry.at);
      const head = label === day ? "" : `<div class="log-day">${label}</div>`;
      day = label;
      return `${head}<div class="log-row${entry.kind === "clean" ? " clean" : ""}">
        <span class="log-time">${formatTime(new Date(entry.at))}</span>${row(entry)}</div>`;
    }).join("");
  }

  function logCard(icon, title, summary, body) {
    return `
      <section class="log-card">
        <header class="log-card-head">
          <span class="icon">${icon}</span>
          <div><h3>${title}</h3><p>${summary}</p></div>
        </header>
        <div class="log-list">${body}</div>
      </section>`;
  }

  function renderLog(data) {
    if (!data || data.error) {
      const text = data ? ACTION_ERRORS[data.error] || "Logboek niet bereikbaar" : "Laden…";
      els.logColumns.innerHTML = `<p class="log-empty">${escapeHtml(text)}</p>`;
      return;
    }
    const isToday = (entry) => logDay(entry.at) === "Vandaag";
    const visits = data.visits || [];
    const cleans = (data.cleans || []).map((entry) => ({ ...entry, kind: "clean" }));
    const box = [...visits, ...cleans].sort((a, b) => b.at - a.at);
    const latest = visits.find((visit) => visit.weightKg);
    const boxSummary = [`Vandaag ${visits.filter(isToday).length}×`, latest && `Pip ${String(latest.weightKg).replace(".", ",")} kg`]
      .filter(Boolean).join(" · ");
    const feeds = data.feeds || [];
    const portionsToday = feeds.filter(isToday).reduce((sum, feed) => sum + (feed.portions || 0), 0);
    els.logColumns.innerHTML =
      logCard(ICONS.box, "Kattenbak", boxSummary, logRows(box, (entry) => entry.kind === "clean"
        ? '<span class="log-what">Gedraaid</span><span class="log-source">via overzicht</span>'
        : `<span class="log-what">${[entry.weightKg && `${String(entry.weightKg).replace(".", ",")} kg`, duration(entry.seconds)].filter(Boolean).join(" · ") || "Bezoek"}</span>`)) +
      logCard(ICONS.bowl, "Voeren", `Vandaag ${portionsText(portionsToday)}`, logRows(feeds, (feed) =>
        `<span class="log-what">${portionsText(feed.portions)}</span><span class="log-source">${feed.source === "overzicht" ? "via overzicht" : "schema of app"}</span>`));
  }

  async function refreshLog() {
    if (!kattenbakLinked()) return renderLog({ error: "UNAUTHORIZED" });
    try {
      const response = await fetch(`${kattenbakUrl()}?log=1`, {
        headers: { Authorization: `Bearer ${actionCode()}` },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (logOpen) renderLog(response.ok ? data : { error: data.error || "UNREACHABLE" });
    } catch (error) {
      if (logOpen) renderLog({ error: "UNREACHABLE" });
    }
  }

  function touchLog() {
    clearTimeout(logTimer);
    logTimer = setTimeout(closeLog, LOG_TIMEOUT_MS);
  }

  function openLog() {
    logOpen = true;
    els.log.hidden = false;
    renderLog(null);
    refreshLog();
    touchLog();
  }

  function closeLog() {
    logOpen = false;
    els.log.hidden = true;
    clearTimeout(logTimer);
  }

  // ---- Taak toevoegen of wijzigen (met schermtoetsenbord) ----

  function keyButton(key) {
    if (key === "back") return `<button class="key wide" data-action="kb-key" data-key="back" aria-label="Wissen">${ICONS.erase}</button>`;
    if (key === "space") return '<button class="key space" data-action="kb-key" data-key="space">spatie</button>';
    return `<button class="key" data-action="kb-key" data-key="${escapeHtml(key)}">${escapeHtml(key)}</button>`;
  }

  function editorHtml() {
    const list = tasks();
    const isNew = !editor.id;
    const index = isNew ? -1 : list.findIndex((task) => task.id === editor.id);
    const taken = new Set(list.map((task) => task.title.toLowerCase()));
    const suggestions = isNew ? SUGGESTIONS.filter((s) => !taken.has(s.title.toLowerCase())).slice(0, 6) : [];
    const chips = suggestions.map((s) =>
      `<button class="chip" data-action="kb-suggest" data-title="${escapeHtml(s.title)}" data-icon="${s.icon}" data-repeat="${s.repeat}">${escapeHtml(s.title)}</button>`).join("");
    const icons = TASK_ICONS.map((name) =>
      `<button class="icon-pick${name === editor.icon ? " selected" : ""}" data-action="kb-icon" data-icon="${name}" aria-label="${name}">${ICONS[name]}</button>`).join("");
    const repeats = Object.entries(REPEATS).map(([key, { label }]) =>
      `<button class="repeat-pick${key === editor.repeat ? " selected" : ""}" data-action="kb-repeat" data-repeat="${key}">${label}</button>`).join("");
    const kind = REPEATS[editor.repeat].days;
    const pick = (day, label) =>
      `<button class="repeat-pick${day === null ? "" : " weekday"}${editor.day === day ? " selected" : ""}" data-action="kb-day" data-day="${day === null ? "" : day}">${label}</button>`;
    let days = "";
    if (kind === "week") {
      days = WEEK_ORDER.map((day) => pick(day, DAYS_SHORT[day])).join("");
    } else if (kind === "month") {
      days = `
        <button class="repeat-pick step" data-action="kb-day-step" data-delta="-1" aria-label="Eerder">${ICONS.left}</button>
        <span class="month-day${editor.day === null ? " empty" : ""}">${editor.day === null ? "Kies een dag" : `Op de ${editor.day}e`}</span>
        <button class="repeat-pick step" data-action="kb-day-step" data-delta="1" aria-label="Later">${ICONS.right}</button>`;
    }
    const dayRow = kind
      ? `<div class="repeat-row"><span class="repeat-label">Welke dag</span>${pick(null, "Geen vaste dag")}${days}</div>`
      : "";
    const manage = isNew ? "" : `
      <button class="choice warn small" data-action="kb-delete"${list.length <= 1 ? " disabled" : ""}>${editor.confirmDelete ? "Echt verwijderen?" : "Verwijderen"}</button>
      <button class="choice secondary small square" data-action="kb-move" data-delta="-1" aria-label="Eerder"${index <= 0 ? " disabled" : ""}>${ICONS.left}</button>
      <button class="choice secondary small square" data-action="kb-move" data-delta="1" aria-label="Later"${index >= list.length - 1 ? " disabled" : ""}>${ICONS.right}</button>
      <span class="position">Plek ${index + 1} van ${list.length}</span>`;
    return `
      <h3>${isNew ? "Nieuwe taak" : "Taak wijzigen"}</h3>
      <div class="name-field${editor.title ? "" : " empty"}">${escapeHtml(editor.title) || "Naam van de taak"}<span class="caret"></span></div>
      ${chips ? `<div class="chips">${chips}</div>` : ""}
      <div class="icon-row">${icons}</div>
      <div class="schedule">
        <div class="repeat-row"><span class="repeat-label">Hoe vaak</span>${repeats}</div>
        ${dayRow}
      </div>
      <div class="keyboard">${KEY_ROWS.map((row) => `<div class="kb-row">${row.map(keyButton).join("")}</div>`).join("")}</div>
      <div class="editor-actions">
        <div class="editor-manage">${manage}</div>
        <div class="editor-done">
          <button class="choice secondary small" data-action="close">Annuleren</button>
          <button class="choice small" data-action="kb-save"${editor.title.trim() ? "" : " disabled"}>Opslaan</button>
        </div>
      </div>`;
  }

  function openEditor(task) {
    const base = task
      ? { id: task.id, title: task.title, icon: task.icon || "paw", repeat: repeatOf(task), day: dayOf(task) }
      : { id: null, title: "", icon: "paw", repeat: "daily", day: null };
    openSheet(null, "", { wide: true });
    editor = { ...base, confirmDelete: false };
    refreshEditor();
  }

  // Andere herhaling: een weekdag past niet bij een maandtaak en andersom.
  function setEditorRepeat(repeat) {
    if (!REPEATS[repeat]) return;
    if (REPEATS[repeat].days !== REPEATS[editor.repeat].days) editor.day = null;
    editor.repeat = repeat;
  }

  // Dag van de maand verschuiven; zonder dag begint hij bij vandaag.
  function stepMonthDay(delta) {
    const today = Math.min(shifted(new Date()).getDate(), MAX_MONTH_DAY);
    editor.day = editor.day === null ? today : mod(editor.day - 1 + delta, MAX_MONTH_DAY) + 1;
  }

  function refreshEditor() {
    if (editor) els.sheetBody.innerHTML = editorHtml();
  }

  function typeKey(key) {
    if (key === "back") {
      editor.title = editor.title.slice(0, -1);
    } else if (editor.title.length < MAX_TITLE) {
      const char = key === "space" ? " " : key;
      if (char === " " && (!editor.title || editor.title.endsWith(" "))) return;
      editor.title += editor.title ? char : char.toUpperCase();
    }
    editor.confirmDelete = false;
    refreshEditor();
  }

  function saveEditor() {
    const title = editor.title.trim();
    if (!title) return;
    const list = tasks().map((task) => ({ ...task }));
    const schedule = { repeat: editor.repeat, day: editor.day, from: dayNumber(new Date()) };
    if (editor.id) {
      const task = list.find((t) => t.id === editor.id);
      // Zelfde herhaling en dag: dan blijft de taak lopen zoals hij liep.
      const same = task && repeatOf(task) === editor.repeat && dayOf(task) === editor.day;
      if (task) Object.assign(task, { title, icon: editor.icon }, same ? {} : schedule);
    } else {
      list.push({ id: `t${Date.now().toString(36)}`, title, icon: editor.icon, ...schedule });
    }
    closeSheet();
    setTasks(list);
  }

  function moveEditing(delta) {
    const list = tasks().map((task) => ({ ...task }));
    const from = list.findIndex((task) => task.id === editor.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return;
    [list[from], list[to]] = [list[to], list[from]];
    setTasks(list);
    refreshEditor();
  }

  function deleteEditing() {
    if (!editor.confirmDelete) {
      editor.confirmDelete = true;
      refreshEditor();
      return;
    }
    const list = tasks().filter((task) => task.id !== editor.id);
    closeSheet();
    if (list.length) setTasks(list);
  }

  // ---- Keuzevenster ----

  // wide: groot venster (bewerken); dat sluit niet vanzelf, want je bent aan het typen.
  function openSheet(task, html, { wide = false } = {}) {
    sheetTask = task;
    els.sheetBody.className = wide ? "sheet wide" : "sheet";
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
    clearTimeout(sheetTimer);
    if (!wide) sheetTimer = setTimeout(closeSheet, SHEET_TIMEOUT_MS);
  }

  function closeSheet() {
    sheetTask = null;
    sheetAction = null;
    editor = null;
    els.sheet.hidden = true;
    clearTimeout(sheetTimer);
  }

  function confirmAction(action) {
    openSheet(null, `
      <h3>${escapeHtml(action.title)}</h3>
      <p>${escapeHtml(action.confirm)}</p>
      <div class="choices">
        <button class="choice" data-action="act-confirm">${escapeHtml(action.button)}</button>
        <button class="choice secondary" data-action="close">Annuleren</button>
      </div>`);
    sheetAction = action;
  }

  // ---- Naar de Google Hub ----

  // Pip gaat aan de kant voor de eigen software van de Google Hub (timers, weer,
  // fotolijst). Het script op de Mac zet Pip daarna vanzelf terug.
  const AWAY_CHOICES = { "15": "Over 15 min", "60": "Over 1 uur", morning: "Morgenochtend" };
  const WATCHER_FRESH_MS = 12 * 60 * 1000; // het script meldt zich elke 5 minuten

  // Draait het script op de Mac dat Pip terugzet? Anders niets beloven.
  async function watcherAlive() {
    if (!actionCode() || !settingsUrl()) return false;
    try {
      const response = await fetch(settingsUrl(), {
        headers: { Authorization: `Bearer ${actionCode()}` },
        cache: "no-store",
        signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
      });
      const remote = response.ok ? await response.json() : {};
      return Date.now() - (remote.watcherSeenAt || 0) < WATCHER_FRESH_MS;
    } catch (error) {
      return false;
    }
  }

  // Zonder dat script zou de knop het overzicht wegzetten tot iemand het opnieuw
  // start. Dan liever geen knop: het overzicht blijft zo veel mogelijk staan.
  function showGoogleButton(alive) {
    els.toGoogle.hidden = !alive;
  }

  async function refreshGoogleButton() {
    showGoogleButton(await watcherAlive());
  }

  // Zelf kiezen: een tijdstip, met knoppen een kwartier of uur verschuiven.
  const AWAY_STEP_MS = 15 * 60 * 1000;
  const AWAY_MIN_MS = 5 * 60 * 1000;
  const AWAY_MAX_MS = 24 * 60 * 60 * 1000;
  let awayPick = 0;

  function clampAway(at) {
    return Math.min(Math.max(at, Date.now() + AWAY_MIN_MS), Date.now() + AWAY_MAX_MS);
  }

  // "over 45 min" of "over 2 uur 15 min".
  function awayDuration(at) {
    const minutes = Math.max(1, Math.round((at - Date.now()) / 60000));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `over ${rest} min`;
    return `over ${hours} uur${rest ? ` ${rest} min` : ""}`;
  }

  // Rustig: alleen de tijd, met − en + (een kwartier; ingedrukt houden gaat sneller).
  function customAwayHtml() {
    const step = (delta, icon, label) =>
      `<button class="pick-step" data-action="google-step" data-delta="${delta}" aria-label="${label}">${icon}</button>`;
    return `
      <p class="pick-label">Het overzicht komt terug om</p>
      <div class="pick-row">
        ${step(-15, ICONS.minus, "Kwartier eerder")}
        <div class="pick-value">
          <span class="pick-day" id="away-day">morgen</span>
          <strong id="away-clock"></strong>
          <span class="pick-sub" id="away-left"></span>
        </div>
        ${step(15, ICONS.plus, "Kwartier later")}
      </div>
      <div class="choices">
        <button class="choice" data-action="google-go" data-choice="custom">Naar Google Hub</button>
        <button class="choice secondary" data-action="to-google">Terug</button>
      </div>`;
  }

  // Alleen de tekst bijwerken, niet het hele venster: dan blijft ingedrukt houden werken.
  function renderAwayTime() {
    const clock = document.getElementById("away-clock");
    if (!clock) return;
    const at = new Date(awayPick);
    document.getElementById("away-day").classList.toggle("shown", at.toDateString() !== new Date().toDateString());
    clock.textContent = formatTime(at);
    document.getElementById("away-left").textContent = awayDuration(awayPick);
  }

  function openCustomAway() {
    // Begin een half uur vooruit, afgerond op het volgende kwartier.
    awayPick = clampAway(Math.ceil((Date.now() + 30 * 60 * 1000) / AWAY_STEP_MS) * AWAY_STEP_MS);
    openSheet(null, customAwayHtml());
    els.sheetBody.classList.add("picker");
    renderAwayTime();
  }

  function stepCustomAway(minutes) {
    // Weer op een heel kwartier uitkomen, ook na de grens van 5 min of 24 uur.
    awayPick = clampAway(Math.round((awayPick + minutes * 60 * 1000) / AWAY_STEP_MS) * AWAY_STEP_MS);
    renderAwayTime();
    clearTimeout(sheetTimer); // zolang je verschuift, blijft het venster open
    sheetTimer = setTimeout(closeSheet, SHEET_TIMEOUT_MS);
  }

  // − of + ingedrukt houden: na een halve seconde steeds sneller verschuiven.
  let holdTimer = null;
  let held = false;

  function stopHold() {
    clearTimeout(holdTimer);
  }

  const STEPPERS = { "google-step": (delta) => stepCustomAway(delta), "feed-step": (delta) => stepFeed(delta) };

  els.sheet.addEventListener("pointerdown", (event) => {
    const button = event.target.closest('[data-action="google-step"], [data-action="feed-step"]');
    if (!button) return;
    held = false;
    const step = STEPPERS[button.dataset.action];
    const delta = Number(button.dataset.delta);
    const repeat = (wait) => {
      holdTimer = setTimeout(() => {
        held = true;
        step(delta);
        repeat(Math.max(70, wait * 0.8));
      }, wait);
    };
    repeat(450);
  });
  ["pointerup", "pointercancel"].forEach((type) => document.addEventListener(type, stopHold));

  function awayUntil(choice) {
    if (choice === "custom") return clampAway(awayPick);
    if (choice !== "morning") return Date.now() + Number(choice) * 60 * 1000;
    const morning = new Date();
    if (morning.getHours() >= NIGHT_UNTIL) morning.setDate(morning.getDate() + 1);
    morning.setHours(NIGHT_UNTIL, 0, 0, 0);
    return morning.getTime();
  }

  async function askGoogle() {
    if (!(await watcherAlive())) {
      openSheet(null, `
        <h3>Naar Google Hub</h3>
        <p>Het overzicht komt daarna niet vanzelf terug: het script op de NAS draait niet. Tik later op Start overzicht op je telefoon.</p>
        <div class="choices">
          <button class="choice" data-action="google-go" data-choice="none">Naar Google Hub</button>
          <button class="choice secondary" data-action="close">Annuleren</button>
        </div>`);
      return;
    }
    const buttons = Object.entries(AWAY_CHOICES).map(([choice, label]) =>
      `<button class="choice" data-action="google-go" data-choice="${choice}">${label}</button>`).join("");
    openSheet(null, `
      <h3>Naar Google Hub</h3>
      <p>Wanneer moet het overzicht terugkomen?</p>
      <div class="choices">${buttons}</div>
      <div class="choices">
        <button class="choice secondary" data-action="google-custom">Zelf kiezen</button>
        <button class="choice secondary" data-action="close">Annuleren</button>
      </div>
      <p class="hint">Eerder terug? Tik op Start overzicht op je telefoon.</p>`);
  }

  async function goToGoogle(choice) {
    closeSheet();
    if (!window.PipCast) {
      openSheet(null, `
        <h3>Alleen op de Google Hub</h3>
        <p>Hier is het overzicht een voorbeeld in de browser; er is geen Google Hub om naartoe te gaan.</p>
        <div class="choices"><button class="choice secondary" data-action="close">Sluiten</button></div>`);
      return;
    }
    els.toGoogle.disabled = true;
    // Eerst opslaan: na stop() draait Pip niet meer.
    if (choice !== "none") await putAway(awayUntil(choice));
    window.PipCast.stop();
  }

  // ---- Voeren: hoeveel porties ----

  let feedPortions = 1;

  function feedSheetHtml() {
    return `
      <p class="pick-label">Hoeveel porties voeren?</p>
      <div class="pick-row">
        <button class="pick-step" data-action="feed-step" data-delta="-1" aria-label="Portie minder">${ICONS.minus}</button>
        <div class="pick-value">
          <strong id="feed-count"></strong>
          <span class="pick-sub" id="feed-unit"></span>
        </div>
        <button class="pick-step" data-action="feed-step" data-delta="1" aria-label="Portie meer">${ICONS.plus}</button>
      </div>
      <div class="choices">
        <button class="choice" data-action="act-confirm">Voeren</button>
        <button class="choice secondary" data-action="close">Annuleren</button>
      </div>`;
  }

  function renderFeedCount() {
    const count = document.getElementById("feed-count");
    if (!count) return;
    count.textContent = feedPortions;
    document.getElementById("feed-unit").textContent = feedPortions === 1 ? "portie" : "porties";
  }

  function askFeed(action) {
    const saved = Number(readStorage(FEED_PORTIONS_KEY));
    feedPortions = Number.isInteger(saved) && saved >= 1 && saved <= MAX_PORTIONS ? saved : 1;
    openSheet(null, feedSheetHtml());
    els.sheetBody.classList.add("picker");
    sheetAction = action;
    renderFeedCount();
  }

  function stepFeed(delta) {
    feedPortions = Math.min(MAX_PORTIONS, Math.max(1, feedPortions + delta));
    renderFeedCount();
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(closeSheet, SHEET_TIMEOUT_MS);
  }

  function showNotLinked() {
    openSheet(null, `
      <h3>Nog niet gekoppeld</h3>
      <p>Vul de kattenbak-code in op de startpagina van het overzicht.</p>
      <div class="choices"><button class="choice secondary" data-action="close">Sluiten</button></div>`);
  }

  function askWho(task) {
    const buttons = people().map((person) =>
      `<button class="choice" data-action="person" data-person="${escapeHtml(person)}">${escapeHtml(person)}</button>`).join("");
    openSheet(task, `
      <h3>${escapeHtml(task.title)}</h3>
      <p>Wie heeft het gedaan?</p>
      <div class="choices">${buttons}</div>
      <div class="choices"><button class="choice secondary" data-action="close">Annuleren</button></div>`);
  }

  function showDone(task) {
    const done = currentDone(task);
    openSheet(task, `
      <h3>${escapeHtml(task.title)}</h3>
      <p>Gedaan door ${escapeHtml(done.by)} ${whenLong(done.at)}</p>
      <div class="choices">
        <button class="choice warn" data-action="undo">Toch niet gedaan</button>
        <button class="choice secondary" data-action="close">Sluiten</button>
      </div>`);
  }

  // ---- Video (gestuurd vanaf de startpagina) ----

  // Alleen onbeveiligde video: YouTube-filmpjes en gewone videolinks. Wat er
  // gebeurt (laden, spelen, fout) gaat terug naar de zender via report().

  const YOUTUBE_STATES = { [-1]: "unstarted", 0: "ended", 1: "playing", 2: "paused", 3: "buffering", 5: "cued" };
  let youtubeApi = null;
  let youtubePlayer = null;
  let videoProgressTimer = null;

  function loadYouTubeApi() {
    if (!youtubeApi) {
      youtubeApi = new Promise((resolve, reject) => {
        window.onYouTubeIframeAPIReady = () => resolve(window.YT);
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => reject(new Error("YT_API_LOAD"));
        document.head.appendChild(script);
        setTimeout(() => reject(new Error("YT_API_TIMEOUT")), 15000);
      }).catch((error) => {
        youtubeApi = null;
        throw error;
      });
    }
    return youtubeApi;
  }

  async function playYouTube(id, report) {
    try {
      const YT = await loadYouTubeApi();
      const holder = document.createElement("div");
      els.videoFrame.appendChild(holder);
      youtubePlayer = new YT.Player(holder, {
        videoId: id,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: (event) => {
            report({ state: "ready" });
            event.target.playVideo();
          },
          onStateChange: (event) => report({ state: YOUTUBE_STATES[event.data] || String(event.data) }),
          onError: (event) => report({ state: "error", detail: `YT_${event.data}` }),
        },
      });
      videoProgressTimer = setTimeout(() => {
        if (youtubePlayer && youtubePlayer.getCurrentTime) report({ state: "progress", time: youtubePlayer.getCurrentTime() });
      }, 8000);
    } catch (error) {
      report({ state: "error", detail: error.message });
    }
  }

  function playUrl(url, report) {
    const video = document.createElement("video");
    video.src = url;
    video.autoplay = true;
    video.controls = true;
    video.playsInline = true;
    video.addEventListener("playing", () => report({ state: "playing" }));
    video.addEventListener("ended", () => report({ state: "ended" }));
    video.addEventListener("error", () => report({ state: "error", detail: `MEDIA_${video.error ? video.error.code : "?"}` }));
    els.videoFrame.appendChild(video);
    videoProgressTimer = setTimeout(() => report({ state: "progress", time: video.currentTime }), 8000);
  }

  function closeVideo() {
    clearTimeout(videoProgressTimer);
    if (youtubePlayer && youtubePlayer.destroy) youtubePlayer.destroy();
    youtubePlayer = null;
    els.videoFrame.innerHTML = "";
    els.video.hidden = true;
  }

  function playVideo(request, report = () => {}) {
    closeVideo();
    closeSheet();
    els.videoTitle.textContent = String(request.title || "Video").slice(0, 60);
    els.video.hidden = false;
    if (request.kind === "youtube" && /^[\w-]{11}$/.test(request.id || "")) {
      playYouTube(request.id, report);
    } else if (request.kind === "url" && /^https:\/\//.test(request.url || "")) {
      playUrl(request.url, report);
    } else {
      closeVideo();
      report({ state: "error", detail: "BAD_REQUEST" });
    }
  }

  // Laadt een productfoto niet, dan blijft het categorie-icoon eronder zichtbaar.
  els.stock.addEventListener("error", (event) => {
    if (event.target.tagName === "IMG") event.target.closest(".thumb").classList.remove("has-img");
  }, true);

  document.addEventListener("click", (event) => {
    audio(); // geluid mag pas na een tik
    if (pageOpen) touchPage();
    if (logOpen) touchLog();
    if (els.rest.hidden) scheduleRest(); // elke tik stelt de ruststand uit
    const target = event.target.closest("[data-action]");
    if (!target || target.disabled) {
      // Naast het venster tikken sluit het, behalve tijdens het typen.
      if (event.target === els.sheet && !editor) closeSheet();
      return;
    }
    const { action, id } = target.dataset;
    if (action === "rest-qr") {
      showRestQr();
    } else if (action === "rest-qr-close") {
      hideRestQr();
    } else if (action === "wake") {
      petPip();
      hideRest();
    } else if (action === "video-close") {
      closeVideo();
    } else if (action === "to-google") {
      askGoogle();
    } else if (action === "google-custom") {
      openCustomAway();
    } else if (action === "google-step" || action === "feed-step") {
      if (held) held = false; // ingedrukt gehouden: de tik is al verwerkt
      else STEPPERS[action](Number(target.dataset.delta));
    } else if (action === "google-go") {
      goToGoogle(target.dataset.choice);
    } else if (action === "all-tasks") {
      openPage();
    } else if (action === "page-close") {
      closePage();
    } else if (action === "log-open") {
      openLog();
    } else if (action === "log-close") {
      closeLog();
    } else if (action === "page-edit") {
      pageEditing = !pageEditing;
      renderPage();
    } else if (action === "edit-task") {
      const task = tasks().find((t) => t.id === id);
      if (task) openEditor(task);
    } else if (action === "add-task") {
      openEditor(null);
    } else if (action === "kb-key" && editor) {
      typeKey(target.dataset.key);
    } else if (action === "kb-icon" && editor) {
      editor.icon = target.dataset.icon;
      refreshEditor();
    } else if (action === "kb-suggest" && editor) {
      editor.title = target.dataset.title;
      editor.icon = target.dataset.icon;
      setEditorRepeat(target.dataset.repeat);
      refreshEditor();
    } else if (action === "kb-repeat" && editor) {
      setEditorRepeat(target.dataset.repeat);
      refreshEditor();
    } else if (action === "kb-day" && editor) {
      editor.day = target.dataset.day === "" ? null : Number(target.dataset.day);
      refreshEditor();
    } else if (action === "kb-day-step" && editor) {
      stepMonthDay(Number(target.dataset.delta));
      refreshEditor();
    } else if (action === "kb-save" && editor) {
      saveEditor();
    } else if (action === "kb-move" && editor) {
      moveEditing(Number(target.dataset.delta));
    } else if (action === "kb-delete" && editor) {
      deleteEditing();
    } else if (action === "task") {
      const task = tasks().find((t) => t.id === id);
      if (!task) return;
      if (currentDone(task)) showDone(task);
      else if (people().length <= 1) markDone(task, people()[0] || "Gedaan");
      else askWho(task);
    } else if (action === "person" && sheetTask) {
      markDone(sheetTask, target.dataset.person);
      closeSheet();
    } else if (action === "undo" && sheetTask) {
      undo(sheetTask);
      closeSheet();
    } else if (action === "act") {
      const act = (config.actions || []).find((a) => a.id === id);
      if (!act || busyActions.has(act.id)) return;
      if (!kattenbakLinked()) showNotLinked();
      else if (act.id === "feed") askFeed(act);
      else confirmAction(act);
    } else if (action === "act-confirm" && sheetAction) {
      const act = sheetAction;
      closeSheet();
      if (act.id === "feed") {
        writeStorage(FEED_PORTIONS_KEY, String(feedPortions));
        runAction(act, { portions: feedPortions });
      } else {
        runAction(act);
      }
    } else if (action === "close") {
      closeSheet();
    } else if (action === "stock") {
      changeStock(id, Number(target.dataset.delta));
    }
  });

  // ---- Start ----

  els.toGoogle.innerHTML = `${ICONS.home}<span>Google Hub</span>`;
  els.restQrButton.innerHTML = ICONS.qr;
  els.restQrButton.hidden = !actionCode(); // zonder koppelcode valt er niets te koppelen
  renderLogo();
  rollOverIfNewDay();
  saveState();
  render();
  renderRest(); // Pip begint in de ruststand
  refreshVoerraad();
  refreshKattenbak();
  pullSettings();
  setInterval(refreshVoerraad, config.voerraad.refreshMinutes * 60 * 1000);
  setInterval(refreshKattenbak, config.kattenbak.refreshMinutes * 60 * 1000);
  setInterval(refreshGoogleButton, 10 * 60 * 1000); // script aan- of uitgezet?
  refreshPhotos();
  refreshMeow();
  setInterval(refreshPhotos, 5 * 60 * 1000); // wijzigingen op fotos.html binnen 5 minuten
  setInterval(refreshMeow, 15 * 60 * 1000);
  scheduleSlide();
  // Lukte het eerste ophalen niet (geen netwerk), elke minuut opnieuw proberen.
  setInterval(() => {
    if (!synced) pullSettings();
  }, 60 * 1000);
  setInterval(() => {
    if (rollOverIfNewDay()) {
      closeSheet();
      render();
      refreshVoerraad();
    } else {
      renderClock();
      renderActions(); // "Gestart om …" verloopt vanzelf
      renderRest();
    }
  }, 10000);

  // Voor cast.js: de startknop stuurt de codes en de huisgenoten naar de Hub.
  window.Pip = { setVoerraadCode, setActionCode, setPeople, playVideo, closeVideo };
})();
