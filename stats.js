// Rekenwerk voor het scoreboard en Pip Wrapped, los van het scherm. Alles komt
// uit het jaarlog van het servertje (netlify/functions/jaarlog-lezen.mjs):
//   ticks      elk vinkje { id, title, icon, repeat, by, at, pts }
//   days       per dag { v, ws, wn, h[24], f, p, fo, c } (kattenbak en voeren)
//   reminders  { id, at, kind? } wanneer een herinnering ging (kind "late": een half uur te laat)
// Werkt in de browser (window.PipStats) en in Node (voor de tests).
(function (root) {
  "use strict";

  const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
    "augustus", "september", "oktober", "november", "december"];
  const MONTHS_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
  const DAY_MS = 86400000;

  const pad = (n) => String(n).padStart(2, "0");
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // ---- Dagen ----

  // Dag van Pip als "2026-11-09": iets om 01:00 hoort nog bij gisteren.
  function dayKey(ms, resetHour) {
    const d = new Date(ms - resetHour * 3600 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Kalenderdag (voor kattenbak en voeren, zoals het servertje ze opslaat).
  function calendarKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function keyNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
  }

  function numberKey(number) {
    const d = new Date(number * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  // Maandag van de week van een dag.
  function weekKey(key) {
    const number = keyNumber(key);
    const weekday = new Date(number * DAY_MS).getUTCDay();
    return numberKey(number - ((weekday + 6) % 7));
  }

  function weekdayOf(key) {
    return new Date(keyNumber(key) * DAY_MS).getUTCDay();
  }

  // "9 november"
  // "Natvoer geven" → "natvoer gegeven", voor zinnen als "12 dagen natvoer gegeven".
  // Alleen bekende werkwoorden; anders blijft de taaknaam zoals hij is.
  const DONE_FORMS = {
    geven: "gegeven", draaien: "gedraaid", verversen: "ververst", schoonmaken: "schoongemaakt",
    legen: "geleegd", borstelen: "geborsteld", bijvullen: "bijgevuld", voeren: "gevoerd",
    verschonen: "verschoond", kammen: "gekamd", knippen: "geknipt", wegen: "gewogen",
    poetsen: "gepoetst", zuigen: "gezogen", opruimen: "opgeruimd", vullen: "gevuld",
  };
  function doneForm(title) {
    const words = String(title).toLowerCase().split(" ");
    const last = words[words.length - 1];
    if (DONE_FORMS[last]) words[words.length - 1] = DONE_FORMS[last];
    return words.join(" ");
  }

  function shortDate(key) {
    const [, m, d] = key.split("-").map(Number);
    return `${d} ${MONTHS[m - 1]}`;
  }

  // Langste reeks opeenvolgende dagen in een lijst dagen: { length, from, to }.
  function longestRun(keys) {
    const numbers = [...new Set(keys)].map(keyNumber).sort((a, b) => a - b);
    let best = { length: 0, from: null, to: null };
    let start = 0;
    for (let i = 0; i < numbers.length; i++) {
      if (i > 0 && numbers[i] !== numbers[i - 1] + 1) start = i;
      const length = i - start + 1;
      if (length > best.length) best = { length, from: numberKey(numbers[start]), to: numberKey(numbers[i]) };
    }
    return best;
  }

  function count(map, key, by = 1) {
    map.set(key, (map.get(key) || 0) + by);
  }

  function topOf(map) {
    let best = null;
    map.forEach((value, key) => {
      if (!best || value > best[1] || (value === best[1] && String(key).localeCompare(String(best[0])) < 0)) best = [key, value];
    });
    return best;
  }

  // ---- Scoreboard ----

  function inPeriod(tick, period, now, resetHour) {
    const key = dayKey(tick.at, resetHour);
    const today = dayKey(now, resetHour);
    if (period === "week") return weekKey(key) === weekKey(today);
    if (period === "month") return key.slice(0, 7) === today.slice(0, 7);
    return key.slice(0, 4) === today.slice(0, 4);
  }

  function periodLabel(period, now, resetHour, startedAt) {
    const today = dayKey(now, resetHour);
    if (period === "week") {
      const monday = weekKey(today);
      const sunday = numberKey(keyNumber(monday) + 6);
      const [, m1, d1] = monday.split("-").map(Number);
      const [, m2, d2] = sunday.split("-").map(Number);
      return m1 === m2
        ? `Deze week · maandag ${d1} t/m zondag ${d2} ${MONTHS[m2 - 1]}`
        : `Deze week · maandag ${d1} ${MONTHS[m1 - 1]} t/m zondag ${d2} ${MONTHS[m2 - 1]}`;
    }
    const since = startedAt && dayKey(startedAt, resetHour);
    if (period === "month") {
      const month = `${MONTHS[Number(today.slice(5, 7)) - 1]} tot nu toe`;
      const label = month.charAt(0).toUpperCase() + month.slice(1);
      return since && since.slice(0, 7) === today.slice(0, 7) && since.slice(8) !== "01" ? `${label} · sinds ${shortDate(since)}` : label;
    }
    const label = `${today.slice(0, 4)} tot nu toe`;
    return since && since.slice(0, 4) === today.slice(0, 4) && since > `${today.slice(0, 4)}-01-07` ? `${label} · sinds ${shortDate(since)}` : label;
  }

  // Per persoon: punten, aantal vinkjes, per taak, dagen, vroeg op, verschillende taken.
  function perPerson(ticks, resetHour) {
    const people = new Map();
    for (const tick of ticks) {
      if (!people.has(tick.by)) people.set(tick.by, { name: tick.by, points: 0, count: 0, tasks: new Map(), days: [], early: 0 });
      const person = people.get(tick.by);
      person.points += tick.pts || 1;
      person.count += 1;
      count(person.tasks, tick.id);
      person.days.push(dayKey(tick.at, resetHour));
      const hour = new Date(tick.at).getHours();
      if (hour >= 4 && hour < 8) person.early += 1;
    }
    return people;
  }

  function titles(ticks) {
    const map = new Map();
    for (const tick of ticks) map.set(tick.id, { title: tick.title, icon: tick.icon || "paw" });
    return map;
  }

  function scores(log, period, now, people, resetHour) {
    const ticks = (log.ticks || []).filter((tick) => inPeriod(tick, period, now, resetHour));
    const stats = perPerson(ticks, resetHour);
    const names = titles(log.ticks || []);
    (people || []).forEach((name) => {
      if (!stats.has(name)) stats.set(name, { name, points: 0, count: 0, tasks: new Map(), days: [], early: 0 });
    });
    const ranking = [...stats.values()]
      .sort((a, b) => b.points - a.points || b.count - a.count || a.name.localeCompare(b.name))
      .map((person) => {
        const top = topOf(person.tasks);
        const run = longestRun(person.days).length;
        const parts = [`${person.count} ${person.count === 1 ? "taak" : "taken"} afgevinkt`];
        if (top && top[1] > 1) parts.push(`${names.get(top[0]).title.toLowerCase()} ${top[1]}×`);
        if (run >= 2) parts.push(`reeks ${run} dagen`);
        return { name: person.name, points: person.points, count: person.count, detail: person.count ? parts.join(" · ") : "nog niets afgevinkt" };
      });

    const badges = [];
    // De taak die het vaakst gedaan is, en wie hem het vaakst deed.
    const perTask = new Map();
    ticks.forEach((tick) => count(perTask, tick.id));
    const topTask = topOf(perTask);
    if (topTask) {
      const doers = new Map();
      ticks.filter((tick) => tick.id === topTask[0]).forEach((tick) => count(doers, tick.by));
      const [who, times] = topOf(doers);
      const task = names.get(topTask[0]);
      badges.push({ icon: task.icon, title: task.title, text: `${who} · ${times} keer` });
    } else {
      badges.push({ icon: "paw", title: "Meest gedaan", text: "Nog niemand" });
    }
    const early = [...stats.values()].filter((p) => p.early > 0).sort((a, b) => b.early - a.early)[0];
    badges.push({ icon: "sun", title: "Vroege vogel", text: early ? `${early.name} · ${early.early} keer vóór 8:00` : "Nog niemand" });
    const runs = [...stats.values()].map((p) => ({ name: p.name, run: longestRun(p.days).length })).filter((p) => p.run >= 2).sort((a, b) => b.run - a.run)[0];
    badges.push({ icon: "flame", title: "Langste reeks", text: runs ? `${runs.name} · ${runs.run} dagen op rij` : "Nog niemand" });
    const variety = [...stats.values()].map((p) => ({ name: p.name, n: p.tasks.size })).filter((p) => p.n >= 2).sort((a, b) => b.n - a.n)[0];
    badges.push({ icon: "heart", title: "Alleskunner", text: variety ? `${variety.name} · ${variety.n} verschillende taken` : "Nog niemand" });

    return { ranking, badges, total: ticks.length, label: periodLabel(period, now, resetHour, ((log.ticks || [])[0] || {}).at || log.startedAt) };
  }

  // Wie staat er deze week bovenaan? null als nog niemand punten heeft.
  function leader(log, now, resetHour) {
    const top = scores(log, "week", now, [], resetHour).ranking[0];
    return top && top.points > 0 ? top : null;
  }

  // Zondag vanaf 20:00 (tot de nieuwe week om 04:00): de held van de week.
  function hero(log, now, resetHour) {
    const hour = new Date(now).getHours();
    if (weekdayOf(dayKey(now, resetHour)) !== 0 || (hour < 20 && hour >= resetHour)) return null;
    const ranking = scores(log, "week", now, [], resetHour).ranking.filter((p) => p.points > 0);
    if (!ranking.length) return null;
    return { ...ranking[0], others: ranking.slice(1, 3), week: weekKey(dayKey(now, resetHour)) };
  }

  // ---- Pip Wrapped ----

  // Pips wc-ritme: het uur waarop Pip het vaakst op de kattenbak zit (plassen
  // en poepen), als kattentype.
  const CAT_TYPES = [
    { from: 4, to: 8, name: "De Ochtendkat", line: "Het vaakst op de pot in de vroege ochtend." },
    { from: 9, to: 11, name: "De Uitslaper", line: "Het vaakst op de pot halverwege de ochtend." },
    { from: 12, to: 16, name: "De Middagkat", line: "Het vaakst op de pot in de middag." },
    { from: 17, to: 20, name: "De Avondkat", line: "Het vaakst op de pot rond etenstijd." },
  ];
  const NIGHT_TYPE = { name: "De Nachtkat", line: "Het vaakst op de pot als iedereen slaapt." };

  function catType(hour) {
    return CAT_TYPES.find((type) => hour >= type.from && hour <= type.to) || NIGHT_TYPE;
  }

  // Bakjes voor een grafiek door de tijd: per dag als het om hooguit drie weken
  // gaat, maanden als er minstens 3 zijn, en daartussen weken.
  function buckets(keys) {
    const sorted = [...new Set(keys)].sort();
    const months = [...new Set(keys.map((key) => key.slice(0, 7)))].sort();
    if (sorted.length && keyNumber(sorted[sorted.length - 1]) - keyNumber(sorted[0]) < 21) {
      const list = [];
      for (let n = keyNumber(sorted[0]); n <= keyNumber(sorted[sorted.length - 1]); n++) {
        const key = numberKey(n);
        const day = Number(key.slice(8));
        // Eerste dag en elke 1e van de maand met de maand erbij.
        list.push({ id: key, label: list.length === 0 || day === 1 ? `${day} ${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]}` : String(day) });
      }
      return { kind: "day", list, of: (key) => key };
    }
    if (months.length >= 3) {
      return { kind: "month", list: months.map((month) => ({ id: month, label: MONTHS_SHORT[Number(month.slice(5)) - 1] })), of: (key) => key.slice(0, 7) };
    }
    const weeks = [...new Set(keys.map(weekKey))].sort();
    return {
      kind: "week",
      list: weeks.map((week) => ({ id: week, label: shortDate(week).replace(/ (\w{3})\w*$/, " $1") })),
      of: weekKey,
    };
  }

  function sum(list, pick) {
    return list.reduce((total, item) => total + (pick(item) || 0), 0);
  }

  function wrapped(log, extra, now, resetHour) {
    const year = Number(log.year) || new Date(now).getFullYear();
    const ticks = (log.ticks || []).filter((tick) => dayKey(tick.at, resetHour).slice(0, 4) === String(year));
    const dayEntries = Object.entries(log.days || {}).filter(([key]) => key.slice(0, 4) === String(year)).sort(([a], [b]) => a.localeCompare(b));
    const days = dayEntries.map(([key, day]) => ({ key, ...day }));
    const reminders = log.reminders || [];
    const people = (extra && extra.people) || [];
    const tasks = (extra && extra.tasks) || [];
    const today = dayKey(now, resetHour);
    const lastKey = today.slice(0, 4) === String(year) ? today : `${year}-12-31`;

    const firstKeys = [
      log.startedAt && dayKey(log.startedAt, resetHour),
      ticks[0] && dayKey(ticks[0].at, resetHour),
      days[0] && days[0].key,
    ].filter((key) => key && key.slice(0, 4) === String(year)).sort();
    const startKey = firstKeys[0] || lastKey;
    const daysCovered = Math.max(1, keyNumber(lastKey) - keyNumber(startKey) + 1);
    const since = startKey > `${year}-01-07` ? `sinds ${shortDate(startKey)}` : "";
    const slides = [];
    const summary = [];

    slides.push({ type: "intro", year, since });

    // Samen voor Pip
    const fedVia = sum(days, (d) => d.fo);
    const cleaned = sum(days, (d) => d.c);
    const care = ticks.length + fedVia + cleaned;
    if (care > 0) {
      const perDay = care / daysCovered;
      slides.push({
        type: "total",
        total: care,
        perDay: perDay >= 1 ? `Gemiddeld ${String(Math.round(perDay * 10) / 10).replace(".", ",")} keer per dag.` : `Samen ${care} keer in ${daysCovered} dagen.`,
        rows: [
          { value: ticks.length, label: ticks.length === 1 ? "taak afgevinkt" : "taken afgevinkt" },
          { value: fedVia, label: "keer gevoerd via het overzicht" },
          { value: cleaned, label: "keer de kattenbak gedraaid" },
        ].filter((row) => row.value > 0),
      });
    }

    // Kattenbak
    const visitDays = days.filter((d) => d.v > 0);
    const visits = sum(days, (d) => d.v);
    let typeOfCat = null;
    if (visits > 0) {
      const perDay = visits / Math.max(1, days.length);
      const busiest = visitDays.reduce((best, d) => (!best || d.v > best.v ? d : best), null);
      const plan = buckets(days.map((d) => d.key));
      const totals = new Map();
      days.forEach((d) => count(totals, plan.of(d.key), d.v));
      const bars = plan.list.map((bucket) => ({ label: bucket.label, value: totals.get(bucket.id) || 0 }));
      const facts = [
        `Gemiddeld ${String(Math.round(perDay * 10) / 10).replace(".", ",")} keer per dag`,
        `Drukste dag: ${shortDate(busiest.key)}, ${busiest.v} keer`,
      ];
      if (plan.kind === "month" && bars.length >= 3) {
        const quiet = bars.slice(0, -1).reduce((best, bar) => (!best || bar.value < best.value ? bar : best), null);
        if (quiet) facts.push(`Rustigste maand: ${MONTHS[MONTHS_SHORT.indexOf(quiet.label)]}`);
      }
      slides.push({ type: "box", visits, facts, bars, bucket: plan.kind });
      summary.push({ label: "Kattenbak", value: num(visits), sub: `bezoeken, ${String(Math.round(perDay * 10) / 10).replace(".", ",")} per dag` });

      const hours = new Array(24).fill(0);
      days.forEach((d) => (d.h || []).forEach((n, hour) => { hours[hour] += n; }));
      const counted = hours.reduce((a, b) => a + b, 0);
      if (counted >= 10) {
        const peak = hours.indexOf(Math.max(...hours));
        typeOfCat = catType(peak);
        const parts = [
          { name: "'s ochtends", from: 6, to: 11 },
          { name: "'s middags", from: 12, to: 17 },
          { name: "'s avonds", from: 18, to: 23 },
          { name: "'s nachts", from: 0, to: 5 },
        ].map((part) => ({ ...part, share: Math.round((sum(hours.slice(part.from, part.to + 1), (n) => n) / counted) * 100) }))
          .filter((part) => part.share > 0)
          .sort((a, b) => b.share - a.share)
          .slice(0, 3)
          .map((part) => `${part.share}% ${part.name}`);
        slides.push({ type: "type", name: typeOfCat.name, line: typeOfCat.line, hours, peak: `${pad(peak)}:00`, chips: parts });
        summary.unshift({ label: "Wc-ritme", value: `${pad(peak)}:00`, sub: typeOfCat.name });
      }
    }

    // Eten: de dagtaak met een herinnering (natvoer), anders de vaakst gedane dagtaak.
    const daily = new Map();
    ticks.filter((tick) => tick.repeat === "daily").forEach((tick) => count(daily, tick.id));
    const reminded = tasks.find((task) => task.remind && daily.has(task.id));
    const careId = reminded ? reminded.id : (topOf(daily) || [null])[0];
    const portions = sum(days, (d) => d.p);
    if (careId || portions > 0) {
      const stats = [];
      let heat = null;
      let streak = null;
      let careTitle = null;
      if (careId) {
        const careTicks = ticks.filter((tick) => tick.id === careId);
        careTitle = careTicks[careTicks.length - 1].title;
        const doneDays = new Set(careTicks.map((tick) => dayKey(tick.at, resetHour)));
        stats.push({ value: String(doneDays.size), label: `${doneDays.size === 1 ? "dag" : "dagen"} ${doneForm(careTitle)}` });
        // Vinkjes worden pas sinds het jaarlog bewaard (daarvoor alleen het laatste
        // per taak): een dag daarvoor zonder vinkje is onbekend, niet vergeten.
        const tickStartKey = log.ticksSince ? dayKey(log.ticksSince, resetHour) : dayKey(careTicks[0].at, resetHour);
        // Altijd het hele jaar tot nu (zoals een jaaroverzicht): dagen van voor het
        // bijhouden staan er licht in.
        const startHeat = `${year}-01-01`;
        const trackedFrom = [dayKey(careTicks[0].at, resetHour), tickStartKey].sort()[0];
        const start = keyNumber(startHeat);
        const end = keyNumber(lastKey);
        heat = {
          offset: (new Date(start * DAY_MS).getUTCDay() + 6) % 7,
          cells: [],
          days: [],
          first: MONTHS[0],
          last: MONTHS[Number(lastKey.slice(5, 7)) - 1],
          since: trackedFrom > startHeat ? shortDate(trackedFrom) : null,
        };
        streak = longestRun([...doneDays]);
        for (let n = start; n <= end; n++) {
          const key = numberKey(n);
          const done = doneDays.has(key);
          const inStreak = streak.length >= 3 && key >= streak.from && key <= streak.to;
          heat.cells.push(done ? (inStreak ? "streak" : "done") : key === today ? "today" : key < trackedFrom ? "unknown" : "missed");
          heat.days.push({ day: Number(key.slice(8)), wd: DAYS[weekdayOf(key)].slice(0, 2) });
        }
        heat.hasUnknown = heat.cells.includes("unknown");
        // Hoe vaak het seintje "een half uur te laat" nodig was (alleen bij een taak met een tijd).
        if (reminded) {
          const late = reminders.filter((r) => r.id === careId && r.kind === "late").length;
          stats.push({ value: String(late), label: `keer een half uur te laat` });
        }
        const dayWord = doneDays.size === 1 ? "dag" : "dagen";
        summary.push({ label: careTitle, value: num(doneDays.size), sub: streak.length >= 2 ? `${dayWord}, ${streak.length} op rij` : dayWord });
      }
      if (portions > 0) stats.splice(1, 0, { value: String(portions), label: "porties uit de voerbak" });
      slides.push({
        type: "food",
        title: careTitle,
        doneTitle: careTitle ? doneForm(careTitle) : null,
        stats: stats.slice(0, 3),
        heat,
        streak: streak && streak.length >= 3 ? { length: streak.length, from: shortDate(streak.from), to: shortDate(streak.to) } : null,
      });
    }

    // Gewicht
    const weighed = sum(days, (d) => d.wn);
    if (weighed > 0) {
      const average = sum(days, (d) => d.ws) / weighed / 10;
      const plan = buckets(days.filter((d) => d.wn > 0).map((d) => d.key));
      const groups = new Map();
      days.filter((d) => d.wn > 0).forEach((d) => {
        const id = plan.of(d.key);
        const group = groups.get(id) || { ws: 0, wn: 0 };
        group.ws += d.ws;
        group.wn += d.wn;
        groups.set(id, group);
      });
      const points = plan.list.filter((b) => groups.has(b.id)).map((b) => ({ label: b.label, kg: groups.get(b.id).ws / groups.get(b.id).wn / 10 }));
      const kg = (n) => `${String(Math.round(n * 10) / 10).replace(".", ",")} kg`;
      const first = points[0];
      const last = points[points.length - 1];
      slides.push({
        type: "weight",
        average: kg(average),
        points,
        line: points.length < 2 ? "Gewogen bij elk bezoek aan de kattenbak."
          : Math.abs(first.kg - last.kg) < 0.05 ? `Mooi stabiel: elke ${{ month: "maand", week: "week", day: "dag" }[plan.kind]} rond de ${kg(last.kg)}.`
            : `Van ${kg(first.kg)} ${{ month: "in het begin", week: "in de eerste week", day: `op ${first.label}` }[plan.kind]} naar ${kg(last.kg)} nu.`,
      });
      summary.push({ label: "Gewicht", value: kg(average), sub: "gemiddeld" });
    }

    // Top 5 taken
    if (ticks.length) {
      const perTask = new Map();
      ticks.forEach((tick) => count(perTask, tick.id));
      const names = titles(ticks);
      const top = [...perTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([id, n]) => ({ name: names.get(id).title, count: n }));
      slides.push({ type: "top", tasks: top });
    }

    // Favoriete baasje
    const year_ = scores({ ...log, ticks }, "year", new Date(`${lastKey}T12:00:00`).getTime(), people, resetHour);
    const ranked = year_.ranking.filter((p) => p.points > 0);
    if (ranked.length) {
      const first = ranked[0];
      const stats = perPerson(ticks.filter((tick) => tick.by === first.name), resetHour).get(first.name);
      const top = topOf(stats.tasks);
      const names = titles(ticks);
      slides.push({
        type: "human",
        name: first.name,
        points: first.points,
        count: first.count,
        line: top ? `${top[1]} keer ${names.get(top[0]).title.toLowerCase()}. Pip weet het wel.` : "Pip weet het wel.",
        podium: ranked.slice(0, 3).map((p) => ({ name: p.name, points: p.points })),
      });
      summary.splice(1, 0, { label: "Favoriete baasje", value: first.name, sub: `${first.points} punten` });
    }

    // Records
    const records = [];
    const byPerson = perPerson(ticks, resetHour);
    const bestRun = [...byPerson.values()].map((p) => ({ name: p.name, run: longestRun(p.days) })).sort((a, b) => b.run.length - a.run.length)[0];
    if (bestRun && bestRun.run.length >= 2) {
      records.push({ icon: "flame", label: "Langste reeks", value: `${bestRun.run.length} dagen`, text: `${bestRun.name} deed van ${shortDate(bestRun.run.from)} t/m ${shortDate(bestRun.run.to)} elke dag iets.` });
    }
    const weeks = new Map();
    ticks.forEach((tick) => count(weeks, weekKey(dayKey(tick.at, resetHour))));
    const busyWeek = topOf(weeks);
    if (busyWeek && busyWeek[1] >= 3) {
      records.push({ icon: "calendar", label: "Drukste week", value: `${busyWeek[1]} taken`, text: `De week van maandag ${shortDate(busyWeek[0])}.` });
    }
    let fastest = null;
    for (const reminder of reminders) {
      const answer = ticks.find((tick) => tick.id === reminder.id && tick.at >= reminder.at && tick.at - reminder.at < 3 * 3600 * 1000);
      if (answer && (!fastest || answer.at - reminder.at < fastest.ms)) fastest = { ms: answer.at - reminder.at, tick: answer };
    }
    if (fastest) {
      const minutes = Math.max(1, Math.round(fastest.ms / 60000));
      records.push({ icon: "bell", label: "Snelst na de melding", value: `${minutes} ${minutes === 1 ? "minuut" : "minuten"}`, text: `${fastest.tick.by} deed ${fastest.tick.title.toLowerCase()} vlak na de herinnering.` });
    }
    const mornings = ticks.filter((tick) => {
      const hour = new Date(tick.at).getHours();
      return hour >= resetHour && hour < 12;
    });
    if (mornings.length) {
      const minutesOf = (tick) => new Date(tick.at).getHours() * 60 + new Date(tick.at).getMinutes();
      const earliest = mornings.reduce((best, tick) => (!best || minutesOf(tick) < minutesOf(best) ? tick : best), null);
      const time = new Date(earliest.at);
      records.push({ icon: "sun", label: "Vroegste vinkje", value: `${pad(time.getHours())}:${pad(time.getMinutes())}`, text: `${earliest.by}, ${earliest.title.toLowerCase()} op ${shortDate(dayKey(earliest.at, resetHour))}.` });
    }
    if (records.length >= 2) slides.push({ type: "records", records: records.slice(0, 4) });

    // Kosten (uit Voerraad)
    const costs = extra && extra.costs;
    if (costs && costs.total > 0) {
      // Voerraad kent het hele jaar, ook van voor het jaarlog.
      const perDay = costs.total / (costs.days || daysCovered);
      slides.push({
        type: "costs",
        total: costs.total,
        perDay,
        // Leeg = kosten vanaf begin januari: dan "dit jaar", niet de start van het jaarlog.
        since: typeof costs.since === "string" ? costs.since : since,
        rows: costs.rows.slice(0, 7),
        priciest: costs.priciest || null,
      });
    }

    // Fotolijst
    // photoCount: het echte aantal als er maar een paar foto's zijn meegegeven
    // (de telefoon haalt er alleen de eerste 3 op).
    const photos = (extra && extra.photos) || [];
    const photoCount = Math.max(photos.length, Number(extra && extra.photoCount) || 0);
    if (photos.length) {
      slides.push({ type: "photos", count: photoCount, urls: photos.slice(0, 3) });
      if (summary.length < 6) summary.push({ label: "Fotolijst", value: num(photoCount), sub: photoCount === 1 ? "foto van Pip" : "foto's van Pip" });
    }

    if (ticks.length && summary.length < 6) summary.push({ label: "Taken", value: num(ticks.length), sub: "keer afgevinkt" });
    slides.push({ type: "outro", year, summary: summary.slice(0, 6), people: ranked.map((p) => p.name) });

    return { year, since, slides };
  }

  const api = { dayKey, calendarKey, weekKey, scores, leader, hero, wrapped, longestRun, shortDate };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PipStats = api;
})(typeof window !== "undefined" ? window : globalThis);
