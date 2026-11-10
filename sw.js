// Achtergrondscript van Pip op het beginscherm: toont de meldingen van het
// servertje (web-push, netlify/lib/push.mjs) en opent de Pip-app als je erop
// tikt. Het bewaart verder niets: de pagina's komen altijd vers van GitHub Pages.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(self.registration.showNotification(data.title || "Pip", {
    body: data.body || "",
    icon: "icoon-192.png",
    badge: "icoon-192.png",
    tag: data.tag || undefined,
    data: { url: data.url || "instellingen.html" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "instellingen.html", self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    // Staat Pip al open, dan die naar voren halen; anders openen. Hoort de melding
    // bij een eigen pagina (zoals de fotobattle), dan daarheen.
    const own = event.notification.data && event.notification.data.url && !/instellingen\.html$/.test(url);
    for (const client of windows) {
      if (!("focus" in client)) continue;
      if (own && client.url !== url && "navigate" in client) await client.navigate(url).catch(() => null);
      return client.focus();
    }
    return self.clients.openWindow(url);
  })());
});
