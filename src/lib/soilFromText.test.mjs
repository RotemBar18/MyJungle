import assert from 'node:assert/strict';
import { soilFromText } from './soilFromText.js';

/**
 * The check that unblocks the watch list: a check event is only meaningful if
 * it carries a substrate reading, so this is the fallback when the model omits
 * one. Getting "still moist" wrong leaves a plant nagging the owner after they
 * have already dealt with it — which is exactly the bug this fixes.
 *
 *   node src/lib/soilFromText.test.mjs
 */
const cases = [
  // the reported bug, in both languages
  ['בדקתי אותו והאדמה עדיין לחה', 'moist'],
  ['checked it, still moist', 'moist'],
  ['I checked and it is not dry yet', 'moist'],
  ['בדקתי, עדיין לא יבש', 'moist'],

  ['I checked and the soil is bone dry', 'dry'],
  ['בדקתי, יבש לגמרי', 'dry'],
  ['soil was dry so I watered', 'dry'],

  ['it was soaked', 'wet'],
  ['האדמה רטובה', 'wet'],

  // nothing said about the substrate — must not invent one
  ['looks happy today', null],
  ['בדקתי אותו', null],
  ['a new leaf opened', null],
];

let failed = 0;
for (const [text, want] of cases) {
  const got = soilFromText(text);
  if (got !== want) {
    failed++;
    console.error(`FAIL ${JSON.stringify(text)} -> ${got} (wanted ${want})`);
  }
}
assert.equal(failed, 0, `${failed} of ${cases.length} cases failed`);
console.log(`soilFromText: ${cases.length}/${cases.length} ok`);
