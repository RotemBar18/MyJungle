/**
 * The vocabulary of myJungle.
 *
 * Everything the UI offers as a choice is an id defined here; the human label
 * always comes from the i18n dictionaries (`t('enum.<list>.<id>')`). Nothing in
 * the data layer ever stores a translated string, so switching language never
 * rewrites data and old records keep rendering correctly.
 */

/** Growing medium a plant currently lives in. */
export const MEDIUMS = ['soil', 'water', 'perlite', 'moss', 'leca', 'mix'];

/** How dry the substrate should get before watering — the plant's care rule. */
export const DRY_RULES = ['full', 'mostly', 'top5', 'top3', 'slight', 'evenMoist'];

/** Observed substrate condition at the moment of watering (ordered dry → wet). */
export const SOIL_STATES = ['dry', 'mostlyDry', 'topDry', 'slightlyMoist', 'moist', 'wet'];

/** Which measurements make sense for a given plant. Chosen per plant. */
export const METRICS = ['height', 'width', 'leaves', 'stems', 'pups', 'newGrowth', 'rootLength'];

/** Metric -> unit key (resolved against the user's unit system). */
export const METRIC_UNITS = {
  height: 'length',
  width: 'length',
  rootLength: 'length',
  leaves: 'count',
  stems: 'count',
  pups: 'count',
  newGrowth: 'count',
};

export const LIGHT_LEVELS = ['directSun', 'bright', 'brightIndirect', 'medium', 'low'];
export const WINDOW_DIRECTIONS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'none'];
export const POT_MATERIALS = ['terracotta', 'plastic', 'ceramic', 'glass', 'concrete', 'fabric', 'other'];
export const POT_TYPES = ['standard', 'nursery', 'cachepot', 'hanging', 'selfWatering', 'propagation', 'other'];
export const DRAINAGE = ['good', 'some', 'none'];
export const PLANT_STATUS = ['active', 'archived', 'dead', 'gifted'];
export const HEALTH_LEVELS = ['good', 'watch', 'issue'];
export const PROPAGATION_METHODS = ['water', 'soil', 'perlite', 'moss', 'leca', 'division', 'leaf', 'offset'];
export const PROPAGATION_OUTCOMES = ['inProgress', 'rooted', 'potted', 'established', 'failed'];
export const FERTILIZER_TYPES = ['liquid', 'granular', 'slowRelease', 'organic', 'foliar', 'other'];
export const APPLICATION_METHODS = ['inWater', 'topDressing', 'foliarSpray', 'soak', 'other'];
export const ROOT_CONDITIONS = ['healthy', 'rootBound', 'sparse', 'damaged', 'rot'];

export const HEALTH_ISSUES = [
  'yellowLeaves', 'brownLeaves', 'leafDrop', 'curling', 'spots', 'wilting',
  'rot', 'rootProblem', 'pests', 'noGrowth', 'stemDamage', 'sunburn',
  'overwatering', 'underwatering', 'other',
];

export const PEST_KINDS = ['spiderMites', 'mealybugs', 'scale', 'thrips', 'fungusGnats', 'aphids', 'whitefly', 'other'];

/**
 * Timeline event types.
 * `group` drives where the type shows up in the "add event" sheet.
 * `quick` types are offered as one-tap actions.
 */
export const EVENT_TYPES = [
  // care
  { id: 'water', group: 'care', icon: '💧', tone: 'blue', quick: true },
  { id: 'waterChange', group: 'care', icon: '🔁', tone: 'blue', quick: true },
  { id: 'fertilize', group: 'care', icon: '🧪', tone: 'lime', quick: true },
  { id: 'mist', group: 'care', icon: '🌫️', tone: 'blue' },
  { id: 'clean', group: 'care', icon: '🧽', tone: 'neutral' },
  { id: 'rotate', group: 'care', icon: '🔄', tone: 'neutral' },
  { id: 'support', group: 'care', icon: '🪵', tone: 'neutral' },
  { id: 'check', group: 'care', icon: '👀', tone: 'neutral', quick: true },

  // growth
  { id: 'growth', group: 'growth', icon: '📏', tone: 'green', quick: true },
  { id: 'newLeaf', group: 'growth', icon: '🌱', tone: 'green' },
  { id: 'flower', group: 'growth', icon: '🌸', tone: 'pink' },
  { id: 'leafLoss', group: 'growth', icon: '🍂', tone: 'amber' },
  { id: 'prune', group: 'growth', icon: '✂️', tone: 'amber' },

  // soil & roots
  { id: 'repot', group: 'soil', icon: '🪴', tone: 'amber' },
  { id: 'soilChange', group: 'soil', icon: '🧱', tone: 'amber' },
  { id: 'rootCheck', group: 'soil', icon: '🔍', tone: 'neutral' },
  { id: 'rootWash', group: 'soil', icon: '🚿', tone: 'blue' },
  { id: 'rootPrune', group: 'soil', icon: '✂️', tone: 'amber' },

  // health
  { id: 'health', group: 'health', icon: '⚠️', tone: 'red' },
  { id: 'healthUpdate', group: 'health', icon: '📋', tone: 'amber' },
  { id: 'pest', group: 'health', icon: '🐛', tone: 'red' },
  { id: 'treatment', group: 'health', icon: '💊', tone: 'amber' },
  { id: 'rootRot', group: 'health', icon: '🦠', tone: 'red' },

  // propagation & moves
  { id: 'cuttingTaken', group: 'propagation', icon: '🌿', tone: 'green' },
  { id: 'rooted', group: 'propagation', icon: '🪸', tone: 'green' },
  { id: 'potted', group: 'propagation', icon: '🪴', tone: 'green' },
  { id: 'move', group: 'place', icon: '📍', tone: 'neutral' },

  // free-form
  { id: 'photo', group: 'other', icon: '📷', tone: 'neutral' },
  { id: 'note', group: 'other', icon: '📝', tone: 'neutral', quick: true },
  { id: 'status', group: 'other', icon: '🏷️', tone: 'neutral' },
  { id: 'custom', group: 'other', icon: '✨', tone: 'neutral' },
];

export const EVENT_GROUPS = ['care', 'growth', 'soil', 'health', 'propagation', 'place', 'other'];

const byId = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]));
export const eventType = (id) => byId[id] || { id, group: 'other', icon: '•', tone: 'neutral' };

/** Event types that count as "this plant got water". */
export const WATERING_TYPES = ['water', 'waterChange'];

/**
 * Sensible defaults for the check-interval range, per medium + dryness rule.
 * Only used to pre-fill a new plant — the real intervals come from history.
 */
export const DEFAULT_INTERVALS = {
  water: [4, 8],
  soil: { full: [14, 30], mostly: [10, 20], top5: [7, 14], top3: [6, 12], slight: [4, 8], evenMoist: [3, 6] },
};

export function defaultInterval(medium, dryRule) {
  if (medium === 'water' || medium === 'leca') return DEFAULT_INTERVALS.water;
  return DEFAULT_INTERVALS.soil[dryRule] || [7, 14];
}
