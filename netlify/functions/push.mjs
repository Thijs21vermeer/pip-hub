// Aanmelden voor meldingen van de Pip-app (web-push), met dezelfde code als de
// rest (PIP_ACTION_CODE). De meldingen zelf gaan via netlify/lib/push.mjs.
//
//   GET    /api/push   { publicKey }: de openbare sleutel voor het aanmelden
//   PUT    /api/push   { subscription, name? }: deze telefoon aanmelden; name = wie
//                      hem gebruikt (opnieuw sturen na wisselen van baasje)
//   DELETE /api/push   { endpoint }: deze telefoon afmelden

import { authorized, corsHeaders, json } from "../lib/http.mjs";
import { cleanName, cleanSubscription, readSubscriptions, writeSubscriptions } from "../lib/push.mjs";

export default async (request) => {
  const headers = corsHeaders(request, "GET, PUT, DELETE");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  try {
    if (!authorized(request)) return json(401, { error: "UNAUTHORIZED" }, headers);

    if (request.method === "GET") {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) return json(503, { error: "PUSH_NOT_SET_UP" }, headers);
      return json(200, { publicKey }, headers);
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json(400, { error: "BAD_JSON" }, headers);
    }

    if (request.method === "PUT") {
      const subscription = cleanSubscription(body && body.subscription);
      if (!subscription) return json(400, { error: "BAD_SUBSCRIPTION" }, headers);
      const list = (await readSubscriptions()).filter((item) => item.subscription.endpoint !== subscription.endpoint);
      const name = cleanName(body && body.name);
      list.push({ subscription, at: Date.now(), ...(name ? { name } : {}) });
      await writeSubscriptions(list);
      return json(200, { ok: true }, headers);
    }

    if (request.method === "DELETE") {
      const endpoint = body && typeof body.endpoint === "string" ? body.endpoint : "";
      const list = await readSubscriptions();
      const rest = list.filter((item) => item.subscription.endpoint !== endpoint);
      if (rest.length !== list.length) await writeSubscriptions(rest);
      return json(200, { ok: true }, headers);
    }

    return json(405, { error: "METHOD_NOT_ALLOWED" }, headers);
  } catch (error) {
    return json(error && error.code === "CONFIG" ? 503 : 500, { error: error && error.code === "CONFIG" ? error.message : "SERVER_ERROR" }, headers);
  }
};

export const config = { path: "/api/push" };
