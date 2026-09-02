/**
 * Recover a substrate reading from what the owner actually wrote.
 *
 * The model is asked to put `soil` on every check, but when it forgets, a check
 * carries no reading — and a reading is what decides whether the plant is
 * resting or needs water. This reads only what was described; a check with no
 * mention of the substrate returns null rather than a guess.
 *
 * Ordered most specific first: "bone dry" must not be caught by the plain
 * "moist" branch, and "still moist" must not be caught by "dry" appearing
 * elsewhere in the sentence.
 */
export function soilFromText(text = '') {
  const s = String(text).toLowerCase();

  // Explicitly still wet — checked first because these sentences often also
  // contain the word "dry" ("not dry yet", "עדיין לא יבש").
  if (/\bnot (yet )?dry\b|still (very )?(moist|damp|wet)|לא יבש|עדיין לח/.test(s)) return 'moist';

  if (/\bsoaked|soaking|waterlogged|רטוב מאוד|ספוג/.test(s)) return 'wet';
  if (/bone[- ]dry|completely dry|totally dry|very dry|יבש(ה)? (לגמרי|לחלוטין|מאוד)/.test(s)) return 'dry';
  if (/\bdry\b|יבש/.test(s)) return 'dry';
  if (/\bwet\b|רטוב/.test(s)) return 'wet';
  if (/\bmoist\b|\bdamp\b|\bלח\b|לחה\b|לחות/.test(s)) return 'moist';

  return null;
}
