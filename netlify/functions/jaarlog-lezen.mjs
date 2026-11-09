// Het jaarlog voor de Hub: het scoreboard en Pip Wrapped rekenen er zelf mee.
//
//   GET /api/jaarlog?year=2026   { year, ticks: [...], startedAt, days: {...}, reminders: [...], extraCosts: [...] }
//
// extraCosts: eenmalige kosten die niet in Voerraad staan (de startkosten van
// krabpaal, kattenbak, …): [{ date: "2026-06-27", label, amount }]. Staan in
// Netlify Blobs onder history-<jaar>-extra-costs, niet in de openbare code.
//
// Zelfde code als de rest van het servertje (PIP_ACTION_CODE).

import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { readPart, yearOf } from "../lib/history.mjs";

function cleanCosts(list, year) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((c) => c && typeof c.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date.startsWith(`${year}-`))
    .map((c) => ({ date: c.date, label: String(c.label || "").slice(0, 60), amount: Math.round(Number(c.amount) * 100) / 100 }))
    .filter((c) => c.amount > 0 && c.amount < 100000);
}

export default async (request) => {
  const headers = corsHeaders(request, "GET");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);
    if (request.method !== "GET") return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
    const asked = Number(new URL(request.url).searchParams.get("year"));
    const year = Number.isInteger(asked) && asked >= 2026 && asked <= 2100 ? asked : yearOf(Date.now());
    const [ticks, days, reminders, extra] = await Promise.all([
      readPart(year, "ticks"),
      readPart(year, "days"),
      readPart(year, "reminders"),
      readPart(year, "extra-costs"),
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
      extraCosts: cleanCosts(extra && extra.list, year),
    }, headers);
  } catch (error) {
    console.error(JSON.stringify({ event: "jaarlog.read.error", code: error.code || error.name || "UNKNOWN" }));
    return json(502, { error: error.code === "CONFIG" ? "NOT_CONFIGURED" : "STORAGE_ERROR" }, headers);
  }
};

export const config = { path: "/api/jaarlog" };
