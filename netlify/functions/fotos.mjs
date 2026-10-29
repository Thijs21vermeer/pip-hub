// Foto's van Pip voor de ruststand op de Google Hub. Je zet ze erop vanaf de
// startpagina op je telefoon; de Hub wisselt ertussen. Bewaard in Netlify Blobs
// (store "pip-media"), met dezelfde code als de rest (PIP_ACTION_CODE).
//
//   GET    /api/fotos        lijst: [{ id, at, width, height }], oudste eerst
//   GET    /api/fotos/:id    de foto zelf (JPEG)
//   POST   /api/fotos?w=&h=  nieuwe foto: de JPEG-bytes, al verkleind door de startpagina
//   DELETE /api/fotos/:id    foto weg

import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const MAX_PHOTOS = 40;
const MAX_BYTES = 1.5 * 1024 * 1024;
const LIST_KEY = "photos";

function media() {
  return getStore({ name: "pip-media", consistency: "strong" });
}

async function readList(store) {
  return (await store.get(LIST_KEY, { type: "json" })) || [];
}

function size(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= 10000 ? number : null;
}

function isJpeg(bytes) {
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export default async (request, context) => {
  const headers = corsHeaders(request, "GET, POST, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const store = media();
    const id = context.params && context.params.id;
    if (id && !/^[a-z0-9]{8,40}$/.test(id)) return json(404, { error: "NOT_FOUND" }, headers);

    if (request.method === "GET" && !id) return json(200, await readList(store), headers);

    if (request.method === "GET") {
      const bytes = await store.get(`foto/${id}`, { type: "arrayBuffer" });
      if (!bytes) return json(404, { error: "NOT_FOUND" }, headers);
      // Een foto verandert nooit (nieuwe foto = nieuw id), dus lang bewaren mag.
      return new Response(bytes, {
        headers: { ...headers, "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
      });
    }

    if (request.method === "POST" && !id) {
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json(413, { error: "TOO_BIG" }, headers);
      if (!isJpeg(bytes)) return json(415, { error: "NOT_JPEG" }, headers);
      const photos = await readList(store);
      if (photos.length >= MAX_PHOTOS) return json(409, { error: "FULL" }, headers);
      const query = new URL(request.url).searchParams;
      const photo = {
        id: Date.now().toString(36) + randomBytes(4).toString("hex"),
        at: Date.now(),
        width: size(query.get("w")),
        height: size(query.get("h")),
      };
      await store.set(`foto/${photo.id}`, bytes);
      await store.setJSON(LIST_KEY, [...photos, photo]);
      return json(201, photo, headers);
    }

    if (request.method === "DELETE" && id) {
      const photos = await readList(store);
      const rest = photos.filter((photo) => photo.id !== id);
      if (rest.length === photos.length) return json(404, { error: "NOT_FOUND" }, headers);
      await store.setJSON(LIST_KEY, rest);
      await store.delete(`foto/${id}`);
      return json(200, { ok: true }, headers);
    }

    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "fotos.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: ["/api/fotos", "/api/fotos/:id"] };
