import { daysBetween, toDate } from './format.js';
import { WATERING_TYPES } from './domain.js';
import { isWaterMedium } from '../data/model.js';

/** Substrate readings that mean "there was still water in there". */
const MOIST = new Set(['slightlyMoist', 'moist', 'wet']);
/** Readings that mean the plant is ready for water now. */
const DRY = new Set(['dry', 'mostlyDry']);

export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/**
 * Everything the UI needs to know about one plant's history.
 * `events` must be this plant's events, newest first.
 */
export function plantStats(plant, events = []) {
  const now = new Date();
  const byType = (t) => events.filter((e) => e.type === t);

  const waterings = events
    .filter((e) => WATERING_TYPES.includes(e.type))
    .map((e) => ({ ...e, date: toDate(e.at) }))
    .filter((e) => e.date);

  const checks = byType('check')
    .map((e) => ({ ...e, date: toDate(e.at) }))
    .filter((e) => e.date);

  // Intervals between consecutive waterings, oldest → newest.
  const asc = [...waterings].reverse();
  const intervals = [];
  for (let i = 1; i < asc.length; i++) {
    const d = daysBetween(asc[i - 1].date, asc[i].date);
    if (d != null && d > 0 && d < 400) intervals.push(d);
  }

  const lastWater = waterings[0] || null;
  const lastCheck = checks[0] || null;
  const lastFert = byType('fertilize')[0] || null;
  const lastGrowth = byType('growth')[0] || null;
  const lastRepot = [...byType('repot'), ...byType('soilChange')].sort(
    (a, b) => toDate(b.at) - toDate(a.at),
  )[0] || null;
  const lastEvent = events[0] || null;

  // --- the check window -------------------------------------------------
  // With enough of this plant's own history the window comes from the data;
  // until then it is the rule the user set. `windowSource` is surfaced in the
  // UI so a reminder is never an unexplained number.
  const configured = [plant.care.checkMinDays, plant.care.checkMaxDays];
  const med = intervals.length >= 4 ? median(intervals) : null;
  const windowSource = med ? 'history' : 'setting';
  let [minDays, maxDays] = med
    ? [Math.max(1, Math.round(med * 0.8)), Math.max(2, Math.round(med * 1.3))]
    : configured;
  if (maxDays <= minDays) maxDays = minDays + 1;

  // Looking at a plant is care, and it moves the clock — whatever it found.
  //
  // This used to require a substrate reading, so a check recorded without one
  // counted for nothing: the plant read as though it had never been touched and
  // stayed on the list the owner had just cleared by hand. What the reading
  // changes is the verdict, not whether the check happened at all.
  const checkedSince =
    lastCheck && (!lastWater || lastCheck.date > lastWater.date) ? lastCheck : null;
  const checkedSoil = checkedSince?.data?.soil;
  // Found dry and not watered: it needs water now, so say so rather than
  // restarting the clock on the strength of having looked.
  const dryCheck = checkedSince && DRY.has(checkedSoil) ? checkedSince : null;
  // Found moist, or not described — someone who found it dry would have watered
  // it, so an unqualified check is treated as "not ready yet".
  const restingCheck = checkedSince && !dryCheck ? checkedSince : null;

  const anchor = restingCheck ? restingCheck.date : lastWater ? lastWater.date : dryCheck ? dryCheck.date : null;
  const win = restingCheck
    ? [Math.max(2, Math.round(minDays * 0.45)), Math.max(3, Math.round(minDays * 0.8))]
    : [minDays, maxDays];

  const daysSinceWater = lastWater ? daysBetween(lastWater.date, now) : null;
  const daysSinceAnchor = anchor ? daysBetween(anchor, now) : null;

  let state = 'unknown';
  if (dryCheck) {
    state = 'due';
  } else if (anchor != null && daysSinceAnchor != null) {
    if (daysSinceAnchor >= win[1]) state = 'due';
    else if (daysSinceAnchor >= win[0]) state = 'check';
    else state = 'fine';
  }
  const daysToNext = daysSinceAnchor == null ? null : win[0] - daysSinceAnchor;

  // --- health issues ----------------------------------------------------
  const updates = byType('healthUpdate');
  const issues = byType('health').map((e) => {
    const thread = updates
      .filter((u) => u.ref === e.id)
      .sort((a, b) => toDate(a.at) - toDate(b.at));
    const closing = thread.find((u) => u.data?.outcome === 'resolved');
    const resolvedAt = e.data?.resolvedAt ? toDate(e.data.resolvedAt) : closing ? toDate(closing.at) : null;
    return {
      ...e,
      startedAt: toDate(e.data?.startedAt || e.at),
      updates: thread,
      resolvedAt,
      open: !resolvedAt,
      openDays: daysBetween(toDate(e.data?.startedAt || e.at), resolvedAt || now),
    };
  });
  const openIssues = issues.filter((i) => i.open);

  // --- growth -----------------------------------------------------------
  const growth = byType('growth')
    .map((e) => ({ id: e.id, date: toDate(e.at), values: e.data?.values || {}, note: e.note }))
    .filter((g) => g.date)
    .sort((a, b) => a.date - b.date);

  const series = {};
  for (const g of growth) {
    for (const [k, v] of Object.entries(g.values)) {
      if (v == null || v === '' || Number.isNaN(Number(v))) continue;
      (series[k] ||= []).push({ date: g.date, value: Number(v) });
    }
  }

  // --- photos -----------------------------------------------------------
  const photos = events
    .flatMap((e) => (e.photos || []).map((p) => ({ ...p, at: toDate(e.at), eventId: e.id, type: e.type })))
    .filter((p) => p.at)
    .sort((a, b) => b.at - a.at);

  // --- propagation ------------------------------------------------------
  const takenAt =
    toDate(plant.propagation?.startedAt) || toDate(byType('cuttingTaken').slice(-1)[0]?.at) || null;
  const rootedEv = byType('rooted').slice(-1)[0] || null;
  const pottedEv = byType('potted').slice(-1)[0] || null;
  const propagation = {
    takenAt,
    rootedAt: toDate(rootedEv?.at) || null,
    pottedAt: toDate(pottedEv?.at) || null,
    daysToRoot: takenAt && rootedEv ? daysBetween(takenAt, toDate(rootedEv.at)) : null,
    daysRooting: takenAt && !rootedEv ? daysBetween(takenAt, now) : null,
    method: plant.propagation?.method || null,
    outcome: plant.propagation?.outcome || (pottedEv ? 'potted' : rootedEv ? 'rooted' : 'inProgress'),
  };

  const moistStreak = (() => {
    let n = 0;
    for (const c of checks) {
      if (MOIST.has(c.data?.soil)) n++;
      else break;
    }
    return n;
  })();

  return {
    events,
    count: events.length,
    waterings,
    waterCount: waterings.length,
    intervals,
    avgInterval: intervals.length ? Math.round(mean(intervals) * 10) / 10 : null,
    medianInterval: med ? Math.round(med * 10) / 10 : null,
    recentInterval: intervals.length >= 3 ? Math.round(median(intervals.slice(-3)) * 10) / 10 : null,
    windowSource,
    window: win,
    lastCheckSoil: checkedSoil || null,
    configuredWindow: configured,
    lastWater,
    lastCheck,
    lastFert,
    lastGrowth,
    lastRepot,
    lastEvent,
    lastTouch: lastEvent ? toDate(lastEvent.at) : null,
    daysSinceWater,
    daysSinceAnchor,
    daysSinceFert: lastFert ? daysBetween(toDate(lastFert.at), now) : null,
    daysSinceGrowth: lastGrowth ? daysBetween(toDate(lastGrowth.at), now) : null,
    daysSinceTouch: lastEvent ? daysBetween(toDate(lastEvent.at), now) : null,
    daysToNext,
    state,
    isWater: isWaterMedium(plant),
    issues,
    openIssues,
    moistStreak,
    growth,
    series,
    photos,
    propagation,
  };
}

