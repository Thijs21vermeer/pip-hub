// Alles wat Pip na een herstart van de Google Hub terug moet hebben: de taken,
// de huisgenoten, de vinkjes van vandaag, de handmatige voorraadtellers en de
// Voerraad-koppelcode. Bewaard in Netlify Blobs. Zelfde code als het
// kattenbak-servertje (PIP_ACTION_CODE).
//
//   GET /api/pip-settings   { tasks?, people?, today?, stock?, voerraadCode?, updatedAt? }
//   PUT /api/pip-settings   werkt bij wat meegestuurd wordt

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const ICONS = new Set(["sun", "moon", "drop", "bowl", "box", "heart", "paw", "pill", "scissors", "ball"]);
const MAX_TASKS = 12;
const MAX_PEOPLE = 6;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTasks(list) {
  if (!Array.isArray(list)) return null;
  const seen = new Set();
  const tasks = [];
  for (const item of list.slice(0, MAX_TASKS)) {
    const id = text(item?.id, 40);
    const title = text(item?.title, 30);
    if (!title || !/^[a-z0-9_-]+$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    tasks.push({ id, title, icon: ICONS.has(item.icon) ? item.icon : "paw" });
  }
  return tasks.length ? tasks : null;
}

function cleanPeople(list) {
  if (!Array.isArray(list)) return null;
  const people = list.map((name) => text(name, 20)).filter(Boolean).slice(0, MAX_PEOPLE);
  return people.length ? people : null;
}

// Vinkjes van één dag: { day: "2026-10-29", done: { taakId: { by, at, took } } }.
function cleanToday(value) {
  if (!value || typeof value !== "object" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day)) return null;
  const done = {};
  for (const [id, entry] of Object.entries(value.done || {}).slice(0, MAX_TASKS)) {
    if (!/^[a-z0-9_-]{1,40}$/i.test(id) || !entry || typeof entry.at !== "number") continue;
    done[id] = {
      by: text(entry.by, 20) || "Gedaan",
      at: entry.at,
      took: Number.isInteger(entry.took) && entry.took >= 0 && entry.took < 100 ? entry.took : 0,
    };
  }
  return { day: value.day, done };
}

// Handmatige voorraadtellers: { natvoer: 13, ... }.
function cleanStock(value) {
  if (!value || typeof value !== "object") return null;
  const stock = {};
  for (const [id, amount] of Object.entries(value).slice(0, 20)) {
    if (/^[a-z0-9_-]{1,40}$/i.test(id) && Number.isInteger(amount) && amount >= 0 && amount < 1000) stock[id] = amount;
  }
  return stock;
}

// Voerraad-koppelcode (alleen-lezen); leeg = ontkoppeld.
function cleanVoerraadCode(value) {
  if (value === "") return "";
  return typeof value === "string" && /^vrh_[\w-]{20,80}$/.test(value) ? value : null;
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, PUT");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    // strong: een wijziging moet bij de volgende GET meteen terugkomen.
    const store = getStore({ name: "pip", consistency: "strong" });
    const current = (await store.get("settings", { type: "json" })) || {};
    if (request.method === "GET") return json(200, current, headers);
    if (request.method !== "PUT") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    const next = { ...current };
    if ("tasks" in body) {
      const tasks = cleanTasks(body.tasks);
      if (!tasks) return json(400, { error: "BAD_TASKS" }, headers);
      next.tasks = tasks;
    }
    if ("people" in body) {
      const people = cleanPeople(body.people);
      if (!people) return json(400, { error: "BAD_PEOPLE" }, headers);
      next.people = people;
    }
    if ("today" in body) {
      const today = cleanToday(body.today);
      if (!today) return json(400, { error: "BAD_TODAY" }, headers);
      next.today = today;
    }
    if ("stock" in body) {
      const stock = cleanStock(body.stock);
      if (!stock) return json(400, { error: "BAD_STOCK" }, headers);
      next.stock = stock;
    }
    if ("voerraadCode" in body) {
      const code = cleanVoerraadCode(body.voerraadCode);
      if (code === null) return json(400, { error: "BAD_VOERRAAD_CODE" }, headers);
      if (code) next.voerraadCode = code;
      else delete next.voerraadCode;
    }
    next.updatedAt = new Date().toISOString();
    await store.setJSON("settings", next);
    return json(200, next, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "pip-settings.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/pip-settings" };
