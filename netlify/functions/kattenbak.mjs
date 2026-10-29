// Servertje achter de actieknoppen op Pip: praat via de Tuya Cloud API met de
// kattenbak. De Tuya-sleutels staan alleen hier, als Netlify-omgevingsvariabelen,
// en niet in Pip: die pagina is openbaar. Pip komt binnen met PIP_ACTION_CODE.
//
//   GET  /api/kattenbak                      status (gewicht, bezoeken, bak vol, kat erin)
//   POST /api/kattenbak  {"action":"clean"}  nu schoonmaken (niet als er een kat in zit)
//   POST /api/kattenbak  {"action":"odourless"}  nu ontgeuren
//
// Omgeving: TUYA_ACCESS_ID, TUYA_ACCESS_SECRET, TUYA_DEVICE_ID, PIP_ACTION_CODE,
// optioneel TUYA_REGION (standaard eu) en ALLOWED_ORIGINS (komma's).

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const BASES = {
  eu: "https://openapi.tuyaeu.com",
  "eu-west": "https://openapi-weaz.tuyaeu.com",
  us: "https://openapi.tuyaus.com",
};

// Pip-actie → datapunt van deze kattenbak (uitgelezen met tools/tuya_check.py).
const ACTIONS = { clean: "Clean", odourless: "odourless" };

// Niet twee keer kort na elkaar laten draaien (per serverinstantie).
const CLEAN_COOLDOWN_MS = 2 * 60 * 1000;
const EMPTY_HASH = createHash("sha256").update("").digest("hex");

let lastClean = 0;
let cachedToken = null;

function setting(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`MISSING_${name}`), { code: "CONFIG" });
  return value;
}

function corsHeaders(request) {
  const allowed = (process.env.ALLOWED_ORIGINS || "https://thijs21vermeer.github.io")
    .split(",")
    .map((origin) => origin.trim());
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function authorized(request) {
  const given = Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim());
  const expected = Buffer.from(setting("PIP_ACTION_CODE"));
  return given.length === expected.length && timingSafeEqual(given, expected);
}

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

async function readStatus() {
  const device = setting("TUYA_DEVICE_ID");
  const token = await accessToken();
  const [shadow, info] = await Promise.all([
    tuya("GET", `/v2.0/cloud/thing/${device}/shadow/properties`, undefined, token),
    tuya("GET", `/v2.0/cloud/thing/${device}`, undefined, token),
  ]);
  const value = Object.fromEntries(shadow.properties.map((p) => [p.code, p.value]));
  return {
    online: Boolean(info.is_online ?? info.isOnline ?? info.online),
    // cat_weight staat in grammen.
    catWeightKg: typeof value.cat_weight === "number" ? Math.round(value.cat_weight / 100) / 10 : null,
    visitsToday: typeof value.excretion_times_day === "number" ? value.excretion_times_day : null,
    binFull: Boolean(value.trash_status),
    catInside: Boolean(value.monitoring),
    fault: Boolean(value.fault),
    updatedAt: new Date().toISOString(),
  };
}

async function runAction(action) {
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
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    if (request.method === "GET") return json(200, await readStatus(), headers);
    if (request.method === "POST") {
      const { action } = await request.json().catch(() => ({}));
      const [status, body] = await runAction(action);
      return json(status, body, headers);
    }
    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    // Geen sleutels of codes loggen, alleen de foutcode.
    console.error(JSON.stringify({ event: "kattenbak.error", code: error.code || "UNKNOWN" }));
    const expired = error.code === "28841002";
    return json(502, { error: expired ? "TUYA_EXPIRED" : error.code === "CONFIG" ? "NOT_CONFIGURED" : "TUYA_ERROR" }, headers);
  }
};

export const config = { path: "/api/kattenbak" };
