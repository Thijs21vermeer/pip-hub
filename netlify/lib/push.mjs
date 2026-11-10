// Meldingen van de Pip-app zelf (web-push), naast ntfy. Een telefoon met Pip op
// het beginscherm meldt zich aan via /api/push (netlify/functions/push.mjs); tik
// je op zo'n melding, dan opent de Pip-app (sw.js) in plaats van ntfy.
//
// Nodig in de Netlify-instellingen: VAPID_PUBLIC_KEY en VAPID_PRIVATE_KEY (een
// sleutelpaar, eenmalig gemaakt met web-push). Zonder die twee: stil.

import webpush from "web-push";
import { getStore } from "@netlify/blobs";

const LIST_KEY = "push-subscriptions";
const SUBJECT = "https://thijs21vermeer.github.io/pip-hub/";
export const MAX_SUBSCRIPTIONS = 20;

function store() {
  return getStore({ name: "pip", consistency: "strong" });
}

export async function readSubscriptions() {
  return (await store().get(LIST_KEY, { type: "json" })) || [];
}

export async function writeSubscriptions(list) {
  await store().setJSON(LIST_KEY, list.slice(-MAX_SUBSCRIPTIONS));
}

// Alleen een echte aanmelding van een browser: een https-adres en twee sleutels.
export function cleanSubscription(value) {
  if (!value || typeof value !== "object") return null;
  const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
  const keys = value.keys || {};
  if (!/^https:\/\/[^\s]{8,800}$/.test(endpoint)) return null;
  if (typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 200 || keys.auth.length > 100) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

// Wie een telefoon gebruikt (telefoon.js, me): zo kan een melding naar één baasje.
export function cleanName(value) {
  const name = typeof value === "string" ? value.trim().slice(0, 20) : "";
  return name || null;
}

// Naar elke aangemelde telefoon, of met `to` alleen naar de telefoons van die
// baasjes (een telefoon die niet weet van wie hij is, krijgt die dan niet).
// badge: het getal op het app-icoon (0 haalt het weg). Een aanmelding die niet
// meer bestaat (404/410) gaat uit de lijst. Geeft terug naar hoeveel telefoons het lukte.
export async function sendPush({ title, message, url = "instellingen.html", to, badge, tag }) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return 0;
  const list = await readSubscriptions();
  if (!list.length) return 0;
  const wanted = Array.isArray(to) ? new Set(to.map((name) => String(name).toLowerCase())) : null;
  webpush.setVapidDetails(SUBJECT, publicKey, privateKey);
  const payload = JSON.stringify({ title, body: message, url, ...(Number.isInteger(badge) ? { badge } : {}), ...(tag ? { tag } : {}) });
  const keep = [];
  let sent = 0;
  for (const item of list) {
    if (wanted && !(item.name && wanted.has(item.name.toLowerCase()))) {
      keep.push(item);
      continue;
    }
    try {
      await webpush.sendNotification(item.subscription, payload, { TTL: 6 * 60 * 60, urgency: "high" });
      sent += 1;
      keep.push(item);
    } catch (error) {
      if (error && (error.statusCode === 404 || error.statusCode === 410)) continue;
      keep.push(item);
    }
  }
  if (keep.length !== list.length) await writeSubscriptions(keep);
  return sent;
}
