// Jaarlog van Pip: alles wat het scoreboard en Pip Wrapped nodig hebben. Per
// jaar drie losse blobs, elk met één schrijver, zodat ze elkaar niet overschrijven:
//
//   history-2026-ticks      elk vinkje: { id, title, icon, repeat, by, at, pts }
//                           (geschreven door pip-settings.mjs)
//   history-2026-days       per dag: kattenbakbezoeken, gewicht, uren, voeren en
//                           draaien (geschreven door jaarlog.mjs, elke 3 uur)
//   history-2026-reminders  wanneer de herinnering van een taak ging
//                           (geschreven door herinnering.mjs)

import { getStore } from "@netlify/blobs";
import { localTime, pipDay } from "./notify.mjs";

// Punten per vinkje: hoe zeldzamer de taak, hoe meer punten.
const POINTS = { daily: 1, weekly: 3, biweekly: 3, monthly: 5, quarterly: 5 };

export function pointsFor(repeat) {
  return POINTS[repeat] || 1;
}

export function yearOf(ms) {
  return Number(localTime(ms).date.slice(0, 4));
}

function store() {
  return getStore({ name: "pip", consistency: "strong" });
}

export async function readPart(year, part) {
  return store().get(`history-${year}-${part}`, { type: "json" });
}

export async function writePart(year, part, value) {
  await store().setJSON(`history-${year}-${part}`, value);
}

// ---- Vinkjes ----

// Vergelijkt de vinkjes van voor en na een wijziging: nieuwe vinkjes komen in
// het jaarlog, een "Toch niet gedaan" haalt het vinkje er weer uit.
const FRESH_MS = 36 * 60 * 60 * 1000;
const UNDO_MS = 24 * 60 * 60 * 1000;

export async function recordTicks(before, after) {
  const tasks = after.tasks || before.tasks || [];
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const now = Date.now();
  const added = [];
  const removed = [];
  const oldDone = before.done || {};
  const newDone = after.done || {};
  for (const [id, entry] of Object.entries(newDone)) {
    const old = oldDone[id];
    if ((!old || entry.at > old.at) && entry.at > now - FRESH_MS && entry.at < now + 5 * 60 * 1000) {
      const task = byId.get(id) || { id, title: id, icon: "paw", repeat: "daily" };
      added.push({
        id,
        title: task.title,
        icon: task.icon || "paw",
        repeat: task.repeat || "daily",
        by: entry.by,
        at: entry.at,
        pts: pointsFor(task.repeat),
      });
    }
  }
  // Alleen een echt weggehaald vinkje van een taak die nog bestaat is een
  // "Toch niet gedaan" (een verwijderde taak neemt zijn vinkje ook mee).
  for (const [id, old] of Object.entries(oldDone)) {
    if (!newDone[id] && byId.has(id) && old.at > now - UNDO_MS) removed.push({ id, at: old.at });
  }
  if (!added.length && !removed.length) return;

  const years = new Set([...added, ...removed].map((item) => yearOf(item.at)));
  for (const year of years) {
    let ticks = await readPart(year, "ticks");
    if (!ticks) {
      // Eerste keer: begin met de laatste vinkjes die er al waren.
      ticks = { startedAt: now, list: seed(before, byId, year) };
    }
    const list = ticks.list.filter((tick) => !removed.some((r) => r.id === tick.id && r.at === tick.at));
    for (const tick of added.filter((item) => yearOf(item.at) === year)) {
      if (!list.some((t) => t.id === tick.id && t.at === tick.at)) list.push(tick);
    }
    list.sort((a, b) => a.at - b.at);
    await writePart(year, "ticks", { startedAt: ticks.startedAt, list });
  }
}

function seed(before, byId, year) {
  return Object.entries(before.done || {})
    .filter(([id, entry]) => byId.has(id) && yearOf(entry.at) === year)
    .map(([id, entry]) => {
      const task = byId.get(id);
      return { id, title: task.title, icon: task.icon || "paw", repeat: task.repeat || "daily", by: entry.by, at: entry.at, pts: pointsFor(task.repeat) };
    });
}

// ---- Herinneringen ----

export async function recordReminder(taskId, at) {
  const year = yearOf(at);
  const reminders = (await readPart(year, "reminders")) || { list: [] };
  reminders.list.push({ id: taskId, at });
  await writePart(year, "reminders", reminders);
}

// ---- Scores (voor de melding "Held van de week") ----

// Maandag (dag van Pip, dus vanaf 04:00) van de week waarin `ms` valt.
export function weekStart(ms) {
  const day = pipDay(ms);
  const date = new Date(`${day}T12:00:00Z`);
  const back = (date.getUTCDay() + 6) % 7; // ma = 0
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

export function weekScores(ticks, ms) {
  const start = weekStart(ms);
  const totals = new Map();
  for (const tick of ticks) {
    if (weekStart(tick.at) !== start) continue;
    totals.set(tick.by, (totals.get(tick.by) || 0) + (tick.pts || 1));
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
