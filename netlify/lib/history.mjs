// Jaarlog van Pip: alles wat het scoreboard en Pip Wrapped nodig hebben. Per
// jaar drie losse blobs, elk met één schrijver, zodat ze elkaar niet overschrijven:
//
//   history-2026-ticks      elk vinkje: { id, title, icon, repeat, by, at, pts }
//                           (geschreven door pip-settings.mjs; ook de foto van de
//                           maand en de missies van Pip Run, zie hieronder)
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

// Een vinkje dat bewust ongedaan is gemaakt (Toch niet gedaan, ook vanaf de
// telefoon): eruit, hoe oud ook, zodat de punten er weer af gaan.
export async function removeTick(id, at) {
  const year = yearOf(at);
  const part = await readPart(year, "ticks");
  if (!part || !Array.isArray(part.list)) return false;
  const list = part.list.filter((tick) => !(tick.id === id && tick.at === at));
  if (list.length === part.list.length) return false;
  await writePart(year, "ticks", { ...part, list });
  return true;
}

// ---- Spelen met Pip ----

// Elke keer spelen is een vinkje van 1 punt, met de minuten erbij (voor Pip
// Wrapped). play: true houdt ze apart van gewone taken waar dat nodig is.
export async function recordPlay(task, sessions, now = Date.now()) {
  const ticks = sessions.map((session) => ({
    id: task.id,
    title: task.title,
    icon: task.icon || "ball",
    repeat: "daily",
    by: session.by,
    at: session.at,
    pts: 1,
    min: session.minutes,
    play: true,
  }));
  for (const year of new Set(ticks.map((tick) => yearOf(tick.at)))) {
    const part = (await readPart(year, "ticks")) || { startedAt: now, list: [] };
    const list = part.list.slice();
    for (const tick of ticks.filter((item) => yearOf(item.at) === year)) {
      if (!list.some((t) => t.id === tick.id && t.at === tick.at)) list.push(tick);
    }
    list.sort((a, b) => a.at - b.at);
    await writePart(year, "ticks", { startedAt: part.startedAt, list });
  }
}

// ---- Fotobattle ----

// De maker van de foto van de maand krijgt punten: een vinkje met battle: true,
// zodat het scoreboard de punten telt maar het niet als taak meetelt.
export async function recordBattleWin(by, label, at = Date.now(), points = 5) {
  const tick = { id: "fotobattle", title: "Foto van de maand", icon: "camera", repeat: "monthly", by, at, pts: points, battle: true, month: label };
  const year = yearOf(at);
  const part = (await readPart(year, "ticks")) || { startedAt: at, list: [] };
  if (part.list.some((t) => t.id === tick.id && t.at === tick.at)) return;
  const list = part.list.concat(tick).sort((a, b) => a.at - b.at);
  await writePart(year, "ticks", { startedAt: part.startedAt, list });
}

// ---- Pip Run ----

// Een gehaalde missie in Pip Run is 1 punt: een vinkje met game: true, zodat het
// scoreboard de punten telt maar het niet als taak voor Pip meetelt (net als de
// foto van de maand). Elke missie telt één keer per persoon per week.
export async function recordMission(by, mission, week, at = Date.now()) {
  const tick = { id: "piprun", title: `Pip Run: ${mission.title}`, icon: "paw", repeat: "weekly", by, at, pts: mission.points || 1, game: true, mission: mission.id, week };
  const year = yearOf(at);
  const part = (await readPart(year, "ticks")) || { startedAt: at, list: [] };
  const same = (t) => t.game && t.mission === mission.id && t.week === week && String(t.by).toLowerCase() === String(by).toLowerCase();
  if (part.list.some(same)) return false;
  const list = part.list.concat(tick).sort((a, b) => a.at - b.at);
  await writePart(year, "ticks", { startedAt: part.startedAt, list });
  return true;
}

// Wie welke missies van een week al haalde: { naam: [missie-id, ...] }. Een week
// over de jaargrens staat in twee jaarlogs.
export async function missionsDone(week) {
  const years = new Set([Number(week.slice(0, 4)), Number(week.slice(0, 4)) + 1]);
  const done = {};
  for (const year of years) {
    const part = await readPart(year, "ticks");
    for (const tick of (part && part.list) || []) {
      if (!tick.game || tick.week !== week) continue;
      (done[tick.by] = done[tick.by] || []).push(tick.mission);
    }
  }
  return done;
}

// ---- Herinneringen ----

// Een baasje heet voortaan anders: in het jaarlog (vinkjes) van dit en vorig jaar
// de naam omzetten, zodat punten en reeksen meegaan.
export async function renameInHistory(from, to, now = Date.now()) {
  const same = (a, b) => String(a || "").toLowerCase() === String(from).toLowerCase();
  for (const year of new Set([yearOf(now), yearOf(now) - 1])) {
    const ticks = await readPart(year, "ticks");
    if (!ticks || !Array.isArray(ticks.list)) continue;
    let changed = false;
    for (const tick of ticks.list) {
      if (same(tick.by)) {
        tick.by = to;
        changed = true;
      }
    }
    if (changed) await writePart(year, "ticks", ticks);
  }
}

// kind: leeg voor het gewone seintje, "late" voor "een half uur te laat".
export async function recordReminder(taskId, at, kind) {
  const year = yearOf(at);
  const reminders = (await readPart(year, "reminders")) || { list: [] };
  reminders.list.push(kind ? { id: taskId, at, kind } : { id: taskId, at });
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
