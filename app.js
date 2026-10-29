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
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
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
    progressText: document.getElementById("progress-text"),
    progressBar: document.getElementById("progress-bar"),
    clock: document.getElementById("clock"),
    date: document.getElementById("date"),
    tasks: document.getElementById("tasks"),
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
  let sheetTask = null;
  let sheetAction = null;
  let sheetTimer = null;

  // ---- Opslag ----

  // De "dag" begint om resetHour, zodat iets om 01:00 nog bij gisteren hoort.
  function logicalDay(date) {
    const shifted = new Date(date.getTime() - config.resetHour * 3600 * 1000);
    return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
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

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Geen opslag beschikbaar: de lijst werkt, maar onthoudt niets na herstart.
    }
  }

  function rollOverIfNewDay() {
    const today = logicalDay(new Date());
    if (state.day === today) return false;
    state.day = today;
    state.done = {};
    saveState();
    return true;
  }

  // ---- Acties ----

  function markDone(task, person) {
    const entry = { by: person, at: Date.now(), took: 0 };
    // Met Voerraad gekoppeld telt Voerraad zelf de dagen af.
    if (task.stock && !voerraadCode() && task.stock.id in state.stock) {
      const before = state.stock[task.stock.id];
      state.stock[task.stock.id] = Math.max(0, before - task.stock.amount);
      entry.took = before - state.stock[task.stock.id];
    }
    state.done[task.id] = entry;
    saveState();
    render();
  }

  function undo(task) {
    const entry = state.done[task.id];
    if (!entry) return;
    if (task.stock && entry.took) state.stock[task.stock.id] += entry.took;
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
        voerraad = { items: data.items, fetchedAt: Date.now(), error: null };
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
    let saved = [];
    try {
      saved = cleanPeople(JSON.parse(readStorage(PEOPLE_KEY)));
    } catch (error) {
      saved = [];
    }
    return saved.length ? saved : config.people;
  }

  function setPeople(list) {
    const clean = cleanPeople(list);
    writeStorage(PEOPLE_KEY, clean.length ? JSON.stringify(clean) : null);
    closeSheet();
  }

  function setVoerraadCode(code) {
    const clean = String(code || "").trim();
    if (clean !== voerraadCode()) {
      writeStorage(VOERRAAD_CODE_KEY, clean || null);
      writeStorage(VOERRAAD_CACHE_KEY, null);
      voerraad = null;
      renderStock();
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

  function taskCard(task) {
    const done = state.done[task.id];
    const status = done
      ? `${escapeHtml(done.by)} · ${formatTime(new Date(done.at))}`
      : "Nog doen";
    return `
      <button class="task${done ? " done" : ""}" data-action="task" data-id="${escapeHtml(task.id)}">
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
  }

  function renderClock() {
    const now = new Date();
    document.documentElement.dataset.theme = isNight(now) ? "dark" : "light";
    els.clock.textContent = formatTime(now);
    els.date.textContent = formatDate(now);
  }

  function render() {
    renderClock();
    const total = config.tasks.length;
    const doneCount = config.tasks.filter((task) => state.done[task.id]).length;
    const allDone = total > 0 && doneCount === total;
    document.body.classList.toggle("all-done", allDone);
    els.progressText.textContent = allDone ? "Alles gedaan voor vandaag" : `${doneCount} van ${total} gedaan`;
    els.progressBar.style.width = total ? `${(doneCount / total) * 100}%` : "0";
    els.tasks.innerHTML = config.tasks.map(taskCard).join("");
    renderActions();
    renderStock();
  }

  // ---- Keuzevenster ----

  function openSheet(task, html) {
    sheetTask = task;
    els.sheetBody.innerHTML = html;
    els.sheet.hidden = false;
    clearTimeout(sheetTimer);
    sheetTimer = setTimeout(closeSheet, SHEET_TIMEOUT_MS);
  }

  function closeSheet() {
    sheetTask = null;
    sheetAction = null;
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
    const done = state.done[task.id];
    openSheet(task, `
      <h3>${escapeHtml(task.title)}</h3>
      <p>Gedaan door ${escapeHtml(done.by)} om ${formatTime(new Date(done.at))}</p>
      <div class="choices">
        <button class="choice warn" data-action="undo">Toch niet gedaan</button>
        <button class="choice secondary" data-action="close">Sluiten</button>
      </div>`);
  }

  // Laadt een productfoto niet, dan blijft het categorie-icoon eronder zichtbaar.
  els.stock.addEventListener("error", (event) => {
    if (event.target.tagName === "IMG") event.target.closest(".thumb").classList.remove("has-img");
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) {
      if (event.target === els.sheet) closeSheet();
      return;
    }
    const { action, id } = target.dataset;
    if (action === "task") {
      const task = config.tasks.find((t) => t.id === id);
      if (state.done[task.id]) showDone(task);
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

  els.logo.innerHTML = ICONS.paw;
  rollOverIfNewDay();
  saveState();
  render();
  refreshVoerraad();
  refreshKattenbak();
  setInterval(refreshVoerraad, config.voerraad.refreshMinutes * 60 * 1000);
  setInterval(refreshKattenbak, config.kattenbak.refreshMinutes * 60 * 1000);
  setInterval(() => {
    if (rollOverIfNewDay()) {
      closeSheet();
      render();
      refreshVoerraad();
    } else {
      renderClock();
      renderActions(); // "Gestart om …" verloopt vanzelf
    }
  }, 10000);

  // Voor cast.js: de startknop stuurt de codes en de huisgenoten naar de Hub.
  window.Pip = { setVoerraadCode, setActionCode, setPeople };
})();
