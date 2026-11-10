// Fotobattle: elke maand kiezen jullie samen de foto van de maand.
//
// De hele maand stuurt iedereen zijn mooiste foto's van Pip in, hooguit 3 per
// persoon (fotobattle.html, "Jouw foto's"). Op de 1e om 10:00 (de planner,
// herinnering.mjs) gaan de inzendingen van vorige maand de battle in, als er
// minstens 2 baasjes iets instuurden. Iedereen kiest op zijn eigen telefoon steeds
// uit twee (een toernooi), blind: niemand ziet van wie een foto is, en je eigen
// foto's zitten niet in jouw rondjes. Daarna stuurt de telefoon per foto op hoe
// vaak die won. Elke gewonnen keuze is een punt; de foto met de meeste punten van
// iedereen samen wint. Gelijk? Dan die bij de meeste baasjes in de finale stond,
// dan de nieuwste.
//
// De uitslag komt zodra iedereen die kan kiezen gekozen heeft, en anders op de 3e
// om 20:00. Pas dan zie je van wie elke foto is. De maker van de winnaar krijgt 5
// punten in het scoreboard (een vinkje in het jaarlog). De winnaar wordt apart
// bewaard (pip-media "maand/<id>") en komt op de fotolijst van de Hub.
//
// In de blobs (store "pip"):
//   battle-current               id van de laatste battle ("2026-10", of "2026-11-proef")
//   battle/<id>                  { id, month, test?, silent?, photos, makers?, opensAt, closesAt, skipped?, result? }
//   battle/<id>/vote/<naam>      { by, wins: { fotoId: n }, final: [winnaar, tweede], at }
//   entries/<maand>/<naam>       [{ id, at, width, height }]: iemands inzendingen (hooguit 3)
// en in "pip-media": inzending/<id> (de foto's), maand/<id> (de winnaar) en
// maand-list ([{ id, month, at, points, photo, maker }]).

import { randomBytes } from "node:crypto";
import { getStore } from "@netlify/blobs";
import { localTime, notify } from "./notify.mjs";
import { recordBattleWin } from "./history.mjs";

export const MAX_PHOTOS = 16;
export const MAX_PER_PERSON = 3;
export const WIN_POINTS = 5;
const MAX_LIST = 40; // zoveel foto's houdt de fotolijst (fotos.mjs)
const OPEN_HOUR = 10;
const CLOSE_DAY = 3;
const CLOSE_HOUR = 20;
// Tot de 7e (04:00) staat de uitslag nog op Thuis.
const SHOW_UNTIL_DAY = 7;
const PROEF_HOURS = 48;

const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];

function pip() {
  return getStore({ name: "pip", consistency: "strong" });
}
function media() {
  return getStore({ name: "pip-media", consistency: "strong" });
}

export function monthLabel(month) {
  return MONTHS[Number(String(month).slice(5, 7)) - 1] || "";
}

// "2026-11-01" → "2026-10"
export function previousMonth(date) {
  let [year, month] = date.split("-").map(Number);
  month -= 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonth(month) {
  let [year, m] = month.split("-").map(Number);
  m += 1;
  if (m === 13) {
    m = 1;
    year += 1;
  }
  return `${year}-${String(m).padStart(2, "0")}`;
}

// Het moment (ms) waarop het in Nederland `date` om `hour`:00 is, ook rond de zomertijd.
export function amsterdamMs(date, hour) {
  const [y, m, d] = date.split("-").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hour);
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const t = localTime(guess);
    const [ty, tm, td] = t.date.split("-").map(Number);
    guess += wanted - Date.UTC(ty, tm - 1, td, t.hour, t.minute);
  }
  return guess;
}

