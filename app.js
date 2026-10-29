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
  };

  // Takenlijst die je op de Hub zelf beheert.
  const SETTINGS_KEY = "pip-hub-settings";
  const HOME_TASKS = 4; // zoveel taken staan op het startscherm, de rest onder "meer"
  const MAX_TASKS = 12;
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
    daily: { label: "Elke dag", todo: "Nog doen" },
    weekly: { label: "Elke week", todo: "Deze week nog doen", days: "week" },
    biweekly: { label: "Om de week", todo: "Deze 2 weken nog doen", days: "week" },
    monthly: { label: "Elke maand", todo: "Deze maand nog doen", days: "month" },
    quarterly: { label: "Elk kwartaal", todo: "Dit kwartaal nog doen", days: "month" },
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
    rest: document.getElementById("rest"),
    restClock: document.getElementById("rest-clock"),
    restDate: document.getElementById("rest-date"),
    restCard: document.getElementById("rest-card"),
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
    state.done[task.id] = entry;
    saveState();
    render();
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

  async function runAction(action) {
    busyActions.add(action.id);
    renderActions();
    let result;
    try {
      const response = await fetch(kattenbakUrl(), {
        method: "POST",
        headers: { Authorization: `Bearer ${actionCode()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.id }),
      });
      const data = await response.json().catch(() => ({}));
      result = response.ok
        ? { text: `Gestart om ${formatTime(new Date())}`, kind: "ok" }
        : { text: ACTION_ERRORS[data.error] || "Niet gelukt", kind: "warn" };
    } catch (error) {
      result = { text: ACTION_ERRORS.UNREACHABLE, kind: "warn" };
    }
    busyActions.delete(action.id);
    actionFeedback[action.id] = { ...result, until: Date.now() + FEEDBACK_MS };
    renderActions();
    refreshKattenbak();
  }

  function setActionCode(code) {
    const clean = String(code || "").trim();
    writeStorage(ACTION_CODE_KEY, clean || null);
    kattenbak = null;
    refreshKattenbak();
    pullSettings();
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
    if (settings.tasks) body.tasks = settings.tasks;
    if (settings.people) body.people = settings.people;
    try {
      await fetch(settingsUrl(), {
        method: "PUT",
        headers: { Authorization: `Bearer ${actionCode()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
      return item;
    });
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
  function todoText(task) {
    if (dayOf(task) === null) return REPEATS[repeatOf(task)].todo;
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

  function taskCard(task) {
    const done = currentDone(task);
    const later = !done && upcomingDay(task) !== null;
    const status = done
      ? `${escapeHtml(done.by)} · ${whenShort(done.at)}`
      : todoText(task);
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
    renderRest();
    els.rest.hidden = false;
  }

  function hideRest() {
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
    els.tasks.innerHTML = list.slice(0, HOME_TASKS).map(taskCard).join("");
    const extra = total - HOME_TASKS;
    els.tasksMore.textContent = extra > 0 ? `+${extra} meer ›` : "Beheren ›";
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
          <span class="status">${repeatText(task)} · ${index < HOME_TASKS ? "startscherm" : "onder meer"}</span>
        </span>
        <span class="edit-badge">${ICONS.pencil}</span>
      </button>`;
  }

  function renderPage() {
    if (!pageOpen) return;
    const list = tasks();
    els.pageEdit.textContent = pageEditing ? "Klaar" : "Bewerken";
    els.pageHint.textContent = pageEditing
      ? "Tik op een taak om hem te wijzigen. De eerste 4 staan op het startscherm."
      : `${list.length} ${list.length === 1 ? "taak" : "taken"} · de eerste 4 staan op het startscherm`;
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
      <span class="position">Plek ${index + 1} van ${list.length}${index < HOME_TASKS ? " · startscherm" : ""}</span>`;
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

  function customAwayHtml() {
    const at = new Date(awayPick);
    const day = at.toDateString() === new Date().toDateString() ? "" : "morgen ";
    const step = (delta, label) =>
      `<button class="away-step" data-action="google-step" data-delta="${delta}">${label}</button>`;
    return `
      <h3>Wanneer komt Pip terug?</h3>
      <div class="away-pick">
        ${step(-60, "−1 uur")}${step(-15, "−15 min")}
        <div class="away-time"><strong>${day}${formatTime(at)}</strong><span>${awayDuration(awayPick)}</span></div>
        ${step(15, "+15 min")}${step(60, "+1 uur")}
      </div>
      <div class="choices">
        <button class="choice" data-action="google-go" data-choice="custom">Naar Google Hub</button>
        <button class="choice secondary" data-action="to-google">Terug</button>
      </div>`;
  }

  function openCustomAway() {
    // Begin een half uur vooruit, afgerond op het volgende kwartier.
    awayPick = clampAway(Math.ceil((Date.now() + 30 * 60 * 1000) / AWAY_STEP_MS) * AWAY_STEP_MS);
    openSheet(null, customAwayHtml());
  }

  function stepCustomAway(minutes) {
    // Weer op een heel kwartier uitkomen, ook na de grens van 5 min of 24 uur.
    awayPick = clampAway(Math.round((awayPick + minutes * 60 * 1000) / AWAY_STEP_MS) * AWAY_STEP_MS);
    openSheet(null, customAwayHtml()); // opnieuw openen houdt het venster ook langer open
  }

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
        <p>Pip komt daarna niet vanzelf terug: het script op de Mac draait niet. Tik later op Start Pip op je telefoon.</p>
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
      <p>Wanneer moet Pip terugkomen?</p>
      <div class="choices">${buttons}</div>
      <div class="choices">
        <button class="choice secondary" data-action="google-custom">Zelf kiezen</button>
        <button class="choice secondary" data-action="close">Annuleren</button>
      </div>
      <p class="hint">Eerder terug? Tik op Start Pip op je telefoon.</p>`);
  }

  async function goToGoogle(choice) {
    closeSheet();
    if (!window.PipCast) {
      openSheet(null, `
        <h3>Alleen op de Google Hub</h3>
        <p>Hier is Pip een voorbeeld in de browser; er is geen Google Hub om naartoe te gaan.</p>
        <div class="choices"><button class="choice secondary" data-action="close">Sluiten</button></div>`);
      return;
    }
    els.toGoogle.disabled = true;
    // Eerst opslaan: na stop() draait Pip niet meer.
    if (choice !== "none") await putAway(awayUntil(choice));
    window.PipCast.stop();
  }

  function showNotLinked() {
    openSheet(null, `
      <h3>Nog niet gekoppeld</h3>
      <p>Vul de kattenbak-code in op de startpagina van Pip.</p>
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
    if (pageOpen) touchPage();
    if (els.rest.hidden) scheduleRest(); // elke tik stelt de ruststand uit
    const target = event.target.closest("[data-action]");
    if (!target || target.disabled) {
      // Naast het venster tikken sluit het, behalve tijdens het typen.
      if (event.target === els.sheet && !editor) closeSheet();
      return;
    }
    const { action, id } = target.dataset;
    if (action === "wake") {
      hideRest();
    } else if (action === "video-close") {
      closeVideo();
    } else if (action === "to-google") {
      askGoogle();
    } else if (action === "google-custom") {
      openCustomAway();
    } else if (action === "google-step") {
      stepCustomAway(Number(target.dataset.delta));
    } else if (action === "google-go") {
      goToGoogle(target.dataset.choice);
    } else if (action === "all-tasks") {
      openPage();
    } else if (action === "page-close") {
      closePage();
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
      if (kattenbakLinked()) confirmAction(act);
      else showNotLinked();
    } else if (action === "act-confirm" && sheetAction) {
      const act = sheetAction;
      closeSheet();
      runAction(act);
    } else if (action === "close") {
      closeSheet();
    } else if (action === "stock") {
      changeStock(id, Number(target.dataset.delta));
    }
  });

  // ---- Start ----

  els.toGoogle.innerHTML = `${ICONS.home}<span>Google Hub</span>`;
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
