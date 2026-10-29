// Pips eigen miauw: opgenomen met de telefoon en via de startpagina hierheen
// gestuurd. De Google Hub speelt hem af als je Pip aait in de ruststand.
// Bewaard in Netlify Blobs (store "pip-media"), met dezelfde code als de rest.
//
//   GET    /api/geluid          het geluid zelf (404 als er nog geen is)
//   GET    /api/geluid?info=1   { at, type, bytes }: of er een nieuw geluid is
//   PUT    /api/geluid          nieuw geluid (audio/…, hooguit 1 MB)
//   DELETE /api/geluid          geluid weg

import { getStore } from "@netlify/blobs";
import { authorized, corsHeaders, json } from "../lib/http.mjs";

const MAX_BYTES = 1024 * 1024;
const KEY = "miauw";

export default async (request) => {
  const headers = corsHeaders(request, "GET, PUT, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    const store = getStore({ name: "pip-media", consistency: "strong" });

    if (request.method === "GET") {
      const found = await store.getWithMetadata(KEY, { type: "arrayBuffer" });
      if (!found) return json(404, { error: "NOT_FOUND" }, headers);
      const { type, at } = found.metadata;
      if (new URL(request.url).searchParams.get("info") === "1") {
        return json(200, { at, type, bytes: found.data.byteLength }, headers);
      }
      return new Response(found.data, { headers: { ...headers, "Content-Type": type, "Cache-Control": "no-store" } });
    }

    if (request.method === "PUT") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!/^audio\/[\w.+-]+$/.test(type)) return json(415, { error: "NOT_AUDIO" }, headers);
      const bytes = await request.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return json(413, { error: "TOO_BIG" }, headers);
      const at = Date.now();
      await store.set(KEY, bytes, { metadata: { type, at } });
      return json(200, { at, type, bytes: bytes.byteLength }, headers);
    }

    if (request.method === "DELETE") {
      await store.delete(KEY);
      return json(200, { ok: true }, headers);
    }

    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "geluid.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/geluid" };
