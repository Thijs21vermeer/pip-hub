// Fotobattle: de foto van de maand (zie lib/battle.mjs voor hoe het werkt).
//
//   GET  /api/fotobattle?me=Thijs     { current: { id, label, photos, voted, mine, result, … } | null, winners }
//   POST /api/fotobattle              { id, by, wins: { fotoId: n }, final: [winnaar, tweede] }
//   POST /api/fotobattle              { proef: true }: een proefbattle met de foto's van deze maand
//   GET  /api/fotobattle/maand/:id    de bewaarde winnaar (JPEG)

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { battleSummary, castVote, keptPhoto, startProef } from "../lib/battle.mjs";

async function readPeople() {
  const settings = await getStore({ name: "pip", consistency: "strong" }).get("settings", { type: "json" });
  return Array.isArray(settings && settings.people) ? settings.people : [];
}

export default async (request, context) => {
  const headers = corsHeaders(request, "GET, POST");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const id = context.params && context.params.id;

    if (id) {
      if (request.method !== "GET" || !/^\d{4}-\d{2}(-proef)?$/.test(id)) return json(404, { error: "NOT_FOUND" }, headers);
      const bytes = await keptPhoto(id);
      if (!bytes) return json(404, { error: "NOT_FOUND" }, headers);
      return new Response(bytes, {
        headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
      });
    }

    const people = await readPeople();
    if (request.method === "GET") {
      const me = new URL(request.url).searchParams.get("me");
      return json(200, await battleSummary(people, me), headers);
    }
    if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    if (body.proef === true) {
      const result = await startProef();
      if (result.error) return json(409, { error: result.error }, headers);
      return json(201, await battleSummary(people, null), headers);
    }
    const result = await castVote(body, people);
    if (result.error) return json(result.error === "CLOSED" ? 409 : 400, { error: result.error }, headers);
    return json(200, await battleSummary(people, body.by), headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "fotobattle.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: ["/api/fotobattle", "/api/fotobattle/maand/:id"] };
