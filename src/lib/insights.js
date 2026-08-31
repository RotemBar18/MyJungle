import { daysBetween, toDate } from './format.js';
import { median, growthRate } from './stats.js';
import { WATERING_TYPES } from './domain.js';

/**
 * Personal insights.
 *
 * Every card below states a minimum amount of evidence before it is allowed to
 * appear, and carries the record count it was computed from. If the data is not
 * there, the card simply is not produced — the UI then says "not enough data
 * yet" rather than inventing a pattern.
 */

const MIN_INTERVALS = 4;
const SUMMER = [5, 6, 7, 8]; // Jun–Sep (0-based months)
const WINTER = [11, 0, 1, 2]; // Dec–Mar

export function buildInsights({ plants, stats, lengthFmt }) {
  const cards = [];
  const active = plants.filter((p) => p.status === 'active');

  for (const p of active) {
    const s = stats.get(p.id);
    if (!s) continue;

    // 1. This plant's own rhythm.
    if (s.intervals.length >= MIN_INTERVALS) {
      cards.push({
        id: `rhythm-${p.id}`,
        icon: '💧',
        weight: 60,
        plantId: p.id,
        key: 'rhythm',
        vars: { name: p.name, n: Math.round(median(s.intervals)) },
        evidence: s.waterCount,
      });
    }

    // 2. A shift in that rhythm — needs two comparable stretches.
    if (s.intervals.length >= 6) {
      const recent = s.intervals.slice(-3);
      const before = s.intervals.slice(0, -3);
      const a = median(recent);
      const b = median(before);
      if (a && b && Math.abs(a - b) / b >= 0.25) {
        cards.push({
          id: `shift-${p.id}`,
          icon: '📈',
          weight: 80,
          plantId: p.id,
          key: 'rhythmShift',
          vars: { name: p.name, now: Math.round(a), before: Math.round(b) },
          evidence: s.intervals.length + 1,
        });
      }
    }

    // 3. Repeatedly found still moist — the interval is probably too short.
    if (s.moistStreak >= 3) {
      cards.push({
        id: `moist-${p.id}`,
        icon: '🌫️',
        weight: 85,
        plantId: p.id,
        key: 'moistChecks',
        vars: { name: p.name, n: s.moistStreak },
        evidence: s.moistStreak,
      });
    }

    // 4. Growth before vs after a move.
    const move = s.events.filter((e) => e.type === 'move').map((e) => toDate(e.at)).filter(Boolean)[0];
    const heights = s.series.height || [];
    if (move && heights.length >= 4) {
      const after = heights.filter((x) => x.date >= move);
      const before = heights.filter((x) => x.date < move);
      if (after.length >= 2 && before.length >= 2) {
        const ra = growthRate(after);
        const rb = growthRate(before);
        if (ra != null && rb != null && Math.abs(ra - rb) > 0.3) {
          const ev = s.events.find((e) => e.type === 'move');
          cards.push({
            id: `move-${p.id}`,
            icon: '📍',
            weight: 75,
            plantId: p.id,
            key: 'growthAfterMove',
            vars: {
              name: p.name,
              place: ev?.data?.toRoom || ev?.data?.toLocation || p.room || '—',
              rate: lengthFmt(Math.round(ra * 10) / 10),
              before: lengthFmt(Math.round(rb * 10) / 10),
            },
            evidence: heights.length,
          });
        }
      }
    }

    // 5. Fertilizing gap — only for plants that have ever been fertilized.
    if (s.lastFert && s.daysSinceFert >= 60) {
      cards.push({
        id: `fert-${p.id}`,
        icon: '🧪',
        weight: 40,
        plantId: p.id,
        key: 'fertGap',
        vars: { name: p.name, n: s.daysSinceFert },
        evidence: 1,
      });
    }

    // 6. Did the treatment work? Only when an action was actually recorded.
    const solved = s.issues.find((i) => !i.open && (i.data?.action || i.updates.some((u) => u.data?.action)));
    if (solved) {
      const action = solved.data?.action || solved.updates.find((u) => u.data?.action)?.data?.action;
      cards.push({
        id: `issue-${solved.id}`,
        icon: '💊',
        weight: 70,
        plantId: p.id,
        key: 'issueResolved',
        vars: {
          name: p.name,
          issue: solved.data?.issue,
          issueEnum: true,
          n: solved.openDays,
          action,
        },
        evidence: 1 + solved.updates.length,
      });
    }

    // 7. Seasonal watering rhythm — needs enough intervals in both seasons.
    if (s.waterings.length >= 8) {
      const summer = [];
      const winter = [];
      const asc = [...s.waterings].reverse();
      for (let i = 1; i < asc.length; i++) {
        const gap = daysBetween(asc[i - 1].date, asc[i].date);
        if (gap == null || gap <= 0 || gap > 200) continue;
        const m = asc[i].date.getMonth();
        if (SUMMER.includes(m)) summer.push(gap);
        else if (WINTER.includes(m)) winter.push(gap);
      }
      if (summer.length >= 3 && winter.length >= 3) {
        cards.push({
          id: `season-${p.id}`,
          icon: '🌤️',
          weight: 65,
          plantId: p.id,
          key: 'seasonal',
          vars: {
            name: p.name,
            summer: Math.round(median(summer)),
            winter: Math.round(median(winter)),
          },
          evidence: summer.length + winter.length,
        });
      }
    }

    // 8. Nothing logged for a long time.
    if (s.daysSinceTouch != null && s.daysSinceTouch >= 45) {
      cards.push({
        id: `stale-${p.id}`,
        icon: '🕰️',
        weight: 30,
        plantId: p.id,
        key: 'dryStreak',
        vars: { name: p.name, n: s.daysSinceTouch },
        evidence: s.count,
      });
    }
  }

  // 9. How long cuttings from a given mother take to root.
  const byParent = new Map();
  for (const p of plants) {
    if (!p.parentId) continue;
    const d = stats.get(p.id)?.propagation?.daysToRoot;
    if (d == null) continue;
    if (!byParent.has(p.parentId)) byParent.set(p.parentId, []);
    byParent.get(p.parentId).push(d);
  }
  for (const [parentId, list] of byParent) {
    if (list.length < 2) continue;
    const parent = plants.find((x) => x.id === parentId);
    if (!parent) continue;
    cards.push({
      id: `root-${parentId}`,
      icon: '🌱',
      weight: 55,
      plantId: parentId,
      key: 'rootTime',
      vars: { name: parent.name, n: Math.round(median(list)) },
      evidence: list.length,
    });
  }

  // 10. The fastest grower right now.
  const growers = active
    .map((p) => ({ p, rate: growthRate((stats.get(p.id)?.series.height || []).slice(-4)) }))
    .filter((x) => x.rate != null && x.rate > 0)
    .sort((a, b) => b.rate - a.rate);
  if (growers.length) {
    const { p } = growers[0];
    const pts = stats.get(p.id).series.height;
    cards.push({
      id: `fast-${p.id}`,
      icon: '🚀',
      weight: 50,
      plantId: p.id,
      key: 'fastGrower',
      vars: {
        name: p.name,
        v: lengthFmt(Math.round((pts[pts.length - 1].value - pts[0].value) * 10) / 10),
        n: daysBetween(pts[0].date, pts[pts.length - 1].date),
      },
      evidence: pts.length,
    });
  }

  // Keep it a digest, not a dashboard: best card per plant, six in total.
  const seen = new Set();
  return cards
    .sort((a, b) => b.weight - a.weight)
    .filter((c) => {
      if (seen.has(c.plantId)) return false;
      seen.add(c.plantId);
      return true;
    })
    .slice(0, 6);
}

