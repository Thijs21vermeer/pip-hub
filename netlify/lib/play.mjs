// Spelen met Pip: een taak met play: true die je zo vaak kunt doen als je wilt,
// ook door verschillende mensen. Elke keer spelen is een punt voor wie speelde.
// Met een timer (Hub en telefoon zien dezelfde) of meteen ("Al gespeeld").
//
// Eigen blob "play" naast "settings", zodat het bijwerken van de vinkjes door de
// Hub (die de hele settings terugschrijft) nooit een timer of sessie wegveegt:
//
//   { timer?: { by, minutes, startedAt, endsAt }, sessions: [{ by, at, minutes }] }
//
// Een timer die af is wordt een sessie op het moment dat hij afliep, door wie het
// eerst kijkt: de Hub, de telefoon of herinnering.mjs (elke 5 minuten). Pas dan
// gaat de melding "Tijd om" naar de telefoons.

import { getStore } from "@netlify/blobs";
import { recordPlay } from "./history.mjs";
import { notify } from "./notify.mjs";

const KEY = "play";
export const MAX_MINUTES = 120;
const KEEP_MS = 36 * 60 * 60 * 1000; // sessies van vandaag (en een marge) blijven hier; het jaarlog heeft alles
const MAX_SESSIONS = 60;

function store() {
  return getStore({ name: "pip", consistency: "strong" });
}

export function playTask(tasks) {
  return (Array.isArray(tasks) ? tasks : []).find((task) => task && task.play) || null;
}

function name(value) {
  return typeof value === "string" ? value.trim().slice(0, 20) : "";
}

function minutesOf(value) {
  return Number.isInteger(value) && value >= 1 && value <= MAX_MINUTES ? value : null;
}

function cleanPlay(value) {
  const play = value && typeof value === "object" ? value : {};
  const timer = play.timer && Number.isFinite(play.timer.endsAt) ? play.timer : null;
  const sessions = Array.isArray(play.sessions) ? play.sessions.filter((s) => s && Number.isFinite(s.at)) : [];
  return timer ? { timer, sessions } : { sessions };
}

function withSession(play, session, now) {
  const sessions = play.sessions.filter((s) => s.at > now - KEEP_MS);
  if (!sessions.some((s) => s.at === session.at && s.by === session.by)) sessions.push(session);
  sessions.sort((a, b) => a.at - b.at);
  return { ...play, sessions: sessions.slice(-MAX_SESSIONS) };
}

function withoutTimer(play) {
  const { timer, ...rest } = play;
  return rest;
}

// Een afgelopen timer wordt een sessie, op de tijd dat hij afliep. Zo geven twee
// die tegelijk kijken (Hub en planner) precies dezelfde sessie.
export function settle(play, now) {
  const timer = play.timer;
  if (!timer || timer.endsAt > now) return { play, settled: null };
  const settled = { by: timer.by, at: timer.endsAt, minutes: timer.minutes };
  return { play: withSession(withoutTimer(play), settled, now), settled };
}

// Wat de Hub of telefoon vraagt:
//   { start: { by, minutes } }   timer starten (er loopt er hooguit één)
//   { log: { by, minutes } }     al gespeeld, zonder timer: het punt telt meteen
//   { finish: true, startedAt }  eerder klaar: punt voor de minuten tot nu
//   { stop: true, startedAt }    timer weg, geen punt
// Geeft { play, added: [sessies], settled, error }.
export function apply(before, action, now) {
  let { play, settled } = settle(cleanPlay(before), now);
  const added = settled ? [settled] : [];
  const same = (timer) => timer && (!Number.isFinite(action.startedAt) || timer.startedAt === action.startedAt);
  if (action.start) {
    const by = name(action.start.by);
    const minutes = minutesOf(action.start.minutes);
    if (!by || !minutes) return { error: "BAD_PLAY", status: 400 };
    if (play.timer) return { error: "BUSY", status: 409, play };
    play = { ...play, timer: { by, minutes, startedAt: now, endsAt: now + minutes * 60 * 1000 } };
  } else if (action.log) {
    const by = name(action.log.by);
    const minutes = minutesOf(action.log.minutes);
    if (!by || !minutes) return { error: "BAD_PLAY", status: 400 };
    const session = { by, at: now, minutes };
    play = withSession(play, session, now);
    added.push(session);
  } else if (action.finish) {
    // Al afgelopen (en hierboven al een sessie) of nooit gestart: niets meer te doen.
    if (same(play.timer)) {
      const { timer } = play;
      const minutes = Math.min(timer.minutes, Math.max(1, Math.round((now - timer.startedAt) / 60000)));
      const session = { by: timer.by, at: now, minutes };
      play = withSession(withoutTimer(play), session, now);
      added.push(session);
    }
  } else if (action.stop) {
    if (same(play.timer)) play = withoutTimer(play);
  } else {
    return { error: "BAD_PLAY", status: 400 };
  }
  return { play, added, settled };
}

async function save(play, added, settled, tasks) {
  await store().setJSON(KEY, play);
  const task = playTask(tasks);
  if (task && added.length) {
    // Het jaarlog en de melding mogen het opslaan nooit tegenhouden.
    await recordPlay(task, added).catch((error) =>
      console.error(JSON.stringify({ event: "play.history.error", code: error.code || error.name || "UNKNOWN" })));
  }
  if (settled) {
    await notify({
      title: "Tijd om: spelen met Pip",
      message: `${settled.by} speelde ${settled.minutes} ${settled.minutes === 1 ? "minuut" : "minuten"} met Pip: +1 punt.`,
    }).catch(() => {});
  }
}

// Lezen, en een afgelopen timer meteen afhandelen. Voor GET /api/pip-settings
// en de planner.
export async function readPlay(tasks, now = Date.now()) {
  const before = cleanPlay(await store().get(KEY, { type: "json" }));
  const { play, settled } = settle(before, now);
  if (settled) await save(play, [settled], settled, tasks);
  return play;
}

export async function actPlay(tasks, action, now = Date.now()) {
  if (!playTask(tasks)) return { error: "NO_PLAY_TASK", status: 400 };
  const before = await store().get(KEY, { type: "json" });
  const result = apply(before, action || {}, now);
  if (result.error) return result;
  await save(result.play, result.added, result.settled, tasks);
  return result;
}