/**
 * How loudly a plant should ask for attention on the home screen.
 * Higher score = shown first. Returns null when nothing is needed.
 */
export function attentionOf(plant, s, t) {
  if (plant.status !== 'active') return null;
  const reasons = [];
  let score = 0;

  if (s.openIssues.length) {
    score += 60;
    reasons.push({ key: 'openIssue', tone: 'red' });
  }
  if (s.state === 'due') {
    score += s.isWater ? 45 : 40;
    reasons.push({
      key: s.isWater ? 'waterChange' : 'dueCheck',
      tone: s.isWater ? 'blue' : 'amber',
    });
  } else if (s.state === 'check') {
    score += 20;
    reasons.push({ key: 'dueCheck', tone: 'amber' });
  } else if (s.state === 'unknown') {
    score += 15;
    reasons.push({ key: 'neverLogged', tone: 'neutral' });
  }
  if (s.daysSinceAnchor != null && s.daysSinceAnchor >= s.window[1] * 2) {
    score += 20;
    reasons.push({ key: 'overdue', tone: 'red', vars: { n: s.daysSinceAnchor } });
  }
  if (plant.care.fertilizeEveryDays && s.daysSinceFert != null && s.daysSinceFert >= plant.care.fertilizeEveryDays) {
    score += 10;
    reasons.push({ key: 'fertilize', tone: 'lime' });
  }
  if (plant.kind === 'cutting' && !s.propagation.rootedAt && s.propagation.daysRooting >= 14) {
    score += 8;
    reasons.push({ key: 'rooting', tone: 'green' });
  }
  if (s.daysSinceTouch != null && s.daysSinceTouch >= 45) {
    score += 6;
    reasons.push({ key: 'staleMeasure', tone: 'neutral', vars: { n: s.daysSinceTouch } });
  }

  return score > 0 ? { score, reasons } : null;
}

/** Linear-fit growth rate per 30 days for one metric series. */
export function growthRate(points) {
  if (!points || points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const days = daysBetween(first.date, last.date);
  if (!days) return null;
  return ((last.value - first.value) / days) * 30;
}
