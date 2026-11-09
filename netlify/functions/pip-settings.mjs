// Alles wat Pip na een herstart van de Google Hub terug moet hebben: de taken,
// de huisgenoten, wanneer elke taak voor het laatst gedaan is, de handmatige
// voorraadtellers en de Voerraad-koppelcode. Bewaard in Netlify Blobs. Zelfde
// code als het kattenbak-servertje (PIP_ACTION_CODE).
//
//   GET /api/pip-settings   { tasks?, people?, done?, stock?, voerraadCode?, away?, watcherSeenAt?, updatedAt? }
//   PUT /api/pip-settings   werkt bij wat meegestuurd wordt
//   PUT { rename: { from, to } }  een baasje heet voortaan anders: de naam gaat
//                                 overal mee (huisgenoten, vinkjes, jaarlog, profielfoto)
//   PUT { tick: { id, by } }      één taak afvinken vanaf de telefoon (alleen die taak;
//                                 de rest van de vinkjes blijft zoals hij is)
//   PUT { untick: { id, at } }    Toch niet gedaan (vanaf de telefoon): dat vinkje weg,
//                                 en uit het jaarlog, zodat de punten er weer af gaan.
//                                 In undone onthouden, zodat de Hub het ook weghaalt
//                                 en het niet terugstuurt.
//   PUT { play: { start | log | finish | stop } }  Spelen met Pip (zie lib/play.mjs);
//                                 GET en PUT geven altijd play: { timer?, sessions } mee
//
// Een taak met notify: true geeft een melding op de telefoon (ntfy) zodra iemand
// hem afvinkt; remind: "22:00" geeft een seintje als hij dan nog open staat
// (zie herinnering.mjs).

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { recordTicks, removeTick, renameInHistory } from "../lib/history.mjs";
import { localTime, notify } from "../lib/notify.mjs";
import { actPlay, readPlay } from "../lib/play.mjs";

const ICONS = new Set(["sun", "moon", "drop", "bowl", "box", "heart", "paw", "pill", "scissors", "ball"]);
const REPEATS = new Set(["daily", "weekly", "biweekly", "monthly", "quarterly"]);
const MAX_TASKS = 12;
const MAX_PEOPLE = 6;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTasks(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const tasks = [];
  for (const item of list.slice(0, MAX_TASKS)) {
    const id = text(item?.id, 40);
    const title = text(item?.title, 30);
    if (!title || !/^[a-z0-9_-]+$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    const task = {
      id,
      title,
      icon: ICONS.has(item.icon) ? item.icon : "paw",
      repeat: REPEATS.has(item.repeat) ? item.repeat : "daily",
    };
    // Spelen met Pip: zo vaak als je wilt, elke keer een punt (lib/play.mjs).
    if (item.play === true) {
      task.play = true;
      task.repeat = "daily";
      tasks.push(task);
      continue;
    }
    // Melding als hij gedaan is, en een seintje op een vaste tijd (alleen dagtaken).
    if (item.notify === true) task.notify = true;
    if (task.repeat === "daily" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.remind || "")) task.remind = item.remind;
    // Vaste dag: weekdag (0-6) bij week-taken, dag van de maand (1-28) bij
    // maand- en kwartaaltaken. from = dagnummer waarop die dag gekozen is.
    const week = task.repeat === "weekly" || task.repeat === "biweekly";
    const month = task.repeat === "monthly" || task.repeat === "quarterly";
    const day = item.day;
    if (Number.isInteger(day) && ((week && day >= 0 && day <= 6) || (month && day >= 1 && day <= 28))) {
      task.day = day;
      if (Number.isInteger(item.from) && item.from > 0 && item.from < 100000) task.from = item.from;
    }
    tasks.push(task);
  }
  return tasks.length ? tasks : null;
}

function cleanPeople(list) {
  if (!Array.isArray(list)) return null;
  const people = list.map((name) => text(name, 20)).filter(Boolean).slice(0, MAX_PEOPLE);
  return people.length ? people : null;
}

// Laatste keer dat een taak gedaan is: { taakId: { by, at, took } }. Pip rekent
// zelf uit of dat nog binnen de periode (dag, week, maand…) van die taak valt.
function cleanDone(value) {
  if (!value || typeof value !== "object") return null;
  const done = {};
  for (const [id, entry] of Object.entries(value).slice(0, 30)) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !entry || typeof entry.at !== "number") continue;
    done[id] = {
      by: text(entry.by, 20) || "Gedaan",
      at: entry.at,
      took: Number.isInteger(entry.took) && entry.took >= 0 && entry.took < 100 ? entry.took : 0,
    };
  }
  return done;
}

