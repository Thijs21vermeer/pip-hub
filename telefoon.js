// Gedeeld door de telefoonpagina's: instellingen.html (het menu), fotos.html en
// baasjes.html. Koppelen gaat met de QR-code in de ruststand van de Google Hub;
// de code staat daarna op de telefoon (localStorage), voor alle pagina's.
//
// Een nieuwe pagina toevoegen: maak hem (kopieer baasjes.html als begin) en zet
// hem in PAGES hieronder. Dan staat hij vanzelf in het menu.
(function () {
  "use strict";

  const config = window.PIP_CONFIG;
  const CODE_KEY = "pip-kattenbak-code"; // zelfde als op de startpagina en fotos.html

  // Het menu op instellingen.html. count: wat er rechtsonder bij staat (optioneel).
  const PAGES = [
    {
      href: "fotos.html",
      title: "Foto's van Pip",
      sub: "De fotolijst in de ruststand",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="15" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-8 8"/></svg>',
      count: async () => {
        const list = await getJson(serverUrl("fotos", config.photos.url));
        return list.length === 1 ? "1 foto" : `${list.length} foto's`;
      },
    },
    {
      href: "baasjes.html",
      title: "Baasjes",
      sub: "Profielen en profielfoto's",
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16 14.6c2.7-.4 4.8 1.2 5.5 4.4"/></svg>',
      count: async () => {
        const settings = await getJson(serverUrl("settings", config.settings.url));
        const n = (settings.people || []).length;
        return n === 1 ? "1 baasje" : `${n} baasjes`;
      },
    },
  ];

  const $ = (id) => document.getElementById(id);

  // Alleen bij lokaal testen mag een ander servertje, bv. ?fotos=http://localhost:9/f
  function serverUrl(name, fallback) {
    const local = location.hostname === "localhost" || location.hostname === "127.0.0.1";
    return (local && new URLSearchParams(location.search).get(name)) || fallback;
  }

  function code() {
    try {
      return localStorage.getItem(CODE_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  function unlink() {
    try {
      localStorage.removeItem(CODE_KEY);
      // Ook de bewaarde stand en plaatjes van dit huis weg.
      Object.keys(localStorage).filter((key) => key.startsWith("pip-cache:")).forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // Geen opslag: dan was er ook niets gekoppeld.
    }
    if (window.caches) caches.delete("pip-media").catch(() => {});
  }

  function auth(extra = {}) {
    return { Authorization: `Bearer ${code()}`, ...extra };
  }

  async function getJson(url) {
    const response = await fetch(url, { headers: auth(), cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }

  // Een statusregel onder een blok: tekst en kind ("ok" of "error").
  function statusLine(id) {
    return (text, kind) => {
      const element = $(id);
      element.textContent = text || "";
      element.className = `status ${kind || ""}`;
    };
  }

  // Koppelen met de QR-code uit de ruststand (pagina.html#koppel=…). Geeft true
  // als er net gekoppeld is, false als de code niet werkte, null zonder code.
  async function linkFromQr() {
    const given = new URLSearchParams(location.hash.slice(1)).get("koppel");
    if (!given) return null;
    history.replaceState(null, "", location.pathname + location.search); // code uit de adresbalk
    try {
      return await useCode(given);
    } catch (error) {
      return false;
    }
  }

  // Een koppelcode controleren bij het servertje en bewaren. Gooit een fout als
  // het servertje niet bereikbaar is.
  async function useCode(given) {
    const value = String(given || "").trim();
    if (!value) return false;
    const response = await fetch(serverUrl("kattenbak", config.kattenbak.url), { headers: { Authorization: `Bearer ${value}` } });
    if (!response.ok) return false;
    localStorage.setItem(CODE_KEY, value);
    return true;
  }

  // Geopend vanaf het beginscherm (als app, zonder adresbalk)? Zo'n app heeft op
  // een iPhone eigen opslag en kent de koppelcode van de browser dus niet.
  // iPhone of iPad (een iPad doet zich soms voor als Mac).
  function isIos() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  }

  function isApp() {
    return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  }

  // ---- Meldingen van de Pip-app (web-push) ----
  // Op een iPhone kan dat alleen in Pip op het beginscherm (iOS 16.4+). Tik je
  // op zo'n melding, dan opent de Pip-app (sw.js).

  function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function pushUrl() {
    return serverUrl("push", (config.push && config.push.url) || "");
  }

  function keyBytes(base64) {
    const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  }

  // "on", "off", "denied", "browser" (eerst op het beginscherm zetten) of
  // "unsupported" (deze telefoon kan het niet).
  async function pushState() {
    if (!pushSupported() || !pushUrl()) {
      return isIos() && !isApp() ? "browser" : "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    // Niet eeuwig wachten als het achtergrondscript niet antwoordt.
    const registration = await Promise.race([
      navigator.serviceWorker.getRegistration(),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    const subscription = registration && await registration.pushManager.getSubscription();
    return subscription && Notification.permission === "granted" ? "on" : "off";
  }

  // Meteen na een tik aanroepen: iOS vraagt alleen dan om toestemming.
  async function enablePush() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw Object.assign(new Error("DENIED"), { code: "DENIED" });
    await navigator.serviceWorker.register("sw.js");
    const registration = await navigator.serviceWorker.ready;
    const { publicKey } = await getJson(pushUrl());
    const subscription = (await registration.pushManager.getSubscription())
      || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    const name = savedMe();
    const response = await fetch(pushUrl(), {
      method: "PUT",
      headers: auth({ "Content-Type": "application/json" }),
      body: JSON.stringify({ subscription: subscription.toJSON(), ...(name ? { name } : {}) }),
    });
    if (!response.ok) throw new Error(String(response.status));
    rememberPushName(name);
  }

  // Het servertje weet bij elke aanmelding van wie de telefoon is, zodat een
  // melding naar één baasje kan (wie nog moet kiezen bij de fotobattle). Na
  // wisselen van baasje (setMe) of als het nog niet gestuurd is: opnieuw melden.
  const PUSH_NAME_KEY = "pip-push-naam";
  function rememberPushName(name) {
    try {
      localStorage.setItem(PUSH_NAME_KEY, name || "");
    } catch (error) {
      // Geen opslag: dan de volgende keer opnieuw sturen.
    }
  }
  async function syncPushName(name = savedMe()) {
    try {
      if (!pushSupported() || !pushUrl() || !name) return;
      if (localStorage.getItem(PUSH_NAME_KEY) === name) return;
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = registration && await registration.pushManager.getSubscription();
      if (!subscription) return;
      const response = await fetch(pushUrl(), {
        method: "PUT",
        headers: auth({ "Content-Type": "application/json" }),
        body: JSON.stringify({ subscription: subscription.toJSON(), name }),
      });
      if (response.ok) rememberPushName(name);
    } catch (error) {
      // Niet erg: de volgende keer opnieuw.
    }
  }

  async function disablePush() {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration && await registration.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(pushUrl(), {
      method: "DELETE",
      headers: auth({ "Content-Type": "application/json" }),
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe();
  }

  // Nog niet gekoppeld: onder de uitleg een knop om de koppelcode te plakken
  // (gekopieerd op Thuis in de browser) of hem te typen.
  function showPairing() {
    const note = $("not-linked");
    if (!note || note.dataset.pairing) return;
    note.dataset.pairing = "1";
    if (isApp()) {
      note.textContent = "Pip op je beginscherm is nog niet gekoppeld. Open Pip in je browser, waar hij wel gekoppeld is, tik op Thuis onderaan op Gekoppeld met de Google Hub en dan op Kopieer koppelcode. Kom dan hier terug.";
    }
    const box = document.createElement("div");
    box.className = "pair";
    box.innerHTML = `<button type="button" class="pair-paste">Plak koppelcode</button>
      <form class="pair-type"><input type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Of plak of typ de code hier" aria-label="Koppelcode"><button type="submit">Koppel</button></form>
      <p class="pair-status" role="status"></p>`;
    note.after(box);
    const status = box.querySelector(".pair-status");
    const input = box.querySelector("input");
    const tryCode = async (value) => {
      if (!String(value || "").trim()) {
        status.textContent = "Er staat geen code klaar. Kopieer hem eerst op Thuis in je browser.";
        return;
      }
      status.textContent = "Even controleren…";
      try {
        if (await useCode(value)) {
          status.textContent = "Gekoppeld!";
          location.reload();
        } else {
          status.textContent = "Deze code klopt niet. Kopieer hem opnieuw en probeer het nog eens.";
        }
      } catch (error) {
        status.textContent = "Geen verbinding met het servertje. Probeer het zo nog eens.";
      }
    };
    box.querySelector(".pair-paste").addEventListener("click", async () => {
      try {
        await tryCode(await navigator.clipboard.readText());
      } catch (error) {
        status.textContent = "Plakken lukte niet. Plak of typ de code in het vak.";
        input.focus();
      }
    });
    box.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      tryCode(input.value);
    });
  }

  // Zet #linked of #not-linked aan, na een eventuele QR-code. Geeft terug of de
  // telefoon gekoppeld is.
  async function showLinked() {
    const fresh = await linkFromQr();
    const linked = Boolean(code());
    if ($("linked")) $("linked").hidden = !linked;
    if ($("not-linked")) $("not-linked").hidden = linked;
    if (!linked) showPairing();
    return { linked, fresh };
  }

  // ---- Voor het thuisscherm, scores en baasjes ----

  // Elk baasje een eigen warme kleur (op volgorde van de lijst).
  const COLORS = ["#b3562a", "#7d8c5a", "#c08a3e", "#8a5a7a", "#4f7a86", "#a7713a"];
  function colorFor(name, people) {
    const index = (people || []).findIndex((person) => person.toLowerCase() === String(name).toLowerCase());
    return COLORS[(index < 0 ? 0 : index) % COLORS.length];
  }

  // ---- Laatst bekende stand: meteen tonen, daarna verversen ----
  // Zonder dit begon elke pagina leeg en verscheen alles pas als het servertje
  // antwoordde (ook bij terugkomen op Thuis of het openen van de app).

  const CACHE_PREFIX = "pip-cache:";
  function remember(key, value) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      // Vol of geen opslag: dan de volgende keer gewoon wachten.
    }
  }
  function recall(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  // Plaatjes (foto's van Pip, profielfoto's) bewaard op de telefoon (Cache API),
  // per adres. Een adres hoort altijd bij hetzelfde plaatje, dus eerst daar kijken.
  const MEDIA_CACHE = "pip-media";
  async function mediaUrl(url) {
    try {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(url, { ignoreVary: true });
      if (hit) return URL.createObjectURL(await hit.blob());
    } catch (error) {
      // Geen Cache API: dan van het servertje.
    }
    const response = await fetch(url, { headers: auth() });
    if (!response.ok) throw new Error(String(response.status));
    const blob = await response.blob();
    try {
      const cache = await caches.open(MEDIA_CACHE);
      await cache.put(url, new Response(blob, { headers: { "Content-Type": blob.type || "image/jpeg" } }));
    } catch (error) {
      // Niet bewaard: de volgende keer opnieuw ophalen.
    }
    return URL.createObjectURL(blob);
  }
  // Alleen wat op de telefoon staat (geen netwerk), of null.
  async function storedMediaUrl(url) {
    try {
      const cache = await caches.open(MEDIA_CACHE);
      const hit = await cache.match(url, { ignoreVary: true });
      return hit ? URL.createObjectURL(await hit.blob()) : null;
    } catch (error) {
      return null;
    }
  }
  // Plaatjes die niet meer in de lijst staan weggooien.
  async function pruneMedia(base, keep) {
    try {
      const cache = await caches.open(MEDIA_CACHE);
      for (const request of await cache.keys()) {
        if (request.url.startsWith(`${base}/`) && !keep.has(request.url)) await cache.delete(request);
      }
    } catch (error) {
      // Niet erg: dan blijft er wat liggen.
    }
  }

  // Profielfoto's: naam (kleine letters) → blob-URL. Haalt de lijst op en bewaart
  // hem, zodat cachedAvatars de volgende keer meteen iets heeft.
  async function loadAvatars() {
    const result = new Map();
    const url = serverUrl("baasjes", (config.baasjes && config.baasjes.url) || "");
    if (!url) return result;
    try {
      const list = await getJson(url);
      remember("avatars", list.map((avatar) => ({ id: avatar.id, name: avatar.name })));
      await Promise.all(list.map(async (avatar) => {
        const photo = await mediaUrl(`${url}/${avatar.id}`).catch(() => null);
        if (photo) result.set(avatar.name.toLowerCase(), photo);
      }));
      pruneMedia(url, new Set(list.map((avatar) => `${url}/${avatar.id}`)));
    } catch (error) {
      // Zonder foto's: dan de eerste letter.
    }
    return result;
  }

  // De profielfoto's van de vorige keer, zonder netwerk.
  async function cachedAvatars() {
    const result = new Map();
    const url = serverUrl("baasjes", (config.baasjes && config.baasjes.url) || "");
    const list = recall("avatars");
    if (!url || !Array.isArray(list)) return result;
    await Promise.all(list.map(async (avatar) => {
      const photo = await storedMediaUrl(`${url}/${avatar.id}`);
      if (photo) result.set(String(avatar.name).toLowerCase(), photo);
    }));
    return result;
  }

  // Wat Thuis, Scores en Activiteit nodig hebben, voor de volgende keer. Zonder
  // de Voerraad-koppelcode: die hoeft niet op de telefoon te staan.
  function rememberHome(data) {
    const { voerraadCode, ...settings } = (data && data.settings) || {};
    remember("home", { settings, jaarlog: data.jaarlog || null, log: data.log || null });
  }

  // Een rondje met foto of eerste letter, als HTML-element.
  function avatarElement(name, people, avatars, tag = "span") {
    const photo = avatars && avatars.get(String(name).toLowerCase());
    const element = document.createElement(photo ? "img" : tag);
    element.className = "avatar";
    if (photo) {
      element.src = photo;
      element.alt = "";
    } else {
      element.textContent = String(name).charAt(0).toUpperCase();
      element.style.background = colorFor(name, people);
    }
    return element;
  }

  const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
  function longDate(date) {
    const text = `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function clock(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  // ---- Activiteit: wat er gebeurde, voor het thuisscherm en activiteit.html ----

  // Een dag van Pip begint om resetHour (04:00): iets om 01:00 hoort nog bij gisteren.
  function pipDayKey(ms) {
    const d = new Date(ms - config.resetHour * 3600 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const ACTIVITY_DAYS = 7; // zo lang bewaart het servertje de bezoeken aan de bak

  // Alles van de afgelopen 7 dagen, nieuwste eerst: Pip op de bak, de voerbak,
  // de bak draaien, en wat de baasjes deden (een taak afgevinkt, gespeeld).
  // { at, day, text, sub, care }; care = iets wat een baasje deed.
  function activity({ settings, jaarlog, log }, now = Date.now()) {
    const from = now - ACTIVITY_DAYS * 24 * 3600 * 1000;
    const today = pipDayKey(now);
    const events = [];
    const add = (event) => { if (event.at >= from && event.at <= now + 60000) events.push({ ...event, day: pipDayKey(event.at) }); };
    const kattenbak = log || {};
    // Waar een actie vandaan kwam: de Hub of een telefoon (een baasje deed het,
    // dus een gevuld bolletje). Een voerbeurt van het schema heeft geen herkomst.
    const via = { overzicht: "via de Hub", telefoon: "via je telefoon" };
    for (const feed of kattenbak.feeds || []) {
      const from = via[feed.source];
      add({ at: feed.at, text: "Gevoerd uit de voerbak", sub: `${feed.portions} ${feed.portions === 1 ? "portie" : "porties"}${from ? ` · ${from}` : ""}`, care: Boolean(from) });
    }
    for (const clean of kattenbak.cleans || []) add({ at: clean.at, text: "Bak gedraaid", sub: via[clean.source] || "via de Hub", care: true });
    // Per dag tellen: de hoeveelste keer op de bak.
    const visits = (kattenbak.visits || []).slice().sort((a, b) => a.at - b.at);
    const perDay = new Map();
    for (const visit of visits) {
      const day = pipDayKey(visit.at);
      const n = (perDay.get(day) || 0) + 1;
      perDay.set(day, n);
      const kg = visit.weightKg ? ` · ${String(visit.weightKg).replace(".", ",")} kg` : "";
      add({ at: visit.at, text: "Pip op de kattenbak", sub: `${n}e keer${day === today ? " vandaag" : ""}${kg}` });
    }
    // Wat de baasjes deden: uit het jaarlog (elk vinkje en elke keer spelen),
    // plus wat net is afgevinkt of gespeeld en daar nog niet in staat. Elk één keer.
    const s = settings || {};
    const tasks = Array.isArray(s.tasks) && s.tasks.length ? s.tasks : config.tasks;
    const seen = new Set();
    const care = (id, at, text, sub) => {
      if (!at || seen.has(`${id}:${at}`)) return;
      seen.add(`${id}:${at}`);
      add({ at, text, sub, care: true });
    };
    const titleOf = (id, fallback) => (tasks.find((task) => task.id === id) || {}).title || fallback || id;
    const played = (by, minutes) => `${by}${minutes ? ` · ${minutes} min` : ""}`;
    for (const tick of (jaarlog && jaarlog.ticks) || []) {
      if (tick.at < from) continue;
      if (tick.play) care(tick.id, tick.at, "Met Pip gespeeld", played(tick.by, tick.min));
      else if (tick.game) care(`${tick.id}:${tick.mission}`, tick.at, "Missie gehaald in Pip Run", `${tick.by} · ${String(tick.title || "").replace(/^Pip Run: /, "")} · +${tick.pts || 1} punt`);
      else care(tick.id, tick.at, titleOf(tick.id, tick.title), `Afgevinkt door ${tick.by}`);
    }
    for (const task of tasks.filter((t) => !t.play)) {
      const entry = (s.done || {})[task.id];
      if (entry) care(task.id, entry.at, task.title, `Afgevinkt door ${entry.by}`);
    }
    const playId = (tasks.find((t) => t.play) || { id: "spelen" }).id;
    for (const session of (s.play && s.play.sessions) || []) {
      care(playId, session.at, "Met Pip gespeeld", played(session.by, session.minutes));
    }
    return events.sort((a, b) => b.at - a.at);
  }

  // Eén regel van de tijdlijn.
  function activityItem(event) {
    const li = document.createElement("li");
    if (event.care) li.className = "care";
    li.innerHTML = '<time></time><i class="dot" aria-hidden="true"></i><span><strong></strong><small></small></span>';
    li.querySelector("time").textContent = clock(event.at);
    li.querySelector("strong").textContent = event.text;
    li.querySelector("small").textContent = event.sub;
    return li;
  }

  function people(settings) {
    return Array.isArray(settings && settings.people) && settings.people.length ? settings.people : config.people;
  }

  // Pip Wrapped staat klaar van 1 december tot half januari (net als op de Hub).
  function wrappedSeason(now = new Date()) {
    const month = now.getMonth();
    if (month === 11) return now.getFullYear();
    if (month === 0 && now.getDate() <= 15) return now.getFullYear() - 1;
    return null;
  }

  // Wie deze telefoon gebruikt (voor de fotobattle): één keer gevraagd, daarna onthouden.
  const ME_KEY = "pip-ik";
  function me(settings) {
    let name = "";
    try {
      name = localStorage.getItem(ME_KEY) || "";
    } catch (error) {
      name = "";
    }
    const list = people(settings);
    return list.find((person) => person.toLowerCase() === name.toLowerCase()) || "";
  }
  function setMe(name) {
    try {
      localStorage.setItem(ME_KEY, name);
    } catch (error) {
      // Geen opslag: dan de volgende keer opnieuw vragen.
    }
    syncPushName(name);
  }
  // Wat deze telefoon als naam bewaart (zonder te kijken of die nog bestaat).
  function savedMe() {
    try {
      return localStorage.getItem(ME_KEY) || "";
    } catch (error) {
      return "";
    }
  }

  // Het getal op het app-icoon (iOS 16.4+ op het beginscherm, Android): 1 zolang
  // jij nog moet kiezen bij de fotobattle, anders niets.
  function battleBadge(summary, name) {
    try {
      const current = summary && summary.current;
      const open = current && !current.result && Date.now() < current.closesAt;
      const todo = open && name && (current.canVote || []).includes(name) && !(current.voted || []).includes(name);
      if (todo && navigator.setAppBadge) navigator.setAppBadge(1).catch(() => {});
      else if (!todo && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
    } catch (error) {
      // Geen getal op het icoon: niet erg.
    }
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  // ---- Kleur van de statusbalk (app op het beginscherm) ----
  // iOS 26 neemt de kleur van de effen statusbalk van een vaste laag bovenaan,
  // en kijkt pas opnieuw als zo'n laag verschijnt of verdwijnt (theme-color
  // negeert hij). Daarom bij elke nieuwe kleur een nieuw strookje bovenaan in
  // die kleur (stijl.css, .bar-strip). Android kleurt mee via theme-color.
  let barColor = null;
  function paintStatusBar(color) {
    if (!color || color === barColor) return;
    barColor = color;
    const old = [...document.querySelectorAll(".bar-strip")];
    const strip = document.createElement("div");
    strip.className = "bar-strip";
    strip.setAttribute("aria-hidden", "true");
    strip.style.background = color;
    document.body.appendChild(strip);
    setTimeout(() => old.forEach((el) => el.remove()), 60);
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.content = color; });
  }

  // Gemiddelde kleur van de bovenste rand van een foto zoals hij in beeld staat
  // (object-fit: cover, in het midden), of null.
  // placed: waar de foto echt staat ({ left, top, width }, in px), als hij niet
  // gewoon in het midden staat (Thuis met een eigen uitsnede).
  function topColorOf(img, boxWidth, boxHeight, placed) {
    try {
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      if (!iw || !ih || !boxWidth || !boxHeight) return null;
      const scale = placed ? placed.width / iw : Math.max(boxWidth / iw, boxHeight / ih);
      const sw = boxWidth / scale;
      const sh = Math.max(1, (boxHeight * 0.04) / scale);
      const sx = placed ? -placed.left / scale : (iw - sw) / 2;
      const sy = placed ? -placed.top / scale : (ih - boxHeight / scale) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 3;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 24, 3);
      const data = ctx.getImageData(0, 0, 24, 3).data;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      const n = data.length / 4;
      return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
    } catch (error) {
      return null;
    }
  }

  // ---- Nieuwe versie direct ----
  // GitHub Pages laat een pagina 10 minuten in de cache van de telefoon staan.
  // Na een update zag je dan nog even de oude (zoals de oude statusbalk). Bij
  // het openen, en als Pip weer naar voren komt, daarom de pagina zelf opnieuw
  // ophalen ("reload" ververst ook die cache). Is het versienummer anders, dan
  // één keer herladen. Niet midden in Pip Wrapped.
  function myVersion() {
    const script = document.querySelector('script[src*="telefoon.js?v="]');
    return script ? script.getAttribute("src").split("v=")[1] : null;
  }
  async function checkForUpdate() {
    const mine = myVersion();
    if (!mine || (window.PipWrapped && window.PipWrapped.isOpen())) return;
    try {
      const response = await fetch(location.pathname, { cache: "reload" });
      const found = (await response.text()).match(/telefoon\.js\?v=([\w-]+)/);
      if (!found || found[1] === mine) return;
      // Nooit in een rondje herladen als de oude toch terugkomt.
      if (sessionStorage.getItem("pip-updated-from") === mine) return;
      sessionStorage.setItem("pip-updated-from", mine);
      location.reload();
    } catch (error) {
      // Geen netwerk: dan de versie die er is.
    }
  }
  checkForUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });

  window.PipPhone = {
    config, PAGES, $, serverUrl, code, unlink, auth, getJson, statusLine, linkFromQr, showLinked, useCode, isApp, isIos,
    pushSupported, pushState, enablePush, disablePush, activity, activityItem, pipDayKey,
    remember, recall, rememberHome, mediaUrl, storedMediaUrl, pruneMedia, cachedAvatars,
    paintStatusBar, topColorOf,
    COLORS, colorFor, loadAvatars, avatarElement, longDate, clock, people, wrappedSeason, escapeHtml,
    me, setMe, syncPushName, battleBadge,
  };
})();
