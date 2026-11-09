// Seintje op de telefoon (ntfy) als een taak op zijn vaste tijd nog open staat,
// bijvoorbeeld natvoer om 22:00, en nog een als hij een half uur later (22:30)
// nog steeds open staat. Netlify draait dit elke 5 minuten, in de cloud: er
// hoeft thuis niets aan te staan. Per taak hooguit één van elk per dag. Beide
// komen in het jaarlog (de tweede met kind: "late"), voor Pip Wrapped.
//
// Een taak krijgt een tijd met remind: "22:00" (zie pip-settings.mjs).
//
// Zondag vanaf 20:00 komt hier ook de melding "Held van de week" vandaan: wie
// deze week de meeste punten haalde (zie lib/history.mjs).

import { getStore } from "@netlify/blobs";
import { readPart, recordReminder, weekScores, weekStart, yearOf } from "../lib/history.mjs";
import { localTime, notify, pipDay } from "../lib/notify.mjs";

// Liep de planner even niet, dan tot 2 uur na de tijd nog sturen.
const LATE_MINUTES = 120;
// Zo lang na de tijd komt het tweede seintje: een half uur te laat.
const OVERDUE_MINUTES = 30;
const HERO_HOUR = 20;

async function remindOpenTasks(store, settings, now) {
  const sent = (await store.get("reminders-sent", { type: "json" })) || {};
  const here = localTime(now);
  const today = pipDay(now);
  let changed = false;
  for (const task of settings.tasks || []) {
    if (!task.remind) continue;
    const lateKey = `${task.id}:late`;
    if (sent[task.id] === today && sent[lateKey] === today) continue;
    const [hour, minute] = task.remind.split(":").map(Number);
    let late = here.hour * 60 + here.minute - (hour * 60 + minute);
    if (late < -12 * 60) late += 24 * 60; // over middernacht heen (23:45 → 00:15)
    if (late < 0 || late > LATE_MINUTES) continue;
    const done = (settings.done || {})[task.id];
    if (done && pipDay(done.at) === today) continue;

    if (late >= OVERDUE_MINUTES && sent[lateKey] !== today) {
      // Een half uur te laat. (Liep de planner niet, dan alleen deze, niet allebei.)
      await notify({
        title: `Half uur te laat: ${task.title}`,
        message: `Het is ${here.time} en "${task.title}" staat nog steeds open.`,
        priority: 5,
      });
      sent[task.id] = today;
      sent[lateKey] = today;
      changed = true;
      await recordReminder(task.id, now, "late").catch(() => {});
    } else if (sent[task.id] !== today && late < OVERDUE_MINUTES) {
      await notify({
        title: `Nog doen: ${task.title}`,
        message: `Het is ${here.time} en nog niemand heeft "${task.title}" afgevinkt.`,
        priority: 4,
      });
      sent[task.id] = today;
      changed = true;
      await recordReminder(task.id, now).catch(() => {});
    }
  }
  if (changed) await store.setJSON("reminders-sent", sent);
}

// Zondag 20:00 tot middernacht, één keer per week.
async function announceHero(store, now) {
  const here = localTime(now);
  const weekday = new Date(`${here.date}T12:00:00Z`).getUTCDay();
  if (weekday !== 0 || here.hour < HERO_HOUR) return;
  const week = weekStart(now);
  const last = await store.get("hero-sent", { type: "text" });
  if (last === week) return;
  // Een week kan over de jaargrens lopen: dan beide jaren.
  const years = new Set([yearOf(now), yearOf(now - 6 * 24 * 60 * 60 * 1000)]);
  const ticks = [];
  for (const year of years) {
    const part = await readPart(year, "ticks");
    if (part) ticks.push(...part.list);
  }
  const scores = weekScores(ticks, now);
  await store.set("hero-sent", week);
  if (!scores.length) return;
  const [[name, points], ...rest] = scores;
  const others = rest.slice(0, 3).map(([who, pts]) => `${who} ${pts}`).join(", ");
  await notify({
    title: `Held van de week: ${name}`,
    message: `${points} ${points === 1 ? "punt" : "punten"} deze week.${others ? ` Daarna: ${others}.` : ""} Morgen begint een nieuwe week.`,
  });
}

export default async () => {
  const store = getStore({ name: "pip", consistency: "strong" });
  const settings = (await store.get("settings", { type: "json" })) || {};
  const now = Date.now();
  await remindOpenTasks(store, settings, now);
  await announceHero(store, now).catch((error) =>
    console.error(JSON.stringify({ event: "hero.error", code: error.code || error.name || "UNKNOWN" })));
};

export const config = { schedule: "*/5 * * * *" };