// Oudere vorm (alleen de vinkjes van één dag): { day: "2026-10-29", done: {...} }.
function cleanToday(value) {
  if (!value || typeof value !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  return { day: value.day, done: cleanDone(value.done || {}) };
}

// Handmatige voorraadtellers: { natvoer: 13, ... }.
function cleanStock(value) {
  if (!value || typeof value !== "object") return null;
  const stock = {};
  for (const [id, amount] of Object.entries(value).slice(0, 20)) {
    if (/^[a-z0-9_-]{1,40}$/i.test(id) && Number.isInteger(amount) && amount >= 0 && amount < 1000) stock[id] = amount;
  }
  return stock;
}

// Voerraad-koppelcode (alleen-lezen); leeg = ontkoppeld.
function cleanVoerraadCode(value) {
  if (value === "") return "";
  return typeof value === "string" && /^vrh_[\w-]{20,80}$/.test(value) ? value : null;
}

// Pauze (knop "Google Hub" op Pip): { until: ms }. Het script op de Mac zet Pip
// pas daarna terug. null = geen pauze. Fout = undefined.
const MAX_AWAY_MS = 36 * 60 * 60 * 1000;

function cleanAway(value) {
  if (value === null) return null;
  const now = Date.now();
  const until = value && value.until;
  if (!Number.isFinite(until) || until < now - 60 * 1000 || until > now + MAX_AWAY_MS) return undefined;
  return { until: Math.round(until), at: now };
}

// Net afgevinkt (nieuwer dan wat er stond) bij een taak met notify: melden wie het
// deed. Alleen verse vinkjes: een herstart van Pip stuurt oude vinkjes opnieuw mee.
const FRESH_MS = 6 * 60 * 60 * 1000;
// Zo lang onthouden we een ongedaan gemaakt vinkje (de Hub haalt elke 5 minuten op).
const UNDONE_KEEP_MS = 3 * 24 * 60 * 60 * 1000;

function keepUndone(undone, now = Date.now()) {
  const kept = {};
  for (const [id, at] of Object.entries(undone || {})) {
    if (Number.isFinite(at) && at > now - UNDONE_KEEP_MS) kept[id] = at;
  }
  return kept;
}

// De profielfoto (baasjes.mjs) hoort bij de naam: die naam ook omzetten.
async function renameAvatar(from, to) {
  const media = getStore({ name: "pip-media", consistency: "strong" });
  const list = (await media.get("avatars", { type: "json" })) || [];
  const index = list.findIndex((item) => item.name.toLowerCase() === from.toLowerCase());
  if (index < 0) return;
  list[index] = { ...list[index], name: to };
  await media.setJSON("avatars", list);
}

async function announceDone(before, after) {
  const tasks = after.tasks || before.tasks || [];
  for (const task of tasks.filter((t) => t.notify)) {
    const entry = (after.done || {})[task.id];
    const old = (before.done || {})[task.id];
    if (!entry || (old && old.at >= entry.at) || entry.at < Date.now() - FRESH_MS) continue;
    await notify({
      title: `Gedaan: ${task.title}`,
      message: `${entry.by} om ${localTime(entry.at).time}`,
    });
  }
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, PUT");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    // strong: een wijziging moet bij de volgende GET meteen terugkomen.
    const store = getStore({ name: "pip", consistency: "strong" });
    const current = (await store.get("settings", { type: "json" })) || {};
    // Spelen staat in een eigen blob; een fout daar mag de rest niet tegenhouden.
    const withPlay = async (settings) => ({
      ...settings,
      play: await readPlay(settings.tasks).catch((error) => {
        console.error(JSON.stringify({ event: "play.read.error", code: error.code || error.name || "UNKNOWN" }));
        return null;
      }),
    });
    if (request.method === "GET") return json(200, await withPlay(current), headers);
    if (request.method !== "PUT") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    if ("play" in body) {
      const result = await actPlay(current.tasks, body.play);
      if (result.error) return json(result.status, { error: result.error, play: result.play || null }, headers);
      return json(200, { ...current, play: result.play }, headers);
    }
    const next = { ...current };
    if ("tasks" in body) {
      const tasks = cleanTasks(body.tasks);
      if (!tasks) return json(400, { error: "BAD_TASKS" }, headers);
      next.tasks = tasks;
    }
    if ("people" in body) {
      const people = cleanPeople(body.people);
      if (!people) return json(400, { error: "BAD_PEOPLE" }, headers);
      next.people = people;
    }
    let renamed = null;
    if ("rename" in body) {
      const from = text(body.rename && body.rename.from, 20);
      const to = text(body.rename && body.rename.to, 20).replace(/\s+/g, " ");
      const people = next.people || [];
      const index = people.findIndex((name) => name.toLowerCase() === from.toLowerCase());
      if (!from || !to || index < 0) return json(400, { error: "BAD_RENAME" }, headers);
      if (people.some((name, i) => i !== index && name.toLowerCase() === to.toLowerCase())) return json(409, { error: "NAME_TAKEN" }, headers);
      next.people = people.map((name, i) => (i === index ? to : name));
      // Wie een taak het laatst deed: ook de nieuwe naam.
      const done = { ...(next.done || {}) };
      for (const [id, entry] of Object.entries(done)) {
        if (entry && String(entry.by || "").toLowerCase() === from.toLowerCase()) done[id] = { ...entry, by: to };
      }
      next.done = done;
      renamed = { from: people[index], to };
    }
    if ("done" in body) {
      const done = cleanDone(body.done);
      if (!done) return json(400, { error: "BAD_DONE" }, headers);
      // Een vinkje dat op de telefoon ongedaan is gemaakt, stuurt een Hub die dat
      // nog niet weet niet terug.
      for (const [id, at] of Object.entries(keepUndone(next.undone))) {
        if (done[id] && done[id].at === at) delete done[id];
      }
      next.done = done;
    }
    let untick = null;
    if ("untick" in body) {
      const id = text(body.untick && body.untick.id, 40);
      const at = body.untick && body.untick.at;
      const entry = (next.done || {})[id];
      if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !Number.isFinite(at)) return json(400, { error: "BAD_UNTICK" }, headers);
      // Alleen het vinkje dat de telefoon zag; is er sindsdien opnieuw afgevinkt, dan niets.
      if (!entry || entry.at !== at) return json(409, { error: "CHANGED", ...current }, headers);
      const { [id]: removed, ...rest } = next.done;
      next.done = rest;
      next.undone = { ...keepUndone(next.undone), [id]: at };
      untick = { id, at };
    }
    if ("tick" in body) {
      const id = text(body.tick && body.tick.id, 40);
      const by = text(body.tick && body.tick.by, 20);
      // Zonder eigen takenlijst op het servertje (nog de standaardtaken) mag elk id.
      const known = !Array.isArray(next.tasks) || next.tasks.some((task) => task.id === id);
      if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !known || !by) return json(400, { error: "BAD_TICK" }, headers);
      next.done = { ...(next.done || {}), [id]: { by, at: Date.now(), took: 0 } };
    }
    if ("today" in body) {
      const today = cleanToday(body.today);
      if (!today) return json(400, { error: "BAD_TODAY" }, headers);
      next.today = today;
    }
    if ("stock" in body) {
      const stock = cleanStock(body.stock);
      if (!stock) return json(400, { error: "BAD_STOCK" }, headers);
      next.stock = stock;
    }
    if ("voerraadCode" in body) {
      const code = cleanVoerraadCode(body.voerraadCode);
      if (code === null) return json(400, { error: "BAD_VOERRAAD_CODE" }, headers);
      if (code) next.voerraadCode = code;
      else delete next.voerraadCode;
    }
    if ("away" in body) {
      const away = cleanAway(body.away);
      if (away === undefined) return json(400, { error: "BAD_AWAY" }, headers);
      if (away) next.away = away;
      else delete next.away;
    }
    // Teken van leven van het script dat Pip terugzet; Pip kijkt daarnaar
    // voordat hij belooft vanzelf terug te komen.
    if (body.watcher === true) next.watcherSeenAt = Date.now();
    next.updatedAt = new Date().toISOString();
    await store.setJSON("settings", next);
    if (renamed) {
      // Jaarlog en profielfoto ook omzetten; mislukt dat, dan blijft de nieuwe naam toch staan.
      await renameInHistory(renamed.from, renamed.to).catch((error) =>
        console.error(JSON.stringify({ event: "rename.history.error", code: error.code || error.name || "UNKNOWN" })));
      await renameAvatar(renamed.from, renamed.to).catch((error) =>
        console.error(JSON.stringify({ event: "rename.avatar.error", code: error.code || error.name || "UNKNOWN" })));
    }
    await announceDone(current, next).catch(() => {}); // een melding mag het opslaan nooit tegenhouden
    // Elk vinkje in het jaarlog (scoreboard en Pip Wrapped); mag ook nooit tegenhouden.
    if ("done" in body || "tick" in body) {
      await recordTicks(current, next).catch((error) =>
        console.error(JSON.stringify({ event: "jaarlog.ticks.error", code: error.code || error.name || "UNKNOWN" })));
    }
    if (untick) {
      await removeTick(untick.id, untick.at).catch((error) =>
        console.error(JSON.stringify({ event: "jaarlog.untick.error", code: error.code || error.name || "UNKNOWN" })));
    }
    return json(200, await withPlay(next), headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "pip-settings.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/pip-settings" };