/** Headline counters for the insights screen. */
export function summarize(plants, stats, events) {
  const active = plants.filter((p) => p.status === 'active');
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const waterEvents = events.filter((e) => WATERING_TYPES.includes(e.type));
  const intervalPlants = active
    .map((p) => stats.get(p.id))
    .filter((s) => s && s.intervals.length >= 3);

  const rooms = new Map();
  for (const p of active) {
    const k = p.room || '';
    rooms.set(k, (rooms.get(k) || 0) + 1);
  }

  // Activity: number of events per week for the last 12 weeks, oldest first.
  const weeks = Array(12).fill(0);
  for (const e of events) {
    const d = toDate(e.at);
    if (!d) continue;
    const w = Math.floor(daysBetween(d, now) / 7);
    if (w >= 0 && w < 12) weeks[11 - w]++;
  }

  return {
    plants: active.filter((p) => p.kind === 'plant').length,
    cuttings: active.filter((p) => p.kind === 'cutting').length,
    needAttention: 0, // filled in by the screen, which already has the map
    openIssues: active.reduce((n, p) => n + (stats.get(p.id)?.openIssues.length || 0), 0),
    waterThisWeek: waterEvents.filter((e) => toDate(e.at) >= weekAgo).length,
    waterThisMonth: waterEvents.filter((e) => toDate(e.at) >= monthStart).length,
    addedThisMonth: plants.filter((p) => toDate(p.createdAt) >= monthStart).length,
    avgInterval: intervalPlants.length
      ? Math.round(median(intervalPlants.map((s) => median(s.intervals))) * 10) / 10
      : null,
    intervalSample: intervalPlants.length,
    rooms: [...rooms.entries()].sort((a, b) => b[1] - a[1]),
    weeks,
    archived: plants.filter((p) => p.status !== 'active').length,
  };
}
