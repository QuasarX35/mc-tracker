/**
 * Independent acceptance checks for EDICT-0015 (测试部, S5 case list §3.3 of the edict).
 *
 * Static/contract checks only — the browser flows live in tests/qa/ui.e2e.test.mjs and the
 * source audit in tests/qa/mc_ui_audit.py. Every assertion below is traceable to AC1–AC12 of
 * docs/governance/EDICT-0015.md and its frozen contract `.tmp/s8/contract-0015.md`.
 *
 * Run directly: `node tests/qa/edict-0015.acceptance.test.mjs` (never `node --test`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const HTML = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const APP = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const MODEL = fs.readFileSync(path.join(SRC, 'tracker', 'model.js'), 'utf8');

const FIXTURES = path.join(ROOT, 'tests', 'qa', 'edict-0015-fixtures');
const BACKLOG = path.join(ROOT, 'docs', 'backlog');

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function idPresent(id) {
  return new RegExp(`id="${id}"`).test(HTML);
}

/* ------------------------------------------------------------------ fixtures */

test('A1 the S2 fixtures are frozen on disk and documented', () => {
  const names = [
    'v1-backup.json',
    'import-paste.json',
    'route-shuffle.v1.json',
    'route-shuffle.expected-order.json',
    'route-status-change.expected-order.json',
    'budget-state.json',
    'custom-items.v1.json',
    'invalid-no-name.json',
    'invalid-stack-zero.json',
    'invalid-stack-1000.json',
    'invalid-duplicate-name.json',
    'invalid-bad-icon.json',
    'invalid-registry-shape.json',
  ];
  for (const name of names) {
    assert.equal(fs.existsSync(path.join(FIXTURES, name)), true, `${name} exists`);
  }
  const readme = fs.readFileSync(path.join(FIXTURES, 'README.md'), 'utf8');
  assert.match(readme, /dataUrl/, 'the README records the amended dataUrl shape (F1)');
  assert.match(readme, /createCustomItem\(state, world, build, target, spec\)/, 'the README records the positional signatures (F2)');

  const budget = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'budget-state.json'), 'utf8'));
  assert.equal(budget.version, 1, 'the budget fixture is schema version 1');
  const world = budget.worlds.find((entry) => entry.id === budget.activeWorldId);
  assert.equal(world.builds.length, 4, 'four builds in the height-budget fixture (F9)');
  const selected = world.builds.find((build) => build.status === 'building');
  assert.equal(selected.materials.length, 6, 'the building build carries six materials');

  const custom = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'custom-items.v1.json'), 'utf8'));
  const all = JSON.stringify(custom);
  assert.match(all, /"dataUrl"/, 'fixture icons use the shipped dataUrl shape');
  assert.doesNotMatch(all, /"kind":\s*"image",\s*"data"/, 'no fixture uses the stale `data` key');
});

test('A2 the world-header, import, custom-item and step-button ids exist (AC2/AC5/AC6/AC8)', () => {
  const ids = [
    'world-progress',
    'world-remaining',
    'world-bar',
    'world-fill',
    'mat-steps',
    'backdrop-pause',
    'import-dialog',
    'import-file',
    'import-drop',
    'import-text',
    'import-restore',
    'import-cancel',
    'import-error',
    'custom-dialog',
    'custom-name',
    'custom-stack',
    'custom-scope',
    'custom-icon-pick',
    'custom-icon-upload',
    'custom-icon-file',
    'custom-icon-preview',
    'custom-error',
    'custom-save',
    'custom-cancel',
    'btn-new-custom',
  ];
  for (const id of ids) assert.equal(idPresent(id), true, `#${id} exists in src/index.html`);
  assert.doesNotMatch(HTML, /id="world-summary"/, '#world-summary is retired (AC2)');
  assert.doesNotMatch(HTML, /id="summary-(name|line|bar|fill|totals)"/, '#summary-* ids are retired');
  assert.doesNotMatch(APP, /world-summary/, '#world-summary is not painted any more');
});

test('A3 the backdrop is exactly one layer with the contract §1 geometry (AC11)', () => {
  const layers = [...HTML.matchAll(/class="[^"]*backdrop__layer[^"]*"/g)].length;
  assert.equal(layers, 1, 'src/index.html contains exactly one .backdrop__layer');
  assert.doesNotMatch(CSS, /\.backdrop__layer:nth-child\(2\)/, 'the second-copy rule is gone');
  assert.match(CSS, /width:\s*800vh/, 'the layer is 8 viewport-heights wide');
  assert.match(CSS, /height:\s*100%/, 'the layer is full height');
  assert.match(CSS, /background-size:\s*400vh auto/, 'the strip paints at a 4:1 viewport ratio');
  assert.match(CSS, /background-repeat:\s*repeat-x/, 'the strip repeats horizontally');
  assert.match(CSS, /background-position:\s*left center/, 'the strip is anchored left centre');
  const keyframes = /@keyframes\s+backdrop-drift\s*\{([\s\S]*?)\}\s*\n\}/.exec(CSS);
  assert.ok(keyframes, '@keyframes backdrop-drift exists');
  assert.match(keyframes[1], /translateX\(-50%\)/, 'the loop starts at -50%');
  assert.match(keyframes[1], /translateX\(0\)/, 'the loop ends at 0');
  assert.match(CSS, /animation:\s*backdrop-drift\s+120s\s+linear\s+infinite/, '120 s linear infinite');
  assert.match(CSS, /will-change:\s*transform/, 'the compositor hint is transform');
});

