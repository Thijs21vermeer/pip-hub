// Foto's van Pip voor de ruststand op de Google Hub. Je zet ze erop vanaf de
// fotopagina (fotos.html) op je telefoon; de Hub wisselt ertussen. Bewaard in Netlify Blobs
// (store "pip-media"), met dezelfde code als de rest (PIP_ACTION_CODE).
//
//   GET    /api/fotos        lijst: [{ id, at, width, height, fit?, focusX?, focusY? }], oudste eerst
//   GET    /api/fotos/:id    de foto zelf (JPEG)
//   POST   /api/fotos?w=&h=  nieuwe foto: de JPEG-bytes, al verkleind door de fotopagina
//   PATCH  /api/fotos/:id    { fit: "cover" | "contain" | null, focusX, focusY } (0-100)
//   DELETE /api/fotos/:id    foto weg
//   GET    /api/fotolijst    stijl van de fotolijst: { seconds, order, includeDefault, motion }
//   PUT    /api/fotolijst    stijl aanpassen

import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const MAX_PHOTOS = 40;
const MAX_BYTES = 1.5 * 1024 * 1024;
const LIST_KEY = "photos";
const STYLE_KEY = "photo-style";
// Hoe de ruststand wisselt. motion = langzaam inzoomen terwijl een foto in beeld is.
const STYLE_DEFAULTS = { seconds: 20, order: "newest", includeDefault: true, motion: false };
const SECONDS = new Set([10, 20, 60, 300]);
const ORDERS = new Set(["newest", "shuffle"]);
const FITS = new Set(["cover", "contain"]);

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

function percent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : undefined;
}

// Alleen bekende waarden; de rest blijft zoals het was.
function cleanStyle(body, current) {
  const style = { ...current };
  if (SECONDS.has(body.seconds)) style.seconds = body.seconds;
  if (ORDERS.has(body.order)) style.order = body.order;
  if (typeof body.includeDefault === "boolean") style.includeDefault = body.includeDefault;
  if (typeof body.motion === "boolean") style.motion = body.motion;
  return style;
}

async function readStyle(store) {
  return { ...STYLE_DEFAULTS, ...((await store.get(STYLE_KEY, { type: "json" })) || {}) };
}

function isJpeg(bytes) {
  const head = new Uint8Array(bytes, 0, Math.min(3, bytes.byteLength));
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

export default async (request, context) => {
  const headers = corsHeaders(request, "GET, POST, PUT, PATCH, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const store = media();

    if (new URL(request.url).pathname.endsWith("/fotolijst")) {
      if (request.method === "GET") return json(200, await readStyle(store), headers);
      if (request.method !== "PUT") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
      const style = cleanStyle(body, await readStyle(store));
      await store.setJSON(STYLE_KEY, style);
      return json(200, style, headers);
    }

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

    if (request.method === "PATCH" && id) {
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") return json(400, { error: "BAD_REQUEST" }, headers);
      const photos = await readList(store);
      const photo = photos.find((item) => item.id === id);
      if (!photo) return json(404, { error: "NOT_FOUND" }, headers);
      if (body.fit === null) delete photo.fit;
      else if (FITS.has(body.fit)) photo.fit = body.fit;
      for (const key of ["focusX", "focusY"]) {
        const value = percent(body[key]);
        if (value !== undefined) photo[key] = value;
      }
      await store.setJSON(LIST_KEY, photos);
      return json(200, photo, headers);
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

export const config = { path: ["/api/fotos", "/api/fotos/:id", "/api/fotolijst"] };
