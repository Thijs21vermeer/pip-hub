// Welke taken nu open staan, voor de telefoonpagina's (thuisscherm). Zelfde regels
// als op de Google Hub (app.js): een dag begint om resetHour (04:00), een weektaak
// loopt van maandag tot en met zondag, met een vaste dag telt de dag ervoor ook mee.
(function (root) {
  "use strict";

  const REPEATS = {
    daily: { when: "vandaag" },
    weekly: { when: "deze week", days: "week" },
    biweekly: { when: "deze twee weken", days: "week" },
    monthly: { when: "deze maand", days: "month" },
    quarterly: { when: "dit kwartaal", days: "month" },
  };
  const MAX_MONTH_DAY = 28;

  function mod(value, by) {
    return ((value % by) + by) % by;
  }

  function shifted(date, resetHour) {
    return new Date(date.getTime() - resetHour * 3600 * 1000);
  }

  function dayNumber(date, resetHour) {
    const d = shifted(date, resetHour);
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  }

  function weekdayOf(day) {
    return mod(day + 4, 7);
  }

  function repeatOf(task) {
    return REPEATS[task.repeat] ? task.repeat : "daily";
  }

  function dayOf(task) {
    const kind = REPEATS[repeatOf(task)].days;
    const day = task.day;
    if (!Number.isInteger(day)) return null;
    if (kind === "week") return day >= 0 && day <= 6 ? day : null;
    if (kind === "month") return day >= 1 && day <= MAX_MONTH_DAY ? day : null;
    return null;
  }

  function periodStart(task, date, resetHour) {
    const repeat = repeatOf(task);
    const day = dayOf(task);
    const today = dayNumber(date, resetHour);
    if (repeat === "daily") return today;
    if (repeat === "weekly" || repeat === "biweekly") {
      const weekday = day === null ? 1 : day;
      const anchor = repeat === "biweekly" && day !== null && Number.isInteger(task.from)
        ? task.from + mod(weekday - weekdayOf(task.from), 7)
        : weekday - 4;
      return today - mod(today - anchor, repeat === "weekly" ? 7 : 14);
    }
    const d = shifted(date, resetHour);
    const first = day || 1;
    let month = d.getMonth() - (d.getDate() < first ? 1 : 0);
    if (repeat === "quarterly") month -= mod(month, 3);
    return Math.floor(Date.UTC(d.getFullYear(), month, first) / 86400000);
  }


  // Nog niet aan de beurt (een vaste dag die nog moet komen)?
  function upcoming(task, now, resetHour) {
    if (dayOf(task) === null || !Number.isInteger(task.from)) return false;
    const start = periodStart(task, now, resetHour);
    return start < task.from;
  }

  // Het vinkje van deze periode, of null.
  function currentDone(task, done, now, resetHour) {
    const entry = done && done[task.id];
    if (!entry) return null;
    const start = periodStart(task, now, resetHour) - (dayOf(task) === null ? 0 : 1);
    return dayNumber(new Date(entry.at), resetHour) >= start ? entry : null;
  }

  // Spelen met Pip (play: true): zo vaak als je wilt. Alle keren van vandaag.
  function playToday(play, now = new Date(), resetHour = 4) {
    const today = dayNumber(now, resetHour);
    const sessions = play && Array.isArray(play.sessions) ? play.sessions : [];
    return sessions.filter((session) => dayNumber(new Date(session.at), resetHour) === today);
  }

  // Alle taken die nu meetellen, met per taak het vinkje (of null). Spelen telt
  // als gedaan zodra iemand vandaag speelde (de laatste keer).
  function status(tasks, done, now = new Date(), resetHour = 4, play = null) {
    const played = playToday(play, now, resetHour);
    return tasks
      .filter((task) => !upcoming(task, now, resetHour))
      .map((task) => ({
        task,
        done: task.play ? played[played.length - 1] || null : currentDone(task, done, now, resetHour),
        when: REPEATS[repeatOf(task)].when,
      }));
  }

  root.PipTasks = { status, repeatOf, playToday };
})(typeof window !== "undefined" ? window : globalThis);
