// Tuya Cloud OpenAPI (HMAC-SHA256-ondertekening), gedeeld door het kattenbak-
// servertje en het jaarlog. De sleutels staan alleen in de Netlify-omgeving.

import { createHash, createHmac, randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { setting } from "./http.mjs";

const BASES = {
  eu: "https://openapi.tuyaeu.com",
  "eu-west": "https://openapi-weaz.tuyaeu.com",
  us: "https://openapi.tuyaus.com",
};

const EMPTY_HASH = createHash("sha256").update("").digest("hex");
export const DAY_MS = 24 * 60 * 60 * 1000;

// Elke aanroep telt mee voor het maandtegoed van Tuya, ook het ophalen van een
// token. Een token is 2 uur geldig: we bewaren hem in een eigen opslag (niet in
// "pip", waar andere functies bij kunnen), zodat elke serverinstantie hem deelt.
const TOKEN_KEY = "token";
const TOKEN_MARGIN_MS = 5 * 60 * 1000;
// Tuya-codes voor een token dat niet meer werkt: dan vergeten en een nieuwe halen.
const TOKEN_ERRORS = new Set(["1010", "1011"]);

let cachedToken = null;

export function tuyaStore() {
  return getStore({ name: "tuya", consistency: "strong" });
}

function usable(token) {
  return Boolean(token && token.value && token.expiresAt > Date.now() + TOKEN_MARGIN_MS);
}

async function forgetToken() {
  cachedToken = null;
  await tuyaStore().delete(TOKEN_KEY).catch(() => {});
}

export async function tuya(method, url, payload, token = "") {
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
  if (!data.success) {
    if (token && TOKEN_ERRORS.has(String(data.code))) await forgetToken();
    throw Object.assign(new Error(`TUYA_${data.code}`), { code: String(data.code) });
  }
  return data.result;
}

async function loadToken() {
  const saved = await tuyaStore().get(TOKEN_KEY, { type: "json" }).catch(() => null);
  if (usable(saved)) {
    cachedToken = saved;
    return saved.value;
  }
  const result = await tuya("GET", "/v1.0/token?grant_type=1");
  cachedToken = { value: result.access_token, expiresAt: Date.now() + result.expire_time * 1000 };
  await tuyaStore().setJSON(TOKEN_KEY, cachedToken).catch(() => {});
  return cachedToken.value;
}

// Vragen meerdere tegelijk om een token, dan halen ze er samen één.
let pendingToken = null;

export async function accessToken() {
  if (usable(cachedToken)) return cachedToken.value;
  if (!pendingToken) pendingToken = loadToken().finally(() => { pendingToken = null; });
  return pendingToken;
}

// Bezoeken aan de kattenbak van de afgelopen dagen (Tuya bewaart er 7): per
// bezoek het gewicht en hoe lang het duurde (twee meldingen op hetzelfde moment).
export async function readVisits(token, days) {
  const end = Date.now();
  const visits = new Map();
  let rowKey = "";
  for (let page = 0; page < 5; page++) {
    // Tuya ondertekent de query letterlijk en op alfabet: geen %2C voor de komma.
    const query = [
      "codes=cat_weight,excretion_time_day",
      `end_time=${end}`,
      rowKey && `last_row_key=${rowKey}`,
      "size=100",
      `start_time=${end - days * DAY_MS}`,
    ].filter(Boolean).join("&");
    const result = await tuya("GET", `/v2.0/cloud/thing/${setting("TUYA_DEVICE_ID")}/report-logs?${query}`, undefined, token);
    for (const entry of result.logs || []) {
      const key = Math.round(entry.event_time / 5000);
      const visit = visits.get(key) || { at: entry.event_time };
      if (entry.code === "cat_weight") visit.weightKg = Math.round(Number(entry.value) / 100) / 10;
      if (entry.code === "excretion_time_day") visit.seconds = Number(entry.value);
      visits.set(key, visit);
    }
    if (!result.has_more || !result.last_row_key) break;
    rowKey = result.last_row_key;
  }
  return [...visits.values()].sort((a, b) => b.at - a.at);
}
