// Fotobattle: elke maand kiezen jullie samen de foto van de maand.
//
// Op de 1e om 10:00 (de planner, herinnering.mjs) gaan de foto's die vorige maand
// op de fotolijst kwamen de battle in: hooguit 16, de nieuwste. Iedereen kiest op
// zijn eigen telefoon steeds uit twee (een toernooi, fotobattle.html) en stuurt
// daarna per foto op hoe vaak die won. Elke gewonnen keuze is een punt; de foto
// met de meeste punten van iedereen samen wint. Gelijk? Dan die bij de meeste
// baasjes in de finale stond, dan die het vaakst won, dan de nieuwste.
//
// De uitslag komt zodra iedereen gekozen heeft, en anders op de 3e om 20:00. De
// winnaar wordt apart bewaard (pip-media "maand/<id>"), zodat hij blijft als de
// foto later van de fotolijst gaat.
//
// In de blobs (store "pip"):
//   battle-current               id van de laatste battle ("2026-10", of "2026-11-proef")
//   battle/<id>                  { id, month, test?, photos, opensAt, closesAt, skipped?, result? }
//   battle/<id>/vote/<naam>      { by, wins: { fotoId: n }, final: [winnaar, tweede], at }
// en in "pip-media": maand/<id> (de foto) en maand-list ([{ id, month, at, points, photo }]).

import { getStore } from "@netlify/blobs";
import { localTime, notify } from "./notify.mjs";

export const MAX_PHOTOS = 16;
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

const voteKey = (id, name) => `battle/${id}/vote/${name.toLowerCase()}`;

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

// De foto's van een maand (op tijd van toevoegen), nieuwste eerst, hooguit 16.
export function photosOfMonth(list, month) {
  return list
    .filter((photo) => photo && photo.id && localTime(photo.at).date.slice(0, 7) === month)
    .sort((a, b) => b.at - a.at)
    .slice(0, MAX_PHOTOS)
    .map((photo) => photo.id);
}

async function openBattle(store, battle) {
  const photos = photosOfMonth(await photoList(), battle.month);
  if (photos.length < 2) {
    await store.setJSON(`battle/${battle.id}`, { ...battle, photos, skipped: true });
    await store.set("battle-current", battle.id);
    return null;
  }
  const full = { ...battle, photos };
  await store.setJSON(`battle/${battle.id}`, full);
  await store.set("battle-current", battle.id);
  const label = monthLabel(battle.month);
  if (battle.silent) return full; // stille proef: geen melding
  await notify({
    title: `Fotobattle van ${label}`,
    message: `${photos.length} foto's van Pip strijden om de titel foto van de maand. Kiezen kan tot ${weekdayOf(full.closesAt)} ${localTime(full.closesAt).time}.`,
    url: "fotobattle.html",
  }).catch(() => false);
  return full;
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
  const existing = new Set((await photoList()).map((photo) => photo.id));
  const result = { at: now, ...tally(battle, votes, (id) => existing.has(id)) };
  const closed = { ...battle, result };
  await store.setJSON(`battle/${battle.id}`, closed);
  if (!result.winner) return closed;

  // De winnaar apart bewaren: dan blijft hij, ook als de foto van de fotolijst gaat.
  const bytes = await mediaStore.get(`foto/${result.winner}`, { type: "arrayBuffer" });
  if (bytes) await mediaStore.set(`maand/${battle.id}`, bytes);
  if (!battle.test) {
    const list = ((await mediaStore.get("maand-list", { type: "json" })) || []).filter((item) => item.id !== battle.id);
    list.push({ id: battle.id, month: battle.month, at: now, points: result.points[result.winner], photo: result.winner });
    list.sort((a, b) => a.month.localeCompare(b.month));
    await mediaStore.setJSON("maand-list", list);
  }
  if (battle.silent) return closed;
  const label = monthLabel(battle.month);
  const pts = result.points[result.winner];
  await notify({
    title: `Foto van ${label}`,
    message: `De winnaar is bekend: ${pts} ${pts === 1 ? "punt" : "punten"}.${result.chosenBy.length ? ` ${names(result.chosenBy)} ${result.chosenBy.length === 1 ? "koos" : "kozen"} hem als leukste.` : ""}`,
    url: "fotobattle.html",
  }).catch(() => false);
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
      });
    }
  }
  const battle = await currentBattle(store);
  if (battle && !battle.skipped && !battle.result && now >= battle.closesAt) {
    return closeBattle(store, battle, people, now);
  }
  return battle;
}