test('A4 reduced motion defaults the layer to paused, never animation:none (AC11 / R7)', () => {
  const STYLE = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const reduceBlocks = [...STYLE.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const layerRules = [];
  for (const block of reduceBlocks) {
    for (const rule of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1];
      // A rule that targets the layer directly; the F16 exclusion (`:not(...)`) is not one.
      if (/\.backdrop__layer/.test(selector) && !/:not\(/.test(selector)) layerRules.push(rule[2]);
    }
  }
  assert.ok(layerRules.length >= 1, 'a reduce block targets .backdrop__layer directly');
  const layerText = layerRules.join('\n');
  assert.match(layerText, /animation-play-state:\s*paused/, 'the layer defaults to paused');
  assert.doesNotMatch(layerText, /animation:\s*none/, 'the layer never removes its animation (R7)');
  assert.doesNotMatch(layerText, /animation-duration:\s*0(ms|s)/, 'the layer keeps its 120 s duration');
  assert.match(STYLE, /animation-play-state:\s*(paused|running)/, 'the pause control can flip the play state');
  // The global 0 ms reset must not catch the layer (F16).
  const resetRules = [...STYLE.matchAll(/([^{}]*)\{[^{}]*animation-duration:\s*0ms\s*!important[^{}]*\}/g)];
  for (const [, selector] of resetRules) {
    assert.ok(
      !/\.backdrop__layer|backdrop__layer/.test(selector) ||
        /:not\(\.backdrop__layer\)|:not\(\[class\*="backdrop__layer"\]\)/.test(selector),
      'the global 0 ms rule excludes .backdrop__layer (F16)',
    );
    assert.doesNotMatch(selector, /^\s*\*?\s*$/, 'the global 0 ms rule is not a bare * (must exclude the layer)');
  }
});

test('A5 the pause control is in the top bar before New World (AC11)', () => {
  const pauseAt = HTML.indexOf('id="backdrop-pause"');
  const newWorldAt = HTML.indexOf('id="btn-new-world"');
  assert.ok(pauseAt > -1, '#backdrop-pause exists');
  assert.ok(newWorldAt > -1, '#btn-new-world exists');
  assert.ok(pauseAt < newWorldAt, '#backdrop-pause sits before #btn-new-world');
  const actions = /class="topbar__actions"[\s\S]*?<\/div>/.exec(HTML);
  assert.ok(actions, '.topbar__actions exists');
  assert.match(actions[0], /id="backdrop-pause"/, 'the pause control lives in .topbar__actions');
  assert.match(actions[0], /id="btn-new-world"/, 'New World is in the same row');
  assert.match(CSS, /#backdrop-pause/, 'the pause control has a style block');
  assert.match(CSS, /mc-build-tracker:motion|motion-paused/, 'the paused class/storage contract is styled');
});

test('A6 the import input accepts the extension token only (AC8 / item 7)', () => {
  const input = /<input[^>]*id="file-import"[^>]*>/.exec(HTML);
  assert.ok(input, '#file-import exists');
  const accept = /accept="([^"]*)"/.exec(input[0]);
  assert.ok(accept, '#file-import has an accept attribute');
  assert.equal(accept[1], '.json', 'the accept token is the extension only (no MIME first)');
  assert.match(APP, /import-dialog/, 'the import dialog is wired in app.js');
});

test('A7 the custom-item model surface is frozen (AC4)', () => {
  assert.match(MODEL, /SCHEMA\s*=\s*1/, 'SCHEMA stays 1 (v1 backups import)');
  assert.match(MODEL, /statusRank/, 'statusRank exists');
  assert.match(MODEL, /function\s+resolveItem\s*\(\s*state\s*,\s*world\s*,\s*build\s*,\s*name\s*\)/, 'resolveItem(state, world, build, name)');
  assert.match(MODEL, /function\s+customItem\s*\(\s*state\s*,\s*world\s*,\s*build\s*,\s*name\s*\)/, 'customItem(state, world, build, name)');
  assert.match(
    MODEL,
    /function\s+createCustomItem\s*\(\s*state\s*,\s*world\s*,\s*build\s*,\s*target\s*,\s*spec\s*\)/,
    'createCustomItem(state, world, build, target, spec)'
  );
  for (const message of [
    'Custom material needs a name.',
    'Name already used by another material.',
    'Stack size must be between 1 and 999.',
    'Icon must be a catalogue item or an uploaded image.',
  ]) {
    assert.ok(MODEL.includes(message), `model carries the exact error string: ${message}`);
  }
  assert.match(MODEL, /customItems/, 'the registries are serialised by the model');
  assert.match(MODEL, /ICON_DATA_URL_MAX/, 'the image-icon cap still applies');
});

