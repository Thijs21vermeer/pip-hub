// Servertje achter de actieknoppen op Pip: praat via de Tuya Cloud API met de
// kattenbak. De Tuya-sleutels staan alleen hier, als Netlify-omgevingsvariabelen,
// en niet in Pip: die pagina is openbaar. Pip komt binnen met PIP_ACTION_CODE.
//
//   GET  /api/kattenbak                      status (gewicht, bezoeken, bak vol, kat erin)
//                                            en van de voerbak (feeder)
//   GET  /api/kattenbak?log=1                logboek van 7 dagen: bezoeken aan de bak,
//                                            voerbeurten en schoonmaakbeurten
//   POST /api/kattenbak  {"action":"clean"}  nu schoonmaken (niet als er een kat in zit)
//   POST /api/kattenbak  {"action":"odourless"}  nu ontgeuren
//   POST /api/kattenbak  {"action":"feed","portions":2}  nu voeren (1-10 porties)
//
// Omgeving: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, TUYA_DEVICE_ID, PIP_ACTION_CODE,
// optioneel TUYA_FEEDER_ID (voerbak), TUYA_REGION (standaard eu) en
// ALLOWED_ORIGINS (komma's).

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json, setting } from "../lib/http.mjs";
import { accessToken, DAY_MS, readVisits, tuya } from "../lib/tuya.mjs";

// Pip-actie → datapunt van deze kattenbak (uitgelezen met tools/tuya_check.py).
const ACTIONS = { clean: "Clean", odourless: "odourless" };

// Niet twee keer kort na elkaar laten draaien (per serverinstantie).
const CLEAN_COOLDOWN_MS = 2 * 60 * 1000;
// Voerbak (F14-W): manual_feed geeft 1-10 porties; niet dubbel na een dubbele tik.
const MAX_PORTIONS = 10;
const FEED_COOLDOWN_MS = 60 * 1000;
// Logboek: Tuya bewaart de bezoeken aan de kattenbak, maar niet de voerbeurten
// (alleen de laatste) en niet het schoonmaken. Die houden we hier zelf bij.
const LOG_DAYS = 7;
const LOG_KEY = "action-log";
// Na een voerbeurt via het overzicht meldt de voerbak hem zelf ook; zelfde beurt.
const SAME_FEED_MS = 3 * 60 * 1000;

let lastClean = 0;
let lastFeed = 0;

async function readDevice(device, token) {
  const [shadow, info] = await Promise.all([
    tuya("GET", `/v2.0/cloud/thing/${device}/shadow/properties`, undefined, token),
    tuya("GET", `/v2.0/cloud/thing/${device}`, undefined, token),
  ]);
  return {
    online: Boolean(info.is_online ?? info.isOnline ?? info.online),
    value: Object.fromEntries(shadow.properties.map((p) => [p.code, p.value])),
    // Wanneer elk datapunt voor het laatst veranderde (ms).
    time: Object.fromEntries(shadow.properties.map((p) => [p.code, p.time])),
  };
}

// Voerbak: online, bezig of niet, en de laatste voerbeurt (ook die van het
// schema in de app). null als er geen voerbak is ingesteld.
async function readFeeder(token) {
  const device = process.env.TUYA_FEEDER_ID;
  if (!device) return null;
  try {
    const { online, value, time } = await readDevice(device, token);
    let record = null;
    try {
      record = JSON.parse(value.feed_record || "null");
    } catch {
      record = null;
    }
    return {
      online,
      feeding: value.feed_state === "feeding",
      lastFeed: record && typeof record.value === "number" ? { portions: record.value, at: time.feed_record || null } : null,
    };
  } catch (error) {
    return { error: error.code === "1106" ? "NO_PERMISSION" : "TUYA_ERROR" };
  }
}

// ---- Logboek ----

function logStore() {
  return getStore({ name: "pip", consistency: "strong" });
}

async function readLog() {
  const log = (await logStore().get(LOG_KEY, { type: "json" })) || {};
  return { feeds: log.feeds || [], cleans: log.cleans || [] };
}

function recent(list) {
  const from = Date.now() - LOG_DAYS * DAY_MS;
  return list.filter((entry) => entry.at >= from).sort((a, b) => a.at - b.at).slice(-200);
}

async function addToLog(kind, entry) {
  const log = await readLog();
  log[kind] = recent([...log[kind], entry]);
  await logStore().setJSON(LOG_KEY, log);
}

