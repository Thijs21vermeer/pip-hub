// Instellingen die je op de Hub zelf wijzigt (taken) of via de startpagina
// doorgeeft (huisgenoten). Bewaard in Netlify Blobs, zodat ze een herstart van
// de Hub overleven. Zelfde code als het kattenbak-servertje (PIP_ACTION_CODE).
//
//   GET /api/pip-settings                     { tasks?, people?, updatedAt? }
//   PUT /api/pip-settings  { tasks?, people? }  werkt bij wat meegestuurd wordt

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
    next.updatedAt = new Date().toISOString();
    await store.setJSON("settings", next);
    return json(200, next, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "pip-settings.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/pip-settings" };
