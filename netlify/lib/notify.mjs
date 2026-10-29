// Meldingen op de telefoon via ntfy (gratis app, geen account nodig). Iedereen in
// huis abonneert zich in de app op hetzelfde onderwerp, NTFY_TOPIC. Dat onderwerp
// is lang en willekeurig, want wie het kent kan meelezen. Zonder NTFY_TOPIC: stil.

const TIMEZONE = "Europe/Amsterdam";
// Foto van Pip bij elke melding: op Android als icoontje, op de iPhone als plaatje
// in de melding (daar blijft het icoon het ntfy-logo).
const PHOTO_URL = "https://thijs21vermeer.github.io/pip-hub/pip-icoon.jpg";
const RESET_HOUR = 4; // net als Pip (config.js resetHour): een nieuwe dag begint om 04:00

export async function notify({ title, message, priority = 3 }) {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;
  // JSON in plaats van headers: dan mogen titels ook ë bevatten.
  const response = await fetch("https://ntfy.sh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, title, message, priority, icon: PHOTO_URL, attach: PHOTO_URL, filename: "pip.jpg" }),
  });
  return response.ok;
}

// Tijd in Nederland: { date: "2026-10-29", hour: 22, minute: 3, time: "22:03" }.
export function localTime(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    time: `${parts.hour}:${parts.minute}`,
  };
}

// De "dag" van Pip: iets om 01:00 hoort nog bij gisteren.
export function pipDay(ms) {
  return localTime(ms - RESET_HOUR * 60 * 60 * 1000).date;
}
