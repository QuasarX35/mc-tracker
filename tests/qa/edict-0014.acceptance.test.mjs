/**
 * Independent acceptance checks for the EDICT-0014 surfaces that a browser is not needed to
 * prove (测试部, S3 freeze — authoritative at S5, task-13).
 *
 * Source-level assertions only; behaviour lives in `tests/qa/ui.e2e.test.mjs` (cases 50–66)
 * and in 兵部's `tests/unit/tracker-suggest.test.mjs` against the frozen oracle
 * `tests/qa/edict-0014-fixtures/suggestion-fixtures.json`. Every assertion names the frozen
 * contract clause it enforces; a failure here is a FAIL, never a softened pass.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const INDEX = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const APP = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const MODEL = fs.readFileSync(path.join(SRC, 'tracker', 'model.js'), 'utf8');
const CSS = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const ICONS_JS = fs.readFileSync(path.join(SRC, 'assets', 'icons', 'icons.js'), 'utf8');
const PANORAMA_DIR = path.join(SRC, 'assets', 'panorama');
const PANORAMA_MANIFEST = JSON.parse(fs.readFileSync(path.join(PANORAMA_DIR, 'manifest.json'), 'utf8'));
const CONTRACT = fs.readFileSync(path.join(ROOT, '.tmp', 'plan', 'contract-0014.md'), 'utf8');
const EDICT = fs.readFileSync(path.join(ROOT, 'docs', 'governance', 'EDICT-0014.md'), 'utf8');
const FIXTURES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'qa', 'edict-0014-fixtures', 'suggestion-fixtures.json'), 'utf8'));
const STAMP_PATH = path.join(ROOT, 'docs', 'governance', 'app-qa.json');
const SUITE_PATH = path.join(ROOT, 'tests', 'qa', 'ui.e2e.test.mjs');
const AUDIT_PATH = path.join(ROOT, 'tests', 'qa', 'mc_ui_audit.py');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const has = (haystack, needle) => haystack.includes(needle);
const hasAny = (haystack, needles) => needles.some((needle) => has(haystack, needle));
const cssNoComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const JS_SURFACES = `${INDEX}\n${APP}`;

/* ------------------------------------------------------------------ contract */

test('contract: §2 reproduces contract-0014.md verbatim', () => {
  const lines = EDICT.split('\n');
  const start = lines.findIndex((line) => line.startsWith('### Frozen DOM contract'));
  const end = lines.findIndex((line, index) => index > start && line.startsWith('### D1 —'));
  assert.ok(start > 0 && end > start, 'contract block must sit between the heading and D1');
  const block = lines.slice(start + 2, end).join('\n').trimEnd();
  const expected = CONTRACT.replace(/\r\n/g, '\n').trimEnd();
  assert.equal(block, expected, 'EDICT-0014 §2 must be byte-identical to the frozen contract');
});

/* ------------------------------------------------------------------ AC1 */

test('AC1: panorama manifest declares the six-input, four-side seamless strip', () => {
  const manifest = PANORAMA_MANIFEST;
  assert.equal(manifest.faces, 6, 'six resolved inputs');
  assert.equal(manifest.sides, 4, 'four stitched sides');
  assert.equal(manifest.seamless, true, 'seamless wrap');
  assert.equal(manifest.loop_seconds, 180, 'one loop per 180 s');
  assert.equal(manifest.width, 2560, 'width 2,560');
  assert.equal(manifest.height, 640, 'height 640');
  assert.equal(manifest.width, 4 * manifest.height, 'width === 4 * height');
  assert.ok(manifest.blur_radius <= 2, `blur_radius <= 2 (got ${manifest.blur_radius})`);
  const inputs = manifest.inputs || [];
  assert.equal(inputs.length, 6, 'six resolved inputs');
  assert.equal(inputs.filter((input) => input.role === 'side').length, 4, 'four side faces');
  for (const input of inputs) {
    assert.match(input.sha256, /^[0-9a-f]{64}$/, `sha256 for ${input.name}`);
  }
  const output = path.join(PANORAMA_DIR, manifest.output.file);
  const bytes = fs.readFileSync(output);
  assert.equal(bytes.length, manifest.output.bytes, 'backdrop.webp bytes match the manifest');
  assert.equal(sha256(bytes), manifest.output.sha256, 'backdrop.webp sha256 matches the manifest');
  assert.deepEqual(manifest.output.size, [2560, 640], 'output size 2560 x 640');
});

