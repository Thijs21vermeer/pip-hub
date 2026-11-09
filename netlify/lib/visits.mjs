// Bezoeken aan de kattenbak opschonen. De bak meldt gewicht en duur los, soms
// dubbel, en ook als er iets anders dan Pip in staat (bijvoorbeeld bij het
// schoonmaken of bijvullen). Een bezoek telt pas als:
//   - het gewicht klopt: minstens 60% van Pips gewone gewicht (en minstens 1 kg);
//   - meldingen die minder dan 5 minuten na elkaar komen zijn één bezoek;
//   - het bezoek samen minstens 15 seconden duurde (als de duur bekend is).
// Gebruikt door het logboek, de teller op de Hub en het jaarlog.

export const MERGE_MS = 5 * 60 * 1000;
export const MIN_SECONDS = 15;
const MIN_SHARE = 0.6;
const MIN_KG = 1;

export function cleanVisits(raw) {
  const events = (raw || []).filter((event) => event && event.at).sort((a, b) => a.at - b.at);
  const weights = events.map((event) => event.weightKg).filter((kg) => kg > 0).sort((a, b) => a - b);
  const usual = weights.length ? weights[Math.floor(weights.length / 2)] : 0;
  const minKg = Math.max(MIN_KG, usual * MIN_SHARE);

  const sessions = [];
  for (const event of events) {
    if (event.weightKg && event.weightKg < minKg) continue; // niet Pip
    const last = sessions[sessions.length - 1];
    if (last && event.at - last.end <= MERGE_MS) {
      last.end = event.at;
      if (event.seconds) last.seconds = (last.seconds || 0) + event.seconds;
      if (event.weightKg) last.weightKg = Math.max(last.weightKg || 0, event.weightKg);
      continue;
    }
    sessions.push({ at: event.at, end: event.at, weightKg: event.weightKg || null, seconds: event.seconds || null });
  }

  return sessions
    .filter((visit) => visit.weightKg && (visit.seconds === null || visit.seconds >= MIN_SECONDS))
    .map(({ at, weightKg, seconds }) => {
      const visit = { at, weightKg };
      if (seconds) visit.seconds = seconds;
      return visit;
    })
    .sort((a, b) => b.at - a.at);
}
