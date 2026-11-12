// Pip Run: de missies van de week.
//
// Gedeeld door het spel (piprun.html), Thuis (instellingen.html) en het servertje
// (netlify/functions/piprun.mjs). Zo ziet iedereen dezelfde vijf missies, en kan
// het servertje controleren of een missie echt bij deze week hoort.
//
// Elke maandag om 04:00 (net als de Scores) komen er vijf nieuwe: twee makkelijke,
// twee gemiddelde en één moeilijke. De volgorde ligt vast per week (geen toeval op
// het toestel), en binnen een rondje door de lijst komt geen missie twee keer.
// Haal je alle vijf, dan krijg je 1 punt (POINTS). Losse missies geven geen punt.
//
// scope "run": in één run halen. scope "week": opgeteld over alle runs van de week.
// tip: hoe je hem haalt (staat bij de volgende missie in het spel).
(function (root) {
  "use strict";

  const RESET_HOUR = 4;
  // Punten voor wie alle missies van een week haalt.
  const POINTS = 1;

  const POOL = [
    // Makkelijk
    { id: "rondje", tier: 1, scope: "run", stat: "dist", goal: 500, unit: "m", title: "Ochtendrondje", text: "Ren 500 m in één run" , tip: "Kijk ver vooruit en wissel op tijd van baan." },
    { id: "snaai", tier: 1, scope: "run", stat: "kib", goal: 100, unit: "", title: "Snaaitje", text: "Pak 100 brokjes in één run" , tip: "Brokjes liggen in de vrije baan, en bovenop de bank en tafels." },
    { id: "hop", tier: 1, scope: "run", stat: "jumps", goal: 30, unit: "", title: "Hop hop", text: "Spring 30 keer in één run" , tip: "Elke sprong telt, ook gewoon tussendoor." },
    { id: "ritsel", tier: 1, scope: "run", stat: "tunnels", goal: 3, unit: "", title: "Ritselkont", text: "Ren door 3 tunnels in één run" , tip: "Een tunnel staat altijd in de vrije baan: ren er dwars doorheen." },
    { id: "oeps", tier: 1, scope: "run", stat: "knocked", goal: 3, unit: "", title: "Oeps", text: "Gooi 3 spullen van tafel in één run" , tip: "Spring op de salontafel en ren eroverheen." },
    { id: "zigzag", tier: 1, scope: "run", stat: "lanes", goal: 50, unit: "", title: "Zigzag", text: "Wissel 50 keer van baan in één run" , tip: "Heen en weer vegen telt ook mee." },
    { id: "klant", tier: 1, scope: "week", stat: "runs", goal: 5, unit: "", title: "Vaste klant", text: "Speel deze week 5 runs" , tip: "Elke run vanaf 5 meter telt." },
    { id: "balgek", tier: 1, scope: "week", stat: "balls", goal: 3, unit: "", title: "Balgek", text: "Pak deze week 3 ballen" , tip: "Een bal is een van de drie power-ups. Hoe verder je rent, hoe vaker je er een ziet." },
    // Gemiddeld
    { id: "huis", tier: 2, scope: "run", stat: "dist", goal: 1000, unit: "m", title: "Rondje huis", text: "Ren 1000 m in één run" , tip: "Na 750 m rent Pip 40 km/u: kijk dan extra ver vooruit." },
    { id: "schrans", tier: 2, scope: "run", stat: "kib", goal: 250, unit: "", title: "Schranzer", text: "Pak 250 brokjes in één run" , tip: "Met snoepjes komen alle brokjes vanzelf naar je toe." },
    { id: "tafel", tier: 2, scope: "run", stat: "knocked", goal: 8, unit: "", title: "Alles moet van tafel", text: "Gooi 8 spullen van tafel in één run" , tip: "Blijf bovenop tafels rennen: elk ding dat valt telt." },
    { id: "nippertje", tier: 2, scope: "run", stat: "afterBump", goal: 300, unit: "m", title: "Op het nippertje", text: "Bots ergens tegenaan en ren daarna nog 300 m" , tip: "Na een botsing even rustig aan: nog één keer en de stofzuiger heeft je." },
    { id: "bank", tier: 2, scope: "run", stat: "sofa", goal: 5, unit: "", title: "Bankhanger", text: "Land 5 keer op de bank of de poef in één run" , tip: "Spring op de bank of de poef in plaats van eromheen." },
    { id: "speelgoed", tier: 2, scope: "run", stat: "powers", goal: 2, unit: "", title: "Speelgoedkist", text: "Pak 2 power-ups in één run" , tip: "Power-ups liggen in de vrije baan, ongeveer om de 250 m." },
    { id: "spaar", tier: 2, scope: "week", stat: "kib", goal: 1000, unit: "", title: "Spaarvarken", text: "Verzamel deze week 1000 brokjes" , tip: "De brokjes van al je runs deze week tellen samen." },
    { id: "dagen", tier: 2, scope: "week", stat: "days", goal: 3, unit: "", title: "Elke dag een rondje", text: "Speel deze week op 3 verschillende dagen" , tip: "Eén run per dag is al genoeg." },
    { id: "snoep", tier: 2, scope: "week", stat: "treatKib", goal: 30, unit: "", title: "Snoepkont", text: "Pak deze week 30 brokjes tijdens snoepjes" , tip: "Pak je snoepjes, blijf dan gewoon rennen: de brokjes komen naar je toe." },
    { id: "bak", tier: 2, scope: "week", stat: "hides", goal: 3, unit: "", title: "Kattenbakbezoek", text: "Duik deze week 3 keer de kattenbak in" , tip: "De kattenbak staat in de vrije baan: duik erin." },
    // Moeilijk
    { id: "marathon", tier: 3, scope: "run", stat: "dist", goal: 1500, unit: "m", title: "Marathonkat", text: "Ren 1500 m in één run" , tip: "Na 1000 m komen er vaker dubbele rijen: wissel op tijd." },
    { id: "schoon", tier: 3, scope: "run", stat: "clean", goal: 800, unit: "m", title: "Zonder kleerscheuren", text: "Ren 800 m zonder ergens tegenaan te botsen" , tip: "Liever vroeg wisselen dan op het laatste moment springen." },
    { id: "dieet", tier: 3, scope: "run", stat: "diet", goal: 500, unit: "m", title: "Op dieet", text: "Ren 500 m zonder één brokje te pakken" , tip: "Spring over de brokjes heen of neem de baan ernaast." },
    { id: "regen", tier: 3, scope: "run", stat: "streak", goal: 40, unit: "", title: "Brokjesregen", text: "Pak 40 brokjes achter elkaar zonder er één te missen" , tip: "Mis er geen in jouw baan, ook niet die in de lucht." },
    { id: "adem", tier: 3, scope: "week", stat: "dist", goal: 5000, unit: "m", title: "Lange adem", text: "Ren deze week in totaal 5000 m" , tip: "Alle meters van deze week tellen samen." },
    { id: "verstop", tier: 3, scope: "week", stat: "escapes", goal: 1, unit: "", title: "Verstoppertje", text: "Ontsnap via de kattenbak terwijl de stofzuiger je bijna heeft" , tip: "Bots één keer en duik daarna snel de kattenbak in." },
  ];
  const PER_TIER = { 1: 2, 2: 2, 3: 1 };
  // Maandag 5 januari 2026: week 0 van de telling.
  const EPOCH = Date.UTC(2026, 0, 5);

  // De dag van Pip ("YYYY-MM-DD"): tot 04:00 hoort de nacht nog bij gisteren.
  // Lokale tijd van het toestel; het servertje rekent zelf in Nederlandse tijd.
  function dayKey(ms) {
    const d = new Date(ms - RESET_HOUR * 3600 * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Maandag van de week waarin een dag valt.
  function mondayOf(day) {
    const date = new Date(`${day}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
    return date.toISOString().slice(0, 10);
  }

  function weekKey(ms) {
    return mondayOf(dayKey(ms));
  }

  function weekIndex(week) {
    return Math.round((Date.parse(`${week}T12:00:00Z`) - EPOCH - 12 * 3600 * 1000) / (7 * 24 * 3600 * 1000));
  }

  // Vaste "toevalsgenerator" (mulberry32) met een zaadje uit tekst.
  function seeded(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffled(list, seed) {
    const rand = seeded(seed);
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // De volgorde van één rondje door de missies van een moeilijkheid. Wat in de
  // laatste week van het vorige rondje zat, schuift naar achteren, zodat geen
  // missie twee weken achter elkaar komt (de laatste week blijft daarbij altijd
  // gelijk, dus dit hangt niet van nog eerdere rondjes af).
  function roundOrder(list, tier, round, per, weeksPerRound) {
    const order = shuffled(list, `pip-run:${tier}:${round}`);
    const last = (weeksPerRound - 1) * per;
    const before = shuffled(list, `pip-run:${tier}:${round - 1}`).slice(last, last + per).map((mission) => mission.id);
    for (let i = 0; i < per; i++) {
      if (!before.includes(order[i].id)) continue;
      for (let j = per; j < last; j++) {
        if (before.includes(order[j].id)) continue;
        [order[i], order[j]] = [order[j], order[i]];
        break;
      }
    }
    return order;
  }

  // De vijf missies van een week: per moeilijkheid het volgende stukje uit het rondje.
  function forWeek(week) {
    const index = weekIndex(week);
    const out = [];
    for (const tier of [1, 2, 3]) {
      const list = POOL.filter((mission) => mission.tier === tier);
      const per = PER_TIER[tier];
      const weeksPerRound = Math.floor(list.length / per);
      const round = Math.floor(index / weeksPerRound);
      const slot = ((index % weeksPerRound) + weeksPerRound) % weeksPerRound;
      const order = roundOrder(list, tier, round, per, weeksPerRound);
      out.push(...order.slice(slot * per, slot * per + per));
    }
    return out;
  }

  // Heeft iemand met deze gehaalde missies (lijst met id's) alles van de week?
  function allDone(week, ids) {
    const have = new Set(ids || []);
    return forWeek(week).every((mission) => have.has(mission.id));
  }

  function byId(id) {
    return POOL.find((mission) => mission.id === id) || null;
  }

  // Wanneer de volgende missies komen: maandag 04:00 na deze week.
  function nextWeekAt(ms) {
    const week = weekKey(ms);
    const date = new Date(`${week}T00:00:00`);
    date.setDate(date.getDate() + 7);
    date.setHours(RESET_HOUR, 0, 0, 0);
    return date.getTime();
  }

  function daysLeft(ms) {
    return Math.max(0, Math.ceil((nextWeekAt(ms) - ms) / (24 * 3600 * 1000)));
  }

  root.PipMissions = { POOL, POINTS, dayKey, weekKey, forWeek, allDone, byId, nextWeekAt, daysLeft };
})(typeof window !== "undefined" ? window : globalThis);