test('AC1: backdrop animates with transform, not background-position', () => {
  assert.ok(!/panorama-drift/.test(cssNoComments), 'the old panorama-drift keyframes are gone');
  // EDICT-0015 §1: one layer, one 120 s drift keyframe (nested braces, so not a flat regex).
  const drift = /@keyframes\s+backdrop-drift\s*\{([\s\S]*?)\n\}/.exec(cssNoComments);
  assert.ok(drift, 'the backdrop-drift keyframe exists');
  assert.match(drift[1], /translateX\(\s*-50%\s*\)/, 'the loop starts one strip out');
  assert.match(drift[1], /translateX\(\s*0\s*\)/, 'the loop lands on the wrap point');
  assert.ok(/animation:\s*backdrop-drift\s+120s\s+linear\s+infinite/.test(cssNoComments), 'a 120 s transform animation is declared');
  assert.ok(!/animation[^;]*background-position/i.test(cssNoComments), 'the pan is not a background-position animation');
  const reduced = /@media\s*\(prefers-reduced-motion:\s*reduce\)([\s\S]*?)\n\}/.exec(cssNoComments);
  assert.ok(reduced, 'prefers-reduced-motion block exists');
  assert.ok(/animation-play-state:\s*paused/.test(cssNoComments), 'reduce pauses the layer (EDICT-0015 R7)');
  assert.ok(!/\.backdrop__layer[^}]*animation:\s*none/.test(cssNoComments), 'the layer is never stopped with animation:none (R7)');
  assert.ok(/\.backdrop/.test(cssNoComments) && /dirt/.test(cssNoComments), 'dirt fallback styling survives');
});

/* ------------------------------------------------------------------ AC2 */

test('AC2: picker paging constants and hint are in the app', () => {
  assert.ok(has(APP, 'icon-sentinel'), 'sentinel is wired');
  assert.ok(has(APP, 'IntersectionObserver'), 'IntersectionObserver drives paging');
  assert.ok(has(APP, '120'), 'batch size 120');
  assert.ok(has(APP, 'scroll for more'), 'count hint uses the frozen wording');
  assert.ok(!has(APP, 'slice(0, 150)'), 'the old 150 cap is gone');
  assert.ok(!/limit\s*=\s*150/.test(APP), 'the old 150 limit is gone');
});

/* ------------------------------------------------------------------ AC3 */

test('AC3: names wrap — no ellipsis clamps on the three name nodes', () => {
  for (const selector of ['.icon-tile__name', '.mat-row__name', '.mat-choice__name']) {
    const rule = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(cssNoComments);
    assert.ok(rule, `${selector} rule exists`);
    assert.ok(!/text-overflow:\s*ellipsis/.test(rule[1]), `${selector} does not truncate`);
    assert.ok(!/overflow:\s*hidden/.test(rule[1]), `${selector} does not clip`);
    assert.ok(!/-webkit-line-clamp/.test(rule[1]), `${selector} is not line-clamped`);
  }
  // EDICT-0015 §7 compact density clamps the notes *view text* to two lines by design
  // (`.notes__text`), so the freeze is scoped to the three name nodes above, not the whole sheet.
  assert.ok(/overflow-wrap:\s*break-word|word-break:\s*break-word/.test(cssNoComments), 'names may wrap');
});

/* ------------------------------------------------------------------ AC4 */

