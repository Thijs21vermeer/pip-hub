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

  window.PipPhone = { config, PAGES, $, serverUrl, code, unlink, auth, getJson, statusLine, linkFromQr, showLinked };
})();
