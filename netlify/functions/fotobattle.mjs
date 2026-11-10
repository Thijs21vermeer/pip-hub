// Fotobattle: de foto van de maand (zie lib/battle.mjs voor hoe het werkt).
//
//   GET    /api/fotobattle?me=Thijs        { current: { id, label, photos, own, voted, mine, result, … } | null, winners, entry }
//   POST   /api/fotobattle                 { id, by, wins: { fotoId: n }, final: [winnaar, tweede] }
//   POST   /api/fotobattle                 { proef: true }: een proefbattle met de inzendingen van deze maand
//                                          (met stil: true zonder meldingen); { proef: "stop" } stopt hem stil
//   POST   /api/fotobattle/inzending?by=Thijs&w=&h=&vervang=<id>   een foto insturen (JPEG)
//   DELETE /api/fotobattle/inzending/:id?by=Thijs                  een eigen inzending weghalen
//   GET    /api/fotobattle/foto/:id        een foto uit de battle (JPEG, zonder maker)
//   GET    /api/fotobattle/maand/:id       de bewaarde winnaar (JPEG)

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { battlePhoto, battleSummary, castVote, keptPhoto, removeEntry, startProef, stopProef, submitEntry } from "../lib/battle.mjs";

const MAX_BYTES = 1.5 * 1024 * 1024;
const PHOTO_ID = /^[a-z0-9]{8,40}$/;

async function readPeople() {
  const settings = await getStore({ name: "pip", consistency: "strong" }).get("settings", { type: "json" });
  return Array.isArray(settings && settings.people) ? settings.people : [];
}

function isJpeg(bytes) {
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

function size(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 10000 ? number : null;
}

function jpeg(bytes, headers) {
  return new Response(bytes, {
    headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

export default async (request, context) => {
  const headers = corsHeaders(request, "GET, POST, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const url = new URL(request.url);
    const path = url.pathname;
    const id = context.params && context.params.id;

    if (path.includes("/maand/")) {
      if (request.method !== "GET" || !/^\d{4}-\d{2}(-proef)?$/.test(id || "")) return json(404, { error: "NOT_FOUND" }, headers);
      const bytes = await keptPhoto(id);
      return bytes ? jpeg(bytes, headers) : json(404, { error: "NOT_FOUND" }, headers);
    }
    if (path.includes("/foto/")) {
      if (request.method !== "GET" || !PHOTO_ID.test(id || "")) return json(404, { error: "NOT_FOUND" }, headers);
      const bytes = await battlePhoto(id);
      return bytes ? jpeg(bytes, headers) : json(404, { error: "NOT_FOUND" }, headers);
    }

    const people = await readPeople();
    const by = url.searchParams.get("by");

    if (path.includes("/inzending")) {
      if (request.method === "DELETE") {
        if (!PHOTO_ID.test(id || "")) return json(404, { error: "NOT_FOUND" }, headers);
        const result = await removeEntry(id, by, people);
        if (result.error) return json(result.error === "NOT_FOUND" ? 404 : 400, { error: result.error }, headers);
        return json(200, await battleSummary(people, by), headers);
      }
      if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
      const replace = url.searchParams.get("vervang");
      if (replace && !PHOTO_ID.test(replace)) return json(404, { error: "NOT_FOUND" }, headers);
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json(413, { error: "TOO_BIG" }, headers);
      if (!isJpeg(bytes)) return json(415, { error: "NOT_JPEG" }, headers);
      const result = await submitEntry({ by, bytes, width: size(url.searchParams.get("w")), height: size(url.searchParams.get("h")), replace }, people);
      if (result.error) return json(result.error === "FULL" ? 409 : result.error === "NOT_FOUND" ? 404 : 400, { error: result.error }, headers);
      return json(201, await battleSummary(people, by), headers);
    }

    if (request.method === "GET") return json(200, await battleSummary(people, url.searchParams.get("me")), headers);
    if (request.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
    if (body.proef === "stop") {
      const result = await stopProef(people);
      if (result.error) return json(409, { error: result.error }, headers);
      return json(200, await battleSummary(people, null), headers);
    }
    if (body.proef === true) {
      const result = await startProef(people, Date.now(), { silent: body.stil === true });
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

export const config = {
  path: ["/api/fotobattle", "/api/fotobattle/maand/:id", "/api/fotobattle/foto/:id", "/api/fotobattle/inzending", "/api/fotobattle/inzending/:id"],
};
