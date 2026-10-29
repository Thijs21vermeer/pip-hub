// Servertje achter de actieknoppen op Pip: praat via de Tuya Cloud API met de
// kattenbak. De Tuya-sleutels staan alleen hier, als Netlify-omgevingsvariabelen,
// en niet in Pip: die pagina is openbaar. Pip komt binnen met PIP_ACTION_CODE.
//
//   GET  /api/kattenbak                      status (gewicht, bezoeken, bak vol, kat erin)
//                                            en van de voerbak (feeder)
//   POST /api/kattenbak  {"action":"clean"}  nu schoonmaken (niet als er een kat in zit)
//   POST /api/kattenbak  {"action":"odourless"}  nu ontgeuren
//   POST /api/kattenbak  {"action":"feed","portions":2}  nu voeren (1-10 porties)
//
// Omgeving: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, TUYA_DEVICE_ID, PIP_ACTION_CODE,
// optioneel TUYA_FEEDER_ID (voerbak), TUYA_REGION (standaard eu) en
// ALLOWED_ORIGINS (komma's).

import { createHash, createHmac, randomUUID } from "node:crypto";
import { authorized, corsHeaders, json, setting } from "../lib/http.mjs";

const BASES = {
  eu: "https://openapi.tuyaeu.com",
  "eu-west": "https://openapi-weaz.tuyaeu.com",
  us: "https://openapi.tuyaus.com",
};

// Pip-actie → datapunt van deze kattenbak (uitgelezen met tools/tuya_check.py).
const ACTIONS = { clean: "Clean", odourless: "odourless" };

// Niet twee keer kort na elkaar laten draaien (per serverinstantie).
const CLEAN_COOLDOWN_MS = 2 * 60 * 1000;
// Voerbak (F14-W): manual_feed geeft 1-10 porties; niet dubbel na een dubbele tik.
const MAX_PORTIONS = 10;
const FEED_COOLDOWN_MS = 60 * 1000;
const EMPTY_HASH = createHash("sha256").update("").digest("hex");

let lastClean = 0;
let lastFeed = 0;
let cachedToken = null;

// ---- Tuya OpenAPI (HMAC-SHA256-ondertekening) ----

async function tuya(method, url, payload, token = "") {
  const body = payload === undefined ? "" : JSON.stringify(payload);
  const t = String(Date.now());
  const nonce = randomUUID().replaceAll("-", "");
  const contentHash = body ? createHash("sha256").update(body).digest("hex") : EMPTY_HASH;
  const stringToSign = [method, contentHash, "", url].join("\n");
  const sign = createHmac("sha256", setting("TUYA_ACCESS_SECRET"))
    .update(setting("TUYA_ACCESS_ID") + token + t + nonce + stringToSign)
    .digest("hex")
    .toUpperCase();
  const headers = {
    client_id: setting("TUYA_ACCESS_ID"),
    t,
    nonce,
    sign_method: "HMAC-SHA256",
    sign,
    "Content-Type": "application/json",
  };
  if (token) headers.access_token = token;
  const response = await fetch(BASES[process.env.TUYA_REGION || "eu"] + url, { method, headers, body: body || undefined });
  const data = await response.json();
  if (!data.success) throw Object.assign(new Error(`TUYA_${data.code}`), { code: String(data.code) });
  return data.result;
}

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60 * 1000) return cachedToken.value;
  const result = await tuya("GET", "/v1.0/token?grant_type=1");
  cachedToken = { value: result.access_token, expiresAt: Date.now() + result.expire_time * 1000 };
  return cachedToken.value;
}

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

async function readStatus() {
  const token = await accessToken();
  const [{ online, value }, feeder] = await Promise.all([
    readDevice(setting("TUYA_DEVICE_ID"), token),
    readFeeder(token),
  ]);
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
  if (action === "clean") lastClean = Date.now();
  return [200, { ok: true, action, at: new Date().toISOString() }];
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, POST");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    if (request.method === "GET") return json(200, await readStatus(), headers);
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
