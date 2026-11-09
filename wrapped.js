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

  // Grote getallen krimpen als ze langer worden, zodat ze altijd passen.
  function fit(text, size, width) {
    const guess = String(text).length * 0.56 * size;
    return guess > width ? Math.floor(size * (width / guess)) : size;
  }

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
        </div>
        <div class="wr-abs" style="left:64px;top:96px;width:460px">
          <p class="wr-up wr-eyebrow" style="color:#5a1f08">Pips kattentype</p>
          <h2 class="wr-pop d1 wr-num" style="margin-top:16px;font-size:78px;line-height:.92">${esc(s.name)}</h2>
          <p class="wr-up d2 wr-serif" style="margin-top:18px;font-size:34px">${esc(s.line)}</p>
          <div class="wr-wrap" style="margin-top:28px">${chips}</div>
        </div>
      </div>`;
    },

    food(s, ctx) {
      const stats = s.stats.map((stat, i) => `
        <div class="wr-up" style="${delay(0.15 + i * 0.12)}">
          <p class="wr-num" style="font-size:76px;line-height:.95">${num(stat.value)}</p>
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
        let calendar;
        if (s.heat.cells.length <= 21 && s.heat.days) {
          // Korte periode: een rij ronde dagen met weekdag en datum.
          const n = s.heat.cells.length;
          const size = Math.max(28, Math.min(52, Math.floor(862 / n) - 10));
          calendar = `<div class="wr-row" style="margin-top:22px;gap:10px;align-items:flex-start">${s.heat.cells.map((kind, i) => {
            const day = s.heat.days[i];
            return `<div class="wr-stack wr-cell" style="align-items:center;gap:7px;${delay(0.35 + i * 0.05)}">
              <span style="font-size:13px;color:#ffe9d2">${esc(day.wd)}</span>
              <span style="display:grid;place-items:center;box-sizing:border-box;width:${size}px;height:${size}px;border-radius:50%;${looks[kind]};font-size:${size > 36 ? 16 : 12}px;font-weight:700;color:${kind === "streak" ? "#5a2f12" : "#fff4e6"}">${day.day}</span>
            </div>`;
          }).join("")}</div>`;
        } else {
          // Langere periode: het jaaroverzicht, een kolom per week.
          const total = s.heat.offset + s.heat.cells.length;
          const columns = Math.ceil(total / 7);
          const size = Math.max(8, Math.min(26, Math.floor(856 / columns) - 4));
          const cells = new Array(s.heat.offset).fill('<i style="visibility:hidden"></i>')
            .concat(s.heat.cells.map((kind, i) => `<i class="wr-cell" style="${looks[kind]};${delay(0.35 + Math.floor((i + s.heat.offset) / 7) * 0.02)}"></i>`));
          const width = Math.max(columns * (size + 4) - 4, 300);
          calendar = `<div class="wr-heat" style="margin-top:16px;grid-template-rows:repeat(7,${size}px);grid-auto-columns:${size}px">${cells.join("")}</div>
            <div class="wr-row" style="justify-content:space-between;gap:24px;width:${width}px;margin-top:8px;font-size:13px;color:#ffe9d2"><span>${esc(s.heat.first)}</span><span>${esc(s.heat.last)}</span></div>`;
        }
        card = `
          <div class="wr-abs wr-up d3 wr-card" style="left:64px;right:64px;top:280px;background:#8d5124">
            <div class="wr-row" style="justify-content:space-between">
              <p style="font-size:19px;font-weight:700">${esc(s.title)} in ${ctx.year}</p>
              <div class="wr-row" style="gap:16px;font-size:14px;color:#ffe9d2">
                <span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#d18c4f"></i>Gedaan</span>
                ${s.streak ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:#ffe7b0"></i>Langste reeks</span>' : ""}
                <span class="wr-row" style="gap:6px"><i class="wr-key" style="border:2px solid rgba(255,244,230,.6)"></i>Niet gedaan</span>
                ${s.heat.hasUnknown ? '<span class="wr-row" style="gap:6px"><i class="wr-key" style="background:rgba(255,244,230,.12)"></i>Nog niet bijgehouden</span>' : ""}
              </div>
            </div>
            ${calendar}
            ${s.streak ? `<p style="margin-top:14px;font-size:18px"><strong style="color:#ffe7b0">${s.streak.length} dagen op rij</strong> ${esc(s.title.toLowerCase())}, van ${esc(s.streak.from)} t/m ${esc(s.streak.to)}.</p>` : ""}
          </div>`;
      }
      return `<div class="wr-slide" style="background:#a9642f;color:#fff4e6">
        <div class="wr-abs" style="left:64px;top:96px;right:64px">
          <p class="wr-up wr-eyebrow" style="color:#ffe2bf">Eten</p>
          <div style="display:grid;grid-template-columns:repeat(${Math.max(1, s.stats.length)},minmax(0,1fr));gap:24px;margin-top:14px">${stats}</div>
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

    human(s) {
      const order = s.podium.length >= 3 ? [1, 0, 2] : s.podium.length === 2 ? [1, 0] : [0];
      const heights = [230, 160, 100];
      const colors = [["#a9642f", "#ffffff"], ["#e2c9a8", "#7d4820"], ["#efe2d1", "#7d4820"]];
      const columns = order.map((place, i) => {
        const person = s.podium[place];
        const [bg, fg] = colors[place];
        return `
          <div class="wr-stack" style="flex:1;align-items:center;gap:10px">
            ${place === 0 ? `<span class="wr-pop d6" style="color:#c98a1c">${stroke('<path d="M3 18h18l-1.6-10-5 4.5L12 5l-2.4 7.5-5-4.5z"/>', 34)}</span>` : ""}
            <div class="wr-pop wr-round" style="width:76px;height:76px;display:grid;place-items:center;font-size:32px;font-weight:800;background:${place === 0 ? bg : "#e9dccb"};color:${place === 0 ? "#fff" : "#24170f"};${delay(0.36 + i * 0.12)}">${esc(person.name.charAt(0).toUpperCase())}</div>
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
      const max = Math.max(...s.rows.map((row) => row.amount), 1);
      const rows = s.rows.map((row, i) => `
        <div class="wr-up" style="${delay(0.35 + i * 0.12)}">
          <div class="wr-row" style="justify-content:space-between;align-items:baseline;gap:12px">
            <span style="font-size:20px;font-weight:700">${esc(row.name)}</span>
            <span style="font-size:20px;font-weight:700;color:#c9c2ff">€ ${num(row.amount)}</span>
          </div>
          <div style="margin-top:8px;height:10px;border-radius:99px;background:rgba(255,255,255,.1)">
            <div class="wr-growx" style="height:100%;border-radius:99px;width:${Math.round((row.amount / max) * 100)}%;background:${i === 0 ? "#c9c2ff" : "rgba(201,194,255,.5)"};${delay(0.55 + i * 0.12)}"></div>
          </div>
        </div>`).join("");
      const total = `€ ${num(s.total)}`;
      return `<div class="wr-slide" style="background:#262046">
        <div aria-hidden="true" class="wr-abs wr-pop d5 wr-round" style="left:380px;top:470px;width:220px;height:220px;background:#2f2858"></div>
        <div class="wr-abs" style="left:64px;top:96px;width:450px">
          <p class="wr-up wr-eyebrow" style="color:#c9c2ff">Wat Pip kostte</p>
          <p class="wr-up d1" style="margin-top:16px;font-size:30px;font-weight:600">Jullie gaven ${s.since ? esc(s.since) : "dit jaar"}</p>
          <p class="wr-pop d2 wr-num" style="margin-top:8px;font-size:${fit(total, 124, 450)}px;line-height:.88">${total}</p>
          <p class="wr-up d3 wr-serif" style="margin-top:10px;font-size:40px;color:#c9c2ff">uit aan Pip. Elke cent waard.</p>
          <p class="wr-up d4" style="margin-top:24px;font-size:19px;line-height:1.45;color:rgba(255,255,255,.82)">Dat is ${euro(s.perDay)} per dag.${s.priciest ? ` Duurste maand: ${esc(s.priciest)}.` : ""}</p>
        </div>
        <div class="wr-abs wr-stack" style="left:560px;top:112px;width:400px;gap:14px">
          ${rows}
          <div class="wr-up d7 wr-row" style="justify-content:space-between;gap:12px;margin-top:4px;padding:12px 16px;border-radius:16px;background:#332b5e">
            <span style="font-size:17px;font-weight:600">Apps en servers</span>
            <span style="font-size:17px;font-weight:700;color:#c9c2ff">€ 0, gratis</span>
          </div>
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

  async function loadMusic(songs) {
    music.songs = Array.isArray(songs) ? songs : [];
    const missing = music.songs.filter((song) => !music.urls.has(song.id));
    if (!missing.length) return;
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

  // Het nummer bij een scherm; bij het kattentype het nummer van dat type.
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

  function scale() {
    if (!root) return;
    const s = Math.min(window.innerWidth / 1024, window.innerHeight / 600);
    root.querySelector(".wr-stage").style.transform = `translate(-50%, -50%) scale(${s})`;
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

  function show(index) {
    state.index = index;
    const slide = state.slides[index];
    root.querySelector(".wr-host").innerHTML = slide.html;
    balance(root.querySelector(".wr-host .wr-slide"));
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
    const ctx = { year: data.year, photo: options.photo, portrait: options.portrait };
    state = {
      index: 0,
      playing: true,
      data,
      qr: options.qr || null,
      onClose: options.onClose,
      slides: data.slides.filter((slide) => SLIDES[slide.type]).map((slide) => ({
        type: slide.type,
        variant: slide.name || "",
        html: SLIDES[slide.type](slide, ctx),
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
    setPlaying(true);
    show(0);
    // De fragmenten komen pas als Apple antwoordt; dan het nummer van dit scherm.
    loadMusic(options.music).then(() => {
      if (!state) return;
      music.current = null;
      playSongFor(state.slides[state.index]);
      preloadAfter(state.index);
    });
  }

  function close() {
    if (!root || !state) return;
    const done = state.onClose;
    closeShare();
    stopMusic();
    state = null;
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

  window.PipWrapped = { open, close, isOpen: () => Boolean(state), nowPlaying, months: MONTHS };
})();
