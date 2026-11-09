// Het jaarlog voor de Hub: het scoreboard en Pip Wrapped rekenen er zelf mee.
//
//   GET /api/jaarlog?year=2026   { year, ticks: [...], startedAt, days: {...}, reminders: [...] }
//
// Zelfde code als de rest van het servertje (PIP_ACTION_CODE).

import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { readPart, yearOf } from "../lib/history.mjs";

export default async (request) => {
  const headers = corsHeaders(request, "GET");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    if (request.method !== "GET") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
    const asked = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(asked) && asked >= 2026 && asked <= 2100 ? asked : yearOf(Date.now());
    const [ticks, days, reminders] = await Promise.all([
      readPart(year, "ticks"),
      readPart(year, "days"),
      readPart(year, "reminders"),
    ]);
    const starts = [ticks && ticks.startedAt, days && days.startedAt].filter(Boolean);
    return json(200, {
      year,
      startedAt: starts.length ? Math.min(...starts) : null,
      // Sinds wanneer elk vinkje bewaard wordt (daarvoor alleen het laatste per taak).
      ticksSince: (ticks && ticks.startedAt) || null,
      ticks: (ticks && ticks.list) || [],
      days: (days && days.days) || {},
      reminders: (reminders && reminders.list) || [],
    }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "jaarlog.read.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/jaarlog" };