function weekdayOf(ms) {
  const date = localTime(ms).date;
  return DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function names(list) {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} en ${list[list.length - 1]}`;
}

function personIn(people, name) {
  return (people || []).find((person) => person.toLowerCase() === String(name || "").toLowerCase()) || null;
}

function newId() {
  return Date.now().toString(36) + randomBytes(4).toString("hex");
}

const voteKey = (id, name) => `battle/${id}/vote/${name.toLowerCase()}`;
const entryKey = (month, name) => `entries/${month}/${name.toLowerCase()}`;

async function readBattle(store, id) {
  return id ? store.get(`battle/${id}`, { type: "json" }) : null;
}

async function currentBattle(store) {
  return readBattle(store, await store.get("battle-current", { type: "text" }));
}

async function readVotes(store, battle, people) {
  const votes = [];
  for (const person of people || []) {
    const vote = await store.get(voteKey(battle.id, person), { type: "json" });
    if (vote) votes.push({ ...vote, by: person });
  }
  return votes;
}

async function photoList() {
  const list = await media().get("photos", { type: "json" });
  return Array.isArray(list) ? list : [];
}

// ---- Insturen ----

// De maand waarvoor je nu instuurt: de maand van vandaag (in Nederland).
export function entryMonth(now) {
  return localTime(now).date.slice(0, 7);
}

// Alle inzendingen van een maand: [{ id, by, at, width, height }], nieuwste eerst.
export async function readEntries(month, people) {
  const store = pip();
  const all = [];
  for (const person of people || []) {
    const list = (await store.get(entryKey(month, person), { type: "json" })) || [];
    for (const entry of list) all.push({ ...entry, by: person });
  }
  return all.sort((a, b) => b.at - a.at);
}

export async function submitEntry({ by, bytes, width, height, replace }, people, now = Date.now()) {
  const person = personIn(people, by);
  if (!person) return { error: "BAD_PERSON" };
  const store = pip();
  const month = entryMonth(now);
  let list = (await store.get(entryKey(month, person), { type: "json" })) || [];
  if (replace) {
    if (!list.some((entry) => entry.id === replace)) return { error: "NOT_FOUND" };
    list = list.filter((entry) => entry.id !== replace);
    await media().delete(`inzending/${replace}`);
  }
  if (list.length >= MAX_PER_PERSON) return { error: "FULL" };
  const entry = { id: newId(), at: now, width: width || null, height: height || null };
  await media().set(`inzending/${entry.id}`, bytes);
  await store.setJSON(entryKey(month, person), [...list, entry]);
  return { entry };
}

export async function removeEntry(id, by, people, now = Date.now()) {
  const person = personIn(people, by);
  if (!person) return { error: "BAD_PERSON" };
  const store = pip();
  const month = entryMonth(now);
  const list = (await store.get(entryKey(month, person), { type: "json" })) || [];
  if (!list.some((entry) => entry.id === id)) return { error: "NOT_FOUND" };
  await store.setJSON(entryKey(month, person), list.filter((entry) => entry.id !== id));
  await media().delete(`inzending/${id}`);
  return { ok: true };
}

// Een foto uit de battle: een inzending, of (een oude proef) een foto van de fotolijst.
export async function battlePhoto(id) {
  const store = media();
  return (await store.get(`inzending/${id}`, { type: "arrayBuffer" })) || store.get(`foto/${id}`, { type: "arrayBuffer" });
}

// ---- Openen ----

// De foto's van een maand op de fotolijst (voor een proef zonder inzendingen).
export function photosOfMonth(list, month) {
  return list
    .filter((photo) => photo && photo.id && localTime(photo.at).date.slice(0, 7) === month)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PHOTOS)
    .map((photo) => photo.id);
}

// Inzendingen van een maand als battle: { photos, makers, meta } of null als het
// er te weinig zijn (minder dan 2 foto's, of maar van één baasje).
async function entriesForBattle(month, people) {
  const entries = (await readEntries(month, people)).slice(0, MAX_PHOTOS);
  const makers = new Set(entries.map((entry) => entry.by));
  if (entries.length < 2 || makers.size < 2) return null;
  return {
    photos: entries.map((entry) => entry.id),
    makers: Object.fromEntries(entries.map((entry) => [entry.id, entry.by])),
    meta: Object.fromEntries(entries.map((entry) => [entry.id, { at: entry.at, width: entry.width, height: entry.height }])),
  };
}

async function openBattle(store, battle, people, { fromList = false } = {}) {
  let content = await entriesForBattle(battle.month, people);
  if (!content && fromList) {
    const photos = photosOfMonth(await photoList(), battle.month);
    if (photos.length >= 2) content = { photos };
  }
  if (!content) {
    await store.setJSON(`battle/${battle.id}`, { ...battle, photos: [], skipped: true });
    await store.set("battle-current", battle.id);
    return null;
  }
  const full = { ...battle, ...content };
  await store.setJSON(`battle/${battle.id}`, full);
  await store.set("battle-current", battle.id);
  if (battle.silent) return full; // stille proef: geen melding
  const label = monthLabel(battle.month);
  await notify({
    title: `Fotobattle van ${label}`,
    message: `${full.photos.length} foto's van Pip strijden om de titel foto van de maand. Kiezen kan tot ${weekdayOf(full.closesAt)} ${localTime(full.closesAt).time}.`,
    url: "fotobattle.html",
  }).catch(() => false);
  return full;
}

