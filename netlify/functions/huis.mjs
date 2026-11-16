// Het huis voor Waar is Pip: de plattegrond (verdiepingen, muren, kamers en
// meubels), gemaakt van een LiDAR-scan. Het huis staat alleen hier, in Netlify
// Blobs, en nooit in GitHub: de repo en de site zijn openbaar. Alleen met de
// code (PIP_ACTION_CODE) krijg je het te zien, net als de taken en de baasjes.
//
//   GET    /api/huis          { huis, updatedAt }   of 404 { error: "NO_HOUSE" }
//   GET    /api/huis?kort=1   { updatedAt, verdiepingen, kamers }   zonder het huis zelf
//   PUT    /api/huis          het huisbestand (JSON, zie README › Waar is Pip)
//   DELETE /api/huis          huis weg
//
// Het servertje kijkt alleen of het een huisbestand is (pipHuis: 1, een lijst
// verdiepingen) en of het niet te groot is; wat erin staat leest het spel.

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const KEY = "huis";
const MAX_BYTES = 512 * 1024;
const MAX_FLOORS = 6;

function store() {
  return getStore({ name: "pip-huis", consistency: "strong" });
}

function count(house) {
  const floors = house.verdiepingen;
  return { verdiepingen: floors.length, kamers: floors.reduce((n, floor) => n + (Array.isArray(floor.kamers) ? floor.kamers.length : 0), 0) };
}

// null als het geen bruikbaar huisbestand is, anders de reden waarom niet.
function problem(house) {
  if (!house || typeof house !== "object" || Array.isArray(house)) return "NOT_A_HOUSE";
  if (house.pipHuis !== 1) return "WRONG_VERSION";
  const floors = house.verdiepingen;
  if (!Array.isArray(floors) || floors.length === 0 || floors.length > MAX_FLOORS) return "NO_FLOORS";
  for (const floor of floors) {
    if (!floor || typeof floor !== "object" || typeof floor.id !== "string" || !floor.id) return "BAD_FLOOR";
    for (const list of ["muren", "kamers", "meubels", "openingen"]) {
      if (floor[list] !== undefined && !Array.isArray(floor[list])) return "BAD_FLOOR";
    }
  }
  return null;
}

export default async (request) => {
  const headers = corsHeaders(request, "GET, PUT, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);

    if (request.method === "GET") {
      const saved = await store().get(KEY, { type: "json" });
      if (!saved || !saved.huis) return json(404, { error: "NO_HOUSE" }, headers);
      if (new URL(request.url).searchParams.get("kort")) return json(200, { updatedAt: saved.updatedAt, ...count(saved.huis) }, headers);
      return json(200, saved, headers);
    }

    if (request.method === "DELETE") {
      await store().delete(KEY);
      console.log(JSON.stringify({ event: "huis.deleted" }));
      return json(200, { deleted: true }, headers);
    }

    if (request.method !== "PUT") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BYTES) return json(413, { error: "TOO_LARGE", max: MAX_BYTES }, headers);
    let house = null;
    try {
      house = JSON.parse(text);
    } catch (error) {
      return json(400, { error: "NOT_JSON" }, headers);
    }
    const why = problem(house);
    if (why) return json(400, { error: why }, headers);
    const saved = { huis: house, updatedAt: Date.now() };
    await store().setJSON(KEY, saved);
    // Alleen tellen in het log, nooit wat er in het huis staat.
    console.log(JSON.stringify({ event: "huis.saved", bytes: Buffer.byteLength(text), ...count(house) }));
    return json(200, { updatedAt: saved.updatedAt, ...count(house) }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "huis.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/huis" };
