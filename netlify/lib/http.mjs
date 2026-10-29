// Gedeeld door de Netlify-functies van Pip: instellingen, CORS, JSON-antwoorden
// en de controle van de code (PIP_ACTION_CODE) waarmee Pip binnenkomt.

import { timingSafeEqual } from "node:crypto";

export function setting(name) {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error(`MISSING_${name}`), { code: "CONFIG" });
  return value;
}

export function corsHeaders(request, methods) {
  const allowed = (process.env.ALLOWED_ORIGINS || "https://thijs21vermeer.github.io")
    .split(",")
    .map((origin) => origin.trim());
  const origin = request.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": origin && allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": `${methods}, OPTIONS`,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function authorized(request) {
  const given = Buffer.from((request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim());
  const expected = Buffer.from(setting("PIP_ACTION_CODE"));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