// ---- Kiezen en tellen ----

// Wie mag kiezen: iedereen die minstens 2 foto's van anderen kan zien.
export function voters(battle, people) {
  const makers = battle.makers || {};
  return (people || []).filter((person) => battle.photos.filter((id) => makers[id] !== person).length >= 2);
}

// Punten en winnaar. Alleen foto's die er nog zijn (`exists`) kunnen winnen.
export function tally(battle, votes, exists = () => true) {
  const points = Object.fromEntries(battle.photos.map((id) => [id, 0]));
  for (const vote of votes) {
    for (const [id, n] of Object.entries(vote.wins || {})) if (id in points) points[id] += n;
  }
  const finalists = (id) => votes.filter((vote) => (vote.final || []).includes(id)).length;
  const order = battle.photos.slice().sort((a, b) =>
    points[b] - points[a] || finalists(b) - finalists(a) || battle.photos.indexOf(a) - battle.photos.indexOf(b));
  const ranked = order.filter((id) => exists(id));
  const winner = votes.length && ranked.length ? ranked[0] : null;
  const finals = Object.fromEntries(votes.map((vote) => [vote.by, vote.final]));
  return {
    winner,
    points,
    top: ranked.slice(0, 3).map((id) => ({ id, points: points[id] })),
    finals,
    chosenBy: winner ? votes.filter((vote) => vote.final[0] === winner).map((vote) => vote.by) : [],
    voters: votes.map((vote) => vote.by),
  };
}

async function closeBattle(store, battle, people, now) {
  const votes = await readVotes(store, battle, people);
  const mediaStore = media();
  const exists = new Set();
  for (const id of battle.photos) if (await battlePhoto(id)) exists.add(id);
  const result = { at: now, ...tally(battle, votes, (id) => exists.has(id)) };
  const makers = battle.makers || {};
  result.makers = makers;
  result.maker = result.winner ? personIn(people, makers[result.winner]) : null;
  result.bonus = result.maker && !battle.test ? WIN_POINTS : 0;
  const closed = { ...battle, result };
  await store.setJSON(`battle/${battle.id}`, closed);
  if (!result.winner) return closed;

  // De winnaar apart bewaren: dan blijft hij, ook als de inzending opgeruimd wordt.
  const bytes = await battlePhoto(result.winner);
  if (bytes) await mediaStore.set(`maand/${battle.id}`, bytes);
  const label = monthLabel(battle.month);
  if (!battle.test) {
    if (result.bonus) await recordBattleWin(result.maker, label, now).catch(() => {});
    // Op de fotolijst van de Hub (als die nog niet vol is).
    let listPhoto = null;
    const list = await photoList();
    if (bytes && !list.some((photo) => photo.id === result.winner) && list.length < MAX_LIST) {
      const meta = (battle.meta || {})[result.winner] || {};
      listPhoto = { id: newId(), at: now, width: meta.width || null, height: meta.height || null };
      await mediaStore.set(`foto/${listPhoto.id}`, bytes);
      await mediaStore.setJSON("photos", [...list, listPhoto]);
    }
    const months = ((await mediaStore.get("maand-list", { type: "json" })) || []).filter((item) => item.id !== battle.id);
    months.push({
      id: battle.id,
      month: battle.month,
      at: now,
      points: result.points[result.winner],
      photo: listPhoto ? listPhoto.id : list.some((photo) => photo.id === result.winner) ? result.winner : null,
      maker: result.maker,
    });
    months.sort((a, b) => a.month.localeCompare(b.month));
    await mediaStore.setJSON("maand-list", months);
  }
  if (battle.silent) return closed;
  const pts = result.points[result.winner];
  const message = result.maker
    ? `${result.maker} maakte de foto van de maand${result.bonus ? ` en krijgt er ${result.bonus} punten voor` : ""}.`
    : `De winnaar is bekend: ${pts} ${pts === 1 ? "punt" : "punten"}.${result.chosenBy.length ? ` ${names(result.chosenBy)} ${result.chosenBy.length === 1 ? "koos" : "kozen"} hem als leukste.` : ""}`;
  await notify({ title: `Foto van ${label}`, message, url: "fotobattle.html" }).catch(() => false);
  return closed;
}

