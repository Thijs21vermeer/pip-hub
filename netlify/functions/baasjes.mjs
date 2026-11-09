// Profielfoto's van de baasjes (Thijs, Bou, Mar …), voor Scores, de held van de
// week en Pip Wrapped. Je zet ze erop vanaf de fotopagina (fotos.html); de foto
// is daar al vierkant en klein gemaakt. Bewaard in Netlify Blobs (store
// "pip-media"), met dezelfde code als de rest (PIP_ACTION_CODE).
//
//   GET    /api/baasjes              lijst: [{ name, id, at }]
//   GET    /api/baasjes/:id          de foto zelf (JPEG)
//   PUT    /api/baasjes?naam=Thijs   nieuwe foto voor dat baasje (JPEG-bytes)
//   DELETE /api/baasjes?naam=Thijs   foto weg

import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const LIST_KEY = "avatars";
const MAX_AVATARS = 12;
const MAX_BYTES = 400 * 1024;

function media() {
  return getStore({ name: "pip-media", consistency: "strong" });
}

async function readList(store) {
  return (await store.get(LIST_KEY, { type: "json" })) || [];
}

function nameOf(request) {
  const name = (new URL(request.url).searchParams.get("naam") || "").trim().slice(0, 20);
  return name || null;
}

function same(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}

function isJpeg(bytes) {
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export default async (request, context) => {
  const headers = corsHeaders(request, "GET, PUT, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const store = media();
    const id = context.params && context.params.id;
    if (id && !/^[a-z0-9]{8,40}$/.test(id)) return json(404, { error: "NOT_FOUND" }, headers);

    if (request.method === "GET" && !id) return json(200, await readList(store), headers);

    if (request.method === "GET") {
      const bytes = await store.get(`baasje/${id}`, { type: "arrayBuffer" });
      if (!bytes) return json(404, { error: "NOT_FOUND" }, headers);
      // Een nieuwe foto krijgt een nieuw id, dus deze mag lang bewaard worden.
      return new Response(bytes, {
        headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
      });
    }

    const name = nameOf(request);
    if (!name) return json(400, { error: "BAD_NAME" }, headers);

    if (request.method === "PUT") {
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json(413, { error: "TOO_BIG" }, headers);
      if (!isJpeg(bytes)) return json(415, { error: "NOT_JPEG" }, headers);
      const list = await readList(store);
      const old = list.find((item) => same(item.name, name));
      if (!old && list.length >= MAX_AVATARS) return json(409, { error: "FULL" }, headers);
      const avatar = { name, id: Date.now().toString(36) + randomBytes(4).toString("hex"), at: Date.now() };
      await store.set(`baasje/${avatar.id}`, bytes);
      await store.setJSON(LIST_KEY, [...list.filter((item) => !same(item.name, name)), avatar]);
      if (old) await store.delete(`baasje/${old.id}`);
      return json(200, avatar, headers);
    }

    if (request.method === "DELETE") {
      const list = await readList(store);
      const old = list.find((item) => same(item.name, name));
      if (!old) return json(404, { error: "NOT_FOUND" }, headers);
      await store.setJSON(LIST_KEY, list.filter((item) => item !== old));
      await store.delete(`baasje/${old.id}`);
      return json(200, { ok: true }, headers);
    }

    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "baasjes.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: ["/api/baasjes", "/api/baasjes/:id"] };
