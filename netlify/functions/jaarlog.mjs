// Jaarlog bijwerken, elke 3 uur, in de cloud. Tuya bewaart de bezoeken aan de
// kattenbak maar 7 dagen en het logboek van het servertje ook; hier gaat per
// dag een samenvatting naar history-<jaar>-days, voor Pip Wrapped:
//
//   { "2026-11-09": { v: bezoeken, ws: gewicht in hg opgeteld, wn: gewogen bezoeken,
//                     h: [24 × bezoeken per uur], f: voerbeurten, p: porties,
//                     fo: voerbeurten via het overzicht, c: keer gedraaid via het overzicht } }
//
// Elke run schrijft de dagen die helemaal binnen de laatste 7 dagen vallen
// opnieuw, dus een gemiste run haalt de volgende in.

import { getStore } from "@netlify/blobs";
import { readPart, writePart } from "../lib/history.mjs";
import { localTime } from "../lib/notify.mjs";
import { accessToken, DAY_MS, readVisits } from "../lib/tuya.mjs";
import { cleanVisits, usualWeight } from "../lib/visits.mjs";

const WINDOW_DAYS = 7;

function emptyDay() {
  return { v: 0, ws: 0, wn: 0, h: new Array(24).fill(0), f: 0, p: 0, fo: 0, c: 0 };
}

export default async () => {
  const now = Date.now();
  // De oudste dag in het venster is maar half gezien: die slaan we over.
  const firstFull = localTime(now - WINDOW_DAYS * DAY_MS + DAY_MS).date;
  const days = new Map();
  const dayFor = (ms) => {
    const { date, hour } = localTime(ms);
    if (date < firstFull) return null;
    if (!days.has(date)) days.set(date, emptyDay());
    return { day: days.get(date), hour };
  };

  let visits = [];
  const store = getStore({ name: "pip", consistency: "strong" });
  try {
    // Alleen echte bezoeken van Pip (zie lib/visits.mjs).
    const raw = await readVisits(await accessToken(), WINDOW_DAYS);
    const usualKg = usualWeight(raw);
    visits = cleanVisits(raw, { usualKg });
    // Pips gewone gewicht van deze 7 dagen, voor de teller van vandaag (kattenbak.mjs).
    if (usualKg > 0) await store.setJSON("usual-weight", { kg: usualKg, at: now });
  } catch (error) {
    // Tuya even niet bereikbaar: de volgende run probeert het opnieuw.
    console.error(JSON.stringify({ event: "jaarlog.tuya.error", code: error.code || "UNKNOWN" }));
    return;
  }
  for (const visit of visits) {
    const slot = dayFor(visit.at);
    if (!slot) continue;
    slot.day.v += 1;
    slot.day.h[slot.hour] += 1;
    if (visit.weightKg > 1 && visit.weightKg < 15) {
      slot.day.ws += Math.round(visit.weightKg * 10);
      slot.day.wn += 1;
    }
  }

  const log = (await store.get("action-log", { type: "json" })) || {};
  for (const feed of log.feeds || []) {
    const slot = dayFor(feed.at);
    if (!slot) continue;
    slot.day.f += 1;
    slot.day.p += feed.portions || 0;
    if (feed.source === "overzicht") slot.day.fo += 1;
  }
  for (const clean of log.cleans || []) {
    const slot = dayFor(clean.at);
    if (slot) slot.day.c += 1;
  }

  // Ook dagen zonder iets erin: dan weet Wrapped dat er die dag wel gekeken is.
  for (let back = 0; back < WINDOW_DAYS - 1; back++) dayFor(now - back * DAY_MS);

  const byYear = new Map();
  for (const [date, day] of days) {
    const year = Number(date.slice(0, 4));
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year).push([date, day]);
  }
  for (const [year, entries] of byYear) {
    const saved = (await readPart(year, "days")) || { startedAt: now, days: {} };
    for (const [date, day] of entries) saved.days[date] = day;
    await writePart(year, "days", saved);
  }
};

export const config = { schedule: "17 */3 * * *" };
