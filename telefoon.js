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
    } catch (error) {
      // Geen opslag: dan was er ook niets gekoppeld.
    }
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
      const response = await fetch(serverUrl("kattenbak", config.kattenbak.url), { headers: { Authorization: `Bearer ${given.trim()}` } });
      if (!response.ok) throw new Error(String(response.status));
      localStorage.setItem(CODE_KEY, given.trim());
      return true;
    } catch (error) {
      return false;
    }
  }

  // Zet #linked of #not-linked aan, na een eventuele QR-code. Geeft terug of de
  // telefoon gekoppeld is.
  async function showLinked() {
    const fresh = await linkFromQr();
    const linked = Boolean(code());
    if ($("linked")) $("linked").hidden = !linked;
    if ($("not-linked")) $("not-linked").hidden = linked;
    return { linked, fresh };
  }

  // ---- Voor het thuisscherm, scores en baasjes ----

  // Elk baasje een eigen warme kleur (op volgorde van de lijst).
  const COLORS = ["#b3562a", "#7d8c5a", "#c08a3e", "#8a5a7a", "#4f7a86", "#a7713a"];
  function colorFor(name, people) {
    const index = (people || []).findIndex((person) => person.toLowerCase() === String(name).toLowerCase());
    return COLORS[(index < 0 ? 0 : index) % COLORS.length];
  }

  // Profielfoto's: naam (kleine letters) → blob-URL.
  async function loadAvatars() {
    const result = new Map();
    const url = serverUrl("baasjes", (config.baasjes && config.baasjes.url) || "");
    if (!url) return result;
    try {
      const list = await getJson(url);
      await Promise.all(list.map(async (avatar) => {
        const response = await fetch(`${url}/${avatar.id}`, { headers: auth() });
        if (response.ok) result.set(avatar.name.toLowerCase(), URL.createObjectURL(await response.blob()));
      }));
    } catch (error) {
      // Zonder foto's: dan de eerste letter.
    }
    return result;
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

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  window.PipPhone = {
    config, PAGES, $, serverUrl, code, unlink, auth, getJson, statusLine, linkFromQr, showLinked,
    COLORS, colorFor, loadAvatars, avatarElement, longDate, clock, people, wrappedSeason, escapeHtml,
  };
})();