// Een proefbattle met de foto's van deze maand tot nu toe, 48 uur open. Telt niet
// mee voor de foto's van de maand (en de echte battle van deze maand komt gewoon).
// silent: zonder meldingen (niet bij het openen, niet bij de uitslag).
export async function startProef(now = Date.now(), { silent = false } = {}) {
  const store = pip();
  const battle = await currentBattle(store);
  if (battle && !battle.skipped && !battle.result) return { error: "ALREADY_OPEN" };
  const month = localTime(now).date.slice(0, 7);
  const opened = await openBattle(store, {
    id: `${month}-proef`,
    month,
    test: true,
    ...(silent ? { silent: true } : {}),
    opensAt: now,
    closesAt: now + PROEF_HOURS * 60 * 60 * 1000,
  });
  return opened ? { battle: opened } : { error: "TOO_FEW_PHOTOS" };
}

export async function castVote(body, people, now = Date.now()) {
  const store = pip();
  const battle = await currentBattle(store);
  if (!battle || battle.skipped || battle.result || now >= battle.closesAt) return { error: "CLOSED" };
  if (body.id !== battle.id) return { error: "CLOSED" };
  const by = personIn(people, body.by);
  if (!by) return { error: "BAD_PERSON" };
  const wins = body.wins && typeof body.wins === "object" ? body.wins : null;
  const ids = wins ? Object.keys(wins) : [];
  const final = Array.isArray(body.final) ? body.final : [];
  const valid =
    ids.length >= 2 &&
    ids.every((id) => battle.photos.includes(id) && Number.isInteger(wins[id]) && wins[id] >= 0 && wins[id] <= MAX_PHOTOS) &&
    ids.reduce((sum, id) => sum + wins[id], 0) === ids.length - 1 &&
    final.length === 2 &&
    final[0] !== final[1] &&
    final.every((id) => ids.includes(id)) &&
    wins[final[0]] === Math.max(...ids.map((id) => wins[id]));
  if (!valid) return { error: "BAD_VOTE" };
  await store.setJSON(voteKey(battle.id, by), { by, wins: Object.fromEntries(ids.map((id) => [id, wins[id]])), final, at: now });
  // Iedereen gekozen? Dan meteen de uitslag.
  const votes = await readVotes(store, battle, people);
  if (votes.length >= (people || []).length) await closeBattle(store, battle, people, now);
  return { ok: true };
}

// Wat Thuis, de fotobattle-pagina en de Hub nodig hebben.
export async function battleSummary(people, me, now = Date.now()) {
  const battle = await tickBattle(people, now).catch(() => null);
  const winners = (await media().get("maand-list", { type: "json" })) || [];
  const months = winners.map((item) => ({ ...item, label: monthLabel(item.month) }));
  if (!battle || battle.skipped) return { current: null, winners: months };
  const showUntil = amsterdamMs(`${nextMonth(battle.month)}-0${SHOW_UNTIL_DAY}`, 4);
  const until = battle.test ? battle.closesAt + 24 * 60 * 60 * 1000 : showUntil;
  if (battle.result && now >= Math.max(until, battle.result.at + 24 * 60 * 60 * 1000)) return { current: null, winners: months };

  const store = pip();
  const list = await photoList();
  const byId = new Map(list.map((photo) => [photo.id, photo]));
  const votes = battle.result ? [] : await readVotes(store, battle, people);
  const mine = personIn(people, me);
  const myVote = mine && !battle.result ? votes.find((vote) => vote.by === mine) : null;
  return {
    current: {
      id: battle.id,
      month: battle.month,
      label: monthLabel(battle.month),
      test: Boolean(battle.test),
      closesAt: battle.closesAt,
      closesText: `${weekdayOf(battle.closesAt)} ${localTime(battle.closesAt).time}`,
      photos: battle.photos.filter((id) => byId.has(id)).map((id) => {
        const { width, height, at } = byId.get(id);
        return { id, width, height, at };
      }),
      people: people || [],
      voted: battle.result ? battle.result.voters : votes.map((vote) => vote.by),
      mine: myVote ? myVote.final[0] : (mine && battle.result && battle.result.finals[mine] ? battle.result.finals[mine][0] : null),
      result: battle.result ? { ...battle.result, kept: `maand/${battle.id}` } : null,
    },
    winners: months,
  };
}

export async function keptPhoto(id) {
  return media().get(`maand/${id}`, { type: "arrayBuffer" });
}