// Openen op de 1e (of de 2e, als de planner de 1e miste) en sluiten na de tijd.
// Doet niets als er niets te doen is; de planner roept dit elke 5 minuten aan.
export async function tickBattle(people, now = Date.now()) {
  const store = pip();
  const here = localTime(now);
  const day = Number(here.date.slice(8, 10));
  if ((day === 1 && here.hour >= OPEN_HOUR) || day === 2) {
    const month = previousMonth(here.date);
    if (!(await readBattle(store, month))) {
      await openBattle(store, {
        id: month,
        month,
        opensAt: now,
        closesAt: amsterdamMs(`${here.date.slice(0, 8)}0${CLOSE_DAY}`, CLOSE_HOUR),
      }, people);
    }
  }
  const battle = await currentBattle(store);
  if (battle && !battle.skipped && !battle.result && now >= battle.closesAt) {
    return closeBattle(store, battle, people, now);
  }
  return battle;
}

// Een proefbattle met de inzendingen van deze maand (of, zijn die er niet, de
// foto's van deze maand op de fotolijst), 48 uur open. Telt niet mee: geen punten,
// geen foto van de maand, en de echte battle van deze maand komt gewoon.
// silent: zonder meldingen (niet bij het openen, niet bij de uitslag).
export async function startProef(people, now = Date.now(), { silent = false } = {}) {
  const store = pip();
  const battle = await currentBattle(store);
  if (battle && !battle.skipped && !battle.result) return { error: "ALREADY_OPEN" };
  const month = entryMonth(now);
  const opened = await openBattle(store, {
    id: `${month}-proef`,
    month,
    test: true,
    ...(silent ? { silent: true } : {}),
    opensAt: now,
    closesAt: now + PROEF_HOURS * 60 * 60 * 1000,
  }, people, { fromList: true });
  return opened ? { battle: opened } : { error: "TOO_FEW_PHOTOS" };
}

export async function castVote(body, people, now = Date.now()) {
  const store = pip();
  const battle = await currentBattle(store);
  if (!battle || battle.skipped || battle.result || now >= battle.closesAt) return { error: "CLOSED" };
  if (body.id !== battle.id) return { error: "CLOSED" };
  const by = personIn(people, body.by);
  if (!by) return { error: "BAD_PERSON" };
  const makers = battle.makers || {};
  const wins = body.wins && typeof body.wins === "object" ? body.wins : null;
  const ids = wins ? Object.keys(wins) : [];
  const final = Array.isArray(body.final) ? body.final : [];
  const valid =
    ids.length >= 2 &&
    ids.every((id) => battle.photos.includes(id) && makers[id] !== by && Number.isInteger(wins[id]) && wins[id] >= 0 && wins[id] <= MAX_PHOTOS) &&
    ids.reduce((sum, id) => sum + wins[id], 0) === ids.length - 1 &&
    final.length === 2 &&
    final[0] !== final[1] &&
    final.every((id) => ids.includes(id)) &&
    wins[final[0]] === Math.max(...ids.map((id) => wins[id]));
  if (!valid) return { error: "BAD_VOTE" };
  await store.setJSON(voteKey(battle.id, by), { by, wins: Object.fromEntries(ids.map((id) => [id, wins[id]])), final, at: now });
  // Iedereen die kan kiezen gekozen? Dan meteen de uitslag.
  const votes = await readVotes(store, battle, people);
  const done = new Set(votes.map((vote) => vote.by));
  if (voters(battle, people).every((person) => done.has(person))) await closeBattle(store, battle, people, now);
  return { ok: true };
}

