// Bezoeken aan de kattenbak opschonen. De bak meldt gewicht en duur los, soms
// dubbel, en ook als er iets anders dan Pip in staat (bijvoorbeeld bij het
// schoonmaken of bijvullen). Een bezoek telt pas als:
//   - het gewicht klopt: minstens 60% van Pips gewone gewicht (en minstens 1 kg),
//     en hooguit 40% meer (iemand die de bak schoonmaakt woog 7,1 kg);
//   - meldingen die minder dan 5 minuten na elkaar komen zijn één bezoek;
//   - het bezoek samen minstens 15 seconden duurde (als de duur bekend is).
// Gebruikt door het logboek, de teller op de Hub en het jaarlog.

export const MERGE_MS = 5 * 60 * 1000;
export const MIN_SECONDS = 15;
const MIN_SHARE = 0.6;
const MAX_SHARE = 1.4;
const MIN_KG = 1;
// Wat een kat kan wegen; daarbuiten telt het niet mee voor Pips gewone gewicht.
const CAT_KG = [1, 12];

// Pips gewone gewicht: het middelste van de metingen (een paar uitschieters, zoals
// iemand die schoonmaakt, maken dan niets uit). 0 als er niets gewogen is.
export function usualWeight(raw) {
  const weights = (raw || []).map((event) => event && event.weightKg)
    .filter((kg) => kg >= CAT_KG[0] && kg <= CAT_KG[1]).sort((a, b) => a - b);
  return weights.length ? weights[Math.floor(weights.length / 2)] : 0;
}

// usualKg: Pips gewone gewicht van de afgelopen dagen (jaarlog.mjs bewaart het),
// zodat een schoonmaakbeurt vroeg op de dag niet het gewone gewicht wordt.
export function cleanVisits(raw, { usualKg = 0 } = {}) {
  const events = (raw || []).filter((event) => event && event.at).sort((a, b) => a.at - b.at);
  const usual = usualKg > 0 ? usualKg : usualWeight(events);
  const minKg = Math.max(MIN_KG, usual * MIN_SHARE);
  const maxKg = usual > 0 ? usual * MAX_SHARE : Infinity;

  const sessions = [];
  for (const event of events) {
    if (event.weightKg && (event.weightKg < minKg || event.weightKg > maxKg)) continue; // niet Pip
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
