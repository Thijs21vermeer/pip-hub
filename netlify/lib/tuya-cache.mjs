// Gedeelde kopie van wat Tuya weet. Elke aanroep naar Tuya telt mee voor het
// maandtegoed, en de Hub, de telefoons, het logboek en het jaarlog vragen
// allemaal hetzelfde. Hier haalt de server het hoogstens eens per kwartier op;
// de rest krijgt de kopie (in de opslag "tuya", gedeeld door alle functies).
//
//   visits            bezoeken aan de kattenbak van 7 dagen   15 minuten
//   device-<id>       datapunten van de bak of de voerbak     15 minuten
//   online-<id>       of het apparaat online is               60 minuten
//   action            moment van de laatste actie: daarna 2 minuten lang
//                     hooguit 20 seconden oud, zodat je de actie terugziet
//
// Draaien en voeren kijken altijd vers (zit Pip erin? is de voerbak online?).

import { accessToken, readVisits, tuya, tuyaStore } from "./tuya.mjs";

export const FRESH_MS = 15 * 60 * 1000;
const ONLINE_MS = 60 * 60 * 1000;
const AFTER_ACTION_MS = 2 * 60 * 1000;
const AFTER_ACTION_FRESH_MS = 20 * 1000;
export const VISIT_DAYS = 7;

// De kopie onder key als die jonger is dan maxAgeMs, anders vers ophalen (en
// bewaren). maxAgeMs 0: altijd vers.
async function cached(key, maxAgeMs, load) {
  const store = tuyaStore();
  const saved = maxAgeMs > 0 ? await store.get(`cache/${key}`, { type: "json" }).catch(() => null) : null;
  if (saved && Date.now() - saved.at < maxAgeMs) return saved;
  const fresh = { at: Date.now(), value: await load() };
  await store.setJSON(`cache/${key}`, fresh).catch(() => {});
  return fresh;
}

// Vlak na een actie (draaien, voeren) de stand van de apparaten korter bewaren.
async function deviceMaxAge() {
  const action = await tuyaStore().get("cache/action", { type: "json" }).catch(() => null);
  return action && Date.now() - action.at < AFTER_ACTION_MS ? AFTER_ACTION_FRESH_MS : FRESH_MS;
}

export async function noteAction() {
  await tuyaStore().setJSON("cache/action", { at: Date.now() }).catch(() => {});
}

async function readShadow(device) {
  const result = await tuya("GET", `/v2.0/cloud/thing/${device}/shadow/properties`, undefined, await accessToken());
  return {
    value: Object.fromEntries(result.properties.map((p) => [p.code, p.value])),
    // Wanneer elk datapunt voor het laatst veranderde (ms).
    time: Object.fromEntries(result.properties.map((p) => [p.code, p.time])),
  };
}

async function readOnline(device) {
  const info = await tuya("GET", `/v2.0/cloud/thing/${device}`, undefined, await accessToken());
  return Boolean(info.is_online ?? info.isOnline ?? info.online);
}

// Stand van een apparaat: { online, value, time, at }.
//   fresh: datapunten vers (bv. vlak voor draaien: zit Pip erin?)
//   freshOnline: ook online vers (vlak voor een actie)
export async function readDevice(device, { fresh = false, freshOnline = false } = {}) {
  const [state, online] = await Promise.all([
    cached(`device-${device}`, fresh ? 0 : await deviceMaxAge(), () => readShadow(device)),
    cached(`online-${device}`, freshOnline ? 0 : ONLINE_MS, () => readOnline(device)),
  ]);
  return { online: online.value, ...state.value, at: state.at };
}

// Bezoeken aan de kattenbak van de afgelopen 7 dagen (rauw, zie lib/visits.mjs),
// hooguit maxAgeMs oud.
export async function readCachedVisits(maxAgeMs = FRESH_MS) {
  const visits = await cached("visits", maxAgeMs, async () => readVisits(await accessToken(), VISIT_DAYS));
  return { raw: visits.value, at: visits.at };
}
