// Pip Run: de missies van de week (zie missies.js in de hoofdmap).
//
//   GET  /api/piprun   { week, missions: [{ id, title, … }], people, done: { naam: [missie-id, …] } }
//   POST /api/piprun   { by, week, mission }  een gehaalde missie: 1 punt voor `by`
//                      → 201 { added: true, … } of 200 { added: false, … } als hij al telde
//
// Het servertje controleert of de missie bij deze week hoort (dezelfde lijst als
// het spel), of `by` een baasje is, en dat elke missie maar één keer per persoon
// per week telt. Daarna staat hij als vinkje van 1 punt in het jaarlog, zodat hij
// meetelt bij Scores en de held van de week. Zelfde code als de rest (PIP_ACTION_CODE).

import { getStore } from "@netlify/blobs";
import "../../missies.js";
import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { missionsDone, recordMission, weekStart } from "../lib/history.mjs";

const Missions = globalThis.PipMissions;

async function readPeople() {
  const settings = await getStore({ name: "pip", consistency: "strong" }).get("settings", { type: "json" });
  return Array.isArray(settings && settings.people) ? settings.people : [];
}

async function summary(week, people) {
  const missions = Missions.forWeek(week).map(({ id, tier, scope, stat, goal, unit, title, text, points }) => ({ id, tier, scope, stat, goal, unit, title, text, points }));
  return { week, missions, people, done: await missionsDone(week) };
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, POST");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const week = weekStart(Date.now());
    const people = await readPeople();
    if (request.method === "GET") return json(200, await summary(week, people), headers);
    if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    // Een missie van vorige week (laat verstuurd) telt niet meer: de week is voorbij.
    if (body.week !== week) return json(409, { error: "OTHER_WEEK", week }, headers);
    const by = people.find((name) => String(name).toLowerCase() === String(body.by || "").toLowerCase());
    if (!by) return json(400, { error: "UNKNOWN_PERSON" }, headers);
    const mission = Missions.forWeek(week).find((item) => item.id === body.mission);
    if (!mission) return json(400, { error: "UNKNOWN_MISSION" }, headers);

    const added = await recordMission(by, mission, week);
    if (added) console.log(JSON.stringify({ event: "piprun.mission", by, mission: mission.id, week }));
    return json(added ? 201 : 200, { added, ...(await summary(week, people)) }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "piprun.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/piprun" };