// De laatste voerbeurt van de voerbak zelf (schema of app) erbij zetten, als die
// nog niet in het logboek staat. Pip vraagt elk kwartier de status op, dus
// voerbeurten die verder dan een kwartier uit elkaar liggen komen er allemaal in.
async function noteFeederRecord(lastFeed) {
  if (!lastFeed || !lastFeed.at || lastFeed.at < Date.now() - LOG_DAYS * DAY_MS) return;
  const log = await readLog();
  if (log.feeds.some((feed) => Math.abs(feed.at - lastFeed.at) < SAME_FEED_MS)) return;
  log.feeds = recent([...log.feeds, { at: lastFeed.at, portions: lastFeed.portions, source: "voerbak" }]);
  await logStore().setJSON(LOG_KEY, log);
}

async function readLogbook() {
  const token = await accessToken();
  const [visits, log] = await Promise.all([readVisits(token, LOG_DAYS), readLog()]);
  return {
    visits,
    feeds: [...log.feeds].reverse(),
    cleans: [...log.cleans].reverse(),
  };
}

async function readStatus() {
  const token = await accessToken();
  const [{ online, value }, feeder] = await Promise.all([
    readDevice(setting("TUYA_DEVICE_ID"), token),
    readFeeder(token),
  ]);
  // Het logboek mag de status nooit tegenhouden.
  await noteFeederRecord(feeder && feeder.lastFeed).catch(() => {});
  return {
    online,
    // cat_weight staat in grammen.
    catWeightKg: typeof value.cat_weight === "number" ? Math.round(value.cat_weight / 100) / 10 : null,
    visitsToday: typeof value.excretion_times_day === "number" ? value.excretion_times_day : null,
    binFull: Boolean(value.trash_status),
    catInside: Boolean(value.monitoring),
    fault: Boolean(value.fault),
    feeder,
    updatedAt: new Date().toISOString(),
  };
}

async function feed(portions) {
  const device = process.env.TUYA_FEEDER_ID;
  if (!device) return [503, { error: "NOT_CONFIGURED" }];
  if (!Number.isInteger(portions) || portions < 1 || portions > MAX_PORTIONS) return [400, { error: "BAD_PORTIONS" }];
  const token = await accessToken();
  const status = await readFeeder(token);
  if (status.error) return [502, { error: status.error }];
  if (!status.online) return [409, { error: "FEEDER_OFFLINE" }];
  if (status.feeding || Date.now() - lastFeed < FEED_COOLDOWN_MS) return [429, { error: "FEEDING" }];
  await tuya(
    "POST",
    `/v2.0/cloud/thing/${device}/shadow/properties/issue`,
    { properties: JSON.stringify({ manual_feed: portions }) },
    token,
  );
  lastFeed = Date.now();
  await addToLog("feeds", { at: lastFeed, portions, source: "overzicht" }).catch(() => {});
  return [200, { ok: true, action: "feed", portions, at: new Date().toISOString() }];
}

async function runAction(action, portions) {
  if (action === "feed") return feed(portions);
  const code = ACTIONS[action];
  if (!code) return [400, { error: "UNKNOWN_ACTION" }];
  if (action === "clean") {
    const status = await readStatus();
    if (!status.online) return [409, { error: "OFFLINE" }];
    if (status.catInside) return [409, { error: "CAT_INSIDE" }];
    if (Date.now() - lastClean < CLEAN_COOLDOWN_MS) return [429, { error: "TOO_SOON" }];
  }
  const token = await accessToken();
  await tuya(
    "POST",
    `/v2.0/cloud/thing/${setting("TUYA_DEVICE_ID")}/shadow/properties/issue`,
    { properties: JSON.stringify({ [code]: true }) },
    token,
  );
  if (action === "clean") {
    lastClean = Date.now();
    await addToLog("cleans", { at: lastClean, source: "overzicht" }).catch(() => {});
  }
  return [200, { ok: true, action, at: new Date().toISOString() }];
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, POST");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    if (request.method === "GET") {
      const wantsLog = new URL(request.url).searchParams.get("log") === "1";
      return json(200, wantsLog ? await readLogbook() : await readStatus(), headers);
    }
    if (request.method === "POST") {
      const { action, portions } = await request.json().catch(() => ({}));
      const [status, body] = await runAction(action, portions);
      return json(status, body, headers);
    }
    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    // Geen sleutels of codes loggen, alleen de foutcode.
    console.error(JSON.stringify({ event: "kattenbak.error", code: error.code || "UNKNOWN" }));
    const known = { 28841002: "TUYA_EXPIRED", 1106: "NO_PERMISSION", CONFIG: "NOT_CONFIGURED" };
    return json(502, { error: known[error.code] || "TUYA_ERROR" }, headers);
  }
};

export const config = { path: "/api/kattenbak" };
