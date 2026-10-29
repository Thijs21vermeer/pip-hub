// Pip-checklist: taken afvinken, onthouden wie het deed en wanneer, en de voorraad bijhouden.
(function () {
  "use strict";

  const config = window.PIP_CONFIG;
  const STORAGE_KEY = "pip-hub-v1";
  const NIGHT_FROM = 21; // vanaf 21:00 een donker scherm
  const NIGHT_UNTIL = 7; // tot 07:00
  const SHEET_TIMEOUT_MS = 20000; // keuzevenster sluit vanzelf als niemand kiest

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
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    minus: svg('<path d="M5 12h14"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
  };

  const els = {
    logo: document.getElementById("logo"),
    progressText: document.getElementById("progress-text"),
    progressBar: document.getElementById("progress-bar"),
    clock: document.getElementById("clock"),
    date: document.getElementById("date"),
    tasks: document.getElementById("tasks"),
    stock: document.getElementById("stock"),
    sheet: document.getElementById("sheet"),
    sheetBody: document.getElementById("sheet-body"),
  };

  let state = loadState();
  let sheetTask = null;
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
    if (task.stock && task.stock.id in state.stock) {
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
    els.stock.innerHTML = config.stock.map(stockRow).join("");
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
    els.sheet.hidden = true;
    clearTimeout(sheetTimer);
  }

  function askWho(task) {
    const people = config.people.map((person) =>
      `<button class="choice" data-action="person" data-person="${escapeHtml(person)}">${escapeHtml(person)}</button>`).join("");
    openSheet(task, `
      <h3>${escapeHtml(task.title)}</h3>
      <p>Wie heeft het gedaan?</p>
      <div class="choices">${people}</div>
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
      else if (config.people.length <= 1) markDone(task, config.people[0] || "Gedaan");
      else askWho(task);
    } else if (action === "person" && sheetTask) {
      markDone(sheetTask, target.dataset.person);
      closeSheet();
    } else if (action === "undo" && sheetTask) {
      undo(sheetTask);
      closeSheet();
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
  setInterval(() => {
    if (rollOverIfNewDay()) {
      closeSheet();
      render();
    } else {
      renderClock();
    }
  }, 10000);
})();
