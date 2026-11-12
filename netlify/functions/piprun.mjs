// Pip Run: de missies van de week (zie missies.js in de hoofdmap).
//
//   GET  /api/piprun   { week, missions: [{ id, title, … }], points, people, done: { naam: [missie-id, …] } }
//   POST /api/piprun   { by, week, mission }  een gehaalde missie van `by`
//                      → 201 { added: true, scored, … } of 200 { added: false, … } als hij er al stond
//
// Het servertje controleert of de missie bij deze week hoort (dezelfde lijst als
// het spel) en of `by` een baasje is, en onthoudt per week wie welke missie haalde
// (blob piprun-<week>). Heeft iemand daarmee alle vijf, dan komt er één vinkje van
// 1 punt in het jaarlog (scored: true), zodat het meetelt bij Scores en de held van
// de week. Losse missies geven geen punt. Zelfde code als de rest (PIP_ACTION_CODE).

import { getStore } from "@netlify/blobs";
import "../../missies.js";
import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { recordGameWeek, weekStart } from "../lib/history.mjs";

const Missions = globalThis.PipMissions;

function store() {
  return getStore({ name: "pip", consistency: "strong" });
}

async function readPeople() {
  const settings = await store().get("settings", { type: "json" });
  return Array.isArray(settings && settings.people) ? settings.people : [];
}

// { naam: { missie-id: tijd } } van één week.
async function readProgress(week) {
  const value = await store().get(`piprun-${week}`, { type: "json" });
  return value && value.done && typeof value.done === "object" ? value.done : {};
}

function doneLists(progress) {
  return Object.fromEntries(Object.entries(progress).map(([name, missions]) => [name, Object.keys(missions)]));
}

function summary(week, people, progress) {
  const missions = Missions.forWeek(week).map(({ id, tier, scope, stat, goal, unit, title, text }) => ({ id, tier, scope, stat, goal, unit, title, text }));
  return { week, missions, points: Missions.POINTS, people, done: doneLists(progress) };
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, POST");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const week = weekStart(Date.now());
    const people = await readPeople();
    if (request.method === "GET") return json(200, summary(week, people, await readProgress(week)), headers);
    if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    // Een missie van vorige week (laat verstuurd) telt niet meer: de week is voorbij.
    if (body.week !== week) return json(409, { error: "OTHER_WEEK", week }, headers);
    const by = people.find((name) => String(name).toLowerCase() === String(body.by || "").toLowerCase());
    if (!by) return json(400, { error: "UNKNOWN_PERSON" }, headers);
    const mission = Missions.forWeek(week).find((item) => item.id === body.mission);
    if (!mission) return json(400, { error: "UNKNOWN_MISSION" }, headers);

    const progress = await readProgress(week);
    const mine = (progress[by] = progress[by] || {});
    const added = !mine[mission.id];
    if (added) {
      mine[mission.id] = Date.now();
      await store().setJSON(`piprun-${week}`, { week, done: progress });
    }
    // Alle vijf? Dan het punt (ook als het eerder misging: recordGameWeek telt het maar één keer).
    let scored = false;
    if (Missions.allDone(week, Object.keys(mine))) scored = await recordGameWeek(by, week, Date.now(), Missions.POINTS);
    if (added) console.log(JSON.stringify({ event: "piprun.mission", by, mission: mission.id, week, scored }));
    return json(added ? 201 : 200, { added, scored, ...summary(week, people, progress) }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "piprun.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/piprun" };