test('A8 the add-form steppers are wired without touching Got (AC6)', () => {
  assert.match(HTML, /id="mat-steps"/, '#mat-steps exists');
  const steps = /id="mat-steps"[\s\S]*?<\/div>/.exec(HTML);
  assert.ok(steps, 'the stepper container closes');
  const buttons = [...steps[0].matchAll(/data-step="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['1', '10', 'stack'], 'the three unsigned step values are in the frozen order');
  assert.equal((steps[0].match(/data-mat-field="needed"/g) || []).length, 3, 'all three buttons drive the Needed field');
  assert.doesNotMatch(steps[0], /collected/, 'Got gets no steppers');
  assert.match(APP, /materialStepsHtml/, 'the row renderer is still shared');
});

test('A9 the backlog files exist with their required shape (AC9/AC10)', () => {
  const ux = read('docs/backlog/ux.md');
  assert.match(ux, /\|\s*#\s*\|\s*Date\s*\|\s*Area\s*\|\s*Observation\s*\|\s*Proposal\s*\|\s*Priority\s*\|\s*Status\s*\|/, 'ux.md carries the frozen table header');
  const uxRows = ux.split('\n').filter((line) => /^\|\s*\d+\s*\|/.test(line));
  assert.ok(uxRows.length >= 8, `ux.md has at least eight numbered rows (found ${uxRows.length})`);

  const research = read('docs/backlog/mass-input-research.md');
  const urls = [...research.matchAll(/https?:\/\/[^\s)]+/g)].length;
  assert.ok(urls >= 6, `the research file cites at least six sources with URLs (found ${urls})`);
  const index = read('docs/backlog/_index.md');
  assert.match(index, /ux\.md/, '_index.md links the UX backlog');
  assert.match(index, /mass-input-research\.md/, '_index.md links the research file');
});

test('A10 the picker still carries the EDICT-0014 surfaces (no silent regression)', () => {
  for (const id of ['icon-dialog', 'icon-search', 'icon-grid', 'icon-count-hint', 'btn-new-custom']) {
    assert.equal(idPresent(id), true, `#${id} still exists`);
  }
  // The sentinel is created lazily by the pager, so the static proof lives in app.js.
  assert.match(APP, /icon-sentinel/, 'the paging sentinel is still wired in the app');
  assert.match(APP, /picker--material/, 'the picker gets the material-mode class');
  assert.match(APP, /mc-tooltip/, 'the tooltip surface survives');
  assert.match(APP, /#icon-count-hint|icon-count-hint/, 'the count hint is still painted');
  assert.match(APP, /mc-build-tracker:motion/, 'the motion preference key is used');
});

test('A11 every valid fixture is a real tracker backup and every invalid one is refused (S5 guard)', () => {
  /* Guard added after run 1: `route-shuffle.v1.json` carried materials without `id`, so the
     app correctly rejected it and case 67 tested the empty state instead of ordering. Any
     fixture a browser case injects must round-trip through the shipped import path. */
  const sandbox = vm.createContext({ console });
  vm.runInContext(MODEL, sandbox, { filename: 'src/tracker/model.js' });
  const model = sandbox.TrackerModel;
  assert.equal(typeof model.importJSON, 'function', 'the model exports importJSON to a bare context');

  const valid = ['v1-backup.json', 'import-paste.json', 'route-shuffle.v1.json', 'budget-state.json', 'custom-items.v1.json'];
  for (const name of valid) {
    const raw = fs.readFileSync(path.join(FIXTURES, name), 'utf8');
    const result = model.importJSON(raw);
    assert.equal(result.error, undefined, `${name} is a valid backup (got: ${result.error || 'ok'})`);
  }

  const refused = {
    'invalid-no-name.json': 'Custom material needs a name.',
    'invalid-stack-zero.json': 'Stack size must be between 1 and 999.',
    'invalid-stack-1000.json': 'Stack size must be between 1 and 999.',
    'invalid-duplicate-name.json': 'Name already used by another material.',
    'invalid-bad-icon.json': 'Icon must be a catalogue item or an uploaded image.',
    'invalid-registry-shape.json': 'must be an array',
  };
  for (const [name, message] of Object.entries(refused)) {
    const result = model.importJSON(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));
    assert.ok(result.error, `${name} is refused`);
    assert.ok(result.error.includes(message), `${name} refuses with "${message}" (got: ${result.error})`);
  }

  // The ordering fixture must carry material ids, because the model requires them.
  const shuffled = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'route-shuffle.v1.json'), 'utf8'));
  const world = shuffled.worlds.find((entry) => entry.id === shuffled.activeWorldId);
  for (const build of world.builds) {
    for (const material of build.materials) {
      assert.equal(typeof material.id, 'string', `${build.name} / ${material.item} carries a material id`);
    }
  }
  const ordered = model.sortBuilds(world.builds).map((build) => build.name);
  const expected = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'route-shuffle.expected-order.json'), 'utf8')).order;
  assert.deepEqual(ordered, expected, 'the fixture finally encodes the frozen expected order');
});