// ---- Wat de telefoon en de Hub zien ----

async function entrySummary(people, me, now) {
  const month = entryMonth(now);
  const entries = await readEntries(month, people);
  const mine = personIn(people, me);
  const end = amsterdamMs(`${nextMonth(month)}-01`, 0);
  return {
    month,
    label: monthLabel(month),
    until: end,
    untilText: `${new Date(end - 12 * 3600 * 1000).getUTCDate()} ${monthLabel(month)}`,
    startsText: `1 ${monthLabel(nextMonth(month))}`,
    count: entries.length,
    senders: [...new Set(entries.map((entry) => entry.by))],
    mine: mine ? entries.filter((entry) => entry.by === mine).map(({ by, ...entry }) => entry).sort((a, b) => a.at - b.at) : [],
    max: MAX_PER_PERSON,
  };
}

export async function battleSummary(people, me, now = Date.now()) {
  const battle = await tickBattle(people, now).catch(() => null);
  const winners = (await media().get("maand-list", { type: "json" })) || [];
  const months = winners.map((item) => ({ ...item, label: monthLabel(item.month) }));
  const entry = await entrySummary(people, me, now);
  if (!battle || battle.skipped) return { current: null, winners: months, entry };
  const showUntil = amsterdamMs(`${nextMonth(battle.month)}-0${SHOW_UNTIL_DAY}`, 4);
  const until = battle.test ? battle.closesAt + 24 * 60 * 60 * 1000 : showUntil;
  if (battle.result && now >= Math.max(until, battle.result.at + 24 * 60 * 60 * 1000)) return { current: null, winners: months, entry };

  const store = pip();
  const list = await photoList();
  const listMeta = new Map(list.map((photo) => [photo.id, photo]));
  const meta = battle.meta || {};
  const votes = battle.result ? [] : await readVotes(store, battle, people);
  const mine = personIn(people, me);
  const myVote = mine && !battle.result ? votes.find((vote) => vote.by === mine) : null;
  const makers = battle.makers || {};
  const photos = battle.photos
    .map((id) => {
      const info = meta[id] || listMeta.get(id);
      return info ? { id, width: info.width || null, height: info.height || null, at: info.at } : null;
    })
    .filter(Boolean);
  return {
    current: {
      id: battle.id,
      month: battle.month,
      label: monthLabel(battle.month),
      test: Boolean(battle.test),
      closesAt: battle.closesAt,
      closesText: `${weekdayOf(battle.closesAt)} ${localTime(battle.closesAt).time}`,
      photos,
      // Alleen je eigen foto's: die zitten niet in jouw rondjes. Van wie de rest is
      // zie je pas bij de uitslag.
      own: mine ? battle.photos.filter((id) => makers[id] === mine) : [],
      people: people || [],
      canVote: battle.result ? [] : voters(battle, people),
      voted: battle.result ? battle.result.voters : votes.map((vote) => vote.by),
      mine: myVote ? myVote.final[0] : (mine && battle.result && battle.result.finals[mine] ? battle.result.finals[mine][0] : null),
      result: battle.result ? { ...battle.result, kept: `maand/${battle.id}` } : null,
    },
    winners: months,
    entry,
  };
}

export async function keptPhoto(id) {
  return media().get(`maand/${id}`, { type: "arrayBuffer" });
}
