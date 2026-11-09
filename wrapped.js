// Pip Wrapped: het jaar van Pip in schermen die vanzelf doorlopen, zoals bij
// Spotify. De cijfers komen uit stats.js (PipStats.wrapped); dit bestand tekent
// de schermen en speelt ze af. Ontworpen op 1024×600 (de Hub) en geschaald naar
// elk ander scherm. Tik rechts voor verder, links voor terug.
(function () {
  "use strict";

  const SLIDE_SECONDS = 12;
  const LIGHT = new Set(["total", "type", "human", "photos"]);
  const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli",
    "augustus", "september", "oktober", "november", "december"];

  const esc = (text) => String(text).replace(/[&<>"']/g, (ch) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const euro = (n) => `€ ${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, ".")}`;
  const delay = (s) => `animation-delay:${s.toFixed(2)}s`;

  const PAW = '<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><ellipse cx="32" cy="44" rx="15" ry="13"/><ellipse cx="12" cy="27" rx="6.5" ry="8.5"/><ellipse cx="24" cy="13" rx="6.5" ry="8.5"/><ellipse cx="40" cy="13" rx="6.5" ry="8.5"/><ellipse cx="52" cy="27" rx="6.5" ry="8.5"/></svg>';
  const RECORD_ICONS = {
    flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 .8 1.5 1.5 2 2 2 0-2.5-.5-4.5 1-7z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  };
  const stroke = (body, size = 24) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  // Spelen met Pip: "45 min", "3 uur" of "3 uur 15 min".
  function playTime(minutes) {
    if (minutes < 60) return `${num(minutes)} min`;
    const rest = minutes % 60;
    return `${num(Math.floor(minutes / 60))} uur${rest ? ` ${rest} min` : ""}`;
  }

  const PLAY_GREEN = "#a8d98a";

  // Wie het meest met Pip speelde: rondje, naam, tijd en een balkje.
  function playRows(s, ctx, size) {
    const max = Math.max(...s.players.map((p) => p.minutes), 1);
    return s.players.map((p, i) => {
      const photo = ctx.avatar(p.name);
      const face = photo
        ? `<div class="wr-round wr-photo" style="flex:none;width:${size.face}px;height:${size.face}px"><img src="${esc(photo)}" alt=""></div>`
        : `<div class="wr-round" style="flex:none;width:${size.face}px;height:${size.face}px;display:grid;place-items:center;font-size:${Math.round(size.face * 0.45)}px;font-weight:800;background:${i === 0 ? PLAY_GREEN : "rgba(168,217,138,.25)"};color:${i === 0 ? "#1f3a2a" : "#f1f8ec"}">${esc(p.name.charAt(0).toUpperCase())}</div>`;
      return `
        <div class="wr-up wr-row" style="gap:${size.gap}px;align-items:center;${delay(0.45 + i * 0.12)}">
          ${face}
          <div style="flex:1;min-width:0">
            <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:10px">
              <span style="font-size:${size.name}px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.name)}</span>
              <span style="font-size:${size.time}px;font-weight:600;color:${PLAY_GREEN};white-space:nowrap">${esc(playTime(p.minutes))}</span>
            </div>
            <div style="margin-top:6px;height:7px;border-radius:99px;background:rgba(255,255,255,.12)">
              <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((p.minutes / max) * 100)}%;background:${i === 0 ? PLAY_GREEN : "rgba(168,217,138,.5)"};${delay(0.6 + i * 0.12)}"></div>
            </div>
          </div>
        </div>`;
    }).join("");
  }

  // Een foto van Pip op een kaartje, scheef opgehangen.
  function playCard(ctx, radius) {
    return `
      <div aria-hidden="true" class="wr-abs" style="inset:0;transform:rotate(-6deg)"><div class="wr-pop d1" style="width:100%;height:100%;border-radius:${radius}px;background:${PLAY_GREEN}"></div></div>
      <div class="wr-abs" style="inset:0;transform:rotate(4deg)"><div class="wr-pop d2 wr-photo" style="width:100%;height:100%;border-radius:${radius}px"><img src="${esc(ctx.photo || ctx.portrait)}" alt="Pip"></div></div>`;
  }

  // Grote getallen krimpen als ze langer worden, zodat ze altijd passen.
  function fit(text, size, width) {
    const guess = String(text).length * 0.56 * size;
    return guess > width ? Math.floor(size * (width / guess)) : size;
  }

  // Pips wc-ritme: hoe laat Pip het vaakst op de kattenbak zit. Eronder
  // waar het op gebaseerd is, en een knipoog: spelen doet Pip 's avonds, daar
  // is geen kattenbak voor nodig.
  const TYPE_NOTE = "Elk bezoek aan de kattenbak telt mee, per uur van de dag.";
  const PLAY_STICKER = `<div class="wr-sticker"><small>En met spelen?</small><strong>'s Avonds.</strong><span>Precies als jullie op de bank willen zitten.</span></div>`;

  // ---- Schermen ----

  const SLIDES = {
    intro(s, ctx) {
      const paws = [[64, 530, 80], [126, 496, 100], [192, 534, 80], [256, 500, 100], [322, 538, 80]]
        .map(([x, y, r], i) => `<div aria-hidden="true" class="wr-abs" style="left:${x}px;top:${y}px;transform:rotate(${r}deg);color:rgba(243,199,122,.4)"><div class="wr-pop wr-paw" style="${delay(0.6 + i * 0.15)}">${PAW}</div></div>`).join("");
      return `<div class="wr-slide" style="background:#24170f">
        <div aria-hidden="true" class="wr-abs wr-pop wr-round" style="left:548px;top:64px;width:500px;height:500px;background:#f3c77a"></div>
        <div class="wr-abs wr-pop d2 wr-round wr-photo" style="left:588px;top:104px;width:420px;height:420px;box-shadow:0 0 0 8px #24170f"><img src="${esc(ctx.photo)}" alt="Pip"></div>
        <div aria-hidden="true" class="wr-abs wr-pop d4 wr-round" style="left:536px;top:440px;width:104px;height:104px;background:#ff8c66"></div>
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="left:946px;top:468px;width:62px;height:62px;border:9px solid #9cc7e0"></div>
        ${paws}
        <div class="wr-abs" style="left:64px;top:112px;width:470px">
          <p class="wr-up wr-eyebrow" style="color:#f3c77a">Pip Wrapped</p>
          <h1 class="wr-up d1 wr-num" style="margin-top:10px;font-size:168px;color:#fbf7f2">${s.year}</h1>
          <p class="wr-up d2 wr-serif" style="margin-top:18px;font-size:52px;color:#f3c77a">Wat een jaar, Pip.</p>
          ${s.since ? `<p class="wr-up d3" style="margin-top:12px;font-size:20px;color:rgba(255,255,255,.75)">Bijgehouden ${esc(s.since)}.</p>` : ""}
          <span class="wr-up d3 wr-pill" style="margin-top:22px">Tik om te beginnen</span>
        </div>
      </div>`;
    },

    total(s) {
      const rows = s.rows.map((row, i) => `
        <div class="wr-up" style="padding:18px 22px;border-radius:22px;background:#fff3dc;${delay(0.5 + i * 0.12)}">
          <p class="wr-num" style="font-size:46px">${num(row.value)}</p>
          <p style="margin-top:4px;font-size:17px;color:#4a3424">${esc(row.label)}</p>
        </div>`).join("");
      return `<div class="wr-slide" style="background:#f3c77a;color:#24170f">
        <div aria-hidden="true" class="wr-abs" style="left:812px;top:392px;transform:rotate(18deg);color:#e5ac54"><div class="wr-pop d4 wr-paw" style="width:260px;height:260px">${PAW}</div></div>
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="left:528px;top:524px;width:64px;height:64px;background:#ff8c66"></div>
        <div class="wr-abs" style="left:64px;top:130px;width:540px">
          <p class="wr-up wr-eyebrow" style="color:#7d4820">Samen voor Pip</p>
          <p class="wr-up d1" style="margin-top:18px;font-size:34px;font-weight:600">Jullie zorgden</p>
          <p class="wr-pop d2 wr-num" style="margin-top:6px;font-size:${fit(num(s.total), 190, 540)}px">${num(s.total)}</p>
          <p class="wr-up d3 wr-serif" style="margin-top:8px;font-size:52px">keer voor Pip.</p>
          <p class="wr-up d4" style="margin-top:28px;font-size:20px;color:#4a3424">${esc(s.perDay)}</p>
        </div>
        <div class="wr-abs wr-stack" style="left:640px;top:143px;width:320px;gap:12px">${rows}</div>
      </div>`;
    },

    box(s) {
      const peak = Math.max(...s.bars.map((bar) => bar.value), 1);
      const small = s.bars.length > 8;
      const bars = s.bars.map((bar, i) => `
        <div class="wr-bar-col">
          ${bar.value === peak ? `<span class="wr-up d7" style="font-size:18px;font-weight:700;color:#f3c77a">${num(bar.value)}</span>` : ""}
          <div class="wr-grow" style="width:100%;height:${Math.max(4, Math.round((bar.value / peak) * 250))}px;border-radius:10px 10px 4px 4px;background:${bar.value === peak ? "#f3c77a" : "#3d6d91"};${delay(0.3 + i * 0.05)}"></div>
          <span style="font-size:${small ? 11 : 13}px;color:rgba(255,255,255,.72);white-space:nowrap">${esc(bar.label)}</span>
        </div>`).join("");
      const facts = s.facts.map((fact, i) => `
        <div class="wr-up wr-fact" style="${delay(0.4 + i * 0.12)}"><span class="wr-dot" style="background:#f3c77a"></span><span>${esc(fact)}</span></div>`).join("");
      return `<div class="wr-slide" style="background:#16324a">
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="left:-90px;top:476px;width:250px;height:250px;background:#1d4060"></div>
        <div class="wr-abs" style="left:64px;top:96px;width:420px">
          <p class="wr-up wr-eyebrow" style="color:#9cc7e0">Kattenbak</p>
          <p class="wr-pop d1 wr-num" style="margin-top:14px;font-size:${fit(num(s.visits), 140, 420)}px;color:#fbf7f2">${num(s.visits)}</p>
          <p class="wr-up d2" style="margin-top:12px;font-size:28px;font-weight:600">bezoeken aan de kattenbak</p>
          <div class="wr-stack" style="margin-top:28px;gap:12px">${facts}</div>
        </div>
        <div class="wr-abs" style="left:520px;top:118px;width:440px">
          <div class="wr-bars" style="height:330px">${bars}</div>
          <p style="margin-top:14px;font-size:15px;color:rgba(255,255,255,.72)">Bezoeken per ${{ month: "maand", week: "week", day: "dag" }[s.bucket]}.</p>
        </div>
      </div>`;
    },

    type(s) {
      const max = Math.max(...s.hours, 1);
      let base = "";
      let hot = "";
      const peakHour = Number(s.peak.slice(0, 2));
      s.hours.forEach((value, hour) => {
        const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
        const outer = 80 + (value / max) * 96;
        const part = `M${(200 + Math.cos(angle) * 74).toFixed(1)} ${(200 + Math.sin(angle) * 74).toFixed(1)} L${(200 + Math.cos(angle) * outer).toFixed(1)} ${(200 + Math.sin(angle) * outer).toFixed(1)} `;
        if (Math.abs(hour - peakHour) <= 1 || Math.abs(hour - peakHour) === 23) hot += part;
        else base += part;
      });
      const label = (x, y, anchor, text) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="14" font-weight="600" fill="#2a1508">${text}</text>`;
      const chips = s.chips.map((chip, i) => `<span class="wr-up wr-chip" style="background:#2a1508;color:#ffe1d4;${delay(0.5 + i * 0.12)}">${esc(chip)}</span>`).join("");
      return `<div class="wr-slide" style="background:#ff8c66;color:#2a1508">
        <div aria-hidden="true" class="wr-abs wr-pop d1 wr-round" style="left:560px;top:90px;width:420px;height:420px;background:#ffa585"></div>
        <div class="wr-abs wr-pop d2" style="left:570px;top:100px;width:400px;height:400px">
          <svg width="400" height="400" viewBox="0 0 400 400" font-family="Outfit, sans-serif" role="img" aria-label="Bezoeken aan de kattenbak per uur van de dag">
            <path d="${base}" fill="none" stroke="#2a1508" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>
            <path d="${hot}" fill="none" stroke="#2a1508" stroke-width="10" stroke-linecap="round"/>
            <circle cx="200" cy="200" r="60" fill="#fbf7f2"/>
            <text x="200" y="200" text-anchor="middle" font-size="30" font-weight="700" fill="#2a1508">${esc(s.peak)}</text>
            <text x="200" y="224" text-anchor="middle" font-size="14" fill="#5a2f1a">piekuur</text>
            ${label(200, 16, "middle", "0:00")}${label(394, 205, "end", "6:00")}${label(200, 396, "middle", "12:00")}${label(6, 205, "start", "18:00")}
          </svg>
          <div class="wr-abs" style="right:-34px;bottom:-34px;transform:rotate(-5deg)"><div class="wr-pop d6">${PLAY_STICKER}</div></div>
        </div>
        <div class="wr-abs" style="left:64px;top:96px;width:460px">
          <p class="wr-up wr-eyebrow" style="color:#5a1f08">Pips wc-ritme</p>
          <h2 class="wr-pop d1 wr-num" style="margin-top:16px;font-size:78px;line-height:.92">${esc(s.name)}</h2>
          <p class="wr-up d2 wr-serif" style="margin-top:18px;font-size:34px">${esc(s.line)}</p>
          <p class="wr-up d3" style="margin-top:12px;font-size:17px;line-height:1.4;color:#5a2f1a">${TYPE_NOTE}</p>
          <div class="wr-wrap" style="margin-top:24px">${chips}</div>
        </div>
      </div>`;
    },

    food(s, ctx) {
      const stats = s.stats.map((stat, i) => `
        <div class="wr-up" style="${delay(0.15 + i * 0.12)}">
          <p class="wr-num" style="font-size:84px;line-height:.95">${num(stat.value)}</p>
          <p style="margin-top:6px;font-size:19px;line-height:1.3;color:#ffe9d2">${esc(stat.label)}</p>
        </div>`).join("");
      let card = "";
      if (s.heat) {
        const looks = {
          done: "background:#d18c4f",
          streak: "background:#ffe7b0",
          missed: "border:2px solid rgba(255,244,230,.6)",
          unknown: "background:rgba(255,244,230,.12)",
          today: "border:2px dashed rgba(255,244,230,.6)",
        };
        // Het jaaroverzicht: een kolom per week, van januari tot nu.
        const total = s.heat.offset + s.heat.cells.length;
        const columns = Math.ceil(total / 7);
        const size = Math.max(8, Math.min(13, Math.floor(856 / columns) - 4));
        const cells = new Array(s.heat.offset).fill('<i style="visibility:hidden"></i>')
          .concat(s.heat.cells.map((kind, i) => `<i class="wr-cell" style="${looks[kind]};${delay(0.35 + Math.floor((i + s.heat.offset) / 7) * 0.02)}"></i>`));
        const width = Math.max(columns * (size + 4) - 4, 300);
        const calendar = `<div class="wr-heat" style="margin-top:16px;grid-template-rows:repeat(7,${size}px);grid-auto-columns:${size}px">${cells.join("")}</div>
          <div class="wr-row" style="justify-content:space-between;gap:24px;width:${width}px;margin-top:8px;font-size:13px;color:#ffe9d2"><span>${esc(s.heat.first)}</span><span>${esc(s.heat.last)}</span></div>`;
        const line = s.streak
          ? `<strong style="color:#ffe7b0">${s.streak.length} dagen op rij</strong> ${esc(s.doneTitle || s.title.toLowerCase())}, van ${esc(s.streak.from)} t/m ${esc(s.streak.to)}.`
          : s.heat.since ? `Bijgehouden sinds <strong style="color:#ffe7b0">${esc(s.heat.since)}</strong>; daarvoor staat het nog niet in het jaarlog.` : "";
        card = `
          <div class="wr-abs wr-up d3 wr-card" style="left:64px;right:64px;top:288px;background:#8d5124">
            <div class="wr-row" style="justify-content:space-between;gap:16px">
              <p style="font-size:19px;font-weight:700">${esc(s.title)} in ${ctx.year}</p>
              <div class="wr-row" style="gap:16px;font-size:14px;color:#ffe9d2">
                <span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#d18c4f"></i>Gegeven</span>
                ${s.streak ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#ffe7b0"></i>Langste reeks</span>' : ""}
                <span class="wr-row" style="gap:6px"><i class="wr-key" style="border:2px solid rgba(255,244,230,.6)"></i>Vergeten</span>
                ${s.heat.hasUnknown ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:rgba(255,244,230,.12)"></i>Nog niet bijgehouden</span>' : ""}
              </div>
            </div>
            ${calendar}
            ${line ? `<p style="margin-top:12px;font-size:18px">${line}</p>` : ""}
          </div>`;
      }
      return `<div class="wr-slide" style="background:#a9642f;color:#fff4e6">
        <div class="wr-abs" style="left:64px;top:96px;right:64px">
          <p class="wr-up wr-eyebrow" style="color:#ffe2bf">Eten</p>
          <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:14px">${stats}</div>
        </div>
        ${card}
      </div>`;
    },

    weight(s) {
      let chart = "";
      if (s.points.length >= 2) {
        const values = s.points.map((p) => p.kg);
        const low = Math.min(...values) - 0.15;
        const high = Math.max(...values) + 0.15;
        const step = s.points.length > 1 ? 390 / (s.points.length - 1) : 0;
        const x = (i) => Math.round(50 + i * step);
        const y = (kg) => Math.round(300 - ((kg - low) / (high - low)) * 260);
        const line = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.kg)}`).join(" ");
        const area = `${line} L${x(s.points.length - 1)} 320 L${x(0)} 320 Z`;
        const dots = s.points.map((p, i) => `M${x(i)} ${y(p.kg)} l0 .01`).join(" ");
        const last = s.points[s.points.length - 1];
        const lastY = y(last.kg);
        const every = Math.ceil(s.points.length / 11);
        const labels = s.points.map((p, i) => (i % every === 0 || i === s.points.length - 1
          ? `<text x="${x(i)}" y="350" text-anchor="middle" font-size="13" fill="rgba(255,255,255,.7)">${esc(p.label)}</text>` : "")).join("");
        chart = `
          <div class="wr-abs wr-up d2" style="left:500px;top:120px;width:460px;height:370px">
            <svg width="460" height="370" viewBox="0 0 460 370" font-family="Outfit, sans-serif" role="img" aria-label="Gewicht door het jaar">
              <line x1="44" y1="320" x2="452" y2="320" stroke="rgba(255,255,255,.3)"/>
              <path d="${area}" fill="#cfe8b8" fill-opacity=".16"/>
              <path d="${line}" fill="none" stroke="#cfe8b8" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="${dots}" fill="none" stroke="#2f4a2c" stroke-width="16" stroke-linecap="round"/>
              <path d="${dots}" fill="none" stroke="#cfe8b8" stroke-width="9" stroke-linecap="round"/>
              <circle cx="${x(s.points.length - 1)}" cy="${lastY}" r="11" fill="#f3c77a"/>
              <text x="${x(s.points.length - 1)}" y="${lastY - 22}" text-anchor="end" font-size="18" font-weight="700" fill="#f3c77a">${String(Math.round(last.kg * 10) / 10).replace(".", ",")} kg</text>
              ${labels}
            </svg>
            <div class="wr-wipe" style="position:absolute;left:30px;top:0;width:430px;height:332px;background:#2f4a2c"></div>
          </div>`;
      }
      return `<div class="wr-slide" style="background:#2f4a2c">
        <div class="wr-abs" style="left:64px;top:96px;width:${chart ? 400 : 700}px">
          <p class="wr-up wr-eyebrow" style="color:#cfe8b8">Gewicht</p>
          <p class="wr-pop d1 wr-num" style="margin-top:14px;font-size:120px;line-height:.9">${esc(s.average)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:26px;font-weight:600;line-height:1.25">gemiddeld, gewogen door de kattenbak</p>
          <p class="wr-up d3 wr-serif" style="margin-top:22px;font-size:30px;color:#cfe8b8">${esc(s.line)}</p>
        </div>
        ${chart}
      </div>`;
    },

    top(s, ctx) {
      const max = Math.max(...s.tasks.map((t) => t.count), 1);
      const rows = s.tasks.map((task, i) => `
        <div class="wr-up wr-row" style="gap:18px;${delay(0.3 + i * 0.12)}">
          <span class="wr-num" style="width:40px;font-size:40px;color:#f2a6a0">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:12px">
              <span style="font-size:23px;font-weight:700">${esc(task.name)}</span>
              <span style="font-size:20px;font-weight:600;color:#f2a6a0">${num(task.count)}×</span>
            </div>
            <div style="margin-top:7px;height:8px;border-radius:99px;background:rgba(255,255,255,.1)">
              <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((task.count / max) * 100)}%;background:${i === 0 ? "#f2a6a0" : "rgba(242,166,160,.5)"};${delay(0.5 + i * 0.12)}"></div>
            </div>
          </div>
        </div>`).join("");
      return `<div class="wr-slide" style="background:#3a1f3d;color:#fff3f1">
        <div class="wr-abs" style="left:64px;top:96px;width:560px">
          <p class="wr-up wr-eyebrow" style="color:#f2a6a0">Top ${s.tasks.length} van ${ctx.year}</p>
          <h2 class="wr-up d1 wr-num" style="margin-top:12px;font-size:46px;line-height:1">Meest afgevinkte taken</h2>
          <div class="wr-stack" style="margin-top:24px;gap:10px">${rows}</div>
        </div>
        <div aria-hidden="true" class="wr-abs" style="left:690px;top:122px;transform:rotate(-6deg)"><div class="wr-pop d1" style="width:270px;height:330px;border-radius:28px;background:#f2a6a0"></div></div>
        <div class="wr-abs" style="left:690px;top:122px;transform:rotate(4deg)"><div class="wr-pop d2 wr-photo" style="width:270px;height:330px;border-radius:28px"><img src="${esc(ctx.portrait)}" alt="Pip"></div></div>
        <p class="wr-abs wr-up d5 wr-serif" style="left:690px;top:486px;width:270px;text-align:center;font-size:30px;color:#f2a6a0">Pip keurt het goed.</p>
      </div>`;
    },

    play(s, ctx) {
      return `<div class="wr-slide" style="background:#1f3a2a;color:#f1f8ec">
        <div class="wr-abs" style="left:64px;top:84px;width:560px">
          <p class="wr-up wr-eyebrow" style="color:${PLAY_GREEN}">Spelen met Pip</p>
          <p class="wr-pop d1 wr-num" style="margin-top:12px;font-size:${fit(s.big, 120, 540)}px;line-height:.9">${esc(s.big)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:23px;font-weight:600">${esc(s.sub)}</p>
          <p class="wr-up d3" style="margin-top:4px;font-size:19px;color:rgba(241,248,236,.7)">${esc(s.line)}</p>
          <div class="wr-stack" style="margin-top:26px;gap:14px">${playRows(s, ctx, { face: 40, gap: 14, name: 21, time: 18 })}</div>
        </div>
        <div class="wr-abs" style="left:690px;top:112px;width:270px;height:330px">${playCard(ctx, 28)}</div>
        <p class="wr-abs wr-up d5 wr-serif" style="left:690px;top:476px;width:270px;text-align:center;font-size:30px;color:${PLAY_GREEN}">Pip wil nog een keer.</p>
      </div>`;
    },

    human(s, ctx) {
      const order = s.podium.length >= 3 ? [1, 0, 2] : s.podium.length === 2 ? [1, 0] : [0];
      const heights = [230, 160, 100];
      const colors = [["#a9642f", "#ffffff"], ["#e2c9a8", "#7d4820"], ["#efe2d1", "#7d4820"]];
      const columns = order.map((place, i) => {
        const person = s.podium[place];
        const [bg, fg] = colors[place];
        return `
          <div class="wr-stack" style="flex:1;align-items:center;gap:10px">
            ${place === 0 ? `<span class="wr-pop d6" style="color:#c98a1c">${stroke('<path d="M3 18h18l-1.6-10-5 4.5L12 5l-2.4 7.5-5-4.5z"/>', 34)}</span>` : ""}
            ${ctx.avatar(person.name)
              ? `<div class="wr-pop wr-round wr-photo" style="width:76px;height:76px;box-shadow:0 0 0 3px ${place === 0 ? "#a9642f" : "#e2c9a8"};${delay(0.36 + i * 0.12)}"><img src="${esc(ctx.avatar(person.name))}" alt=""></div>`
              : `<div class="wr-pop wr-round" style="width:76px;height:76px;display:grid;place-items:center;font-size:32px;font-weight:800;background:${place === 0 ? bg : "#e9dccb"};color:${place === 0 ? "#fff" : "#24170f"};${delay(0.36 + i * 0.12)}">${esc(person.name.charAt(0).toUpperCase())}</div>`}
            <div class="wr-up" style="text-align:center;${delay(0.36 + i * 0.12)}"><p style="font-size:19px;font-weight:700">${esc(person.name)}</p><p style="font-size:15px;color:#6b5f54">${num(person.points)} punten</p></div>
            <div class="wr-grow" style="width:100%;height:${heights[place]}px;padding-top:14px;border-radius:18px 18px 0 0;background:${bg};display:flex;justify-content:center;font-size:${place === 0 ? 56 : 46}px;font-weight:800;color:${fg};${delay(0.1 + i * 0.12)}">${place + 1}</div>
          </div>`;
      }).join("");
      return `<div class="wr-slide" style="background:#fbf7f2;color:#24170f">
        <div class="wr-abs" style="left:64px;top:96px;width:430px">
          <p class="wr-up wr-eyebrow" style="color:#a9642f">Pips favoriete baasje</p>
          <p class="wr-pop d1 wr-num" style="margin-top:12px;font-size:${fit(s.name, 150, 430)}px;line-height:.85">${esc(s.name)}</p>
          <p class="wr-up d2" style="margin-top:18px;font-size:24px;font-weight:600">${num(s.points)} punten · ${num(s.count)} ${s.count === 1 ? "taak" : "taken"}</p>
          <p class="wr-up d3 wr-serif" style="margin-top:14px;font-size:34px;color:#a9642f">${esc(s.line)}</p>
        </div>
        <div class="wr-abs wr-row" data-fixed style="left:540px;right:56px;bottom:0;align-items:flex-end;gap:14px">${columns}</div>
      </div>`;
    },

    records(s) {
      const cards = s.records.map((record, i) => `
        <div class="wr-up wr-row" style="align-items:flex-start;gap:16px;padding:20px 22px;border-radius:22px;background:#2a211a;${delay(0.24 + i * 0.12)}">
          <div class="wr-round" style="width:48px;height:48px;flex:none;display:grid;place-items:center;background:#f3c77a;color:#17120e">${stroke(RECORD_ICONS[record.icon] || RECORD_ICONS.sun)}</div>
          <div style="min-width:0">
            <p style="font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">${esc(record.label)}</p>
            <p class="wr-num" style="margin-top:4px;font-size:40px;line-height:1.05;color:#f3c77a">${esc(record.value)}</p>
            <p style="margin-top:6px;font-size:16px;line-height:1.35;color:rgba(255,255,255,.82)">${esc(record.text)}</p>
          </div>
        </div>`).join("");
      return `<div class="wr-slide" style="background:#17120e">
        <div class="wr-abs" style="left:64px;top:96px;right:64px">
          <p class="wr-up wr-eyebrow" style="color:#f3c77a">Records</p>
          <h2 class="wr-up d1 wr-num" style="margin-top:12px;font-size:46px;line-height:1">Het jaar in records</h2>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:26px">${cards}</div>
        </div>
      </div>`;
    },

    costs(s) {
      // Speelgoed is een grapje: dat bedrag is oneindig (zie toyRow hieronder).
      const real = s.rows.filter((row) => row.name !== "Speelgoed").slice(0, 6);
      const max = Math.max(...real.map((row) => row.amount), 1);
      // Speelgoed staat bovenaan, de echte bedragen komen daarna.
      const rows = real.map((row, i) => `
        <div class="wr-up" style="${delay(0.47 + i * 0.12)}">
          <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:12px">
            <span style="font-size:20px;font-weight:700">${esc(row.name)}</span>
            <span style="font-size:20px;font-weight:700;color:#c9c2ff">€ ${num(row.amount)}</span>
          </div>
          <div style="margin-top:8px;height:10px;border-radius:99px;background:rgba(255,255,255,.1)">
            <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((row.amount / max) * 100)}%;background:${i === 0 ? "#c9c2ff" : "rgba(201,194,255,.5)"};${delay(0.67 + i * 0.12)}"></div>
          </div>
        </div>`).join("");
      const toyRow = `
        <div class="wr-up" style="${delay(0.35)}">
          <div class="wr-row" style="justify-content:space-between;align-items:center;gap:12px">
            <span style="font-size:20px;font-weight:700">Speelgoed</span>
            <span class="wr-row" role="img" aria-label="oneindig veel euro" style="gap:6px;font-size:20px;font-weight:700;color:#c9c2ff">€
              <svg class="wr-inf" width="40" height="20" viewBox="0 0 40 20" aria-hidden="true">
                <path d="M20 10C16.5 5.3 13.6 3 10 3a7 7 0 0 0 0 14c3.6 0 6.5-2.3 10-7s6.4-7 10-7a7 7 0 0 1 0 14c-3.6 0-6.5-2.3-10-7Z" fill="none" stroke="rgba(201,194,255,.35)" stroke-width="3.2" stroke-linecap="round"/>
                <path class="wr-inf-run" pathLength="100" d="M20 10C16.5 5.3 13.6 3 10 3a7 7 0 0 0 0 14c3.6 0 6.5-2.3 10-7s6.4-7 10-7a7 7 0 0 1 0 14c-3.6 0-6.5-2.3-10-7Z" fill="none" stroke="#c9c2ff" stroke-width="3.2" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <div style="margin-top:8px;height:10px;border-radius:99px;background:rgba(255,255,255,.1)">
            <div class="wr-growx" style="height:100%;border-radius:99px;width:100%;background:linear-gradient(90deg,rgba(201,194,255,.5),#c9c2ff);${delay(0.55)}"></div>
          </div>
        </div>`;
      const total = `€ ${num(s.total)}`;
      return `<div class="wr-slide" style="background:#262046">
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="left:380px;top:470px;width:220px;height:220px;background:#2f2858"></div>
        <div class="wr-abs" style="left:64px;top:96px;width:470px">
          <p class="wr-up wr-eyebrow" style="color:#c9c2ff">Wat Pip kostte</p>
          <div data-center-between style="position:relative;margin-top:20px">
          <p class="wr-up d1" style="font-size:28px;font-weight:600">Jullie gaven ${s.since ? esc(s.since) : "dit jaar"}…</p>
          <p class="wr-pop d2 wr-num" style="margin-top:6px;font-size:${fit(total, 112, 440)}px;line-height:.92;letter-spacing:-0.02em;color:#c9c2ff">${total}</p>
          <p class="wr-up d3" style="margin-top:6px;font-size:28px;font-weight:600;line-height:1.3;white-space:nowrap">…uit aan Pip. Dat is elke cent waard!</p>
          </div>
        </div>
        <div class="wr-abs" data-align-last style="left:64px;top:404px;width:470px">
          <p class="wr-up d4" style="font-size:20px;line-height:1.35;color:rgba(255,255,255,.88)"><span class="wr-line">Gemiddeld ${euro(s.perDay)} per dag.</span>${s.priciest ? `<span class="wr-line">Duurste maand: ${esc(s.priciest)}.</span>` : ""}</p>
        </div>
        <div class="wr-abs wr-stack" style="left:560px;top:112px;width:400px;gap:14px">
          ${toyRow}
          ${rows}
        </div>
      </div>`;
    },

    photos(s) {
      const spots = [
        { left: 560, top: 112, rotate: -3, w: 280, h: 240, cls: "d2", label: "nieuwste" },
        { left: 770, top: 96, rotate: 8, w: 190, h: 190, cls: "d4", label: "" },
        { left: 540, top: 318, rotate: -9, w: 200, h: 150, cls: "d3", label: "" },
      ];
      // Achterste eerst, de grote voorop.
      const order = [2, 1, 0].filter((i) => i < s.urls.length);
      const polaroids = order.map((i) => {
        const spot = spots[i];
        return `<div class="wr-abs" style="left:${spot.left}px;top:${spot.top}px;transform:rotate(${spot.rotate}deg)">
          <div class="wr-pop ${spot.cls} wr-polaroid"><div class="wr-photo" style="width:${spot.w}px;height:${spot.h}px"><img src="${esc(s.urls[i])}" alt="Foto van Pip"></div>
          <p class="wr-serif" style="height:44px;display:flex;align-items:center;justify-content:center;font-size:22px">${esc(spot.label)}</p></div></div>`;
      }).join("");
      return `<div class="wr-slide" style="background:#f4e3d3;color:#24170f">
        <div class="wr-abs" style="left:64px;top:96px;width:420px">
          <p class="wr-up wr-eyebrow" style="color:#8d5124">Fotolijst</p>
          <p class="wr-pop d1 wr-num" style="margin-top:12px;font-size:170px;line-height:.85">${num(s.count)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:28px;font-weight:600">${s.count === 1 ? "foto" : "foto's"} van Pip op de Google Hub</p>
          <p class="wr-up d3" style="margin-top:16px;font-size:19px;line-height:1.45;color:#5a4636">Elke paar seconden een andere, in de ruststand. Nieuwe foto's stuur je met de QR-code linksonder.</p>
        </div>
        ${polaroids}
      </div>`;
    },

    outro(s, ctx) {
      const cells = s.summary.map((cell, i) => `
        <div class="wr-up" style="padding:18px 20px;border-radius:20px;background:#33251b;${delay(0.2 + i * 0.1)}">
          <p style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#f3c77a">${esc(cell.label)}</p>
          <p class="wr-num" style="margin-top:8px;font-size:${fit(cell.value, 32, 230)}px;line-height:1">${esc(cell.value)}</p>
          <p style="margin-top:6px;font-size:15px;color:rgba(251,247,242,.72)">${esc(cell.sub)}</p>
        </div>`).join("");
      return `<div class="wr-slide" style="background:#24170f;color:#fbf7f2">
        <div class="wr-abs" style="left:64px;top:96px;width:300px">
          <div class="wr-pop wr-round wr-photo" style="width:150px;height:150px;box-shadow:0 0 0 6px #f3c77a"><img src="${esc(ctx.portrait)}" alt="Pip"></div>
          <p class="wr-up d1 wr-eyebrow" style="margin-top:30px;color:#f3c77a">Pip Wrapped</p>
          <p class="wr-up d1 wr-num" style="margin-top:6px;font-size:96px;line-height:.9">${s.year}</p>
          <p class="wr-up d2 wr-serif" style="margin-top:14px;font-size:32px;color:#f3c77a">Dat was het jaar van Pip.</p>
        </div>
        <div class="wr-abs" style="left:400px;top:96px;right:64px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">${cells}</div>
        <button type="button" class="wr-abs wr-up d3 wr-share" data-share style="left:64px;top:452px">${stroke('<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v12M7 8l5-5 5 5"/>', 20)}Delen</button>
      </div>`;
    },
  };

  // ---- Staand (telefoon) ----

  // Op een staand scherm dezelfde schermen, maar onder elkaar in plaats van
  // naast elkaar: 400 px breed en zo hoog als het scherm (minstens 720), net als
  // een verhaal op Instagram. De tekst staat boven, het plaatje of de grafiek
  // eronder. Regels met data-fit krimpen tot ze op één regel passen (fitText).
  const TALL_WIDTH = 400;
  const TALL_MIN_HEIGHT = 720;
  const SHARE_ICON = '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"/><path d="M12 3v12M7 8l5-5 5 5"/>';
  // Ruimte verdelen: tussen twee blokken hooguit 56 px (GAP), wat overblijft
  // komt boven en onder het geheel (SPACE, END), onder iets meer: zo staat de
  // inhoud in het optische midden in plaats van tegen de boven- en onderkant.
  const SPACE = '<i class="wr-space" aria-hidden="true"></i>';
  const GAP = '<i class="wr-gap" aria-hidden="true"></i>';
  const END = '<i class="wr-space end" aria-hidden="true"></i>';
  const tall = (bg, color, inner) =>
    `<div class="wr-slide wr-tall" style="background:${bg}${color ? `;color:${color}` : ""}">${inner}</div>`;

  // De klok van Pips wc-ritme, zoals op het brede scherm maar met grotere letters.
  function clockSvg(s, size) {
    const max = Math.max(...s.hours, 1);
    let base = "";
    let hot = "";
    const peakHour = Number(s.peak.slice(0, 2));
    s.hours.forEach((value, hour) => {
      const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
      const outer = 80 + (value / max) * 96;
      const part = `M${(200 + Math.cos(angle) * 74).toFixed(1)} ${(200 + Math.sin(angle) * 74).toFixed(1)} L${(200 + Math.cos(angle) * outer).toFixed(1)} ${(200 + Math.sin(angle) * outer).toFixed(1)} `;
      if (Math.abs(hour - peakHour) <= 1 || Math.abs(hour - peakHour) === 23) hot += part;
      else base += part;
    });
    const label = (x, y, anchor, text) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="17" font-weight="600" fill="#2a1508">${text}</text>`;
    return `<svg width="${size}" height="${size}" viewBox="0 0 400 400" font-family="Outfit, sans-serif" role="img" aria-label="Bezoeken aan de kattenbak per uur van de dag">
      <path d="${base}" fill="none" stroke="#2a1508" stroke-opacity=".3" stroke-width="10" stroke-linecap="round"/>
      <path d="${hot}" fill="none" stroke="#2a1508" stroke-width="10" stroke-linecap="round"/>
      <circle cx="200" cy="200" r="60" fill="#fbf7f2"/>
      <text x="200" y="202" text-anchor="middle" font-size="32" font-weight="700" fill="#2a1508">${esc(s.peak)}</text>
      <text x="200" y="228" text-anchor="middle" font-size="16" fill="#5a2f1a">piekuur</text>
      ${label(200, 18, "middle", "0:00")}${label(396, 206, "end", "6:00")}${label(200, 396, "middle", "12:00")}${label(4, 206, "start", "18:00")}
    </svg>`;
  }

  const TALL = {
    intro(s, ctx) {
      // Pootjes lopen in de lege hoek linksboven naast de foto, niet bij de tekst.
      const paws = [[0, 46, 40], [34, 8, 40]].map(([x, y, r], i) =>
        `<div aria-hidden="true" class="wr-abs" style="left:${x}px;top:${y}px;transform:rotate(${r}deg);color:rgba(243,199,122,.4)"><div class="wr-pop wr-paw" style="width:24px;height:24px;${delay(0.6 + i * 0.15)}">${PAW}</div></div>`).join("");
      return tall("#24170f", "", `
        ${SPACE}
        <div style="position:relative;flex:none;align-self:center;width:280px;height:280px">
          <div aria-hidden="true" class="wr-abs wr-pop wr-round" style="inset:0;background:#f3c77a"></div>
          <div class="wr-abs wr-pop d2 wr-round wr-photo" style="inset:24px;box-shadow:0 0 0 7px #24170f"><img src="${esc(ctx.photo)}" alt="Pip"></div>
          <div aria-hidden="true" class="wr-abs wr-pop d4 wr-round" style="left:-18px;bottom:0;width:74px;height:74px;background:#ff8c66"></div>
          <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="right:-6px;bottom:18px;width:46px;height:46px;border:7px solid #9cc7e0"></div>
          ${paws}
        </div>
        ${GAP}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#f3c77a">Pip Wrapped</p>
          <h1 class="wr-up d1 wr-num" style="margin-top:10px;font-size:112px;color:#fbf7f2">${s.year}</h1>
          <p class="wr-up d2 wr-serif" style="margin-top:14px;font-size:40px;color:#f3c77a">Wat een jaar, Pip.</p>
          ${s.since ? `<p class="wr-up d3" style="margin-top:10px;font-size:17px;color:rgba(255,255,255,.75)">Bijgehouden ${esc(s.since)}.</p>` : ""}
          <span class="wr-up d3 wr-pill" style="margin-top:26px;font-size:16px">Tik om te beginnen</span>
        </div>
        ${END}`);
    },

    total(s) {
      const rows = s.rows.map((row, i) => `
        <div class="wr-up" style="padding:14px 16px;border-radius:18px;background:#fff3dc;${s.rows.length % 2 && i === s.rows.length - 1 ? "grid-column:span 2;" : ""}${delay(0.5 + i * 0.12)}">
          <p class="wr-num" style="font-size:36px">${num(row.value)}</p>
          <p style="margin-top:6px;font-size:15px;line-height:1.3;color:#4a3424">${esc(row.label)}</p>
        </div>`).join("");
      return tall("#f3c77a", "#24170f", `
        <div aria-hidden="true" class="wr-abs" style="right:-56px;top:190px;transform:rotate(18deg);color:#e5ac54"><div class="wr-pop d4 wr-paw" style="width:210px;height:210px">${PAW}</div></div>
        ${SPACE}
        <div style="position:relative">
          <p class="wr-up wr-eyebrow" style="color:#7d4820">Samen voor Pip</p>
          <p class="wr-up d1" style="margin-top:18px;font-size:28px;font-weight:600">Jullie zorgden</p>
          <p class="wr-pop d2 wr-num" data-fit="total" style="margin-top:8px;font-size:${fit(num(s.total), 150, 344)}px">${num(s.total)}</p>
          <p class="wr-up d3 wr-serif" style="margin-top:8px;font-size:44px">keer voor Pip.</p>
          <p class="wr-up d4" style="margin-top:18px;font-size:17px;line-height:1.4;color:#4a3424">${esc(s.perDay)}</p>
        </div>
        ${GAP}
        <div style="position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${rows}</div>
        ${END}`);
    },

    box(s) {
      const peak = Math.max(...s.bars.map((bar) => bar.value), 1);
      // Bij veel staafjes niet onder elk staafje een datum, anders lopen ze door elkaar.
      const every = s.bars.length > 9 ? Math.ceil(s.bars.length / 7) : 1;
      const bars = s.bars.map((bar, i) => `
        <div class="wr-bar-col" style="gap:6px">
          ${bar.value === peak ? `<span class="wr-up d7" style="font-size:16px;font-weight:700;color:#f3c77a">${num(bar.value)}</span>` : ""}
          <div class="wr-grow" style="width:100%;height:${Math.max(4, Math.round((bar.value / peak) * 188))}px;border-radius:${s.bars.length > 12 ? "5px 5px 2px 2px" : "8px 8px 3px 3px"};background:${bar.value === peak ? "#f3c77a" : "#3d6d91"};${delay(0.3 + i * 0.04)}"></div>
          <span style="height:16px;font-size:12px;color:rgba(255,255,255,.72);white-space:nowrap">${i % every === 0 ? esc(bar.label) : ""}</span>
        </div>`).join("");
      const facts = s.facts.map((fact, i) => `
        <div class="wr-up wr-fact" style="font-size:17px;line-height:1.35;${delay(0.4 + i * 0.12)}"><span class="wr-dot" style="background:#f3c77a"></span><span>${esc(fact)}</span></div>`).join("");
      return tall("#16324a", "", `
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="right:-90px;top:110px;width:240px;height:240px;background:#1d4060"></div>
        ${SPACE}
        <div style="position:relative">
          <p class="wr-up wr-eyebrow" style="color:#9cc7e0">Kattenbak</p>
          <p class="wr-pop d1 wr-num" data-fit="visits" style="margin-top:14px;font-size:${fit(num(s.visits), 130, 344)}px;color:#fbf7f2">${num(s.visits)}</p>
          <p class="wr-up d2" style="margin-top:12px;font-size:24px;font-weight:600">bezoeken aan de kattenbak</p>
          <div class="wr-stack" style="margin-top:20px;gap:10px">${facts}</div>
        </div>
        ${GAP}
        <div style="position:relative">
          <div class="wr-bars" style="height:236px;gap:${s.bars.length > 12 ? 4 : 8}px">${bars}</div>
          <p style="margin-top:10px;font-size:14px;color:rgba(255,255,255,.72)">Bezoeken per ${{ month: "maand", week: "week", day: "dag" }[s.bucket]}.</p>
        </div>
        ${END}`);
    },

    type(s) {
      const chips = s.chips.map((chip, i) => `<span class="wr-up wr-chip" style="font-size:15px;padding:9px 14px;background:#2a1508;color:#ffe1d4;${delay(0.5 + i * 0.12)}">${esc(chip)}</span>`).join("");
      return tall("#ff8c66", "#2a1508", `
        <div>
          <p class="wr-up wr-eyebrow" style="color:#5a1f08">Pips wc-ritme</p>
          <h2 class="wr-pop d1 wr-num wr-type-name" style="margin-top:16px;line-height:.92">${esc(s.name)}</h2>
          <p class="wr-up d2 wr-serif" style="margin-top:16px;font-size:32px">${esc(s.line)}</p>
          <p class="wr-up d3" style="margin-top:10px;font-size:15px;line-height:1.4;color:#5a2f1a">${TYPE_NOTE}</p>
          <div class="wr-wrap" style="margin-top:18px">${chips}</div>
        </div>
        <div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding-top:16px">
          <div class="wr-pop d1 wr-round" style="position:relative;height:100%;max-height:316px;aspect-ratio:1/1;padding:10px;background:#ffa585">
            <div class="wr-pop d2" style="width:100%;height:100%">${clockSvg(s, "100%")}</div>
            <div class="wr-abs wr-sticker-spot" style="transform:rotate(-5deg)"><div class="wr-pop d6">${PLAY_STICKER}</div></div>
          </div>
        </div>`);
    },

    food(s, ctx) {
      const stats = s.stats.map((stat, i) => `
        <div class="wr-up" style="${delay(0.15 + i * 0.12)}">
          <p class="wr-num" style="font-size:${fit(num(stat.value), 52, 100)}px;line-height:.95">${num(stat.value)}</p>
          <p style="margin-top:8px;font-size:14px;line-height:1.3;color:#ffe9d2">${esc(stat.label)}</p>
        </div>`).join("");
      let card = "";
      if (s.heat) {
        const looks = {
          done: "background:#d18c4f",
          streak: "background:#ffe7b0",
          missed: "border:2px solid rgba(255,244,230,.6)",
          unknown: "background:rgba(255,244,230,.12)",
          today: "border:2px dashed rgba(255,244,230,.6)",
        };
        // Staand: drie weken per rij (21 vakjes), van januari tot nu.
        const perRow = 21;
        const size = 11;
        const cells = new Array(s.heat.offset).fill('<i style="visibility:hidden"></i>')
          .concat(s.heat.cells.map((kind, i) => `<i class="wr-cell" style="${looks[kind]};${delay(0.35 + Math.floor((i + s.heat.offset) / perRow) * 0.04)}"></i>`));
        const width = perRow * (size + 3) - 3;
        const line = s.streak
          ? `<strong style="color:#ffe7b0">${s.streak.length} dagen op rij</strong> ${esc(s.doneTitle || s.title.toLowerCase())}, van ${esc(s.streak.from)} t/m ${esc(s.streak.to)}.`
          : s.heat.since ? `Bijgehouden sinds <strong style="color:#ffe7b0">${esc(s.heat.since)}</strong>; daarvoor staat het nog niet in het jaarlog.` : "";
        card = `
          <div class="wr-up d3 wr-card" style="padding:18px;border-radius:22px;background:#8d5124">
            <p style="font-size:17px;font-weight:700">${esc(s.title)} in ${ctx.year}</p>
            <div class="wr-row" style="flex-wrap:wrap;gap:6px 14px;margin-top:8px;font-size:13px;color:#ffe9d2">
              <span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#d18c4f"></i>Gegeven</span>
              ${s.streak ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#ffe7b0"></i>Langste reeks</span>' : ""}
              <span class="wr-row" style="gap:6px"><i class="wr-key" style="border:2px solid rgba(255,244,230,.6)"></i>Vergeten</span>
              ${s.heat.hasUnknown ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:rgba(255,244,230,.12)"></i>Nog niet bijgehouden</span>' : ""}
            </div>
            <div class="wr-heat" style="margin-top:14px;grid-auto-flow:row;gap:3px;grid-template-columns:repeat(${perRow},${size}px);grid-auto-rows:${size}px">${cells.join("")}</div>
            <div class="wr-row" style="justify-content:space-between;gap:16px;width:${width}px;margin-top:8px;font-size:12px;color:#ffe9d2"><span>${esc(s.heat.first)}</span><span>${esc(s.heat.last)}</span></div>
            ${line ? `<p style="margin-top:10px;font-size:15px;line-height:1.4">${line}</p>` : ""}
          </div>`;
      }
      return tall("#a9642f", "#fff4e6", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#ffe2bf">Eten</p>
          <div style="display:grid;grid-template-columns:repeat(${Math.max(1, s.stats.length)},minmax(0,1fr));gap:16px;margin-top:16px">${stats}</div>
        </div>
        ${card ? GAP + card : ""}
        ${END}`);
    },

    weight(s) {
      let chart = "";
      if (s.points.length >= 2) {
        const values = s.points.map((p) => p.kg);
        const low = Math.min(...values) - 0.15;
        const high = Math.max(...values) + 0.15;
        const step = 296 / (s.points.length - 1);
        const x = (i) => Math.round(30 + i * step);
        const y = (kg) => Math.round(196 - ((kg - low) / (high - low)) * 166);
        const line = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.kg)}`).join(" ");
        const area = `${line} L${x(s.points.length - 1)} 212 L${x(0)} 212 Z`;
        const dots = s.points.map((p, i) => `M${x(i)} ${y(p.kg)} l0 .01`).join(" ");
        const last = s.points[s.points.length - 1];
        const lastY = y(last.kg);
        const every = Math.ceil(s.points.length / 6);
        const lastIndex = s.points.length - 1;
        // Elke zoveelste maand, en de laatste; niet een die daar vlak tegenaan staat.
        const labels = s.points.map((p, i) => ((i % every === 0 && lastIndex - i >= every) || i === lastIndex
          ? `<text x="${x(i)}" y="238" text-anchor="middle" font-size="12" fill="rgba(255,255,255,.7)">${esc(p.label)}</text>` : "")).join("");
        chart = `
          <div class="wr-up d2" style="position:relative;flex:none;width:344px;height:250px">
            <svg width="344" height="250" viewBox="0 0 344 250" font-family="Outfit, sans-serif" role="img" aria-label="Gewicht door het jaar">
              <line x1="16" y1="212" x2="340" y2="212" stroke="rgba(255,255,255,.3)"/>
              <path d="${area}" fill="#cfe8b8" fill-opacity=".16"/>
              <path d="${line}" fill="none" stroke="#cfe8b8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="${dots}" fill="none" stroke="#2f4a2c" stroke-width="13" stroke-linecap="round"/>
              <path d="${dots}" fill="none" stroke="#cfe8b8" stroke-width="7" stroke-linecap="round"/>
              <circle cx="${x(s.points.length - 1)}" cy="${lastY}" r="9" fill="#f3c77a"/>
              <text x="${x(s.points.length - 1)}" y="${lastY - 18}" text-anchor="end" font-size="16" font-weight="700" fill="#f3c77a">${String(Math.round(last.kg * 10) / 10).replace(".", ",")} kg</text>
              ${labels}
            </svg>
            <div class="wr-wipe" style="position:absolute;left:14px;top:0;width:330px;height:222px;background:#2f4a2c"></div>
          </div>`;
      }
      return tall("#2f4a2c", "", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#cfe8b8">Gewicht</p>
          <p class="wr-pop d1 wr-num" data-fit="weight" style="margin-top:14px;font-size:${fit(s.average, 104, 344)}px;line-height:.9">${esc(s.average)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:22px;font-weight:600;line-height:1.3">gemiddeld, gewogen door de kattenbak</p>
          <p class="wr-up d3 wr-serif" style="margin-top:18px;font-size:30px;color:#cfe8b8">${esc(s.line)}</p>
        </div>
        ${chart ? GAP + chart : ""}
        ${END}`);
    },

    top(s, ctx) {
      const max = Math.max(...s.tasks.map((t) => t.count), 1);
      const rows = s.tasks.map((task, i) => `
        <div class="wr-up wr-row" style="gap:14px;${delay(0.3 + i * 0.12)}">
          <span class="wr-num" style="width:28px;font-size:32px;color:#f2a6a0">${i + 1}</span>
          <div style="flex:1;min-width:0">
            <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:10px">
              <span style="font-size:18px;font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(task.name)}</span>
              <span style="font-size:17px;font-weight:600;color:#f2a6a0">${num(task.count)}×</span>
            </div>
            <div style="margin-top:6px;height:7px;border-radius:99px;background:rgba(255,255,255,.1)">
              <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((task.count / max) * 100)}%;background:${i === 0 ? "#f2a6a0" : "rgba(242,166,160,.5)"};${delay(0.5 + i * 0.12)}"></div>
            </div>
          </div>
        </div>`).join("");
      return tall("#3a1f3d", "#fff3f1", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#f2a6a0">Top ${s.tasks.length} van ${ctx.year}</p>
          <h2 class="wr-up d1 wr-num" style="margin-top:12px;font-size:38px;line-height:1">Meest afgevinkte taken</h2>
          <div class="wr-stack" style="margin-top:22px;gap:14px">${rows}</div>
        </div>
        ${GAP}
        <div class="wr-row" style="gap:26px">
          <div style="position:relative;flex:none;width:150px;height:184px">
            <div aria-hidden="true" class="wr-abs" style="inset:0;transform:rotate(-6deg)"><div class="wr-pop d1" style="width:100%;height:100%;border-radius:22px;background:#f2a6a0"></div></div>
            <div class="wr-abs" style="inset:0;transform:rotate(4deg)"><div class="wr-pop d2 wr-photo" style="width:100%;height:100%;border-radius:22px"><img src="${esc(ctx.portrait)}" alt="Pip"></div></div>
          </div>
          <p class="wr-up d5 wr-serif" style="font-size:32px;color:#f2a6a0">Pip keurt het goed.</p>
        </div>
        ${END}`);
    },

    play(s, ctx) {
      return tall("#1f3a2a", "#f1f8ec", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:${PLAY_GREEN}">Spelen met Pip</p>
          <p class="wr-pop d1 wr-num" data-fit="play" style="margin-top:12px;font-size:${fit(s.big, 96, 344)}px;line-height:.9;white-space:nowrap">${esc(s.big)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:20px;font-weight:600">${esc(s.sub)}</p>
          <p class="wr-up d3" style="margin-top:4px;font-size:17px;color:rgba(241,248,236,.7)">${esc(s.line)}</p>
          <div class="wr-stack" style="margin-top:24px;gap:14px">${playRows(s, ctx, { face: 34, gap: 12, name: 18, time: 16 })}</div>
        </div>
        ${GAP}
        <div class="wr-row" style="gap:26px">
          <div style="position:relative;flex:none;width:150px;height:184px">${playCard(ctx, 22)}</div>
          <p class="wr-up d5 wr-serif" style="font-size:32px;color:${PLAY_GREEN}">Pip wil nog een keer.</p>
        </div>
        ${END}`);
    },

    human(s, ctx) {
      const order = s.podium.length >= 3 ? [1, 0, 2] : s.podium.length === 2 ? [1, 0] : [0];
      const heights = [236, 166, 106];
      const colors = [["#a9642f", "#ffffff"], ["#e2c9a8", "#7d4820"], ["#efe2d1", "#7d4820"]];
      const columns = order.map((place, i) => {
        const person = s.podium[place];
        const [bg, fg] = colors[place];
        const photo = ctx.avatar(person.name);
        return `
          <div class="wr-stack" style="flex:1;min-width:0;align-items:center;gap:8px">
            ${place === 0 ? `<span class="wr-pop d6" style="color:#c98a1c">${stroke('<path d="M3 18h18l-1.6-10-5 4.5L12 5l-2.4 7.5-5-4.5z"/>', 28)}</span>` : ""}
            ${photo
              ? `<div class="wr-pop wr-round wr-photo" style="width:60px;height:60px;box-shadow:0 0 0 3px ${place === 0 ? "#a9642f" : "#e2c9a8"};${delay(0.36 + i * 0.12)}"><img src="${esc(photo)}" alt=""></div>`
              : `<div class="wr-pop wr-round" style="width:60px;height:60px;display:grid;place-items:center;font-size:26px;font-weight:800;background:${place === 0 ? bg : "#e9dccb"};color:${place === 0 ? "#fff" : "#24170f"};${delay(0.36 + i * 0.12)}">${esc(person.name.charAt(0).toUpperCase())}</div>`}
            <div class="wr-up" style="max-width:100%;text-align:center;${delay(0.36 + i * 0.12)}"><p style="font-size:16px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(person.name)}</p><p style="font-size:13px;color:#6b5f54">${num(person.points)} punten</p></div>
            <div class="wr-grow" style="width:100%;height:${heights[place]}px;padding-top:12px;box-sizing:border-box;border-radius:16px 16px 0 0;background:${bg};display:flex;justify-content:center;font-size:${place === 0 ? 46 : 38}px;font-weight:800;color:${fg};${delay(0.1 + i * 0.12)}">${place + 1}</div>
          </div>`;
      }).join("");
      return tall("#fbf7f2", "#24170f", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#a9642f">Pips favoriete baasje</p>
          <p class="wr-pop d1 wr-num" data-fit="human" style="margin-top:12px;font-size:${fit(s.name, 120, 344)}px;line-height:.85;white-space:nowrap">${esc(s.name)}</p>
          <p class="wr-up d2" style="margin-top:16px;font-size:20px;font-weight:600">${num(s.points)} punten · ${num(s.count)} ${s.count === 1 ? "taak" : "taken"}</p>
          <p class="wr-up d3 wr-serif" style="margin-top:12px;font-size:30px;color:#a9642f">${esc(s.line)}</p>
        </div>
        ${GAP}
        <div class="wr-row" style="margin-bottom:calc(-36px - env(safe-area-inset-bottom));align-items:flex-end;gap:12px">${columns}</div>`);
    },

    records(s) {
      const cards = s.records.map((record, i) => `
        <div class="wr-up wr-row" style="align-items:flex-start;gap:14px;padding:14px 16px;border-radius:20px;background:#2a211a;${delay(0.24 + i * 0.12)}">
          <div class="wr-round" style="width:42px;height:42px;flex:none;display:grid;place-items:center;background:#f3c77a;color:#17120e">${stroke(RECORD_ICONS[record.icon] || RECORD_ICONS.sun, 22)}</div>
          <div style="min-width:0">
            <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.7)">${esc(record.label)}</p>
            <p class="wr-num" style="margin-top:4px;font-size:30px;line-height:1.05;color:#f3c77a">${esc(record.value)}</p>
            <p style="margin-top:5px;font-size:14px;line-height:1.35;color:rgba(255,255,255,.82)">${esc(record.text)}</p>
          </div>
        </div>`).join("");
      return tall("#17120e", "", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#f3c77a">Records</p>
          <h2 class="wr-up d1 wr-num" style="margin-top:12px;font-size:38px;line-height:1">Het jaar in records</h2>
        </div>
        <div class="wr-stack" style="margin-top:20px;gap:10px">${cards}</div>
        ${END}`);
    },

    costs(s) {
      const real = s.rows.filter((row) => row.name !== "Speelgoed").slice(0, 6);
      const max = Math.max(...real.map((row) => row.amount), 1);
      const rows = real.map((row, i) => `
        <div class="wr-up" style="${delay(0.47 + i * 0.12)}">
          <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:12px">
            <span style="font-size:17px;font-weight:700">${esc(row.name)}</span>
            <span style="font-size:17px;font-weight:700;color:#c9c2ff">€ ${num(row.amount)}</span>
          </div>
          <div style="margin-top:6px;height:8px;border-radius:99px;background:rgba(255,255,255,.1)">
            <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((row.amount / max) * 100)}%;background:${i === 0 ? "#c9c2ff" : "rgba(201,194,255,.5)"};${delay(0.67 + i * 0.12)}"></div>
          </div>
        </div>`).join("");
      const toyRow = `
        <div class="wr-up" style="${delay(0.35)}">
          <div class="wr-row" style="justify-content:space-between;align-items:center;gap:12px">
            <span style="font-size:17px;font-weight:700">Speelgoed</span>
            <span class="wr-row" role="img" aria-label="oneindig veel euro" style="gap:6px;font-size:17px;font-weight:700;color:#c9c2ff">€
              <svg class="wr-inf" width="34" height="17" viewBox="0 0 40 20" aria-hidden="true">
                <path d="M20 10C16.5 5.3 13.6 3 10 3a7 7 0 0 0 0 14c3.6 0 6.5-2.3 10-7s6.4-7 10-7a7 7 0 0 1 0 14c-3.6 0-6.5-2.3-10-7Z" fill="none" stroke="rgba(201,194,255,.35)" stroke-width="3.2" stroke-linecap="round"/>
                <path class="wr-inf-run" pathLength="100" d="M20 10C16.5 5.3 13.6 3 10 3a7 7 0 0 0 0 14c3.6 0 6.5-2.3 10-7s6.4-7 10-7a7 7 0 0 1 0 14c-3.6 0-6.5-2.3-10-7Z" fill="none" stroke="#c9c2ff" stroke-width="3.2" stroke-linecap="round"/>
              </svg>
            </span>
          </div>
          <div style="margin-top:6px;height:8px;border-radius:99px;background:rgba(255,255,255,.1)">
            <div class="wr-growx" style="height:100%;border-radius:99px;width:100%;background:linear-gradient(90deg,rgba(201,194,255,.5),#c9c2ff);${delay(0.55)}"></div>
          </div>
        </div>`;
      const total = `€ ${num(s.total)}`;
      return tall("#262046", "", `
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="right:-70px;top:150px;width:200px;height:200px;background:#2f2858"></div>
        ${SPACE}
        <div style="position:relative">
          <p class="wr-up wr-eyebrow" style="color:#c9c2ff">Wat Pip kostte</p>
          <p class="wr-up d1" data-fit="cost-line" style="margin-top:18px;font-size:22px;font-weight:600;white-space:nowrap">Jullie gaven ${s.since ? esc(s.since) : "dit jaar"}…</p>
          <p class="wr-pop d2 wr-num" data-fit="cost-total" style="margin-top:8px;font-size:${fit(total, 100, 344)}px;line-height:.92;letter-spacing:-0.02em;color:#c9c2ff">${total}</p>
          <p class="wr-up d3" data-fit="cost-line" style="margin-top:8px;font-size:22px;font-weight:600;line-height:1.3;white-space:nowrap">…uit aan Pip. Dat is elke cent waard!</p>
          <p class="wr-up d4" style="margin-top:14px;font-size:16px;line-height:1.45;color:rgba(255,255,255,.88)"><span class="wr-line">Gemiddeld ${euro(s.perDay)} per dag.</span>${s.priciest ? `<span class="wr-line">Duurste maand: ${esc(s.priciest)}.</span>` : ""}</p>
        </div>
        ${GAP}
        <div class="wr-stack" style="position:relative;gap:11px">${toyRow}${rows}</div>
        ${END}`);
    },

    photos(s) {
      const spots = [
        { left: 64, top: 34, rotate: -3, w: 196, h: 168, cls: "d2", label: "nieuwste" },
        { left: 214, top: 0, rotate: 8, w: 118, h: 118, cls: "d4", label: "" },
        { left: 0, top: 150, rotate: -9, w: 136, h: 104, cls: "d3", label: "" },
      ];
      const order = [2, 1, 0].filter((i) => i < s.urls.length);
      const polaroids = order.map((i) => {
        const spot = spots[i];
        return `<div class="wr-abs" style="left:${spot.left}px;top:${spot.top}px;transform:rotate(${spot.rotate}deg)">
          <div class="wr-pop ${spot.cls} wr-polaroid" style="padding:10px 10px 0"><div class="wr-photo" style="width:${spot.w}px;height:${spot.h}px"><img src="${esc(s.urls[i])}" alt="Foto van Pip"></div>
          <p class="wr-serif" style="height:36px;display:flex;align-items:center;justify-content:center;font-size:19px">${esc(spot.label)}</p></div></div>`;
      }).join("");
      return tall("#f4e3d3", "#24170f", `
        ${SPACE}
        <div>
          <p class="wr-up wr-eyebrow" style="color:#8d5124">Fotolijst</p>
          <p class="wr-pop d1 wr-num" style="margin-top:12px;font-size:140px;line-height:.85">${num(s.count)}</p>
          <p class="wr-up d2" style="margin-top:14px;font-size:24px;font-weight:600">${s.count === 1 ? "foto" : "foto's"} van Pip op de Google Hub</p>
          <p class="wr-up d3" style="margin-top:12px;font-size:16px;line-height:1.45;color:#5a4636">Elke paar seconden een andere, in de ruststand. Nieuwe foto's stuur je met de QR-code linksonder.</p>
        </div>
        ${polaroids ? `${GAP}<div style="position:relative;flex:none;height:284px">${polaroids}</div>` : ""}
        ${END}`);
    },

    outro(s, ctx) {
      const cells = s.summary.map((cell, i) => `
        <div class="wr-up" style="min-width:0;padding:14px 16px;border-radius:18px;background:#33251b;${delay(0.2 + i * 0.1)}">
          <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#f3c77a">${esc(cell.label)}</p>
          <p class="wr-num" data-fit="outro" style="margin-top:7px;font-size:28px;line-height:1">${esc(cell.value)}</p>
          <p style="margin-top:5px;font-size:13px;line-height:1.3;color:rgba(251,247,242,.72)">${esc(cell.sub)}</p>
        </div>`).join("");
      return tall("#24170f", "#fbf7f2", `
        ${SPACE}
        <div class="wr-row" style="gap:20px">
          <div class="wr-pop wr-round wr-photo" style="flex:none;width:100px;height:100px;box-shadow:0 0 0 5px #f3c77a"><img src="${esc(ctx.portrait)}" alt="Pip"></div>
          <div>
            <p class="wr-up d1 wr-eyebrow" style="color:#f3c77a">Pip Wrapped</p>
            <p class="wr-up d1 wr-num" style="margin-top:6px;font-size:76px;line-height:.9">${s.year}</p>
          </div>
        </div>
        <p class="wr-up d2 wr-serif" style="margin-top:18px;font-size:32px;color:#f3c77a">Dat was het jaar van Pip.</p>
        <div style="margin-top:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">${cells}</div>
        ${GAP}
        <button type="button" class="wr-up d3 wr-share" data-share style="position:relative;align-self:flex-start">${stroke(SHARE_ICON, 20)}Delen</button>
        ${END}`);
    },
  };

  // Staand: regels met data-fit krimpen tot ze op één regel passen; regels met
  // dezelfde naam (bv. de twee zinnen rond het bedrag) krijgen dezelfde maat.
  function fitText(slide) {
    if (!slide) return;
    const els = [...slide.querySelectorAll("[data-fit]")];
    const ratio = new Map();
    els.forEach((el) => {
      const r = el.scrollWidth > el.clientWidth ? el.clientWidth / el.scrollWidth : 1;
      ratio.set(el.dataset.fit, Math.min(ratio.has(el.dataset.fit) ? ratio.get(el.dataset.fit) : 1, r));
    });
    els.forEach((el) => {
      const r = ratio.get(el.dataset.fit);
      if (r < 1) el.style.fontSize = `${Math.floor(parseFloat(getComputedStyle(el).fontSize) * r * 0.98 * 10) / 10}px`;
    });
  }

  // ---- Muziek ----

  // Per hoofdstuk een bekend nummer (config.js, wrappedMusic): een fragment van
  // 30 seconden van Apple Music, zacht in en uit. Lukt ophalen niet, dan stil.
  const VOLUME = 0.6;
  const music = { songs: [], urls: new Map(), current: null, audio: null };

  // Een nieuwe fade op hetzelfde fragment stopt de vorige (snel heen en weer tikken).
  function fade(audio, to, ms, done) {
    const from = audio.volume;
    const start = performance.now();
    const id = (audio.pipFade || 0) + 1;
    audio.pipFade = id;
    const step = () => {
      if (audio.pipFade !== id) return;
      const t = Math.min(1, (performance.now() - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * t));
      if (t < 1) requestAnimationFrame(step);
      else if (done) done();
    };
    requestAnimationFrame(step);
  }

  // Geeft true als er iets opgehaald moest worden (music.songs staat meteen goed).
  async function loadMusic(songs) {
    music.songs = Array.isArray(songs) ? songs : [];
    const missing = music.songs.filter((song) => !music.urls.has(song.id));
    if (!missing.length) return false;
    try {
      const ids = missing.map((song) => song.id).join(",");
      const response = await fetch(`https://itunes.apple.com/lookup?id=${ids}&country=NL`);
      const data = await response.json();
      (data.results || []).forEach((result) => {
        if (result.previewUrl) music.urls.set(result.trackId, result.previewUrl);
      });
    } catch (error) {
      // Geen internet of Apple niet bereikbaar: Wrapped speelt zonder muziek.
    }
    return true;
  }

  // iPhone: een fragment mag pas vanzelf spelen (bij het automatisch doorgaan
  // naar het volgende scherm) als het één keer tijdens een tik is gestart.
  // Daarom bij het openen, en dat is een tik op Afspelen, elk fragment heel
  // even stil starten. De telefoonpagina haalt de fragmenten daarvoor al vooraf
  // op (preloadMusic).
  function unlockMusic() {
    music.songs.forEach((song) => {
      const audio = audioFor(song);
      if (!audio || audio.pipUnlocked) return;
      audio.pipUnlocked = true;
      audio.muted = true;
      audio.play()
        .then(() => { if (audio !== music.audio) audio.pause(); })
        .catch(() => {})
        .then(() => { audio.muted = false; });
    });
  }

  function renderSong() {
    const caption = root && root.querySelector(".wr-song");
    if (!caption) return;
    const song = music.current;
    const playable = song && music.urls.has(song.id);
    caption.hidden = !playable;
    if (playable) {
      caption.innerHTML = `<span class="wr-eq" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(song.artist)} · ${esc(song.title)}</span>`;
    }
  }

  // Het nummer bij een scherm; bij het wc-ritme het nummer van dat type.
  function songFor(slide) {
    const fits = music.songs.filter((s) => (s.slides || []).includes(slide.type));
    return fits.find((s) => s.when && s.when === slide.variant) || fits.find((s) => !s.when) || null;
  }

  // Elk fragment één keer klaarzetten, zodat het volgende scherm meteen klinkt.
  const audios = new Map();

  function audioFor(song) {
    const url = song && music.urls.get(song.id);
    if (!url) return null;
    if (!audios.has(song.id)) {
      const audio = new Audio(url);
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 0;
      audios.set(song.id, audio);
    }
    return audios.get(song.id);
  }

  // Naar het refrein (config.js, start): pas kan dat als het fragment geladen is.
  function seek(audio, seconds) {
    if (audio.readyState >= 1) audio.currentTime = seconds;
    else audio.addEventListener("loadedmetadata", () => { audio.currentTime = seconds; }, { once: true });
  }

  function playSongFor(slide) {
    const song = songFor(slide);
    if (song === music.current) return;
    const old = music.audio;
    if (old) fade(old, 0, 500, () => { if (music.audio !== old) old.pause(); });
    music.current = song;
    renderSong();
    const audio = audioFor(song);
    music.audio = audio;
    if (!audio) return;
    seek(audio, song.start || 0);
    audio.volume = 0;
    if (state && state.playing) {
      audio.play().then(() => fade(audio, VOLUME, 800)).catch(() => {});
    }
  }

  function preloadAfter(index) {
    const next = state && state.slides[index + 1];
    if (next) audioFor(songFor(next));
  }

  function stopMusic() {
    const old = music.audio;
    if (old) fade(old, 0, 600, () => old.pause());
    music.audio = null;
    music.current = null;
    // Na het uitfaden de klaargezette fragmenten loslaten.
    setTimeout(() => {
      if (state) return;
      audios.forEach((audio) => audio.pause());
      audios.clear();
    }, 800);
  }

  // ---- Delen ----

  // De Hub kan zelf niet delen: hij laat een QR-code zien naar deel.html, met de
  // cijfers van de samenvatting in het adres. Daar maakt je telefoon er een foto
  // van en deelt die. Er gaat geen code of account mee.
  function shareUrl() {
    const outro = state.data.slides.find((slide) => slide.type === "outro");
    const payload = { y: state.data.year, s: (outro ? outro.summary : []).map((c) => [c.label, c.value, c.sub]) };
    const base64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${new URL("deel.html", location.href).href.split("#")[0]}#d=${base64}`;
  }

  async function openShare() {
    if (state && state.share) {
      setPlaying(false);
      state.share(shareUrl());
      return;
    }
    if (!state || !state.qr) return;
    setPlaying(false);
    const panel = root.querySelector(".wr-share-panel");
    let svg = "";
    try {
      svg = await state.qr(shareUrl());
    } catch (error) {
      svg = "";
    }
    panel.innerHTML = `
      <div class="wr-share-card">
        <div class="wr-share-qr">${svg || '<p style="padding:40px 10px;text-align:center;color:#6b5f54">Geen internet voor de QR-code.</p>'}</div>
        <div>
          <p class="wr-eyebrow" style="color:#a9642f">Delen</p>
          <p style="margin-top:10px;font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.1">Scan met je telefoon</p>
          <p style="margin-top:12px;font-size:18px;line-height:1.45;color:#4a4038">Je krijgt de deelkaart van Pip Wrapped als foto, om te sturen via WhatsApp, Berichten of mail.</p>
          <p style="margin-top:22px;font-size:15px;color:#6b5f54">Tik ergens om terug te gaan.</p>
        </div>
      </div>`;
    panel.hidden = false;
  }

  function closeShare() {
    const panel = root && root.querySelector(".wr-share-panel");
    if (panel) {
      panel.hidden = true;
      panel.innerHTML = "";
    }
  }

  // ---- Afspelen ----

  let root = null;
  let state = null;

  // Staand (telefoon) of breed (de Hub, of een telefoon die gedraaid is).
  const area = () => ({ w: (root && root.clientWidth) || window.innerWidth, h: (root && root.clientHeight) || window.innerHeight });
  const isTall = () => area().h > area().w;

  function scale() {
    // Na het sluiten is er geen scherm meer om te schalen.
    const stage = root && root.querySelector(".wr-stage");
    if (!stage || !state) return;
    const tallNow = isTall();
    const width = tallNow ? TALL_WIDTH : 1024;
    const { w, h } = area();
    const height = tallNow ? Math.max(TALL_MIN_HEIGHT, Math.round(TALL_WIDTH * (h / w))) : 600;
    stage.style.width = `${width}px`;
    stage.style.height = `${height}px`;
    const s = Math.min(w / width, h / height);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    root.classList.toggle("tall", tallNow);
    // Korte telefoon (bv. iPhone SE): op een paar schermen alles iets kleiner.
    root.classList.toggle("short", tallNow && height < 780);
    // Telefoon gedraaid: hetzelfde scherm opnieuw, in de andere opbouw.
    if (tallNow !== state.tall) {
      state.tall = tallNow;
      if (state.shown) show(state.index);
    }
  }

  // Elke pagina begint op dezelfde hoogte: de kop (bv. "SAMEN VOOR PIP") staat
  // overal op 130 px, net als op "Samen voor Pip". Alleen een pagina die dan
  // tegen de onderkant zou komen, schuift zoveel als nodig omhoog. Versiering
  // schuift mee; wat aan de onderkant vastzit (data-fixed) blijft staan.
  const HEADING_TOP = 130;
  const MIN_TOP = 92;
  const MIN_BOTTOM = 24;

  function absoluteTop(el, slide) {
    let top = 0;
    for (let node = el; node && node !== slide; node = node.offsetParent) top += node.offsetTop;
    return top;
  }

  // Kosten: "Duurste maand …" (de laatste regel) op één hoogte met het woord
  // van de één-na-laatste rij rechts (bijvoorbeeld "Bakvulling"), en het middenstuk ("Jullie gaven …" tot en met
  // "…elke cent waard!") precies midden tussen de kop en "Gemiddeld".
  function alignToLast(slide) {
    if (!slide) return;
    const el = slide.querySelector("[data-align-last]");
    const list = slide.querySelector(".wr-stack");
    const rows = list ? [...list.children] : [];
    const last = rows[Math.max(0, rows.length - 2)];
    if (!el || !last) return;
    // Meten zonder de inloop-animaties (die schuiven alles nog 28px op).
    slide.classList.add("wr-measuring");
    const box = slide.getBoundingClientRect();
    const scale = box.height / slide.offsetHeight || 1;
    const y = (value) => (value - box.top) / scale;
    const text = (node) => { const range = document.createRange(); range.selectNodeContents(node); return range.getBoundingClientRect(); };

    const lines = el.querySelectorAll(".wr-line");
    const lastLine = lines[lines.length - 1] || el;
    const label = last.querySelector(".wr-row span") || last;
    const middleOf = (rect) => (rect.top + rect.bottom) / 2;
    el.style.top = `${el.offsetTop + Math.round(y(middleOf(text(label))) - y(middleOf(text(lastLine))))}px`;

    const middle = slide.querySelector("[data-center-between]");
    const heading = slide.querySelector(".wr-eyebrow");
    if (middle && heading) {
      const parts = middle.querySelectorAll("p");
      const above = y(text(heading).bottom);
      const below = y(text(lines[0] || el).top);
      const top = y(text(parts[0]).top);
      const bottom = y(text(parts[parts.length - 1]).bottom);
      const want = above + Math.max(12, (below - above - (bottom - top)) / 2);
      middle.style.top = `${Math.round(want - top)}px`;
    }
    slide.classList.remove("wr-measuring");
  }

  function balance(slide) {
    if (!slide) return;
    const movable = [...slide.children].filter((el) => !el.hasAttribute("data-fixed"));
    const content = movable.filter((el) => el.getAttribute("aria-hidden") !== "true");
    if (!content.length) return;
    const top = Math.min(...content.map((el) => el.offsetTop));
    const bottom = Math.max(...content.map((el) => el.offsetTop + el.offsetHeight));
    // De kop is het ijkpunt, als die bovenaan staat (anders de bovenkant van de inhoud).
    const heading = slide.querySelector(".wr-eyebrow");
    const headingTop = heading ? absoluteTop(heading, slide) : top;
    const anchor = headingTop - top <= 20 ? headingTop : top;
    let delta = HEADING_TOP - anchor;
    delta = Math.min(delta, 600 - MIN_BOTTOM - bottom);
    delta = Math.max(delta, MIN_TOP - top);
    delta = Math.round(delta);
    if (!delta) return;
    movable.forEach((el) => { el.style.top = `${el.offsetTop + delta}px`; });
  }

  // Telefoon als app: de onderrand en de statusbalk krijgen de kleur van het
  // scherm (iOS kleurt ze met theme-color, en daaronder ligt de pagina zelf).
  function paintEdges(slide) {
    const color = slide ? getComputedStyle(slide).backgroundColor : "";
    if (!color) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (!state.edges) state.edges = { meta: meta ? meta.content : null, html: document.documentElement.style.background };
    if (meta) meta.content = color;
    document.documentElement.style.background = color;
  }

  function restoreEdges(edges) {
    if (!edges) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && edges.meta !== null) meta.content = edges.meta;
    document.documentElement.style.background = edges.html;
  }

  function show(index) {
    state.index = index;
    state.shown = true;
    const slide = state.slides[index];
    const look = state.tall && TALL[slide.type] ? TALL : SLIDES;
    root.querySelector(".wr-host").innerHTML = look[slide.type](slide.data, state.ctx);
    const el = root.querySelector(".wr-host .wr-slide");
    paintEdges(el);
    if (look === TALL) {
      fitText(el);
    } else {
      balance(el);
      alignToLast(el);
    }
    root.classList.toggle("light", slide.light);
    root.querySelector(".wr-progress").innerHTML = state.slides.map((_, i) =>
      `<span class="wr-seg"><i class="${i < index ? "full" : i === index ? "run" : ""}"></i></span>`).join("");
    const run = root.querySelector(".wr-seg .run");
    run.style.animationDuration = `${SLIDE_SECONDS}s`;
    run.addEventListener("animationend", () => {
      if (state && state.index === index) step(1, true);
    });
    playSongFor(slide);
    preloadAfter(index);
  }

  function step(delta, auto) {
    if (!state) return;
    const next = state.index + delta;
    if (next < 0) return show(0);
    if (next >= state.slides.length) return auto ? setPlaying(false) : close();
    show(next);
  }

  function setPlaying(playing) {
    state.playing = playing;
    root.classList.toggle("paused", !playing);
    if (music.audio) {
      if (playing) music.audio.play().then(() => fade(music.audio, VOLUME, 600)).catch(() => {});
      else music.audio.pause();
    }
    const button = root.querySelector(".wr-pause");
    button.setAttribute("aria-label", playing ? "Pauzeren" : "Afspelen");
    button.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  }

  function open(data, options) {
    root = document.getElementById("wrapped");
    const ctx = { year: data.year, photo: options.photo, portrait: options.portrait, avatar: options.avatar || (() => null) };
    state = {
      index: 0,
      playing: true,
      data,
      qr: options.qr || null,
      // Op de telefoon: meteen de deelkaart openen in plaats van een QR-code.
      share: options.share || null,
      onClose: options.onClose,
      ctx,
      tall: isTall(),
      shown: false,
      slides: data.slides.filter((slide) => SLIDES[slide.type]).map((slide) => ({
        type: slide.type,
        variant: slide.name || "",
        data: slide,
        light: LIGHT.has(slide.type),
      })),
    };
    root.innerHTML = `
      <div class="wr-stage">
        <div class="wr-host"></div>
        <div class="wr-progress"></div>
        <div class="wr-song" hidden></div>
        <div class="wr-share-panel" hidden></div>
        <button class="wr-tap wr-prev" aria-label="Vorige"></button>
        <button class="wr-tap wr-next" aria-label="Volgende"></button>
        <div class="wr-controls">
          <button class="wr-ctrl wr-pause"></button>
          <button class="wr-ctrl wr-close" aria-label="Sluiten">${stroke('<path d="M6 6l12 12M18 6L6 18"/>', 18)}</button>
        </div>
      </div>`;
    root.querySelector(".wr-prev").addEventListener("click", () => step(-1));
    root.querySelector(".wr-next").addEventListener("click", () => step(1));
    root.querySelector(".wr-pause").addEventListener("click", () => setPlaying(!state.playing));
    root.querySelector(".wr-close").addEventListener("click", close);
    root.querySelector(".wr-host").addEventListener("click", (event) => {
      if (event.target.closest("[data-share]")) openShare();
    });
    root.querySelector(".wr-share-panel").addEventListener("click", closeShare);
    root.hidden = false;
    scale();
    music.current = null;
    const loading = loadMusic(options.music);
    if (options.unlockMusic) unlockMusic();
    setPlaying(true);
    show(0);
    // Waren de fragmenten er nog niet, dan komen ze als Apple antwoordt; dan
    // alsnog het nummer van dit scherm.
    loading.then((fetched) => {
      if (!state || !fetched) return;
      music.current = null;
      playSongFor(state.slides[state.index]);
      preloadAfter(state.index);
    });
  }

  function close() {
    if (!root || !state) return;
    const done = state.onClose;
    const edges = state.edges;
    closeShare();
    stopMusic();
    state = null;
    restoreEdges(edges);
    root.hidden = true;
    root.innerHTML = "";
    if (done) done();
  }

  window.addEventListener("resize", scale);
  // Voor het nakijken: welk nummer klinkt en waar het fragment is.
  function nowPlaying() {
    const audio = music.audio;
    return music.current ? { title: `${music.current.artist} · ${music.current.title}`, at: audio ? Math.round(audio.currentTime * 10) / 10 : null, playing: Boolean(audio && !audio.paused) } : null;
  }

  window.PipWrapped = { open, close, isOpen: () => Boolean(state), nowPlaying, preloadMusic: loadMusic, months: MONTHS };
})();