test('AC4: no pseudo-element tooltips; bubbling pointerover/pointerout delegation', () => {
  assert.ok(!/\[data-tip\][^{]*::(?:after|before)/.test(cssNoComments), 'no data-tip pseudo-element tooltip');
  assert.ok(!/\.slot\[data-tip\][^{]*::(?:after|before)/.test(cssNoComments), 'no slot pseudo tooltip');
  assert.ok(has(APP, 'pointerover') && has(APP, 'pointerout'), 'bubbling pointer events');
  assert.ok(has(APP, 'relatedTarget'), 'relatedTarget containment check');
  assert.ok(has(APP, 'mc-tooltip'), '#mc-tooltip is wired');
  assert.ok(!/addEventListener\(\s*['"]pointerenter/.test(APP), 'pointerenter delegation is rejected');
  assert.ok(!/addEventListener\(\s*['"]pointerleave/.test(APP), 'pointerleave delegation is rejected');
});

/* ------------------------------------------------------------------ AC5 */

test('AC5: five zero-state containers and their next-step controls', () => {
  for (const id of ['btn-empty-create-world', 'detail-empty-action', 'btn-empty-pick-material', 'btn-empty-reset-filter']) {
    assert.ok(hasAny(JS_SURFACES, [id]), `control #${id} is wired`);
  }
  for (const id of ['build-empty', 'world-empty', 'detail-empty', 'material-empty', 'world-material-empty']) {
    assert.ok(hasAny(JS_SURFACES, [id]), `container #${id} is wired`);
  }
  assert.ok(!has(APP, 'Create a world first.'), 'the blind toast path is deleted');
});

/* ------------------------------------------------------------------ AC6/AC7 */

test('AC6/AC7 (amended by EDICT-0016 §2): the two-button .stepper and stack resolution', () => {
  assert.ok(has(APP, 'data-stepper-step'), 'the shared renderer draws data-stepper-step buttons');
  assert.ok(has(APP, 'stepper__btn'), 'the stepper button class is used');
  assert.ok(has(APP, 'stackSizeFor'), 'the resolved stack size still drives the modifiers');
  assert.ok(!has(APP, 'data-mat-step'), 'the retired resolved-step attributes are gone');
  assert.ok(!/materialStepsHtml/.test(APP), 'the retired six-button renderer is gone');
  assert.ok(!/data-step="/.test(APP), 'the retired data-step literals are gone');
});

test('AC7 (EDICT-0016 §7): stamps go through <time>/formatStamp and custom tiles carry a stamp', () => {
  assert.ok(has(MODEL, 'formatStamp'), 'M.formatStamp exists');
  assert.ok(has(APP, 'formatStamp'), 'the app renders stamps through the shared helper');
  assert.ok(has(APP, 'parseRelative'), 'the tile dialog parses relative amounts');
  assert.ok(has(APP, 'tile__stamp'), 'custom tiles render a visible stamp');
  assert.ok(has(CSS, 'tile__stamp'), 'the custom-tile stamp is styled');
  assert.ok(has(INDEX, 'detail-meta'), 'the detail meta surface exists');
  assert.ok(has(APP, 'materials-lede'), 'the Materials lede carries the world stamp');
});

/* ------------------------------------------------------------------ AC8/AC9 */

test('AC8: suggestIcon/parseBulk/iconAuto exist and the frozen fixtures are intact', () => {
  assert.ok(has(MODEL, 'suggestIcon'), 'M.suggestIcon exists');
  assert.ok(has(MODEL, 'parseBulk'), 'M.parseBulk exists');
  assert.ok(/iconAuto/.test(MODEL), 'iconAuto is validated/exported');
  const fixtures = FIXTURES.fixtures || [];
  assert.ok(fixtures.length >= 20, `at least 20 fixtures (got ${fixtures.length})`);
  const slugs = new Set(JSON.parse(ICONS_JS.match(/window\.MC_ICON_SET\s*=\s*(\[[\s\S]*?\]);/)[1]));
  for (const fixture of fixtures) {
    if (!fixture.expected) continue;
    assert.ok(slugs.has(fixture.expected.slug), `${fixture.id}: ${fixture.expected.slug} is in MC_ICON_SET`);
    assert.equal(typeof fixture.expected.reason, 'string', `${fixture.id}: reason is a string`);
    assert.ok(fixture.expected.reason.length > 0, `${fixture.id}: reason is not empty`);
  }
  assert.ok(fixtures.filter((fixture) => fixture.expected === null).length >= 1, 'null cases are covered');
});

test('AC9: bulk dialog surfaces and the parser exist', () => {
  for (const id of ['bulk-dialog', 'bulk-form', 'bulk-input', 'bulk-review', 'bulk-add', 'bulk-cancel', 'bulk-error']) {
    assert.ok(hasAny(JS_SURFACES, [id]), `#${id} is wired`);
  }
  assert.ok(has(MODEL, 'parseBulk'), 'parseBulk lives in the model');
});

test('AC10: undo toast action and the six-second window', () => {
  assert.ok(has(APP, 'toast-action'), '#toast-action is wired');
  assert.ok(/6000|6_000/.test(APP), 'six-second window');
  assert.ok(has(SRC ? INDEX : INDEX, 'toast'), '#toast exists');
});

/* ------------------------------------------------------------------ AC11 */

test('AC11: recents key, cap and ordering hook', () => {
  assert.ok(has(APP, 'mc-build-tracker:recent'), 'recents key is the frozen one');
  assert.ok(/slice\(\s*0\s*,\s*8\s*\)|MAX_RECENT\s*=\s*8|recent\.length\s*>\s*8/.test(APP), 'cap is 8');
  assert.ok(has(APP, 'data-icon-recent'), 'recent tiles carry the marker');
});

/* ------------------------------------------------------------------ AC12 */

test('AC12: the browser suite keeps a floor and the audit grows with the new rules', () => {
  const suite = fs.readFileSync(SUITE_PATH, 'utf8');
  const cases = (suite.match(/^test\('/gm) || []).length;
  assert.ok(cases >= 66, `browser suite has at least 66 cases (got ${cases})`);
  const audit = fs.readFileSync(AUDIT_PATH, 'utf8');
  for (const marker of ['icon-sentinel', 'mc-tooltip', 'bulk-dialog', 'toast-action']) {
    assert.ok(has(audit, marker), `audit covers ${marker}`);
  }
});

/* ------------------------------------------------------------------ R10 */

test('R10: the app-qa stamp hashes the eight sources and postdates the assets', () => {
  const stamp = JSON.parse(fs.readFileSync(STAMP_PATH, 'utf8'));
  const files = new Set(Object.keys(stamp.files || {}));
  const expected = [
    'src/index.html', 'src/styles.css', 'src/app.js', 'src/tracker/model.js', 'src/assets/icons/icons.js',
    'src/assets/fonts/Minecraft.ttf', 'src/assets/panorama/backdrop.webp', 'src/assets/panorama/manifest.json',
  ];
  assert.deepEqual([...files].sort(), expected.slice().sort(), 'stamp hashes exactly APP_SOURCE_FILES');
  assert.ok((stamp.cases || 0) >= 49, 'stamp records at least 49 cases');
  const stampedAt = Date.parse(stamp.verified_at);
  assert.ok(Number.isFinite(stampedAt), 'verified_at is an ISO timestamp');
  const assets = ['src/assets/panorama/backdrop.webp', 'src/assets/panorama/manifest.json', 'src/assets/fonts/Minecraft.ttf'];
  for (const asset of assets) {
    const mtime = fs.statSync(path.join(ROOT, asset)).mtimeMs;
    assert.ok(stampedAt >= mtime, `${asset} predates the stamp (restamp after the final asset)`);
  }
});
