// Seintje op de telefoon (ntfy) als een taak op zijn vaste tijd nog open staat,
// bijvoorbeeld natvoer om 22:00. Netlify draait dit elke 5 minuten, in de cloud:
// er hoeft thuis niets aan te staan. Per taak hooguit één seintje per dag.
//
// Een taak krijgt een tijd met remind: "22:00" (zie pip-settings.mjs).

import { getStore } from "@netlify/blobs";
import { localTime, notify, pipDay } from "../lib/notify.mjs";

// Liep de planner even niet, dan tot 2 uur na de tijd nog sturen.
const LATE_MINUTES = 120;

export default async () => {
  const store = getStore({ name: "pip", consistency: "strong" });
  const settings = (await store.get("settings", { type: "json" })) || {};
  const sent = (await store.get("reminders-sent", { type: "json" })) || {};
  const now = Date.now();
  const here = localTime(now);
  const today = pipDay(now);
  let changed = false;
  for (const task of settings.tasks || []) {
    if (!task.remind || sent[task.id] === today) continue;
    const [hour, minute] = task.remind.split(":").map(Number);
    const late = here.hour * 60 + here.minute - (hour * 60 + minute);
    if (late < 0 || late > LATE_MINUTES) continue;
    const done = (settings.done || {})[task.id];
    if (done && pipDay(done.at) === today) continue;
    await notify({
      title: `Nog doen: ${task.title}`,
      message: `Het is ${here.time} en nog niemand heeft "${task.title}" afgevinkt.`,
      priority: 4,
    });
    sent[task.id] = today;
    changed = true;
  }
  if (changed) await store.setJSON("reminders-sent", sent);
};

export const config = { schedule: "*/5 * * * *" };
