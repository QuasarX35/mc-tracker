/**
 * Comprehensive UI acceptance suite for the Minecraft Build Tracker (测试部, EDICT-0009).
 *
 * Drives the real app in real Chrome through the DevTools Protocol (see ui/harness.mjs).
 * EDICT-0013 froze this case list at the S2 audit; every case maps to a frozen acceptance
 * sentence. The suite is deliberately black-box: it clicks, types and reads the DOM, never
 * app internals, so it fails when a user would notice.
 *
 * 66 cases: onboarding, worlds, builds, title rename (D2), status, deletion, materials,
 * quantity steppers (D5/D6), notes view/edit (D4), coords copy (D3), item picker (D6/D7/D8),
 * image upload, search cap, Escape semantics, themed select (D9), backdrop blur (D10),
 * accessibility, responsive layout, visual contract and console cleanliness. EDICT-0014 adds
 * 17 cases (50–66): paging to every icon + the no-IntersectionObserver fallback, batch reset on
 * search, name wrapping at 1280/390, the top-layer tooltip, the five zero states, the frozen
 * suggestion, manual-icon precedence, bulk paste, three undo paths, recent picks, resolved step
 * labels and a final whole-run console check.
 *
 * Run: node tests/qa/ui.e2e.test.mjs        (Chrome must be launchable, not inside the sandbox)
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, fileUrl, sleep } from './ui/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EVIDENCE = path.join(ROOT, 'reports', 'qa', 'evidence', 'edict-0018');
const CSS_PATH = path.join(ROOT, 'src', 'styles.css');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-qa-'));
let app;

before(async () => {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  app = await launch({ appUrl: fileUrl('src/index.html') });
});

after(async () => {
  if (!app) return;
  await app.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ helpers */

const page = () => app.page;

async function reset({ demo = true } = {}) {
  const p = page();
  await p.goto(fileUrl('src/index.html?tab=builds'));
  await p.evaluate('localStorage.clear(); return true;');
  await p.goto(fileUrl(demo ? 'src/index.html?demo=1&tab=builds' : 'src/index.html?tab=builds'));
  await p.waitFor('document.readyState === "complete" && window.TrackerModel !== undefined');
  await p.waitFor('document.querySelector("#world-select") !== null');
}

/** Current app state, straight from the page's persisted model (EDICT-0017: the v2 key). */
async function appState() {
  return page().evaluate(`
    const raw = localStorage.getItem('mc-build-tracker:v2');
    return raw ? JSON.parse(raw) : null;
  `);
}

async function toastText() {
  return page().text('#toast');
}

async function shot(name) {
  await page().screenshot(path.join(EVIDENCE, `${name}.png`));
}

async function selectWorldById(id) {
  await page().fill('#world-select', id);
}

/** Select the first build in the list and return its detail heading. */
async function openFirstBuild() {
  await page().click('#build-list .build-entry');
  await page().waitFor('!document.querySelector("#detail-body").hidden');
  return page().text('#detail-heading');
}

async function buildByName(name) {
  return page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    for (const world of state.worlds) {
      for (const build of world.builds) if (build.name === ${JSON.stringify(name)}) return { build, worldId: world.id };
    }
    return null;
  `);
}

/**
 * The whole build's gathered percentage and remaining count, computed from the v2 rows:
 * Needed is the text editor's value, and what the build has is the per-material covered cell.
 */
async function buildTotals() {
  return page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
    let needed = 0;
    let covered = 0;
    for (const row of rows) {
      needed += Number(row.querySelector('[data-mat-field="needed"]').value) || 0;
      covered += Number(row.querySelector('[data-mat-covered]').textContent.trim()) || 0;
    }
    return { pct: needed ? Math.round((covered / needed) * 100) : 0, remaining: needed - covered, needed, covered };
  `);
}

/**
 * Count rows only once two consecutive reads agree. The aggregated shopping list can
 * paint across frames, so a single early count can catch an intermediate set.
 */
async function stableRowCount(selector = '#world-material-body .mat-row', accept = () => true) {
  let previous = -1;
  let equal = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const count = await page().count(selector);
    if (count === previous) equal += 1;
    else {
      equal = 0;
      previous = count;
    }
    if (equal >= 2 && accept(count)) {
      await sleep(220);
      if ((await page().count(selector)) === count) return count;
    }
    await sleep(150);
  }
  throw new Error(`row count under ${selector} never stabilised`);
}

/**
 * Add a material through the D8 picker (the only way in) and submit.
 * Matches the exact display name first (a substring match picks "Allay Spawn Egg"
 * for "egg"), or the frozen slug when one is given.
 */
async function addMaterialViaPicker(nameQuery, { needed = null, slug = null } = {}) {
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  await page().fill('#icon-search', nameQuery);
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile").length > 0');
  const clicked = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'));
    const wantSlug = ${JSON.stringify(slug)};
    const wantName = ${JSON.stringify(nameQuery.toLowerCase())};
    const nameOf = (t) => t.querySelector('.icon-tile__name').textContent.trim().toLowerCase();
    const tile = wantSlug
      ? tiles.find((t) => t.dataset.iconSlug === wantSlug)
      : tiles.find((t) => nameOf(t) === wantName) || tiles.find((t) => nameOf(t).includes(wantName));
    if (!tile) return 'none';
    tile.click();
    return 'ok';
  `);
  if (clicked !== 'ok') throw new Error(`no icon tile matched ${nameQuery}${slug ? ` (${slug})` : ''}`);
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  if (needed !== null) await page().fill('#mat-needed', String(needed));
  await page().click('#add-material-form button[type="submit"]');
}

function writeFixture(name, content) {
  const file = path.join(TMP, name);
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  return file;
}

/* ------------------------------------------------------------- onboarding */

test('01 empty state shows the onboarding empties and no console errors', async () => {
  await reset({ demo: false });
  assert.equal(await page().hidden('#build-empty'), false, 'no-build empty state visible');
  assert.equal(await page().hidden('#detail-empty'), false, 'no-selection empty state visible');
  assert.equal(await page().hidden('#world-empty'), false, 'worlds empty state rendered (gated by view)');
  // Contract §4 (R3): the shipped build-empty keeps a next-step control, not a toast.
  const firstBuild = await page().evaluate(`
    const empty = document.querySelector('#build-empty');
    const button = empty && empty.querySelector('#btn-first-build');
    return { inside: !!button, tag: button && button.tagName };
  `);
  assert.equal(firstBuild.inside, true, '#btn-first-build lives inside the build empty state');
  assert.equal(firstBuild.tag, 'BUTTON', 'the next step is a real button');
  const status = (await page().text('#status-line')).trim();
  assert.ok(status.length > 0, 'the live status line announces the load state');
  await shot('01-empty-state');
});

test('02 the build dialog refuses a blank name and then creates the build', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  const required = await page().evaluate(
    'return document.querySelector("#build-dlg-name").validity.valueMissing;'
  );
  assert.equal(required, true, 'the name input is required');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  assert.equal(await page().evaluate('return document.querySelector("#build-dialog").open;'), true,
    'the dialog stays open while the name is missing');
  await page().fill('#build-dlg-name', 'Blaze Farm');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  assert.match(await page().text('#detail-heading'), /Blaze Farm/);
});

/* ------------------------------------------------------------------ worlds */

test('03 the demo seed loads two worlds with their builds', async () => {
  await reset();
  const state = await appState();
  assert.ok(state.worlds.length >= 2, 'seed has at least two worlds');
  assert.ok(state.worlds.some((world) => world.builds.length > 0), 'seed has builds');
  const options = await page().evaluate(
    'return Array.from(document.querySelectorAll("#world-select option")).map((o) => o.textContent.trim());'
  );
  assert.deepEqual(options, state.worlds.map((world) => world.name));
  // The case proves the seeded worlds, so capture the world rows, not the builds panel.
  await page().click('#tab-worlds');
  await shot('03-demo-seed');
  await page().click('#tab-builds');
});

test('04 section tabs keep the ARIA tab pattern and rove with the keyboard', async () => {
  await reset();
  assert.equal(await page().attr('#tab-builds', 'aria-selected'), 'true');
  await page().click('#tab-materials');
  assert.equal(await page().attr('#tab-materials', 'aria-selected'), 'true');
  assert.equal(await page().hidden('#view-materials'), false, 'materials view shown');
  assert.equal(await page().hidden('#view-builds'), true, 'builds view hidden');
  await page().evaluate('document.querySelector("#tab-materials").focus(); return true;');
  await page().press('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  const focused = await page().evaluate('return document.activeElement.id;');
  assert.equal(focused, 'tab-worlds', 'ArrowRight roves to the next tab');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  assert.equal(await page().attr('#tab-worlds', 'aria-selected'), 'true', 'Enter activates the roved tab');
});

test('05 the world dialog creates a world with its edition and version', async () => {
  await reset({ demo: false });
  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog").open');
  await page().fill('#world-name', 'Nether Hub');
  await page().fill('#world-edition', 'bedrock');
  await page().fill('#world-version', '1.21.50');
  await page().click('#world-save');
  await page().waitFor('!document.querySelector("#world-dialog").open');
  const state = await appState();
  const world = state.worlds.find((entry) => entry.name === 'Nether Hub');
  assert.ok(world, 'world persisted');
  assert.equal(world.edition, 'bedrock');
  assert.equal(world.version, '1.21.50');
});

test('06 the world dialog edits the active world', async () => {
  await reset();
  await page().click('#tab-worlds');
  const worldId = await page().evaluate(
    'return document.querySelector("#world-cards [data-world-edit]").dataset.worldEdit;'
  );
  await page().click(`[data-world-edit="${worldId}"]`);
  await page().waitFor('document.querySelector("#world-dialog").open');
  const existing = await page().value('#world-name');
  await page().fill('#world-name', `${existing} Reborn`);
  await page().click('#world-save');
  await page().waitFor('!document.querySelector("#world-dialog").open');
  const state = await appState();
  assert.match(state.worlds.find((world) => world.id === worldId).name, /Reborn$/);
});

test('07 world deletion is guarded by the confirm dialog', async () => {
  await reset();
  await page().click('#tab-worlds');
  const before = (await appState()).worlds.length;
  const worldId = await page().evaluate(
    'return document.querySelector("#world-cards [data-world-delete]").dataset.worldDelete;'
  );
  await page().click(`[data-world-delete="${worldId}"]`);
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-dialog button[value="cancel"]');
  await page().waitFor('!document.querySelector("#confirm-dialog").open');
  assert.equal((await appState()).worlds.length, before, 'cancel keeps the world');
  await page().click(`[data-world-delete="${worldId}"]`);
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-ok');
  await page().waitFor('!document.querySelector("#confirm-dialog").open');
  assert.equal((await appState()).worlds.length, before - 1, 'confirm deletes the world');
});

/* ------------------------------------------------------------------ builds */

test('08 the build dialog creates a build with status and coordinates', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Blaze Farm');
  await page().fill('#build-dlg-status', 'building');
  await page().fill('#build-dlg-coords', '210 / 70 / -18');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  assert.equal(await page().text('#detail-heading'), 'Blaze Farm');
  assert.equal(await page().value('#build-coords'), 'X 210  Y 70  Z -18');
  const pressed = await page().attr('#status-group [data-status="building"]', 'aria-pressed');
  assert.equal(pressed, 'true', 'the chosen status is announced');
  const build = (await buildByName('Blaze Farm')).build;
  assert.equal(build.status, 'building');
});

test('09 renaming a build happens from the section head (D2)', async () => {
  await reset();
  await openFirstBuild();
  assert.equal(await page().exists('#detail-body > .field label[for="build-name"]'), false,
    'the old Name form row is gone');
  assert.equal(await page().hidden('#build-name'), true, 'the inline input is hidden while idle');
  const order = await page().evaluate(`
    const rename = document.querySelector('#build-rename');
    const remove = document.querySelector('#build-delete');
    return !!(rename && remove && (rename.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING));
  `);
  assert.equal(order, true, 'the pencil sits before Delete');

  await page().click('#build-rename');
  assert.equal(await page().hidden('#detail-heading'), true, 'the heading steps aside for the input');
  assert.equal(await page().hidden('#build-name'), false);
  assert.equal(await page().hidden('#build-name-save'), false);
  assert.equal(await page().hidden('#build-name-cancel'), false);
  assert.equal(await page().hidden('#build-rename'), true);
  await page().fill('#build-name', 'Renamed Farm');
  await page().click('#build-name-save');
  await page().waitFor('document.querySelector("#detail-heading").textContent.trim() === "Renamed Farm"');
  assert.equal(await page().hidden('#build-name'), true, 'the input closes after saving');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await page().click('#build-list .build-entry');
  await page().waitFor('!document.querySelector("#detail-body").hidden');
  assert.equal(await page().text('#detail-heading'), 'Renamed Farm', 'the rename survives a reload');
});

test('10 the status buttons commit their state', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#status-group [data-status="done"]');
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const build = world.builds.find((entry) => entry.id === state.activeBuildId)
    || world.builds.find((entry) => entry.status === 'done');
  assert.ok(build, 'the clicked status reached the model');
  assert.equal(await page().attr('#status-group [data-status="done"]', 'aria-pressed'), 'true');
  assert.equal(await page().attr('#status-group [data-status="planned"]', 'aria-pressed'), 'false');
});

test('11 deleting a build asks first and then clears the detail panel', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Temporary Hut');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-dialog button[value="cancel"]');
  await page().waitFor('!document.querySelector("#confirm-dialog").open');
  assert.match(await page().text('#detail-heading'), /Temporary Hut/, 'cancel keeps the build');
  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-ok');
  await page().waitFor('!document.querySelector("#confirm-dialog").open');
  const state = await appState();
  assert.equal(state.worlds.some((world) => world.builds.some((build) => build.name === 'Temporary Hut')), false);
  assert.equal(await page().hidden('#detail-empty'), false, 'the panel falls back to the empty state');
});

/* --------------------------------------------------------------- materials */

test('12 adding an item merges duplicates case-insensitively', async () => {
  await reset();
  await openFirstBuild();
  const stoneRow = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-body .mat-row')).map((row) => ({
      name: row.querySelector('.mat-row__name').textContent.trim(),
      id: row.dataset.mat,
    })).find((entry) => entry.name === 'Stone Bricks');
  `);
  assert.ok(stoneRow, 'the seed has a Stone Bricks row');
  const before = (await buildByName('Iron Farm (spawn)')).build.materials
    .find((material) => material.id === stoneRow.id).needed;
  await addMaterialViaPicker('stone bricks', { needed: 5, collected: 0 });
  const after = (await buildByName('Iron Farm (spawn)')).build.materials;
  const rows = after.filter((material) => material.item.toLowerCase() === 'stone bricks');
  assert.equal(rows.length, 1, 'the duplicate merged into one row');
  assert.equal(rows[0].needed, before + 5, 'needed values add up');
  assert.equal(await page().text('#mat-error'), '', 'no error surfaced');
});

test('13 a material outside the catalog falls back to a lettered slot', async () => {
  await reset();
  const state = await appState();
  state.worlds[0].builds[0].materials.push({ id: 'mat_mystery', item: 'Mystery Goo', needed: 3 });
  const fixture = writeFixture('unknown-item.json', state);
  await page().goto(fileUrl('src/index.html?tab=builds'));
  await page().evaluate('localStorage.clear(); return true;');
  await page().goto(fileUrl('src/index.html?tab=builds'));
  await page().waitFor('document.querySelector("#file-import") !== null');
  await page().upload('#file-import', fixture);
  await page().waitFor('document.querySelector("#world-select").options.length > 0');
  await page().click('#build-list .build-entry');
  await page().waitFor('!document.querySelector("#detail-body").hidden');
  const row = await page().evaluate(`
    const row = Array.from(document.querySelectorAll('#material-body .mat-row'))
      .find((entry) => entry.querySelector('.mat-row__name').textContent.includes('Mystery Goo'));
    if (!row) return null;
    const img = row.querySelector('.slot img');
    const letter = row.querySelector('.slot__letter');
    return { hasImg: !!img, letter: letter ? letter.textContent.trim() : '', tip: row.querySelector('.slot').dataset.tip };
  `);
  assert.deepEqual(row, { hasImg: false, letter: 'M', tip: 'Mystery Goo' });
});

test('14 inline quantity edits update the bar and the summary', async () => {
  await reset();
  await openFirstBuild();
  const materialId = await page().evaluate(
    'return document.querySelector("#material-body .mat-row").dataset.mat;'
  );
  const selector = `[data-mat="${materialId}"] [data-mat-field="needed"]`;
  await page().fill(selector, '20');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor(`document.querySelector('${selector}').value === '20'`);
  const oracle = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const build = world.builds.find((entry) => entry.id === state.activeBuildId) || world.builds[0];
    const alloc = window.TrackerModel.allocate(world);
    const progress = alloc.perBuild[build.id] || { covered: 0, needed: 0 };
    return {
      text: window.TrackerModel.progressText(progress.covered, progress.needed),
      pct: progress.needed ? Math.round((progress.covered / progress.needed) * 100) : 0,
    };
  `);
  assert.equal(await page().text('#detail-progress-text'), oracle.text,
    'the bar sentence is the whole build, computed from the allocation');
  assert.equal(await page().attr('#detail-bar', 'aria-valuenow'), String(oracle.pct));
  assert.equal(await page().attr('#detail-fill', 'style').then((style) => style.includes(`${oracle.pct}%`)), true);
  await page().evaluate(`
    const input = document.querySelector('${selector}');
    input.focus();
    input.value = '999';
    return true;
  `);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  assert.equal(await page().value(selector), '20', 'Escape reverts the uncommitted edit');
  await page().fill(selector, '0');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  assert.equal(await page().value(selector), '1', 'needed clamps at one');
});

test('15 removing a material updates the list and the empty state', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Empty Build');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  assert.equal(await page().hidden('#material-empty'), false, 'a fresh build starts empty');
  await addMaterialViaPicker('apple');
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 1');
  await deleteRowViaMenu();
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 0');
  assert.equal(await page().hidden('#material-empty'), false);
});

test('16 the shopping list aggregates across the world by item', async () => {
  await reset();
  await page().click('#tab-materials');
  const state = await appState();
  const aggregate = new Map();
  for (const world of state.worlds) {
    if (world.id !== state.activeWorldId) continue;
    for (const build of world.builds) {
      for (const material of build.materials) {
        const key = material.item.toLowerCase();
        aggregate.set(key, (aggregate.get(key) || 0) + material.needed);
      }
    }
  }
  const stone = await page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#world-material-body .mat-row'));
    const row = rows.find((entry) => entry.querySelector('.mat-row__item').textContent.toLowerCase().includes('stone bricks'));
    return row ? Number(row.children[1].textContent.replace(/[^0-9]/g, '')) : null;
  `);
  assert.equal(stone, aggregate.get('stone bricks'), 'Stone Bricks needed are summed across builds');
  assert.match(await page().text('#mat-totals'), /(\d+) items? · \d+ \/ \d+ items gathered \(\d+%\)/);
});

test('17 the shopping list filters by text and by remaining/done', async () => {
  await reset();
  await page().click('#tab-materials');
  // The product default is "Still needed" (only rows with work left), so pin that first and
  // then take an explicit "Everything" baseline — the case must not depend on the default.
  assert.equal(await page().value('#mat-filter'), 'remaining', 'the default filter is "Still needed"');
  await page().fill('#mat-filter', 'all');
  const all = await stableRowCount(undefined, (count) => count > 0);
  assert.ok(all > 0, 'the shopping list renders its aggregated rows');
  await page().fill('#mat-search', 'stone');
  const filtered = await stableRowCount(undefined, (count) => count > 0 && count < all);
  assert.ok(filtered > 0 && filtered < all, 'text search narrows the rows');
  await page().fill('#mat-search', '');
  await stableRowCount(undefined, (count) => count === all);
  await page().fill('#mat-filter', 'done');
  const doneRows = await page().evaluate(`
    return Array.from(document.querySelectorAll('#world-material-body .mat-row')).map((row) => ({
      name: row.querySelector('.mat-row__name').textContent.trim(),
      left: Number(row.children[3].textContent.trim()),
    }));
  `);
  const done = await stableRowCount(undefined, (count) => count === doneRows.length);
  assert.ok(done > 0, 'the seed has finished items to filter');
  assert.ok(done < all, 'the done filter hides rows that still need work');
  assert.equal(doneRows.every((row) => row.left === 0), true, 'every row kept by "done" has nothing left');
  const beforeRestore = await stableRowCount();
  assert.equal(beforeRestore, done, 'the done filter stays put until the filter changes');
  await page().fill('#mat-filter', 'all');
  const restored = await stableRowCount();
  assert.equal(restored, all, 'clearing the filter restores every aggregated row');
  assert.ok(restored > beforeRestore, 'the restored list is larger than the filtered one');
});

test('18 copying the shopping list writes the aggregated text', async () => {
  await reset();
  await page().click('#tab-materials');
  await page().evaluate(`
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => { window.__copied = text; return Promise.resolve(); } },
    });
    return true;
  `);
  await page().click('#btn-copy-list');
  await page().waitFor('window.__copied !== null');
  const copied = await page().evaluate('return window.__copied;');
  assert.match(copied, /Stone Bricks x\d+/);
  assert.match(copied, /\(.*left\)|\(done\)/);
  assert.equal(await page().text('#toast'), 'Shopping list copied.');
});

test('19 export downloads a dated JSON backup', async () => {
  await reset();
  await page().evaluate(`
    window.__download = null;
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob) => { window.__download = { type: blob.type, size: blob.size }; return 'blob:mock'; };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { window.__downloadName = this.download; };
    window.__restore = () => { URL.createObjectURL = original; HTMLAnchorElement.prototype.click = click; };
    return true;
  `);
  await page().click('#btn-export');
  await page().waitFor('window.__downloadName !== undefined');
  const name = await page().evaluate('return window.__downloadName;');
  const blob = await page().evaluate('return window.__download;');
  assert.match(name, /^minecraft-build-tracker-\d{4}-\d{2}-\d{2}\.json$/);
  assert.ok(blob.size > 100, 'the backup has content');
  assert.equal(await page().text('#toast'), 'Backup downloaded.');
  await page().evaluate('window.__restore(); return true;');
});

test('20 import restores a backup and refuses malformed or foreign files', async () => {
  await reset();
  const state = await appState();
  const fixture = writeFixture('valid-backup.json', state);
  await reset({ demo: false });
  await page().upload('#file-import', fixture);
  await page().waitFor('document.querySelector("#world-select").options.length > 0');
  assert.equal(await page().text('#toast'), 'Backup restored.');
  await page().upload('#file-import', state.worlds[0].builds[0].name ? writeFixture('not-json.json', 'not json at all') : fixture);
  await page().waitFor('document.querySelector("#toast").textContent.includes("not valid JSON")');
  await page().upload('#file-import', writeFixture('foreign.json', { hello: 'world' }));
  await page().waitFor('document.querySelector("#toast").textContent.includes("not a tracker backup")');
});

test('21 state survives a reload and deep links open the right tab', async () => {
  await reset();
  const world = await page().evaluate(`
    const select = document.querySelector('#world-select');
    return { value: select.value, text: select.selectedOptions[0] ? select.selectedOptions[0].textContent.trim() : '' };
  `);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const afterReload = await page().evaluate(`
    const select = document.querySelector('#world-select');
    return { value: select.value, text: select.selectedOptions[0] ? select.selectedOptions[0].textContent.trim() : '' };
  `);
  assert.deepEqual(afterReload, world, 'the active world survives a reload');
  await page().goto(fileUrl('src/index.html?demo=1&tab=worlds'));
  await page().waitFor('document.querySelector("#tab-worlds") !== null');
  assert.equal(await page().attr('#tab-worlds', 'aria-selected'), 'true');
  assert.equal(await page().hidden('#view-worlds'), false);
});

/* ------------------------------------------------------------ accessibility */

test('22 accessibility invariants hold across the app', async () => {
  await reset();
  const audit = await page().evaluate(`
    const named = [];
    for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (el.hidden || el.closest('[hidden]')) continue; // hidden controls need no accessible name
      const label = el.id && document.querySelector('label[for="' + el.id + '"]');
      const name = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (label && label.textContent.trim());
      if (!name) named.push(el.id || el.outerHTML.slice(0, 60));
    }
    return {
      unnamed: named,
      live: document.querySelectorAll('[aria-live]').length,
      progress: document.querySelectorAll('[role=progressbar]').length,
      skip: !!document.querySelector('.skip-link[href="#main"]'),
      main: document.querySelector('main') && document.querySelector('main').id,
      untyped: Array.from(document.querySelectorAll('button')).filter((b) => !b.getAttribute('type')).length,
    };
  `);
  assert.deepEqual(audit.unnamed, [], 'every form control has an accessible name');
  assert.ok(audit.live >= 2, 'status line and toast are live regions');
  assert.ok(audit.progress >= 2, 'progress bars expose their role');
  assert.equal(audit.skip, true, 'the skip link targets main');
  assert.equal(audit.main, 'main');
  assert.equal(audit.untyped, 0, 'every button declares its type');
});

test('23 the skip link is the first stop of the tab order', async () => {
  await reset();
  await page().evaluate('document.activeElement.blur(); window.scrollTo(0, 0); return true;');
  await page().press('Tab', { code: 'Tab', keyCode: 9 });
  const focused = await page().evaluate(`
    const el = document.activeElement;
    return { tag: el.tagName, className: el.className, href: el.getAttribute('href') };
  `);
  assert.equal(focused.tag, 'A', 'Tab reaches the skip link first');
  assert.equal(focused.href, '#main', 'the first tab stop is the skip link');
  assert.match(focused.className, /skip-link/);
});

test('24 the layout reflows to a 390px phone without horizontal scroll', async () => {
  await reset();
  await page().setViewport(390, 844);
  const metrics = await page().evaluate(`
    const rect = (el) => el.getBoundingClientRect();
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && rect(el).width > 0;
    const got = document.querySelector('#material-body [data-mat-got]');
    const needed = document.querySelector('#material-body [data-mat-field=needed]');
    const head = document.querySelector('.mtable__head');
    const headCells = head ? Array.from(head.children).map((cell) => ({ text: cell.textContent.trim(), left: rect(cell).left, shown: visible(cell) })) : [];
    const gotCell = headCells.find((cell) => /^got$/i.test(cell.text)) || null;
    return {
      width: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      got: got ? { display: getComputedStyle(got).display, width: rect(got).width, left: rect(got).left, name: (got.getAttribute('title') || '') + ' ' + (got.getAttribute('aria-label') || '') } : null,
      neededName: needed ? (needed.getAttribute('aria-label') || '') : '',
      headCells,
      gotCell,
    };
  `);
  assert.ok(metrics.width <= metrics.inner + 1, `no horizontal scroll (${metrics.width} <= ${metrics.inner})`);
  // EDICT-0017 §3: Got is the v2 read-only world-inventory cell (the collected input is retired).
  assert.ok(metrics.got, 'the Got field exists at 390');
  assert.notEqual(metrics.got.display, 'none', 'the Got field is not collapsed under 640px');
  assert.ok(metrics.got.width > 0, `the Got field keeps a visible control (${metrics.got.width}px)`);
  const gotLabelled = /got|in world/i.test(metrics.got.name)
    || (metrics.gotCell ? metrics.gotCell.shown : false);
  assert.ok(gotLabelled, 'the Got field keeps its label at 390 (head label, row label or accessible name)');
  assert.ok(/needed/i.test(metrics.neededName), 'the Needed field keeps its accessible name');
  await shot('24-mobile-390');
  await page().clearViewport();
});

test('25 the visual contract keeps the panel, the font and the icon scale', async () => {
  await reset();
  await openFirstBuild();
  const visual = await page().evaluate(`
    const panel = getComputedStyle(document.querySelector('.panel'));
    const slot = document.querySelector('.detail__avatar');
    return {
      background: panel.backgroundColor,
      radius: panel.borderRadius,
      font: getComputedStyle(document.body).fontFamily,
      hasFace: document.fonts.check('16px Minecraft'),
      avatar: getComputedStyle(slot).width,
      masthead: document.querySelector('.masthead__title').textContent.trim(),
    };
  `);
  assert.equal(visual.background, 'rgb(198, 198, 198)', 'the Minecraft GUI panel face');
  assert.equal(visual.radius, '0px', 'square corners only');
  assert.match(visual.font, /^["']?Minecraft["']?\s*,/, 'the game face leads the stack (contract: Minecraft first)');
  assert.equal(visual.hasFace, true, 'the bundled Minecraft face is loaded, not just named');
  assert.equal(visual.masthead, 'Build Tracker');
  await shot('25-visual-contract');
});

/* ---------------------------------------------------------------- backdrop */

test('26 the panorama is one 4:1 strip that loops from a single layer (AC11)', async () => {
  await reset();
  await page().emulateReducedMotion(false);
  await page().waitFor('window.__backdrop !== undefined');
  assert.equal(await page().evaluate('return window.__backdrop;'), 'panorama');
  assert.equal(
    await page().evaluate('return document.documentElement.classList.contains("has-panorama");'),
    true
  );
  // contract §1: one layer, geometry against the viewport, one translateX loop, 120 s.
  const layer = await page().evaluate(`
    const nodes = Array.from(document.querySelectorAll('.backdrop > .backdrop__layer'));
    const style = nodes[0] ? getComputedStyle(nodes[0]) : null;
    return {
      count: nodes.length,
      extras: Array.from(document.querySelector('.backdrop').children)
        .filter((n) => n.nodeType === 1 && !n.classList.contains('backdrop__layer')).length,
      width: style && parseFloat(style.width),
      height: style && style.height,
      backgroundSize: style && style.backgroundSize,
      backgroundRepeat: style && style.backgroundRepeat,
      animationName: style && style.animationName,
      animationDuration: style && style.animationDuration,
      animationTiming: style && style.animationTimingFunction,
      animationIteration: style && style.animationIterationCount,
      viewport: innerHeight,
    };
  `);
  assert.equal(layer.count, 1, 'exactly one backdrop layer (the two former copies are retired)');
  assert.equal(layer.extras, 0, '.backdrop holds no extra painted copies');
  assert.ok(Math.abs(layer.width - 8 * layer.viewport) <= 1, `layer width is 8 x innerHeight (${layer.width} vs ${8 * layer.viewport})`);
  assert.equal(layer.height, layer.viewport + 'px', 'layer height is the viewport height');
  assert.ok(
    new RegExp(`^${Math.round(4 * layer.viewport)}(\\.\\d+)?px auto$`).test(layer.backgroundSize),
    `background-size is 4 x innerHeight px auto (found ${layer.backgroundSize})`
  );
  assert.equal(layer.backgroundRepeat, 'repeat-x', 'the strip repeats horizontally');
  assert.equal(layer.animationName, 'backdrop-drift', 'the single drift keyframe runs');
  assert.equal(layer.animationDuration, '120s', 'the loop is 120 s');
  assert.equal(layer.animationTiming, 'linear', 'the loop is linear');
  assert.equal(layer.animationIteration, 'infinite', 'the loop never stops');
  const sample = () =>
    page().evaluate(`return getComputedStyle(document.querySelector('.backdrop > .backdrop__layer')).transform;`);
  const first = await sample();
  await sleep(1200);
  const second = await sample();
  assert.notEqual(first, second, 'the strip has translated after ~1 s of the 120 s loop');
  // R7: reduce-motion defaults the layer to paused with the frame painted — never `animation: none`.
  await page().emulateReducedMotion(true);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const paused = await page().evaluate(`
    const style = getComputedStyle(document.querySelector('.backdrop > .backdrop__layer'));
    const button = document.querySelector('#backdrop-pause');
    return {
      name: style.animationName,
      duration: style.animationDuration,
      playState: style.animationPlayState,
      transform: style.transform,
      pressed: button && button.getAttribute('aria-pressed'),
      size: button ? [Math.round(button.getBoundingClientRect().width), Math.round(button.getBoundingClientRect().height)] : null,
      beforeNewWorld: !!button && !!document.querySelector('#btn-new-world')
        && (button.compareDocumentPosition(document.querySelector('#btn-new-world')) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    };
  `);
  assert.equal(paused.name, 'backdrop-drift', 'the animation is declared under reduce (R7)');
  assert.equal(paused.duration, '120s', 'the duration survives reduce (R7)');
  assert.equal(paused.playState, 'paused', 'the layer defaults to paused under reduce');
  assert.deepEqual(paused.size, [28, 28], 'the pause control is 28 x 28');
  assert.equal(paused.beforeNewWorld, true, 'the pause control sits before New World');
  assert.equal(paused.pressed, 'true', 'the pause control reports the paused state');
  await sleep(900);
  assert.equal(await sample(), paused.transform, 'a paused layer paints a frozen frame');
  await page().click('#backdrop-pause');
  await page().waitFor('getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState === "running"');
  assert.equal(await page().evaluate('return document.querySelector("#backdrop-pause").getAttribute("aria-pressed")'), 'false');
  assert.equal(await page().evaluate('return localStorage.getItem("mc-build-tracker:motion")'), 'play');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  assert.equal(
    await page().evaluate('return getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState'),
    'running',
    'an explicit play choice survives a reload under reduce (R7)'
  );
  await page().emulateReducedMotion(false);
  // Missing asset: the dirt fallback is unchanged.
  await page().blockUrls(['*backdrop.webp*']);
  await reset();
  await page().waitFor('window.__backdrop !== undefined');
  assert.equal(await page().evaluate('return window.__backdrop;'), 'dirt', 'a missing strip falls back to dirt');
  await page().unblockUrls();
});

test('27 a missing texture falls back to its first letter', async () => {
  await reset();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-search") !== null');
  await page().fill('#icon-search', 'apple');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile").length > 0');
  const name = await page().evaluate(`
    const tile = document.querySelector('#icon-grid .icon-tile[data-icon-slug]');
    const img = tile && tile.querySelector('img');
    if (!img) return null;
    const label = tile.querySelector('.icon-tile__name').textContent.trim();
    img.dispatchEvent(new Event('error'));
    return label;
  `);
  assert.ok(name, 'icon tiles render real image elements');
  await page().waitFor('document.querySelector("#icon-grid .icon-tile[data-icon-slug] .slot__letter") !== null');
  assert.equal(await page().text('#icon-grid .icon-tile[data-icon-slug] .slot__letter'), name.charAt(0).toUpperCase(),
    'a missing texture degrades to the item initial, not a broken image');
  await shot('27-icon-fallback-probe');
});

/* ------------------------------------------------------------- item picker */

test('28 the retired Item/Image tabs are gone and one picker remains (D7)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  assert.equal(await page().exists('.picker-tabs'), false, 'the tab strip is removed');
  assert.equal(await page().exists('#icon-tab-item'), false);
  assert.equal(await page().exists('#icon-tab-image'), false);
  assert.equal(await page().text('#icon-dialog-title'), 'Choose an icon');
  assert.equal(await page().hidden('#icon-use'), false, 'the use button is present');
  assert.equal(await page().hidden('#icon-upload-block'), false, 'upload lives in the footer');
  assert.ok((await page().count('#icon-grid .icon-tile')) > 0, 'the grid renders');
});

test('29 image upload from the picker footer still produces a 128px icon (D7)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  await page().click('#icon-upload');
  await page().upload('#icon-file', path.join(ROOT, 'src', 'assets', 'icons', 'diamond.png'));
  await page().waitFor('document.querySelector("#icon-preview img") !== null');
  const preview = await page().evaluate(`
    const img = document.querySelector('#icon-preview img');
    return { width: img.naturalWidth, src: img.getAttribute('src').slice(0, 22) };
  `);
  assert.equal(preview.width, 128, 'the upload is resized to 128px');
  assert.match(preview.src, /^data:image\//);
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#toast").textContent.includes("Icon updated")');
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const build = world.builds.find((entry) => entry.id === state.activeBuildId) || world.builds[0];
  assert.equal(build.icon.kind, 'image');
  assert.ok(build.icon.dataUrl.length <= 120000);
});

test('30 a non-image upload is refused with an inline error (D7)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  const before = await page().html('#icon-preview');
  await page().click('#icon-upload');
  await page().upload('#icon-file', writeFixture('note.txt', 'plain text, not an image'));
  await page().waitFor('!document.querySelector("#icon-error").hidden');
  assert.match(await page().text('#icon-error'), /PNG, JPEG or WebP/);
  assert.equal(await page().html('#icon-preview'), before, 'the draft icon is untouched');
  assert.equal(await page().evaluate('return document.querySelector("#icon-dialog").open;'), true);
});

test('31 the picker pages the expanded catalog in 120-tile batches (D2)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  const firstSlugs = await page().count('#icon-grid [data-icon-slug]');
  assert.equal(firstSlugs, 120, 'the first batch shows exactly 120 catalog tiles');
  assert.equal(await page().count('#icon-grid .icon-tile'), 121, 'the batch plus the single None tile');
  assert.match(await page().text('#icon-count-hint'), /showing 120 of \d+ — scroll for more/,
    'the hint names the batch and invites scrolling');
  const sentinel = await page().evaluate(`
    const grid = document.querySelector('#icon-grid');
    const last = grid.lastElementChild;
    return {
      exists: !!grid.querySelector('#icon-sentinel'),
      lastIsSentinel: !!last && last.id === 'icon-sentinel',
      marked: !!last && last.getAttribute('data-icon-sentinel') !== null,
      hidden: !!last && (last.getAttribute('aria-hidden') === 'true' || last.hidden),
    };
  `);
  assert.equal(sentinel.exists, true, 'the sentinel exists in the grid');
  assert.equal(sentinel.lastIsSentinel, true, 'the sentinel is the last child of the grid');
  assert.equal(sentinel.marked, true, 'the sentinel is marked data-icon-sentinel');
  assert.equal(sentinel.hidden, true, 'the sentinel is invisible to assistive tech');
  await page().evaluate(`
    const grid = document.querySelector('#icon-grid');
    grid.scrollTop = grid.scrollHeight;
    return true;
  `);
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length > 120');
  assert.equal(await page().count('#icon-grid [data-icon-slug]'), 240, 'one sentinel hit adds the next 120');
  const lazy = await page().count('#icon-grid img[loading="lazy"]');
  assert.ok(lazy > 0, 'tiles load lazily');
  await page().fill('#icon-search', 'oak log');
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length > 0');
  const hint = await page().text('#icon-count-hint');
  assert.match(hint, /showing \d+ of \d+ for "oak log"/, 'a search resets to one batch and reports its own count');
  const shown = await page().count('#icon-grid [data-icon-slug]');
  assert.ok(shown <= 120, 'a search never renders more than one batch');
  await page().fill('#icon-search', 'oak_log');
  assert.equal(await page().evaluate('return !!document.querySelector("#icon-grid [data-icon-slug=oak_log]");'), true,
    'a slug query also matches');
});

test('32 Escape clears the picker query before closing it', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  await page().waitFor('document.activeElement === document.querySelector("#icon-search")');
  await page().fill('#icon-search', 'stone');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile").length > 0');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  assert.equal(await page().value('#icon-search'), '', 'the first Escape clears the query');
  assert.equal(await page().evaluate('return document.querySelector("#icon-dialog").open;'), true,
    'the dialog stays open after the first Escape');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  const focused = await page().evaluate('return document.activeElement.id;');
  assert.equal(focused, 'detail-avatar', 'focus returns to the trigger');
});

/* ------------------------------------------------------- title and notes */

test('33 the title edit saves with Enter and cancels with Escape', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#build-rename');
  // Type without firing input/change (the change handler also commits) so Enter itself is
  // what saves the name — the keyboard path the AC names.
  await page().evaluate(`
    const input = document.querySelector('#build-name');
    input.focus();
    input.value = 'Enter Saved';
    return true;
  `);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#detail-heading").textContent.trim() === "Enter Saved"');
  assert.equal(await page().hidden('#build-name'), true);
  await page().click('#build-rename');
  await page().evaluate(`
    const input = document.querySelector('#build-name');
    input.focus();
    input.value = 'Escape Discarded';
    return true;
  `);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#detail-heading").textContent.trim() === "Enter Saved"');
  assert.equal(await page().hidden('#build-name'), true);
  assert.equal(await page().evaluate('return document.activeElement.id;'), 'build-rename');
});

test('34 renaming to a blank name is refused and the editor stays open', async () => {
  await reset();
  await openFirstBuild();
  const original = await page().text('#detail-heading');
  await page().click('#build-rename');
  await page().fill('#build-name', '   ');
  await page().click('#build-name-save');
  assert.match(await toastText(), /A build needs a name\./);
  assert.equal(await page().hidden('#build-name'), false, 'the editor stays open for correction');
  assert.equal(await page().text('#detail-heading'), original, 'the stored name is unchanged');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
});

test('35 notes render as text and edit inline (D4)', async () => {
  await reset();
  await openFirstBuild();
  await page().waitFor('document.querySelector("#notes-text") !== null && !document.querySelector("#notes-text").hidden');
  assert.equal(await page().hidden('#notes-text'), false, 'the read-only paragraph is visible');
  assert.equal(await page().hidden('#notes-editor'), true, 'the textarea is not in the view');
  assert.equal(await page().exists('#notes-editor'), true, 'the editor container exists');
  assert.equal(await page().evaluate('return document.querySelector("#build-notes").offsetParent === null;'), true,
    'the textarea is not rendered in view mode');
  await page().click('#notes-edit');
  await page().waitFor('!document.querySelector("#notes-editor").hidden');
  assert.equal(await page().hidden('#notes-text'), true);
  assert.equal(await page().hidden('#notes-editor'), false);
  await page().fill('#build-notes', 'Follow the beacon');
  await page().click('#notes-save');
  await page().waitFor('document.querySelector("#notes-text").textContent.includes("Follow the beacon")');
  assert.equal(await page().hidden('#notes-text'), false);
  assert.equal(await page().hidden('#notes-editor'), true);
});

test('36 notes keep their line breaks across a reload (D4)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#notes-edit');
  await page().fill('#build-notes', 'Line one\nLine two');
  await page().click('#notes-save');
  await page().waitFor('document.querySelector("#notes-text").textContent.includes("Line two")');
  const whiteSpace = await page().evaluate(
    'return getComputedStyle(document.querySelector("#notes-text")).whiteSpace;'
  );
  assert.match(whiteSpace, /pre-wrap/);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await page().click('#build-list .build-entry');
  await page().waitFor('!document.querySelector("#detail-body").hidden');
  const text = await page().text('#notes-text');
  assert.match(text, /Line one\nLine two/, 'both lines survived the reload');
});

test('37 the notes empty state is explicit', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Note-less Build');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  assert.equal(await page().text('#notes-text'), 'No notes yet.');
  const muted = await page().evaluate(
    'return document.querySelector("#notes-text").classList.contains("notes__text--empty");'
  );
  assert.equal(muted, true);
});

/* ------------------------------------------------------------- coordinate */

test('38 the coordinate copy button copies and disables for empty coords (D3)', async () => {
  await reset();
  await openFirstBuild();
  await page().evaluate(`
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => { window.__copied = text; return Promise.resolve(); } },
    });
    return true;
  `);
  const coords = await page().value('#build-coords');
  assert.ok(coords.trim().length > 0, 'the seed build has coordinates');
  await page().click('#copy-coords');
  await page().waitFor('window.__copied !== null');
  assert.equal(await page().evaluate('return window.__copied;'), coords.trim());
  assert.match(await page().text('#toast'), /^Coordinates copied\.?$/, 'a single success toast names the copied coordinates');
  await page().fill('#build-coords', '');
  assert.equal(await page().evaluate('return document.querySelector("#copy-coords").disabled;'), true,
    'the button disables when there is no coordinate');
});

/* ---------------------------------------------------------------- steppers */

async function stepperRow() {
  return page().evaluate(`
    const row = document.querySelector('#material-body .mat-row');
    const input = row.querySelector('[data-mat-field=needed]');
    const stepper = input.closest('.stepper');
    const buttons = stepper ? Array.from(stepper.querySelectorAll('.stepper__btn')) : [];
    const rect = (el) => el.getBoundingClientRect();
    const plus = stepper && stepper.querySelector('.stepper__btn[data-stepper-step="1"]');
    const minus = stepper && stepper.querySelector('.stepper__btn[data-stepper-step="-1"]');
    return {
      id: row.dataset.mat,
      needed: Number(input.value),
      inputType: input.getAttribute('type'),
      buttons: buttons.length,
      order: buttons.map((button) => button.dataset.stepperStep),
      texts: buttons.map((button) => button.textContent.trim()),
      plusLeftOfInput: !!(plus && minus && rect(plus).left < rect(input).left && rect(minus).left > rect(input).left),
      retired: row.querySelectorAll('.mat-step, #mat-steps, [data-step]').length,
      stepperWrapsInput: !!stepper && stepper.contains(input),
    };
  `);
}

async function modifierClick(selector, modifier) {
  return page().evaluate(`
    const button = document.querySelector(${JSON.stringify(selector)});
    if (!button) throw new Error('missing stepper button: ' + ${JSON.stringify(selector)});
    button.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true,
      shiftKey: ${modifier === 'shift'}, ctrlKey: ${modifier === 'ctrl'}
    }));
    return true;
  `);
}

test('39 each row carries a Needed text editor, read-only stock cells and no stepper (AC6/AC7)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const row = await page().evaluate(`
    const node = document.querySelector('#material-body .mat-row');
    const input = node.querySelector('[data-mat-field="needed"]');
    const got = node.querySelector('[data-mat-got]');
    const update = node.querySelector('[data-mat-update]');
    return {
      matId: node.getAttribute('data-mat'),
      role: node.getAttribute('role'),
      tabindex: node.getAttribute('tabindex'),
      input: input && { tag: input.tagName, type: input.type, mode: input.getAttribute('inputmode'), prev: input.getAttribute('data-prev'), value: input.value, label: input.getAttribute('aria-label') },
      got: got && { tag: got.tagName, title: got.getAttribute('title') },
      coveredTag: node.querySelector('[data-mat-covered]') ? node.querySelector('[data-mat-covered]').tagName : '',
      remainingTag: node.querySelector('[data-mat-remaining]') ? node.querySelector('[data-mat-remaining]').tagName : '',
      update: update && { tag: update.tagName, type: update.getAttribute('type') },
      hasMenu: !!node.querySelector('[data-mat-menu]'),
      hasRemove: !!node.querySelector('[data-mat-remove]'),
      retiredInRow: node.querySelectorAll('[data-step], .stepper, .stepper__btn, .mat-step, .mat-steps').length,
      retiredInPage: document.querySelectorAll('[data-step], .stepper, .stepper__btn, .mat-step, .mat-steps, #mat-steps').length,
    };
  `);
  assert.equal(row.role, 'row', 'a material row declares itself a table row');
  assert.equal(row.tabindex, '0', 'rows join the tab order');
  assert.ok(row.matId, 'the row identifies its material');
  assert.equal(row.input.tag, 'INPUT', 'Needed is an editable input');
  assert.equal(row.input.type, 'text', 'the Needed editor is a plain text input once the stepper is retired');
  assert.equal(row.input.mode, 'numeric', 'the editor still asks for a numeric keypad');
  assert.equal(row.input.prev, row.input.value, 'data-prev mirrors the committed value');
  assert.match(row.input.label, /^Needed /, 'the editor is labelled for its item');
  assert.equal(row.got.tag, 'SPAN', 'Got is read-only text, not a second editor');
  assert.match(row.got.title, /^World inventory for /, 'the Got cell explains where the number comes from');
  assert.equal(row.coveredTag, 'SPAN', 'Covered is a read-only cell');
  assert.equal(row.remainingTag, 'SPAN', 'Left is a read-only cell');
  assert.equal(row.update.tag, 'BUTTON', 'Update is a button');
  assert.equal(row.update.type, 'button', 'Update never submits a form');
  assert.ok(row.hasMenu && row.hasRemove, 'Remove hides inside the row overflow menu');
  assert.equal(row.retiredInRow, 0, 'no stepper inside the row');
  assert.equal(row.retiredInPage, 0, 'the whole stepper mechanism is retired (AC7)');
});

test('40 Enter and blur both commit the typed Needed value once (AC6)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const matId = await page().evaluate('return document.querySelector("#material-body .mat-row").getAttribute("data-mat");');
  const previous = await page().evaluate(`return document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev');`);
  assert.ok(Number(previous) >= 1, 'the editor starts from a committed value');
  const before = await appState();
  const materialsOf = (state) => state.worlds.flatMap((world) => world.builds).flatMap((build) => build.materials);
  const neededOf = (state, id) => materialsOf(state).find((mat) => mat.id === id).needed;

  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.value = '12';
    return true;
  `);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '12'`);
  const afterEnter = await appState();
  assert.equal(neededOf(afterEnter, matId), 12, 'Enter commits the typed value');
  assert.equal(neededOf(before, matId), Number(previous), 'and nothing before the press had committed');
  assert.equal(
    await page().evaluate(`return document.activeElement === document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');`),
    false,
    'the editor leaves focus after committing'
  );

  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.value = '13';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '13'`);
  const afterBlur = await appState();
  assert.equal(neededOf(afterBlur, matId), 13, 'a blur/change commits the typed value too');
  const others = (state) => JSON.stringify(materialsOf(state).filter((mat) => mat.id !== matId));
  assert.equal(others(afterBlur), others(before), 'one edit touches one material and nothing else');
});

test('41 the Needed editor never takes needed below one (AC6)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const matId = await page().evaluate('return document.querySelector("#material-body .mat-row").getAttribute("data-mat");');
  const neededOf = async () => {
    const state = await appState();
    return state.worlds.flatMap((world) => world.builds).flatMap((build) => build.materials).find((mat) => mat.id === matId).needed;
  };
  const initial = await neededOf();
  const commit = async (value) => {
    await page().evaluate(`
      const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
      input.focus();
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
  };

  await commit('0');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '1'`);
  assert.equal(await neededOf(), 1, 'a typed zero clamps to one');
  assert.notEqual(initial, 1, 'the fixture started above one, so the clamp was real');

  await commit('-9');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value === '1'`);
  assert.equal(await neededOf(), 1, 'a negative value never reaches the model');

  await commit('0.5');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value === '1'`);
  assert.equal(await neededOf(), 1, 'a fraction below one clamps as well');

  await commit('abc');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value === '1'`);
  assert.equal(await neededOf(), 1, 'a non-numeric entry is discarded, not committed');
  assert.equal(await page().attr('[data-mat="' + matId + '"] [data-mat-field="needed"]', 'data-prev'), '1');
});

test('42 the stack notation follows each item own stack size (egg 16, water bucket 1)', async () => {
  await injectState({
    version: 2,
    activeWorldId: 'w-stack',
    customItems: [],
    worlds: [{
      id: 'w-stack',
      name: 'Stack Lab',
      edition: 'java',
      version: '1.21.4',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      inventory: {},
      customItems: [],
      builds: [{
        id: 'b-stack',
        name: 'Stack Lab',
        status: 'building',
        active: true,
        coords: '',
        notes: '',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        customItems: [],
        materials: [
          { id: 'm-stone', item: 'Stone', needed: 7 },
          { id: 'm-egg', item: 'Egg', needed: 7 },
          { id: 'm-bucket', item: 'Water Bucket', needed: 7 },
        ],
      }],
    }],
  });
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const oracles = await page().evaluate(`
    return {
      eggStack: TrackerModel.stackSizeFor('egg'),
      bucketStack: TrackerModel.stackSizeFor('water_bucket'),
      stoneStack: TrackerModel.stackSizeFor('stone'),
      egg138: TrackerModel.formatUnits(138, 'egg', 'stacks'),
      stone138: TrackerModel.formatUnits(138, 'stone', 'stacks'),
      bucket138: TrackerModel.formatUnits(138, 'water_bucket', 'stacks'),
      egg20: TrackerModel.formatUnits(20, 'egg', 'stacks'),
    };
  `);
  assert.equal(oracles.eggStack, 16, 'the catalogue says an egg stacks to 16');
  assert.equal(oracles.bucketStack, 1, 'a water bucket does not stack');
  assert.equal(oracles.stoneStack, 64);
  assert.equal(oracles.egg138, '8 stacks + 10', 'the notation is per item, not per row');
  assert.equal(oracles.stone138, '2 stacks + 10');
  assert.equal(oracles.bucket138, '138 stacks');
  assert.equal(oracles.egg20, '1 stack + 4');

  await page().evaluate(`
    const input = document.querySelector('[data-mat="m-egg"] [data-mat-field="needed"]');
    input.focus();
    input.value = '138';
    return true;
  `);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor(`document.querySelector('[data-mat="m-egg"] [data-mat-field="needed"]').getAttribute('data-prev') === '138'`);
  const state = await appState();
  assert.equal(state.worlds[0].builds[0].materials.find((mat) => mat.id === 'm-egg').needed, 138);

  await page().click('#unit-toggle [data-unit="stacks"]');
  await page().waitFor('document.querySelector("#unit-toggle [data-unit=\\"stacks\\"]").getAttribute("aria-pressed") === "true"');
  const shown = await page().evaluate(`
    const value = (matId) => document.querySelector('[data-mat="' + matId + '"] [data-mat-field="needed"]').value;
    return { egg: value('m-egg'), stone: value('m-stone'), bucket: value('m-bucket') };
  `);
  assert.equal(shown.egg, oracles.egg138, 'the row editor renders the egg stack notation');
  assert.equal(shown.stone, '7', 'stone stays a plain count below one stack');
  assert.equal(shown.bucket, '7 stacks', 'the bucket counts stacks of one');
  assert.equal(await page().count('[data-step], .stepper, .stepper__btn, #mat-steps'), 0, 'no stepper node is involved');
});

test('43 the Needed editor is a text field that commits whole numbers (D5/AC6)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const matId = await page().evaluate('return document.querySelector("#material-body .mat-row").getAttribute("data-mat");');
  const attrs = await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    return { type: input.type, mode: input.getAttribute('inputmode'), tag: input.tagName };
  `);
  assert.equal(attrs.tag, 'INPUT');
  assert.equal(attrs.type, 'text', 'the contract fixes type=text for the row editor');
  assert.equal(attrs.mode, 'numeric', 'numeric entry is requested from the keyboard, not from a spinner widget');
  assert.equal(await page().count('[data-step], .stepper, .stepper__btn, .mat-step, .mat-steps, #mat-steps'), 0);

  const neededOf = async () => {
    const state = await appState();
    return state.worlds.flatMap((world) => world.builds).flatMap((build) => build.materials).find((mat) => mat.id === matId).needed;
  };
  const commit = async (value) => {
    await page().evaluate(`
      const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
      input.focus();
      input.value = ${JSON.stringify(value)};
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
  };

  await commit('042');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '42'`);
  assert.equal(await neededOf(), 42, 'a padded integer commits as its number');

  await commit('7.9');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '7'`);
  assert.equal(await neededOf(), 7, 'a fractional entry floors to a whole count');

  await commit('');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value === '7'`);
  assert.equal(await neededOf(), 7, 'an empty entry reverts instead of committing zero');
});

test('44 the material chooser opens the picker in pick-item mode (D8)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  assert.equal(await page().text('#icon-dialog-title'), 'Choose an item');
  assert.equal(await page().hidden('#icon-use'), true, 'no Use button in item mode');
  assert.equal(await page().hidden('#icon-upload-block'), true, 'no image upload for materials');
  assert.equal(await page().exists('#icon-grid [data-icon-none]'), false, 'no None tile in item mode');
  assert.ok((await page().count('#icon-grid .icon-tile')) > 0);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('!document.querySelector("#icon-dialog").open');
});

test('45 choosing an item fills the chip and adds its icon row (D8)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#mat-choice-name") !== null');
  assert.equal((await page().text('#mat-choice-name')).trim(), 'Choose item…', 'the chip starts empty');
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().fill('#icon-search', 'egg');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  const picked = await page().evaluate(`
    const tile = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug="egg"]'))
      .find((node) => node.querySelector('.icon-tile__name').textContent.trim() === 'Egg');
    if (!tile) return false;
    tile.click();
    return true;
  `);
  assert.equal(picked, true, 'the picker lists Egg');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  assert.equal((await page().text('#mat-choice-name')).trim(), 'Egg', 'the chip shows the chosen item');
  const slotSrc = await page().evaluate('return document.querySelector("#mat-choice-slot img") ? document.querySelector("#mat-choice-slot img").getAttribute("src") : "";');
  assert.match(slotSrc, /egg\.png$/, 'the chip carries the item icon');

  await page().fill('#mat-needed', '20');
  await page().click('#add-material-form button[type="submit"]');
  await page().waitFor('Array.from(document.querySelectorAll("#material-body .mat-row__name")).some((node) => node.textContent.trim() === "Egg")');
  const eggRow = (await materialRows()).find((row) => row.item === 'Egg');
  assert.ok(eggRow, 'the new material gets a row');
  assert.equal(eggRow.needed, '20', 'the typed Needed survives into the row');
  const iconSrc = await page().evaluate(`const row = document.querySelector('[data-mat="${eggRow.id}"]'); const img = row.querySelector('img'); return img ? img.getAttribute('src') : '';`);
  assert.match(iconSrc, /egg\.png$/, 'the row shows the same icon the picker resolved');
  assert.equal(await page().count('[data-step], .stepper, .stepper__btn, #mat-steps'), 0);
});

test('46 adding a material without choosing an item is refused inline (D8)', async () => {
  await reset();
  await openFirstBuild();
  const before = await page().count('#material-body .mat-row');
  await page().click('#add-material-form button[type="submit"]');
  assert.equal(await page().hidden('#mat-error'), false, 'the error is shown inline');
  assert.equal(await page().text('#mat-error'), 'A material needs an item name.');
  assert.equal(await page().count('#material-body .mat-row'), before, 'nothing was added');
});

/* -------------------------------------------------------------------- D9 */

test('47 the themed select path is active in this Chrome (D9)', async () => {
  await reset();
  const themed = await page().evaluate(`
    const select = document.querySelector('#world-select');
    return {
      supports: CSS.supports('appearance', 'base-select'),
      appearance: getComputedStyle(select).appearance,
      picker: (() => { try { return getComputedStyle(select, '::picker(select)').backgroundColor; } catch (e) { return null; } })(),
    };
  `);
  assert.equal(themed.supports, true, 'Chrome 155 supports appearance: base-select');
  assert.equal(themed.appearance, 'base-select', 'the select opts into the custom picker');
  if (themed.picker) assert.equal(themed.picker, 'rgb(111, 111, 111)', 'the picker panel uses the themed face');
  await shot('47-themed-select');
});

/* ------------------------------------------------------------------- D10 */

test('48 the strip keeps its 2560x640 geometry, one layer and the paused-under-reduce rule (AC11/R7)', async () => {
  await reset();
  await page().emulateReducedMotion(false);
  await page().waitFor('window.__backdrop !== undefined');
  const layer = await page().evaluate(`
    const nodes = Array.from(document.querySelectorAll('.backdrop > .backdrop__layer'));
    const style = nodes[0] ? getComputedStyle(nodes[0]) : null;
    return {
      count: nodes.length,
      filter: style && style.filter,
      backgroundImage: style && style.backgroundImage,
      animationName: style && style.animationName,
      animationDuration: style && style.animationDuration,
      pseudo: getComputedStyle(document.querySelector('.backdrop'), '::before').filter,
    };
  `);
  assert.equal(layer.count, 1, 'one layer paints the strip');
  assert.equal(layer.pseudo, 'none', 'the blur lives on the layer, not on a pseudo-element');
  const blur = /blur\(([\d.]+)px\)/.exec(layer.filter || '');
  assert.ok(blur, 'the layer carries a blur (' + layer.filter + ')');
  assert.ok(Number(blur[1]) <= 1, 'the blur is at most 1px (found ' + blur[1] + 'px)');
  assert.match(layer.backgroundImage, /backdrop\.webp/);
  assert.equal(layer.animationName, 'backdrop-drift');
  assert.equal(layer.animationDuration, '120s');
  const size = await page().evaluate(`
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 0, height: 0 });
      image.src = 'assets/panorama/backdrop.webp';
    });
  `);
  assert.deepEqual(size, { width: 2560, height: 640 }, 'the baked backdrop keeps its strip geometry');
  assert.equal(size.width, 4 * size.height, 'the strip keeps its 4:1 arithmetic');
  await page().emulateReducedMotion(true);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await page().waitFor('getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState === "paused"');
  const paused = await page().evaluate(`
    const style = getComputedStyle(document.querySelector('.backdrop > .backdrop__layer'));
    return { name: style.animationName, duration: style.animationDuration, playState: style.animationPlayState };
  `);
  assert.equal(paused.name, 'backdrop-drift', 'the animation is declared under reduce (never animation: none)');
  assert.equal(paused.duration, '120s', 'the duration survives reduce');
  assert.equal(paused.playState, 'paused', 'reduce defaults the strip to paused');
  await shot('48-backdrop-narrow-blur');
  // Emulated media is sticky across reloads; restore it so later cases start in the play state.
  await page().emulateReducedMotion(false);
});

test('49 the whole run stayed free of console errors', async () => {
  assert.deepEqual(app.consoleErrors, []);
});

/* ------------------------------------------- EDICT-0014 helpers (D2/D4/D5) *//** Open the icon picker from the selected build's avatar. */
async function openPicker() {
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
}

/** Fire a bubbling pointerover the way a real pointer would reach a delegated listener. */
async function pointerOver(selector) {
  return page().evaluate(`
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return 'missing';
    node.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget: null }));
    return 'ok';
  `);
}

async function pointerOut(selector) {
  return page().evaluate(`
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return 'missing';
    node.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: document.body }));
    return 'ok';
  `);
}

async function tooltipState() {
  return page().evaluate(`
    const tip = document.querySelector('#mc-tooltip');
    if (!tip) return null;
    const style = getComputedStyle(tip);
    const rect = tip.getBoundingClientRect();
    const visible = !tip.hidden && style.display !== 'none' && style.visibility !== 'hidden'
      && rect.width > 0 && rect.height > 0;
    return {
      visible,
      text: tip.textContent.trim(),
      inDialog: !!tip.closest('dialog[open]'),
      inViewport: rect.x >= -1 && rect.y >= -1 && rect.right <= window.innerWidth + 1
        && rect.bottom <= window.innerHeight + 1,
    };
  `);
}

async function loadPickerBatch(target) {
  await page().evaluate(`
    const grid = document.querySelector('#icon-grid');
    grid.scrollTop = grid.scrollHeight;
    return true;
  `);
  await page().waitFor(`document.querySelectorAll('#icon-grid [data-icon-slug]').length >= ${target}`, { timeout: 5000 });
}

/* ------------------------------------------ EDICT-0014 cases (D2-D11) */

test('50 the picker pages the whole catalog and works without IntersectionObserver (D2)', async () => {
  await reset();
  await openFirstBuild();
  await openPicker();
  assert.equal(await page().count('#icon-grid [data-icon-slug]'), 120, 'first batch of 120');
  let count = 120;
  for (let attempt = 0; attempt < 20 && count < 1368; attempt += 1) {
    await page().evaluate(`
      const grid = document.querySelector('#icon-grid');
      grid.scrollTop = grid.scrollHeight;
      return true;
    `);
    await page().waitFor(`document.querySelectorAll('#icon-grid [data-icon-slug]').length > ${count}`, { timeout: 4000 });
    count = await page().count('#icon-grid [data-icon-slug]');
  }
  assert.equal(count, 1368, 'the whole catalog is reachable by scrolling');
  const distinct = await page().evaluate(`
    return new Set(Array.from(document.querySelectorAll('#icon-grid [data-icon-slug]'))
      .map((tile) => tile.dataset.iconSlug)).size;
  `);
  assert.equal(distinct, 1368, 'every tile is a distinct slug');
  assert.match(await page().text('#icon-count-hint'), /showing 1368 of 1368/);
  const last = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#icon-grid [data-icon-slug]'));
    const tile = tiles[tiles.length - 1];
    tile.click();
    return tile.dataset.iconSlug;
  `);
  await page().click('#icon-use');
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const heading = (await page().text('#detail-heading')).trim();
  const build = world.builds.find((entry) => entry.name === heading);
  assert.ok(build, `the selected build is ${heading}`);
  assert.equal(build.icon && build.icon.slug, last, 'the last tile is usable and commits');
  await openPicker();
  await page().click('#icon-cancel');
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  await page().evaluate('delete window.IntersectionObserver; return true;');
  await openPicker();
  assert.equal(await page().count('#icon-grid [data-icon-slug]'), 120, 'the first batch is unchanged');
  await page().evaluate(`
    const grid = document.querySelector('#icon-grid');
    grid.scrollTop = grid.scrollHeight;
    grid.dispatchEvent(new Event('scroll'));
    return true;
  `);
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length > 120', { timeout: 4000 });
  assert.ok((await page().count('#icon-grid [data-icon-slug]')) >= 240,
    'the scroll fallback pages when IntersectionObserver is missing');
  await page().click('#icon-cancel');
});

test('51 typing a query resets the batch and reports its own match count (D2)', async () => {
  await reset();
  await openFirstBuild();
  await openPicker();
  await loadPickerBatch(240);
  await page().fill('#icon-search', 'stone');
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length > 0');
  const hint = await page().text('#icon-count-hint');
  assert.match(hint, /showing \d+ of \d+ for "stone"/, 'the hint names the query and its match count');
  assert.ok((await page().count('#icon-grid [data-icon-slug]')) <= 120, 'a query never renders more than one batch');
  await page().fill('#icon-search', '');
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length === 120');
  assert.match(await page().text('#icon-count-hint'), /showing 120 of 1368 — scroll for more/,
    'clearing the query restores the first batch and the scroll hint');
});

test('52 long names wrap instead of truncating at 1280 and 390 (D3)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await openFirstBuild();
  await openPicker();
  await page().fill('#icon-search', 'Wayfinder');
  await page().waitFor('document.querySelectorAll("#icon-grid [data-icon-slug]").length > 0');
  const longest = '.icon-tile__name';
  const measure = async (selector) => page().evaluate(`
    const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    return nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        text: node.textContent.trim(),
        overflow: style.textOverflow,
        whiteSpace: style.whiteSpace,
        clipped: node.scrollWidth > node.clientWidth + 1,
      };
    });
  `);
  for (const entry of await measure(longest)) {
    assert.notEqual(entry.overflow, 'ellipsis', `${entry.text} is not ellipsised`);
    assert.notEqual(entry.whiteSpace, 'nowrap', `${entry.text} may wrap`);
    assert.equal(entry.clipped, false, `${entry.text} fits its tile at 1280`);
  }
  await page().click('#icon-cancel');
  const rowsBefore = await page().count('#material-body .mat-row');
  await addMaterialViaPicker('Wayfinder', { slug: 'wayfinder_armor_trim_smithing_template', needed: 1 });
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore + 1}`);
  const wayfinder = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-body .mat-row')).some((row) => {
      const name = row.querySelector('.mat-row__name');
      return !!name && name.textContent.includes('Wayfinder');
    });
  `);
  assert.equal(wayfinder, true, 'the long-named material row is present');
  await page().setViewport(390, 844);
  await sleep(200);
  for (const entry of [...(await measure('.mat-row__name')), ...(await measure('#mat-choice-name'))]) {
    assert.notEqual(entry.overflow, 'ellipsis', `${entry.text} is not ellipsised at 390`);
    assert.equal(entry.clipped, false, `${entry.text} fits the phone width`);
  }
  await page().clearViewport();
});

test('53 the picker tooltip paints in the dialog top layer and hides on Escape (D4)', async () => {
  await reset();
  await openFirstBuild();
  await openPicker();
  await page().fill('#icon-search', 'stone');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  assert.equal(await pointerOver('#icon-grid .icon-tile[data-icon-slug]'), 'ok');
  await page().waitFor('document.querySelector("#mc-tooltip") && !document.querySelector("#mc-tooltip").hidden');
  const tip = await tooltipState();
  assert.ok(tip && tip.visible, 'the tooltip is visible');
  assert.ok(tip.text.length > 0, 'the tooltip carries the frozen data-tip text');
  assert.equal(tip.inDialog, true, 'the tooltip is appended inside the open dialog');
  assert.equal(tip.inViewport, true, 'the tooltip is clamped into the viewport');
  const topmost = await page().evaluate(`
    const tip = document.querySelector('#mc-tooltip');
    const rect = tip.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return !!hit && (hit === tip || tip.contains(hit));
  `);
  assert.equal(topmost, true, 'the tooltip is the topmost element at its centre');
  await page().press('Escape');
  await page().waitFor('!document.querySelector("#mc-tooltip") || document.querySelector("#mc-tooltip").hidden');
});

test('54 tooltips work on material rows and inside the world dialog (D4)', async () => {
  await reset();
  await openFirstBuild();
  assert.equal(await pointerOver('#material-body .mat-row .slot'), 'ok');
  await page().waitFor('document.querySelector("#mc-tooltip") && !document.querySelector("#mc-tooltip").hidden');
  const rowTip = await tooltipState();
  assert.ok(rowTip.text.length > 0, 'a material row reveals its item name');
  assert.equal(rowTip.inDialog, false, 'with no dialog open the tooltip lives on the body');
  await pointerOut('#material-body .mat-row .slot');
  await page().waitFor('!document.querySelector("#mc-tooltip") || document.querySelector("#mc-tooltip").hidden');
  await page().click('#tab-worlds');
  await page().click('#btn-new-world-2');
  await page().waitFor('document.querySelector("#world-dialog").open');
  assert.equal(await pointerOver('#world-icon'), 'ok');
  await page().waitFor('document.querySelector("#mc-tooltip") && !document.querySelector("#mc-tooltip").hidden');
  const worldTip = await tooltipState();
  assert.equal(worldTip.inDialog, true, 'inside the world dialog the tooltip attaches to it');
  await page().click('#world-dialog button[value="cancel"]');
});

test('55 every zero state offers its next action (D5)', async () => {
  await reset({ demo: false });
  await page().click('#tab-worlds');
  assert.equal(await page().hidden('#world-empty'), false, 'worlds empty state visible');
  const worldCta = await page().evaluate(`
    const button = document.querySelector('#world-empty #btn-empty-create-world');
    return button ? { exists: true, hidden: button.hidden } : { exists: false };
  `);
  assert.equal(worldCta.exists, true, '#world-empty carries #btn-empty-create-world');
  await page().click('#world-empty #btn-empty-create-world');
  await page().waitFor('document.querySelector("#world-dialog").open');
  await page().fill('#world-name', 'Fresh World');
  await page().click('#world-save');
  await page().waitFor('!document.querySelector("#world-dialog").open');
  await page().click('#tab-builds');
  assert.equal(await page().hidden('#build-empty'), false, 'no-build state after the first world');
  await page().click('#build-empty #btn-first-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Empty Build');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  const detailCta = await page().evaluate(`
    const empty = document.querySelector('#detail-empty');
    const action = document.querySelector('#detail-empty-action');
    return {
      hidden: !empty || empty.hidden,
      action: !!action,
      inside: !!action && !!empty && empty.contains(action),
      actionHidden: !action || action.hidden,
    };
  `);
  assert.equal(detailCta.action, true, '#detail-empty carries its action');
  assert.equal(detailCta.inside, true, 'the action lives inside #detail-empty');
  assert.equal(detailCta.actionHidden, false, 'the action is rendered, not a dead node');
  assert.equal(detailCta.hidden, true, 'with a build selected the detail empty state is hidden');
  const materialEmpty = await page().evaluate(`
    const empty = document.querySelector('#material-empty');
    const button = document.querySelector('#btn-empty-pick-material');
    return { exists: !!empty, button: !!button, buttonInside: !!(empty && empty.contains(button)) };
  `);
  assert.equal(materialEmpty.exists, true, '#material-empty is a container');
  assert.equal(materialEmpty.buttonInside, true, '#btn-empty-pick-material lives in it');
  await page().click('#btn-empty-pick-material');
  await page().waitFor('document.activeElement && document.activeElement.id === "mat-choice"',
    { timeout: 3000 });
  await reset();
  await openFirstBuild();
  await page().click('#tab-materials');
  await page().fill('#mat-search', 'zzz-no-such-item');
  await page().waitFor('!document.querySelector("#world-material-empty").hidden');
  const resetCta = await page().evaluate(`
    const empty = document.querySelector('#world-material-empty');
    const button = document.querySelector('#btn-empty-reset-filter');
    return { button: !!button, inside: !!(empty && empty.contains(button)) };
  `);
  assert.equal(resetCta.button, true, '#btn-empty-reset-filter exists');
  assert.equal(resetCta.inside, true, 'the reset control lives in the filtered empty state');
  await page().click('#btn-empty-reset-filter');
  await page().waitFor('document.querySelector("#mat-search").value === ""');
  assert.equal(await page().hidden('#world-material-empty'), true, 'resetting the filter brings the rows back');
});

test('56 the avatar suggests an icon without storing it (D8)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Gold Vault');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  const avatar = await page().evaluate(`
    const node = document.querySelector('#detail-avatar');
    return { auto: node.dataset.iconAuto, title: node.title, html: node.innerHTML };
  `);
  assert.equal(avatar.auto, 'true', 'the avatar marks a suggestion');
  assert.match(avatar.title, /matched "gold" in the name/, 'the title explains the reason');
  assert.match(avatar.html, /assets\/icons\/gold_block\.png/, 'the suggested icon is shown');
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const build = world.builds.find((entry) => entry.name === 'Gold Vault');
  assert.equal(build.icon, null, 'a suggestion is never stored on the build');
  await openPicker();
  assert.match(await page().text('#icon-suggest-note'), /Suggested from "gold"/);
  assert.equal(await page().evaluate('return !!document.querySelector("#icon-grid [data-icon-suggested=true]");'),
    true, 'the suggested tile is marked');
  await page().click('#icon-grid [data-icon-suggested=true]');
  await page().click('#icon-use');
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  const saved = await appState();
  const savedWorld = saved.worlds.find((entry) => entry.id === saved.activeWorldId);
  const savedBuild = savedWorld.builds.find((entry) => entry.name === 'Gold Vault');
  assert.equal(savedBuild.icon && savedBuild.icon.slug, 'gold_block', 'choosing the suggestion stores it');
  assert.equal(savedBuild.iconAuto, false, 'a manual choice clears the auto flag');
});

test('57 a stored icon is never replaced by the suggestion (D8)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Wheat Farm');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  await page().click('#build-rename');
  await page().fill('#build-name', 'Wheat Farm Manual');
  await page().press('Enter');
  await openPicker();
  await page().fill('#icon-search', 'apple');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  await page().click('#icon-grid [data-icon-slug=apple]');
  await page().click('#icon-use');
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  await page().click('#build-rename');
  await page().fill('#build-name', 'Wheat Farm');
  await page().press('Enter');
  const after = await page().evaluate(`
    const node = document.querySelector('#detail-avatar');
    return { auto: node.dataset.iconAuto || '', html: node.innerHTML, title: node.title };
  `);
  assert.equal(after.auto, '', 'a stored icon is not an auto suggestion');
  assert.match(after.html, /assets\/icons\/apple\.png/, 'the manual apple survives the rename');
});

test('58 bulk paste previews merged and unmatched lines and commits once (D12)', async () => {
  await injectState({
    version: 2,
    activeWorldId: 'w-paste',
    customItems: [],
    worlds: [{
      id: 'w-paste',
      name: 'Test Vault',
      edition: 'java',
      version: '1.21.4',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      inventory: {},
      customItems: [],
      builds: [{
        id: 'b-paste',
        name: 'Test Vault',
        status: 'building',
        active: true,
        coords: '',
        notes: '',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        customItems: [],
        materials: [],
      }],
    }],
  });
  await page().waitFor('document.querySelector("#material-body") !== null');
  await page().click('#bulk-paste');
  await page().waitFor('document.querySelector("#paste-preview").open === true');
  assert.equal(await page().count('#bulk-dialog'), 0, 'the retired bulk dialog is gone');
  assert.equal(await page().count('#bulk-input'), 0);
  assert.equal(await page().count('#bulk-review'), 0);
  assert.equal(await page().count('#bulk-add'), 0);
  assert.equal(await page().evaluate('return document.querySelector("#paste-ok").disabled;'), true, 'an empty paste cannot be imported');
  assert.match(await page().text('#paste-context'), /Nothing parsed yet/);

  await page().fill('#paste-text', '64 stone bricks\n20x oak log\n3 stone bricks\n1 oak log\nmystery goo');
  await page().waitFor('document.querySelector("#paste-rows").getAttribute("data-count") === "2"');
  const preview = await page().evaluate(`
    return Array.from(document.querySelectorAll('#paste-rows .paste-row')).map((row) => ({
      slug: row.getAttribute('data-slug'),
      qty: row.querySelector('.paste-row__qty').textContent.trim(),
    }));
  `);
  assert.deepEqual(preview, [
    { slug: 'stone_bricks', qty: '67' },
    { slug: 'oak_log', qty: '21' },
  ], 'repeated lines are merged before the preview');
  assert.match(await page().text('#paste-errors'), /^1 line was not understood: mystery goo$/);
  assert.match(await page().text('#paste-context'), /2 lines ready to import/);
  assert.equal(await page().evaluate('return document.querySelector("#paste-ok").disabled;'), false);

  await page().fill('#paste-text', 'only nonsense here\nand more');
  await page().waitFor('document.querySelector("#paste-rows").getAttribute("data-count") === "0"');
  assert.equal(await page().evaluate('return document.querySelector("#paste-ok").disabled;'), true, 'nothing parsable disables Import');
  assert.match(await page().text('#paste-errors'), /^2 lines were not understood: only nonsense here, and more$/);

  await page().fill('#paste-text', '64 stone bricks\n20x oak log\n3 stone bricks\n1 oak log\nmystery goo');
  await page().waitFor('document.querySelector("#paste-rows").getAttribute("data-count") === "2"');
  await page().click('#paste-ok');
  await page().waitFor('document.querySelector("#paste-preview").open === false');
  const rows = await materialRows();
  assert.deepEqual(rows.map((row) => [row.item, row.needed]), [['Stone Bricks', '67'], ['Oak Log', '21']], 'the merged rows land in the build');
  assert.match((await toastText()).trim(), /^2 materials added\.$/, 'the toast counts the merged rows');
  const state = await appState();
  assert.equal(state.worlds[0].builds[0].materials.length, 2, 'the import commits once, two materials');

  await page().click('#bulk-paste');
  await page().waitFor('document.querySelector("#paste-preview").open === true');
  await page().fill('#paste-text', '5 dirt');
  await page().waitFor('document.querySelector("#paste-rows").getAttribute("data-count") === "1"');
  await page().click('#paste-cancel');
  await page().waitFor('document.querySelector("#paste-preview").open === false');
  assert.equal((await materialRows()).length, 2, 'Cancel imports nothing');
});

test('59 undo restores a deleted material, and expires after six seconds (D10)', async () => {
  await reset();
  await openFirstBuild();
  const before = await appState();
  const rowsBefore = await page().count('#material-body .mat-row');
  assert.ok(rowsBefore >= 1, 'the demo build starts with materials');
  await deleteRowViaMenu();
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore - 1}`);
  assert.equal(await page().hidden('#toast-action'), false, 'the toast offers Undo');
  await page().waitFor('document.querySelector("#toast").textContent.includes("Undo")');
  await page().click('#toast-action');
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore}`);
  assert.deepEqual(await appState(), before, 'the restore is a deep-equal snapshot');
  await deleteRowViaMenu();
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore - 1}`);
  await sleep(6800);
  const expired = await page().evaluate(`
    const action = document.querySelector('#toast-action');
    return { hidden: !action || action.hidden || !action.offsetParent, text: document.querySelector('#toast').textContent.trim() };
  `);
  assert.equal(expired.hidden, true, 'the undo action is gone after six seconds');
});

test('60 undo restores a deleted build and its selection (D10)', async () => {
  await reset();
  await openFirstBuild();
  const before = await appState();
  const name = await page().text('#detail-heading');
  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-ok');
  await page().waitFor('document.querySelector("#confirm-dialog") && !document.querySelector("#confirm-dialog").open');
  await page().click('#toast-action');
  await page().waitFor('document.querySelectorAll("#build-list .build-entry").length > 0');
  assert.deepEqual(await appState(), before, 'the build and its materials are restored');
  assert.ok((await page().text('#detail-heading')).includes(name.trim()),
    'the restored build is selected again');
});

test('61 undo restores a deleted world (D10)', async () => {
  await reset();
  await page().click('#tab-worlds');
  await page().click('#btn-new-world-2');
  await page().waitFor('document.querySelector("#world-dialog").open');
  await page().fill('#world-name', 'Doomed World');
  await page().click('#world-save');
  await page().waitFor('!document.querySelector("#world-dialog").open');
  const before = await appState();
  await page().click('#tab-worlds');
  await page().evaluate(`
    const cards = Array.from(document.querySelectorAll('#world-cards .world-card'));
    const card = cards.find((entry) => entry.textContent.includes('Doomed World'));
    card.querySelector('[data-world-delete]').click();
    return true;
  `);
  await page().waitFor('document.querySelector("#confirm-dialog").open');
  await page().click('#confirm-ok');
  await page().waitFor('!document.querySelector("#confirm-dialog").open');
  await page().click('#toast-action');
  await page().waitFor('document.querySelectorAll("#world-cards .world-card").length >= 3');
  assert.deepEqual(await appState(), before, 'the world and its builds come back unchanged');
});

test('62 recent picks come first in the unfiltered picker (D11)', async () => {
  await reset();
  await openFirstBuild();
  for (const name of ['apple', 'dirt']) {
    await page().click('#detail-avatar');
    await page().waitFor('document.querySelector("#icon-dialog").open');
    await page().fill('#icon-search', name);
    await page().waitFor(`document.querySelector('#icon-grid [data-icon-slug=${name}]') !== null`);
    await page().click(`#icon-grid [data-icon-slug=${name}]`);
    await page().click('#icon-use');
    await page().waitFor('!document.querySelector("#icon-dialog").open');
  }
  await openPicker();
  const order = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'));
    return {
      recent: tiles.filter((tile) => tile.dataset.iconRecent === 'true').map((tile) => tile.dataset.iconSlug),
      firstSlugs: tiles.slice(0, 2).map((tile) => tile.dataset.iconSlug),
    };
  `);
  assert.deepEqual(order.recent, ['dirt', 'apple'], 'the two picks are recent, latest first');
  assert.deepEqual(order.firstSlugs, ['dirt', 'apple'], 'recent tiles lead the first batch');
  await page().click('#icon-cancel');
});

test('63 recents survive a reload, cap at eight and drop unknown slugs (D11)', async () => {
  await reset();
  const seeded = ['stone', 'dirt', 'apple', 'glass', 'egg', 'torch', 'sand', 'oak_log', 'gravel', 'coal', 'not_a_real_slug', 'stone'];
  await page().evaluate(`localStorage.setItem('mc-build-tracker:recent', ${JSON.stringify(JSON.stringify(seeded))}); return true;`);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await openFirstBuild();
  await openPicker();
  const recents = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'));
    return tiles.filter((tile) => tile.dataset.iconRecent === 'true').map((tile) => tile.dataset.iconSlug);
  `);
  assert.equal(recents.length, 8, 'the list caps at eight');
  assert.deepEqual(recents, seeded.slice(0, 8), 'order and dedupe survive; the unknown slug is dropped');
  const exported = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    return window.TrackerModel.exportJSON(state);
  `);
  assert.equal(exported.includes('mc-build-tracker:recent'), false, 'recents are browser-local, not exported');
  await page().click('#icon-cancel');
});

test('64 blur commits each row and the stack notation stays per item (D6/AC6)', async () => {
  await injectState({
    version: 2,
    activeWorldId: 'w-mix',
    customItems: [],
    worlds: [{
      id: 'w-mix',
      name: 'Mixed Stack',
      edition: 'java',
      version: '1.21.4',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
      inventory: {},
      customItems: [],
      builds: [{
        id: 'b-mix',
        name: 'Mixed Stack',
        status: 'building',
        active: true,
        coords: '',
        notes: '',
        createdAt: '2026-10-01T00:00:00.000Z',
        updatedAt: '2026-10-01T00:00:00.000Z',
        customItems: [],
        materials: [
          { id: 'm-mix-stone', item: 'Stone', needed: 7 },
          { id: 'm-mix-egg', item: 'Egg', needed: 7 },
          { id: 'm-mix-bucket', item: 'Water Bucket', needed: 7 },
        ],
      }],
    }],
  });
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');

  const wanted = [
    { matId: 'm-mix-stone', value: '9' },
    { matId: 'm-mix-egg', value: '18' },
    { matId: 'm-mix-bucket', value: '11' },
  ];
  for (const entry of wanted) {
    await page().evaluate(`
      const input = document.querySelector('[data-mat="${entry.matId}"] [data-mat-field="needed"]');
      input.focus();
      input.value = ${JSON.stringify(entry.value)};
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
    await page().waitFor(`document.querySelector('[data-mat="${entry.matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === ${JSON.stringify(entry.value)}`);
  }
  const state = await appState();
  const materials = state.worlds[0].builds[0].materials;
  assert.equal(materials.find((mat) => mat.id === 'm-mix-stone').needed, 9, 'every row commits its own value');
  assert.equal(materials.find((mat) => mat.id === 'm-mix-egg').needed, 18);
  assert.equal(materials.find((mat) => mat.id === 'm-mix-bucket').needed, 11);

  const shownInItems = await page().evaluate(`
    const value = (matId) => document.querySelector('[data-mat="' + matId + '"] [data-mat-field="needed"]').value;
    return { stone: value('m-mix-stone'), egg: value('m-mix-egg'), bucket: value('m-mix-bucket') };
  `);
  assert.deepEqual(shownInItems, { stone: '9', egg: '18', bucket: '11' }, 'items mode shows plain counts');

  await page().click('#unit-toggle [data-unit="stacks"]');
  await page().waitFor('document.querySelector("#unit-toggle [data-unit=\\"stacks\\"]").getAttribute("aria-pressed") === "true"');
  const shownInStacks = await page().evaluate(`
    const value = (matId) => document.querySelector('[data-mat="' + matId + '"] [data-mat-field="needed"]').value;
    return {
      stone: value('m-mix-stone'), egg: value('m-mix-egg'), bucket: value('m-mix-bucket'),
      eggOracle: TrackerModel.formatUnits(18, 'egg', 'stacks'),
      bucketOracle: TrackerModel.formatUnits(11, 'water_bucket', 'stacks'),
    };
  `);
  assert.equal(shownInStacks.egg, shownInStacks.eggOracle, 'the egg row renders 16-egg stacks');
  assert.equal(shownInStacks.bucket, shownInStacks.bucketOracle, 'the bucket row renders one-item stacks');
  assert.equal(shownInStacks.stone, '9', 'stone stays plain below one stack');
  const afterUnits = await appState();
  assert.deepEqual(afterUnits.worlds[0].builds[0].materials, materials, 'switching units never changes the stored counts');
  assert.equal(await page().count('[data-step], .stepper, .stepper__btn, #mat-steps'), 0);
});

test('65 the suggestion is pure, deterministic and null with two arguments (D8)', async () => {
  await reset();
  const probe = await page().evaluate(`
    const catalog = window.MC_ICON_SET.map((slug) => ({ slug, name: window.MC_ICON_NAMES[slug] }));
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const build = world.builds[0];
    const before = JSON.stringify(state);
    const two = window.TrackerModel.suggestIcon(build, world);
    const three = window.TrackerModel.suggestIcon(build, world, catalog);
    const again = window.TrackerModel.suggestIcon(build, world, catalog);
    return { two, three, stable: JSON.stringify(three) === JSON.stringify(again), stateUnchanged: JSON.stringify(state) === before };
  `);
  assert.equal(probe.two, null, 'two arguments return null');
  assert.equal(probe.stable, true, 'three arguments are deterministic');
  assert.equal(probe.stateUnchanged, true, 'the helper is pure');
  const gold = await page().evaluate(`
    const catalog = window.MC_ICON_SET.map((slug) => ({ slug, name: window.MC_ICON_NAMES[slug] }));
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    return window.TrackerModel.suggestIcon(
      { name: 'Gold Vault', notes: '', coords: '', materials: [] }, world, catalog
    );
  `);
  assert.equal(gold && gold.slug, 'gold_block', 'the frozen keyword table decides');
  assert.equal(gold && gold.reason, 'matched "gold" in the name');
});

/* ------------------------------------------------------------- suite tail */

/* ------------------------------------------------- EDICT-0015 (S5 cases) */

async function buildNames() {
  return page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((node) => node.textContent.trim());
  `);
}

/* EDICT-0017: `injectState` seeds a **v2** document (any version the fixture carries is run
   through the model's importer first, so v1 fixtures land as v2 exactly as the app would). */
async function injectState(state) {
  await page().goto(fileUrl('src/index.html?tab=builds'));
  await page().evaluate(`
    const result = window.TrackerModel.importJSON(${JSON.stringify(JSON.stringify(state))});
    if (result.error) throw new Error(result.error);
    localStorage.removeItem('mc-build-tracker:v1');
    localStorage.setItem('mc-build-tracker:v2', JSON.stringify(result.state));
    return true;
  `);
  // A second goto() to the identical URL can be served from the already-complete document and
  // race the reload, so the injected state must be read by a genuinely fresh navigation.
  const stamp = Date.now();
  await page().goto(fileUrl('src/index.html?tab=builds&fixture=' + stamp));
  await page().waitFor('document.querySelector("#world-select") !== null && window.TrackerModel !== undefined');
}

/* EDICT-0017 migration cases: a legacy document only under `:v1`, with `:v2` cleared, so the
   loader has to migrate. */
async function injectV1State(state) {
  await page().goto(fileUrl('src/index.html?tab=builds'));
  await page().evaluate(
    'localStorage.removeItem("mc-build-tracker:v2");'
    + 'localStorage.setItem("mc-build-tracker:v1", ' + JSON.stringify(JSON.stringify(state)) + '); return true;'
  );
  const stamp = Date.now();
  await page().goto(fileUrl('src/index.html?tab=builds&fixture=' + stamp));
  await page().waitFor('document.querySelector("#world-select") !== null && window.TrackerModel !== undefined');
}

const FIXTURES_0015 = path.join(ROOT, 'tests', 'qa', 'edict-0015-fixtures');
const FIXTURES_0016 = path.join(ROOT, 'tests', 'qa', 'edict-0016-fixtures');
const FIXTURES_0017 = path.join(ROOT, 'tests', 'qa', 'edict-0017-fixtures');

function fixture(name) {
  return path.join(FIXTURES_0015, name);
}

function fixture16(name) {
  return path.join(FIXTURES_0016, name);
}

function fixture17(name) {
  return path.join(FIXTURES_0017, name);
}

// Load an exported backup text through the model, persist it and reload, so cases can start from a
// frozen fixture without driving the import dialog each time.
async function loadBackupText(text) {
  const imported = await page().evaluate(`
    const result = window.TrackerModel.importJSON(${JSON.stringify(text)});
    if (result.error) return false;
    localStorage.removeItem('mc-build-tracker:v1');
    localStorage.setItem('mc-build-tracker:v2', window.TrackerModel.exportJSON(result.state));
    return true;
  `);
  assert.equal(imported, true, 'the fixture is a valid backup');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
}

test('67 builds sort building, planned, done and keep registry order inside a rank (AC1)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('route-shuffle.v1.json'), 'utf8'));
  const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
  const expected = world.builds.map((build) => build.name);
  await injectState(state);
  assert.deepEqual(await buildNames(), expected, 'the shuffled registry renders in rank order, stable inside a rank');
  const current = await page().evaluate(`return document.querySelector('#build-list [aria-current="true"] .build-entry__name').textContent.trim();`);
  assert.ok(current.length > 0, 'a build stays selected through the re-sort');
  await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Weekend Cottage');
    entry.click();
    return true;
  `);
  await page().waitFor(`document.querySelector('#detail-heading').textContent.trim() === 'Weekend Cottage'`);
  await page().click('#status-group [data-status="done"]');
  // EDICT-0018 item 11: the registry order is the user's priority; marking a build done must not
  // silently move it, only its badge changes.
  assert.deepEqual(await buildNames(), expected, 'a status change keeps the registry order');
  assert.equal(await page().evaluate('return document.querySelector("#status-group [data-status=\\"done\\"]").getAttribute("aria-pressed");'), 'true');
});

test('68 the world header derives its stats and the retired summary block is gone (AC2)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#world-progress-text") !== null');
  const expected = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
    const summary = TrackerModel.worldSummary(world);
    return { text: TrackerModel.progressText(summary.covered, summary.needed), pct: summary.pct, needed: summary.needed, covered: summary.covered };
  `);
  assert.match(expected.text, /^\d+ \/ \d+ items gathered \(\d+%\)$/, 'the progress copy follows the contract phrase');
  assert.equal((await page().text('#world-progress-text')).trim(), expected.text, 'the sidebar prints the model progress line');
  assert.equal(Number(await page().attr('#world-bar', 'aria-valuenow')), expected.pct, 'the bar reports the same percentage');
  assert.equal(await page().evaluate('return document.querySelector("#world-fill").style.width;'), expected.pct + '%');
  assert.equal(await page().attr('#world-bar', 'role'), 'progressbar');
  assert.equal(await page().exists('#world-panel #world-progress'), true, 'the progress lives in the world panel');

  const retired = ['#build-pct', '#build-summary', '#build-bar', '#build-fill', '#world-summary', '#world-remaining'];
  for (const selector of retired) assert.equal(await page().count(selector), 0, selector + ' stays retired');
  assert.equal(/still to collect|items gathered ·|of \d+ items/.test(await page().text('#world-panel')), false, 'the EDICT-0016 summary copy is gone');

  const meta = (await page().text('#world-meta')).trim();
  assert.match(meta, /Java/, 'the identity keeps the edition');
  assert.match(meta, /1\.21\.4/, 'the identity keeps the version');
  assert.match(meta, /3 builds/, 'the identity keeps the build count');
  assert.doesNotMatch(meta, /gathered/, 'the header never repeats the progress line');
});

test('69 zero worlds and zero materials show honest states, not NaN (AC2/AC5)', async () => {
  await reset({ demo: false });
  await page().waitFor('document.querySelector("#world-select") !== null');
  assert.equal((await page().text('#world-meta')).trim(), 'No world selected');
  assert.equal((await page().text('#world-progress-text')).trim(), '', 'no world means no invented progress');
  assert.equal(await page().hidden('#world-progress'), false, 'the progress block stays laid out when empty');
  assert.equal((await page().text('#detail-progress-text')).trim(), '0 / 0 items gathered (0%)');
  assert.equal(await page().hidden('#detail-body'), true, 'with no build selected the detail stays empty');
  assert.equal(/NaN/.test(await page().text('body')), false, 'no NaN leaks into the page');

  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog").open === true');
  await page().fill('#world-name', 'Empty Probe');
  await page().click('#world-save');
  await page().waitFor('document.querySelector("#world-dialog").open === false');
  await page().waitFor('document.querySelector("#world-select").value !== ""');
  const meta = (await page().text('#world-meta')).trim();
  assert.match(meta, /^Java 1\.21 · 0 builds/, 'the new world reports zero builds');
  assert.equal((await page().text('#world-progress-text')).trim(), '0 / 0 items gathered (0%)');
  assert.equal(await page().attr('#world-bar', 'aria-valuenow'), '0');
  assert.equal(await page().evaluate('return document.querySelector("#world-fill").style.width;'), '0%');
  assert.equal((await page().text('#detail-progress-text')).trim(), '0 / 0 items gathered (0%)');
  assert.equal(await page().hidden('#detail-empty'), false, 'the empty detail explains itself');
  assert.equal(await page().count('#material-body .mat-row'), 0);
  assert.equal(/NaN/.test(await page().text('body')), false, 'still no NaN after the empty world');
});

test('70 labels, controls and the materials toolbar share their measured lines (AC3)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await page().waitFor('document.querySelector("#material-table .mtable__head") !== null');
  const boxes = await page().evaluate(`
    const rect = (selector) => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    return {
      choiceLabel: rect('label[for="mat-choice"]'), choice: rect('#mat-choice'),
      neededLabel: rect('label[for="mat-needed"]'), needed: rect('#mat-needed'),
      add: rect('#add-material-form button[type="submit"]'),
      toolbar: rect('#mat-toolbar'), sortField: rect('#mat-toolbar .field'), sort: rect('#mat-sort'), hideDone: rect('#mat-hide-done'), toggle: rect('.mat-viewtoggle'),
      scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
    };
  `);
  assert.ok(boxes.choiceLabel && boxes.choice && boxes.neededLabel && boxes.needed, 'the add form and its labels exist');
  assert.ok(Math.abs(boxes.choiceLabel.left - boxes.choice.left) <= 2, 'the Item label sits on its control column');
  assert.ok(Math.abs(boxes.neededLabel.left - boxes.needed.left) <= 2, 'the Needed label sits on its control column');
  assert.ok(Math.abs(boxes.choiceLabel.bottom - boxes.neededLabel.bottom) <= 1, 'both labels share a baseline');
  assert.ok(boxes.choiceLabel.bottom <= boxes.choice.top + 2, 'the label sits above its control');
  const tops = [boxes.choice.top, boxes.needed.top, boxes.add.top];
  assert.ok(Math.max(...tops) - Math.min(...tops) <= 2, 'the add-form controls share one line, saw tops ' + tops.join('/'));
  const centres = [boxes.sortField, boxes.hideDone, boxes.toggle].map((box) => (box.top + box.bottom) / 2);
  assert.ok(Math.max(...centres) - Math.min(...centres) <= 3, 'the toolbar controls are centred together');
  assert.ok(boxes.sort.top >= boxes.toolbar.top && boxes.sort.bottom <= boxes.toolbar.bottom + 1, 'the toolbar contains its controls');
  assert.ok(boxes.scrollWidth <= boxes.clientWidth + 1, 'no horizontal page overflow at 1280');

  await page().setViewport(390, 844);
  await page().waitFor('document.documentElement.clientWidth === 390');
  const narrow = await page().evaluate('return { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth };');
  assert.ok(narrow.scrollWidth <= narrow.clientWidth + 1, 'no horizontal page overflow at 390');
  await page().clearViewport();
});

test('71 the frozen fixture meets the section 6 width and above-the-fold budget (AC7)', async () => {
  const budget = JSON.parse(fs.readFileSync(fixture('budget-state.json'), 'utf8'));
  await injectState(budget);
  await page().setViewport(1280, 900);
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const boxes = await page().evaluate(`
    const rect = (selector) => {
      const node = document.querySelector(selector);
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const rows = Array.from(document.querySelectorAll('#material-body .mat-row')).map((row) => {
      const box = row.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
    return {
      main: rect('#main'), panel: rect('#world-panel'), list: rect('#build-list'), detail: rect('#detail-body'),
      header: rect('#build-header'), progress: rect('#detail-progress'), toolbar: rect('#mat-toolbar'), table: rect('#material-table'),
      visibleRows: rows.filter((row) => row.top >= 0 && row.bottom <= 900).length,
      rowCount: rows.length,
      scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
      tableOverflow: getComputedStyle(document.querySelector('#material-body')).overflowY,
    };
  `);
  assert.ok(Math.abs(boxes.main.width - 1232) <= 1, '#main is 1232 wide at 1280 (contract section 6), saw ' + boxes.main.width);
  assert.ok(boxes.panel.width >= 190 && boxes.panel.width <= 210, '#world-panel is 190-210 wide, saw ' + boxes.panel.width);
  assert.ok(boxes.list.width >= 360, 'the build list is at least 360 wide, saw ' + boxes.list.width);
  assert.ok(boxes.detail.width >= 640, 'the detail column is at least 640 wide, saw ' + boxes.detail.width);
  assert.ok(boxes.header.bottom <= boxes.progress.top + 1, 'the header does not overlap the progress band');
  assert.ok(boxes.progress.bottom <= boxes.toolbar.top + 1, 'the progress band does not overlap the toolbar');
  assert.ok(boxes.toolbar.bottom <= boxes.table.top + 1, 'the toolbar does not overlap the table');
  assert.ok(boxes.table.left >= boxes.detail.left - 1 && boxes.table.right <= boxes.detail.right + 1, 'the table stays inside the detail column');
  assert.ok(boxes.visibleRows >= 6, 'at least six material rows fit above the fold, saw ' + boxes.visibleRows + ' of ' + boxes.rowCount);
  assert.ok(!['auto', 'scroll'].includes(boxes.tableOverflow), 'the table is not an inner scroll box, saw ' + boxes.tableOverflow);
  assert.ok(boxes.header.top < 900 && boxes.progress.bottom < 900 && boxes.toolbar.bottom < 900, 'header, progress and toolbar are above the fold');
  assert.ok(boxes.scrollWidth <= boxes.clientWidth + 1, 'no horizontal page overflow at 1280');

  await page().setViewport(390, 844);
  await page().waitFor('document.documentElement.clientWidth === 390');
  const narrow = await page().evaluate(`
    return {
      scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth,
      stacked: Array.from(document.querySelectorAll('#material-body .mat-row')).every((row) => row.getBoundingClientRect().height > 60),
    };
  `);
  assert.ok(narrow.scrollWidth <= narrow.clientWidth + 1, '390 has no horizontal page overflow');
  assert.equal(narrow.stacked, true, 'the narrow row layout stacks instead of squeezing eight cells onto one line');
  await page().clearViewport();
});

test('72 the add form keeps a numeric Needed field with resolved stack semantics (AC6)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#mat-needed") !== null');
  const attrs = await page().evaluate(`
    const input = document.querySelector('#mat-needed');
    return {
      type: input.type, mode: input.getAttribute('inputmode'), min: input.getAttribute('min'), step: input.getAttribute('step'),
      required: input.required,
      steppers: document.querySelectorAll('#add-material-form .stepper, #add-material-form .stepper__btn, #add-material-form [data-step]').length,
    };
  `);
  assert.equal(attrs.type, 'number', 'the add form keeps its number field');
  assert.equal(attrs.mode, 'numeric');
  assert.equal(attrs.min, '1', 'needed can never start below one');
  assert.equal(attrs.step, '1');
  assert.equal(attrs.required, true);
  assert.equal(attrs.steppers, 0, 'the add form carries no stepper either');

  const oracles = await page().evaluate(`
    return {
      egg: TrackerModel.formatUnits(138, 'egg', 'stacks'), stone: TrackerModel.formatUnits(138, 'stone', 'stacks'),
      bucket: TrackerModel.formatUnits(138, 'water_bucket', 'stacks'),
      eggStack: TrackerModel.stackSizeFor('egg'), bucketStack: TrackerModel.stackSizeFor('water_bucket'), stoneStack: TrackerModel.stackSizeFor('stone'),
    };
  `);
  assert.equal(oracles.egg, '8 stacks + 10', 'the form shares the resolved stack semantics');
  assert.equal(oracles.stone, '2 stacks + 10');
  assert.equal(oracles.bucket, '138 stacks');
  assert.equal(oracles.eggStack, 16);
  assert.equal(oracles.bucketStack, 1);
  assert.equal(oracles.stoneStack, 64);

  await page().evaluate('document.querySelector("#mat-needed").value = "0"; return true;');
  assert.equal(await page().evaluate('return document.querySelector("#mat-needed").checkValidity();'), false, 'a zero Needed is rejected by the field');
  assert.equal(await page().evaluate('return document.querySelector("#add-material-form").checkValidity();'), false, 'the form refuses to submit it');

  const rowsBefore = await page().count('#material-body .mat-row');
  await addMaterialViaPicker('Egg', { needed: 138 });
  await page().waitFor('Array.from(document.querySelectorAll("#material-body .mat-row__name")).some((node) => node.textContent.trim() === "Egg")');
  const eggRow = (await materialRows()).find((row) => row.item === 'Egg');
  assert.ok(eggRow, 'a valid submission still adds the row');
  assert.equal(eggRow.needed, '138', 'the submitted Needed is stored as typed');
  assert.equal((await materialRows()).length, rowsBefore + 1, 'the rejected zero never became a row');
});

test('73 the import dialog restores by paste and by drop, and reports bad JSON (AC8)', async () => {
  await reset({ demo: false });
  assert.equal(await page().evaluate(`return document.querySelector('#file-import').getAttribute('accept');`), '.json', 'the file input accepts only the .json extension token');
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog") !== null && document.querySelector("#import-dialog").open');
  assert.match(await page().text('#import-dialog'), /Restore a backup/);
  const pasteText = fs.readFileSync(fixture('import-paste.json'), 'utf8');
  await page().fill('#import-text', pasteText);
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#toast").textContent.indexOf("Backup restored.") === 0');
  await page().waitFor('document.querySelectorAll("#world-select option").length > 0');
  assert.ok(await page().count('#build-list .build-entry') > 0, 'the restored world lists its builds');
  assert.ok(await page().exists('#build-list [aria-current="true"]'), 'the restore selects a build');
  await page().fill('#import-text', 'not json at all');
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#import-error") !== null && !document.querySelector("#import-error").hidden');
  assert.match(await page().text('#import-error'), /not valid JSON/i);
  const dropped = await page().evaluate(`
    const text = ${JSON.stringify(pasteText)};
    const transfer = new DataTransfer();
    transfer.items.add(new File([text], 'backup.json', { type: 'application/json' }));
    const dialog = document.querySelector('#import-dialog');
    const zone = document.querySelector('#import-drop');
    (zone || dialog).dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    return true;
  `);
  assert.equal(dropped, true);
  await page().waitFor('document.querySelector("#toast").textContent.indexOf("Backup restored.") === 0');
});

test('74 custom materials are created in three scopes with the exact error strings (AC4/AC5)', async () => {
  await reset();
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  const materialPicker = await page().evaluate(`
    return { custom: !!document.querySelector('#btn-new-custom'),
      visible: !!(document.querySelector('#btn-new-custom') && document.querySelector('#btn-new-custom').offsetParent),
      flagged: document.querySelector('#icon-dialog').classList.contains('picker--material') };
  `);
  assert.equal(materialPicker.custom, true, 'the material picker carries the New custom material control');
  assert.equal(materialPicker.visible, true, 'the control is visible in material mode');
  assert.equal(materialPicker.flagged, true, 'the picker is flagged for material use');
  await page().click('#icon-cancel');
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  assert.equal(await page().evaluate(`return document.querySelector('#btn-new-custom').offsetParent === null;`), true, 'the control is away in icon mode');
  await page().click('#icon-cancel');
  await page().waitFor('!document.querySelector("#icon-dialog").open');

  const create = async (name, stack, scope, iconSlug) => {
    await page().click('#mat-choice');
    await page().waitFor('document.querySelector("#icon-dialog").open');
    await page().click('#btn-new-custom');
    await page().waitFor('document.querySelector("#custom-dialog") !== null && document.querySelector("#custom-dialog").open');
    assert.equal(await page().text('#custom-error'), '', 'a freshly opened custom dialog carries no stale error');
    await page().fill('#custom-name', name);
    await page().fill('#custom-stack', String(stack));
    await page().fill('#custom-scope', scope);
    if (iconSlug) {
      await page().click('#custom-icon-pick');
      await page().waitFor('document.querySelector("#icon-dialog").open');
      await page().fill('#icon-search', iconSlug.replace(/_/g, ' '));
      await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
      await page().evaluate(`
        const tile = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'))
          .find((node) => node.dataset.iconSlug === ${JSON.stringify(iconSlug)});
        tile.click();
        return true;
      `);
      await page().waitFor('document.querySelector("#custom-dialog").open && !document.querySelector("#icon-dialog").open');
    }
    await page().click('#custom-save');
    await page().waitFor('!document.querySelector("#custom-dialog").open && !document.querySelector("#icon-dialog").open');
  };

  await create('Test Bricks', 16, 'build', 'stone_bricks');
  assert.equal(await page().text('#mat-choice-name'), 'Test Bricks', 'the new entry becomes the pending material');
  let registries = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const build = world.builds.find((entry) => entry.id === state.activeBuildId) || world.builds[0];
    return { build: (build.customItems || []).map((item) => ({ name: item.name, stack: item.stack, icon: item.icon })),
      world: (world.customItems || []).length, account: (state.customItems || []).length };
  `);
  assert.deepEqual(registries.build, [{ name: 'Test Bricks', stack: 16, icon: { kind: 'item', slug: 'stone_bricks' } }], 'the build registry stores the entry');
  assert.equal(registries.world, 0, 'a build scope does not leak into the world registry');
  assert.equal(registries.account, 0, 'a build scope does not leak into the account registry');
  await create('World Slate', 1, 'world', null);
  await create('Account Plank', 999, 'account', null);
  registries = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    return { world: (world.customItems || []).map((item) => item.name), account: (state.customItems || []).map((item) => item.name) };
  `);
  assert.deepEqual(registries.world, ['World Slate']);
  assert.deepEqual(registries.account, ['Account Plank']);

  const failing = async (name, stack, scope) => {
    await page().click('#mat-choice');
    await page().waitFor('document.querySelector("#icon-dialog").open');
    await page().click('#btn-new-custom');
    await page().waitFor('document.querySelector("#custom-dialog").open');
    // Run-2 correction: every refusal gets a freshly opened dialog and a clean error slot, so a
    // stale message from the previous refusal can never answer this one.
    assert.equal(await page().text('#custom-error'), '', 'each refusal starts with a clean error slot');
    await page().fill('#custom-name', name);
    await page().fill('#custom-stack', String(stack));
    await page().fill('#custom-scope', scope);
    await page().click('#custom-save');
    const text = await page().text('#custom-error');
    await page().click('#custom-cancel');
    await page().waitFor('!document.querySelector("#custom-dialog").open');
    return text;
  };
  assert.equal(await failing('', 64, 'build'), 'Custom material needs a name.', 'an empty name is refused');
  assert.equal(await failing('World Slate', 64, 'world'), 'Name already used by another material.', 'a duplicate name in the same registry is refused');
  assert.equal(await failing('Stack Probe', 0, 'build'), 'Stack size must be between 1 and 999.', 'a zero stack is refused');
  await page().click('#custom-cancel').catch(() => {});
});

test('75 resolution runs build -> world -> account -> catalogue for the 2s delta (AC4)', async () => {
  const custom = JSON.parse(fs.readFileSync(fixture('custom-items.v1.json'), 'utf8'));
  await injectState(custom);
  const cases = [
    { build: 'Iron Farm (spawn)', item: 'Deepslate Bricks', stack: 1, scope: 'build' },
    { build: 'Iron Farm (spawn)', item: 'Pillar Stone', stack: 16, scope: 'build' },
    { build: 'Storage Hall', item: 'Deepslate Bricks', stack: 64, scope: 'world' },
    { build: 'Iron Farm (spawn)', item: 'Roof Tile', stack: 64, scope: 'account' },
    { build: 'Storage Hall', item: 'Stone', stack: 64, scope: 'catalogue' },
  ];
  for (const entry of cases) {
    await openBuildNamed(entry.build);
    const resolved = await page().evaluate(`
      const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
      const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
      const build = world.builds.find((candidate) => candidate.name === ${JSON.stringify(entry.build)});
      const item = TrackerModel.resolveItem(state, world, build, ${JSON.stringify(entry.item)});
      return { stack: item.stack, scope: item.scope };
    `);
    assert.equal(resolved.stack, entry.stack, 'the ' + entry.scope + ' registry wins for ' + entry.item + ', saw ' + resolved.stack);

    await addMaterialViaPicker(entry.item, { needed: 10 });
    await page().waitFor(`Array.from(document.querySelectorAll('#material-body .mat-row__name')).some((node) => node.textContent.trim() === ${JSON.stringify(entry.item)})`);
    const inventoryBefore = await page().evaluate(`
      const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
      const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
      return world.inventory;
    `);
    const matId = await page().evaluate(`
      const row = Array.from(document.querySelectorAll('#material-body .mat-row'))
        .find((candidate) => candidate.querySelector('.mat-row__name').textContent.trim() === ${JSON.stringify(entry.item)});
      return row.getAttribute('data-mat');
    `);
    await openInventoryForRow(matId);
    assert.match((await page().text('#inv-context')).trim(), /^(.+ · )?\d+ allocated of \d+ needed · \d+ in world$/);
    await page().fill('#inv-delta', '2s');
    await page().click('#inv-ok');
    await page().waitFor('document.querySelector("#inventory-dialog").open === false');
    const delta = await page().evaluate(`
      const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
      const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
      const before = ${JSON.stringify(inventoryBefore)};
      const changed = Object.keys(world.inventory).filter((key) => (world.inventory[key] || 0) !== (before[key] || 0));
      return { changed, value: changed.length === 1 ? world.inventory[changed[0]] - (before[changed[0]] || 0) : null };
    `);
    assert.equal(delta.changed.length, 1, 'one delta writes one inventory key');
    assert.equal(delta.value, 2 * entry.stack, '2s adds two resolved stacks for the ' + entry.scope + ' scope (' + entry.item + '), saw ' + delta.value);
    await page().click('#toast-action');
    await page().waitFor(`
      (function () {
        const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
        const world = state.worlds.find((candidate) => candidate.id === state.activeWorldId);
        const before = ${JSON.stringify(inventoryBefore)};
        const keys = Array.from(new Set([...Object.keys(world.inventory || {}), ...Object.keys(before)])).sort();
        return keys.every((key) => (world.inventory[key] || 0) === (before[key] || 0));
      })()
    `);
  }
});

test('76 custom tiles carry the badge and sort after the catalogue (AC5)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('custom-items.v1.json'), 'utf8'));
  await injectState(state);
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  const badges = await page().count('#icon-grid .tile__badge');
  assert.equal(badges, 0, 'the unfiltered first batch shows no custom badge');
  await page().fill('#icon-search', 'pillar');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  const custom = await page().evaluate(`
    const tile = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'))
      .find((node) => node.querySelector('.icon-tile__name').textContent.trim() === 'Pillar Stone');
    return { found: !!tile, badge: tile && tile.querySelector('.tile__badge') && tile.querySelector('.tile__badge').textContent.trim() };
  `);
  assert.equal(custom.found, true, 'the custom entry is searchable');
  assert.equal(custom.badge, 'custom', 'the custom tile is badged');
  await page().fill('#icon-search', 'stone');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  assert.equal(
    await page().evaluate(`return document.querySelector('#icon-grid .icon-tile[data-icon-slug]').dataset.iconSlug;`),
    'stone',
    'the catalogue sorts before custom entries'
  );
});

test('77 export round-trips the v2 shape and malformed imports are atomic (AC4)', async () => {
  await page().upload('#file-import', fixture('custom-items.v1.json'));
  await page().waitFor('document.querySelector("#toast").textContent.indexOf("Backup restored.") === 0');
  const live = await appState();
  assert.equal(live.version, 2, 'the imported v1 document lands as v2');
  await page().evaluate(`
    window.__blobText = null;
    URL.createObjectURL = (blob) => { blob.text().then((text) => { window.__blobText = text; }); return 'blob:stub'; };
    URL.revokeObjectURL = () => {};
    HTMLAnchorElement.prototype.click = function () {};
    return true;
  `);
  await page().click('#btn-export');
  await page().waitFor('window.__blobText !== null');
  const exported = JSON.parse(await page().evaluate('return window.__blobText;'));

  assert.equal(exported.version, 2, 'Export emits the v2 document');
  /* §5.9: `migratedFrom` is a one-shot flag kept in memory for the notice and dropped by the
     first v2 save, so the persisted copy legitimately lacks it — compare everything else. */
  assert.equal(Object.prototype.hasOwnProperty.call(live, 'migratedFrom'), false, 'the one-shot migration flag is not persisted');
  const exportedCore = JSON.parse(JSON.stringify(exported));
  delete exportedCore.migratedFrom;
  assert.deepEqual(exportedCore, live, 'the export is the live document, not a stale copy');
  assert.equal(exported.customItems.length, 2, 'the account registry exports');
  assert.equal(exported.worlds[0].customItems.length, 1, 'the world registry exports');
  assert.equal(exported.worlds[0].builds[0].customItems.length, 2, 'the build registry exports');
  assert.equal(typeof exported.worlds[0].inventory, 'object', 'the world carries an inventory map');
  assert.equal(JSON.stringify(exported).includes('"collected"'), false, 'no material keeps a collected count');
  let materialsSeen = 0;
  for (const world of exported.worlds) {
    for (const build of world.builds) {
      for (const mat of build.materials) {
        materialsSeen += 1;
        assert.deepEqual(Object.keys(mat).sort(), ['id', 'item', 'needed'], 'a material is exactly id/item/needed');
        assert.ok(Number.isInteger(mat.needed) && mat.needed >= 1, 'needed stays a positive integer');
      }
    }
  }
  assert.ok(materialsSeen > 0, 'the fixture actually exercised materials');

  const dump = writeFixture('export-roundtrip.json', JSON.stringify(exported, null, 2));
  await page().upload('#file-import', dump);
  await page().waitFor('document.querySelector("#toast").textContent.indexOf("Backup restored.") === 0');
  const restored = await appState();
  assert.deepEqual(restored, exportedCore, 'importing the export restores it exactly');
  assert.equal(Object.prototype.hasOwnProperty.call(restored, 'migratedFrom'), false, 'a v2 save never keeps the one-shot flag');

  const beforeInvalid = JSON.stringify(await appState());
  for (const name of ['invalid-no-name.json', 'invalid-duplicate-name.json', 'invalid-stack-zero.json', 'invalid-stack-1000.json', 'invalid-bad-icon.json', 'invalid-registry-shape.json']) {
    await page().upload('#file-import', fixture(name));
    await page().waitFor(`
      (function () {
        const toast = document.querySelector('#toast');
        return !!toast && !toast.hidden && /custom material|Name already|Stack size|Icon must|not a tracker backup|not valid JSON/i.test(toast.textContent);
      })()
    `);
    assert.equal(JSON.stringify(await appState()), beforeInvalid, name + ' must not mutate the live document');
  }
});

test('78 the pause control persists the choice across reloads (AC11/R7)', async () => {
  // Emulated media is sticky: case 48 (or 26) may have left `reduce` on, and R7 correctly
  // defaults the strip to paused under reduce. This case exercises the play default.
  await page().emulateReducedMotion(false);
  await reset();
  assert.equal(await page().evaluate(`return getComputedStyle(document.querySelector('.backdrop > .backdrop__layer')).animationPlayState;`), 'running', 'the strip runs by default');
  assert.equal(await page().evaluate(`return localStorage.getItem('mc-build-tracker:motion');`), null, 'no stored choice means play');
  await page().click('#backdrop-pause');
  await page().waitFor('getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState === "paused"');
  assert.equal(await page().evaluate(`return localStorage.getItem('mc-build-tracker:motion');`), 'paused', 'pausing is remembered');
  assert.equal(await page().evaluate(`return document.querySelector('#backdrop-pause').getAttribute('aria-pressed');`), 'true', 'the control reports paused');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  assert.equal(await page().evaluate(`return getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState;`), 'paused', 'the pause survives a reload');
  await page().click('#backdrop-pause');
  await page().waitFor('getComputedStyle(document.querySelector(".backdrop > .backdrop__layer")).animationPlayState === "running"');
  assert.equal(await page().evaluate(`return localStorage.getItem('mc-build-tracker:motion');`), 'play', 'resuming is remembered');
});

test('79 the world header shows identity tokens, never the retired summary line (AC2/AC7)', async () => {
  await reset();
  const header = await page().evaluate(`
    const meta = document.querySelector('#world-meta');
    const select = document.querySelector('#world-select');
    const option = select && select.options[select.selectedIndex];
    const sidebar = document.querySelector('#world-panel-name');
    return {
      text: meta.textContent.replace(/\\s+/g, ' ').trim(),
      sidebarName: sidebar ? sidebar.textContent.trim() : null,
      selectedName: option ? option.textContent.trim() : null,
      hasSummary: !!document.querySelector('#world-summary'),
      hasProgress: !!document.querySelector('#world-panel #world-progress'),
      progressText: document.querySelector('#world-progress-text').textContent.trim(),
    };
  `);
  assert.match(header.text, /Java/, 'the identity keeps the edition token');
  assert.match(header.text, /1\.21\.4/, 'the identity keeps the version token');
  assert.match(header.text, /3 builds?/, 'the identity keeps the build count');
  assert.equal(header.hasSummary, false, '#world-summary stays retired');
  assert.equal(header.sidebarName, header.selectedName, 'the sidebar name mirrors the selected world');
  assert.equal(header.hasProgress, true, 'progress belongs to the sidebar alone');
  assert.match(header.progressText, /items gathered/, 'the sidebar prints the contract progress line');
  assert.doesNotMatch(header.text, /gathered|still to collect/, 'the identity row never repeats progress');
});

test('80 nothing paints over the detail sections at either viewport (containment)', async () => {
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page().setViewport(vp.width, vp.height);
    await reset();
    await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
    const report = await page().evaluate(`
      const pick = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
      };
      const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
      const last = rows[rows.length - 1];
      return {
        detail: pick('#detail-body'), header: pick('#build-header'), progress: pick('#detail-progress'),
        toolbar: pick('#mat-toolbar'), table: pick('#material-table'),
        lastRow: last ? pick('#material-body .mat-row:last-of-type') : null,
        rows: rows.length,
        inDetail: !!document.querySelector('#detail-body .mtable') && !!document.querySelector('#detail-body #material-body .mat-row'),
        stale: !!document.querySelector('#detail-body .progress-block, #build-pct, #build-summary, #build-bar, #build-fill'),
      };
    `);
    const label = vp.width + 'px';
    assert.equal(report.rows > 0, true, label + ': the material rows render');
    assert.equal(report.inDetail, true, label + ': the table and its rows stay inside #detail-body');
    assert.equal(report.stale, false, label + ': the EDICT-0016 gathered strip is gone');
    assert.ok(report.table.left >= report.detail.left - 1 && report.table.right <= report.detail.right + 1, label + ': the table stays inside the detail column');
    assert.ok(report.header.left >= report.detail.left - 1 && report.header.right <= report.detail.right + 1, label + ': the header stays inside the detail column');
    assert.ok(report.header.bottom <= report.progress.top + 1, label + ': the header does not overlap the progress band');
    assert.ok(report.progress.bottom <= report.toolbar.top + 1, label + ': the progress band does not overlap the toolbar');
    assert.ok(report.toolbar.bottom <= report.table.top + 1, label + ': the toolbar does not overlap the table');
    assert.ok(report.lastRow.bottom <= report.table.bottom + 1, label + ': the table contains its last row');
  }
  await page().clearViewport();
});

test('81 the 18px type knob scales body, headings and the compact build rows (AC1)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await page().waitFor('document.querySelector("#build-list .build-entry") !== null');
  const type = await page().evaluate(`
    const size = (selector) => parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const entries = Array.from(document.querySelectorAll('#build-list .build-entry')).map((entry) => {
      const box = entry.getBoundingClientRect();
      return {
        height: box.height,
        children: Array.from(entry.children).map((child) => child.className.split(' ')[0]),
        hasMeta: !!entry.querySelector('.build-entry__meta, .build-entry__sub, .build-entry__detail'),
        hasName: !!entry.querySelector('.build-entry__name'),
        hasBadge: !!entry.querySelector('.build-entry__badge'),
        hasBar: !!entry.querySelector('.build-entry__bar'),
      };
    });
    const row = document.querySelector('#material-body .mat-row');
    return {
      body: size('body'), title: size('.builds__list .section-head__title'), entries,
      rowHeight: row ? row.getBoundingClientRect().height : 0,
      inputHeight: row ? row.querySelector('[data-mat-field="needed"]').getBoundingClientRect().height : 0,
      choiceHeight: document.querySelector('#mat-choice').getBoundingClientRect().height,
      masthead: document.querySelector('.masthead__title') ? document.querySelector('.masthead__title').getBoundingClientRect().height : 0,
    };
  `);
  assert.equal(type.body, 18, 'the root type knob is 18px');
  assert.equal(type.title, 22, 'section titles scale with it');
  assert.ok(type.masthead <= 46, 'the masthead title stays one scaled line');
  assert.ok(type.entries.length >= 2, 'the fixture lists builds');
  for (const entry of type.entries) {
    assert.ok(entry.height <= 70, 'a build entry is one compact line, saw ' + entry.height);
    assert.ok(entry.height >= 36, 'and never collapses below the tap target');
    assert.equal(entry.hasMeta, false, 'the entry carries no second meta row');
    assert.equal(entry.hasName && entry.hasBadge && entry.hasBar, true, 'name, badge and mini bar are the whole entry');
  }
  assert.ok(type.rowHeight >= 48, 'material rows keep a comfortable height');
  assert.ok(Math.abs(type.inputHeight - 28) <= 1, 'the row editor keeps its 28px box');
  assert.ok(Math.abs(type.choiceHeight - 36) <= 1, 'the item chip keeps its 36px box');

  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open === true');
  const dialog = await page().evaluate(`
    const name = document.querySelector('#build-dlg-name');
    const save = document.querySelector('#build-dialog-save');
    return { nameHeight: name.getBoundingClientRect().height, buttonHeight: save ? save.getBoundingClientRect().height : 0 };
  `);
  assert.ok(dialog.nameHeight >= 42, 'dialog inputs scale with the knob');
  assert.ok(dialog.buttonHeight >= 32, 'dialog buttons stay above the small target floor, saw ' + dialog.buttonHeight);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#build-dialog").open === false');
  await page().clearViewport();
});

test('82 the detail progress band keeps its compact padding and one-line bar (AC2)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#detail-progress") !== null');
  const band = await page().evaluate(`
    const progress = document.querySelector('#detail-progress');
    const style = getComputedStyle(progress);
    const text = document.querySelector('#detail-progress-text');
    const bar = document.querySelector('#detail-bar');
    const fill = document.querySelector('#detail-fill');
    const textBox = text.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    return {
      paddingTop: style.paddingTop, paddingLeft: style.paddingLeft, gap: style.columnGap || style.gap,
      text: text.textContent.trim(), fontSize: getComputedStyle(text).fontSize,
      barHeight: barBox.height, barLeft: barBox.left, barRight: barBox.right,
      textRight: textBox.right, textBottom: textBox.bottom, barBottom: barBox.bottom,
      pct: bar.getAttribute('aria-valuenow'), fill: fill.style.width,
      retired: !!document.querySelector('#detail-progress .progress-block, #detail-body .progress-block'),
    };
  `);
  assert.equal(band.paddingTop, '4px', 'the band keeps its tight vertical padding');
  assert.equal(band.paddingLeft, '8px', 'and its side padding');
  assert.ok(parseFloat(band.gap) >= 8, 'the label and the bar keep a readable gap, saw ' + band.gap);
  assert.equal(band.fontSize, '15px', 'the label uses the small print size');
  assert.ok(band.barHeight >= 10 && band.barHeight <= 14, 'the bar stays a thin band, saw ' + band.barHeight);
  assert.ok(band.barLeft >= band.textRight, 'the bar starts after the label, not on top of it');
  assert.ok(Math.abs(band.textBottom - band.barBottom) <= 6, 'label and bar share one line');
  assert.match(band.text, /^\d+ \/ \d+ items gathered \(\d+%\)$/, 'the band prints the contract phrase');
  const pct = Number(/(\d+)%\)$/.exec(band.text)[1]);
  assert.equal(Number(band.pct), pct, 'the bar reports the same percentage the text prints');
  assert.equal(parseFloat(band.fill), pct, 'the fill matches the percentage');
  assert.equal(band.retired, false, 'the retired gathered strip is gone');
});

test('83 notes render as a plain paragraph with no field skin (AC3)', async () => {
  await reset();
  await openFirstBuild();
  const style = await page().evaluate(`
    const s = getComputedStyle(document.querySelector('#notes-text'));
    return {
      background: s.backgroundColor, borderTop: s.borderTopWidth, borderBottom: s.borderBottomWidth,
      boxShadow: s.boxShadow, padding: s.padding, fontSize: s.fontSize, whiteSpace: s.whiteSpace,
      textShadow: s.textShadow,
    };
  `);
  assert.equal(style.background, 'rgba(0, 0, 0, 0)', 'transparent background (no field skin)');
  assert.equal(style.borderTop, '0px');
  assert.equal(style.borderBottom, '0px');
  assert.equal(style.boxShadow, 'none');
  assert.equal(style.padding, '0px 2px');
  assert.equal(style.fontSize, '18px', 'notes body uses the body size');
  assert.match(style.whiteSpace, /pre-wrap/);
  assert.equal(style.textShadow, 'none');
});

test('84 the notes save/cancel controls move into the label row in order (AC4)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#notes-edit');
  await page().waitFor('document.querySelector("#notes-text").hidden');
  const row = await page().evaluate(`
    const hint = document.querySelector('#notes-hint');
    const save = document.querySelector('#notes-save');
    const cancel = document.querySelector('#notes-cancel');
    if (!hint || !save || !cancel) return null;
    const parent = hint.parentElement;
    const rect = (el) => el.getBoundingClientRect();
    return {
      sameRow: save.parentElement === parent && cancel.parentElement === parent,
      order: rect(hint).left < rect(save).left && rect(save).left < rect(cancel).left,
      hint: hint.textContent.trim(),
      retired: document.querySelectorAll('.notes-editor__actions').length,
      editorBelow: !!document.querySelector('#notes-editor #build-notes'),
    };
  `);
  assert.ok(row, '#notes-hint, #notes-save and #notes-cancel all exist');
  assert.equal(row.sameRow, true, 'all three live in the label row');
  assert.equal(row.order, true, 'order is hint, save, cancel left to right');
  assert.equal(row.hint, 'Ctrl+Enter to Save');
  assert.equal(row.retired, 0, 'the retired .notes-editor__actions row is gone');
  assert.equal(row.editorBelow, true, 'the editor is only the textarea below');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('!document.querySelector("#notes-text").hidden');
});

test('85 the save glyph is the 14px check path (AC5)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#notes-edit');
  await page().waitFor('document.querySelector("#notes-save") !== null');
  const glyph = await page().evaluate(`
    const svg = document.querySelector('#notes-save svg');
    if (!svg) return null;
    const path = svg.querySelector('path');
    const rect = svg.getBoundingClientRect();
    return {
      width: Math.round(rect.width), height: Math.round(rect.height),
      viewBox: svg.getAttribute('viewBox'),
      d: path ? path.getAttribute('d').trim() : '',
    };
  `);
  assert.ok(glyph, 'the save button renders an svg');
  assert.equal(glyph.width, 14, 'the check glyph is 14px wide');
  assert.equal(glyph.height, 14, 'the check glyph is 14px tall');
  assert.equal(glyph.viewBox, '0 0 14 14');
  assert.equal(glyph.d, 'M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
});

test('86 every v2 row keeps the contract cell order and 28px controls (AC6/AC12)', async () => {
  const orderOf = () => page().evaluate(`
    const row = document.querySelector('#material-body .mat-row');
    const kind = (child) => (child.classList.contains('mat-row__item') ? 'item'
      : child.classList.contains('mat-row__needed') ? 'needed'
      : child.hasAttribute('data-mat-got') ? 'got'
      : child.hasAttribute('data-mat-covered') ? 'covered'
      : child.hasAttribute('data-mat-remaining') ? 'remaining'
      : child.hasAttribute('data-mat-surplus') ? 'surplus'
      : child.hasAttribute('data-mat-update') ? 'update'
      : child.classList.contains('mat-row__menu') ? 'menu' : 'other');
    const input = row.querySelector('[data-mat-field="needed"]');
    const update = row.querySelector('[data-mat-update]');
    const size = (node) => { const box = node.getBoundingClientRect(); return { width: box.width, height: box.height }; };
    return {
      order: Array.from(row.children).map(kind),
      rowHeight: size(row).height, input: size(input), update: size(update),
      surplus: (row.querySelector('[data-mat-surplus]') || {}).textContent || '',
      stepper: row.querySelectorAll('.stepper, .stepper__btn, [data-step], .mat-step').length,
    };
  `);

  await seed17('surplus-state.json');
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const surplus = await orderOf();
  assert.deepEqual(surplus.order, ['item', 'needed', 'got', 'covered', 'remaining', 'surplus', 'update', 'menu'],
    'a row with surplus keeps the contract cell order');
  assert.match(surplus.surplus.trim(), /^\+385 surplus$/, 'the surplus cell states the overage');
  assert.ok(surplus.rowHeight >= 48, 'rows keep a 48px minimum, saw ' + surplus.rowHeight);
  assert.ok(Math.abs(surplus.input.height - 28) <= 1, 'the Needed editor is a 28px control');
  assert.ok(surplus.input.width >= 30, 'and wide enough to hold a number');
  assert.ok(Math.abs(surplus.update.height - 28) <= 1, 'the Update button matches it');
  assert.equal(surplus.stepper, 0, 'no stepper node inside the row');

  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const plain = await orderOf();
  assert.deepEqual(plain.order, ['item', 'needed', 'got', 'covered', 'remaining', 'surplus', 'update', 'menu'],
    'the surplus column is always present (item 8) and shows a dash when empty');
  assert.equal(plain.surplus.trim(), '–', 'an empty surplus reads as a dash');
  assert.ok(plain.rowHeight >= 48);
});

test('87 timestamps render UTC from the ISO prefix, malformed values show a dash (AC7)', async () => {
  await reset();
  const fmt = await page().evaluate(`
    const M = window.TrackerModel;
    return {
      ok: M.formatStamp('2026-09-14T12:34:00.000Z'),
      late: M.formatStamp('2026-09-14T23:59:00.000Z'),
      bad: M.formatStamp('yesterday'),
      empty: M.formatStamp(''),
      absent: M.formatStamp(undefined),
    };
  `);
  assert.equal(fmt.ok, '2026-09-14 12:34', 'the display is the UTC ISO prefix (never local time)');
  assert.equal(fmt.late, '2026-09-14 23:59');
  assert.equal(fmt.bad, '—');
  assert.equal(fmt.empty, '—');
  assert.equal(fmt.absent, '—');
  const malformed = fs.readFileSync(fixture16('malformed-timestamps.json'), 'utf8');
  await loadBackupText(malformed);
  const stamps = (await page().text('#world-meta')) || '';
  assert.match(stamps, /—/, 'an unparseable stamp displays as a dash, not an invented date');
});

test('88 focusing the Needed editor selects all, capability-safely (AC8)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  // The selection API only reports ranges while the document itself has focus; bring the page to the
  // front first so the assertion measures the app's select-on-focus behaviour, not a background tab.
  try {
    await page().cdp.send('Page.bringToFront');
  } catch (error) {
    // older harness: the click below still focuses the document
  }
  await page().waitFor('document.hasFocus() === true');
  const result = await page().evaluate(`
    const input = document.querySelector('#material-body .mat-row [data-mat-field="needed"]');
    const read = () => ({ start: input.selectionStart, end: input.selectionEnd, length: (input.value || '').length, type: input.type, focused: document.activeElement === input });
    input.focus();
    const afterFocus = read();
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const afterClick = read();
    return { afterFocus, afterClick };
  `);
  for (const [label, state] of [['focus', result.afterFocus], ['click', result.afterClick]]) {
    assert.equal(state.type, 'text', label + ': the editor is a text input, whose selection API works');
    assert.equal(state.focused, true, label + ': the editor takes focus');
    const full = state.length > 0 && state.start === 0 && state.end === state.length;
    const unsupported = state.start === null || state.end === null;
    assert.ok(full || unsupported, label + ': focusing selects the whole value (or the capability is unavailable), saw ' + state.start + '..' + state.end + ' of ' + state.length);
  }
});

test('89 the Needed editor commits on Enter and on blur, and Escape reverts (AC9)', async () => {
  // EDICT-0017 retired the stepper, and with it the wheel-plus-modifier shortcuts this case used to
  // drive: src/app.js registers no `wheel` listener any more. The AC9 intent — the editor has an
  // explicit commit and an explicit revert path, and nothing else mutates the count — is covered here
  // by the three real keyboard/blur paths, plus a guard that a wheel event never secretly commits.
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const matId = await page().evaluate('return document.querySelector("#material-body .mat-row").getAttribute("data-mat");');
  const neededOf = async () => {
    const state = await appState();
    return state.worlds.flatMap((world) => world.builds).flatMap((build) => build.materials).find((mat) => mat.id === matId).needed;
  };
  const start = await neededOf();

  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.value = '42';
    return true;
  `);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '42'`);
  assert.equal(await neededOf(), 42, 'Enter commits');
  assert.equal(start === 42, false, 'the fixture did not start at the committed value');

  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.value = '43';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').getAttribute('data-prev') === '43'`);
  assert.equal(await neededOf(), 43, 'blur/change commits');

  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.value = '99';
    return true;
  `);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  assert.equal(await neededOf(), 43, 'Escape commits nothing');
  await page().waitFor(`document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value === '43'`);
  assert.equal(await page().evaluate(`return document.activeElement === document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');`), false, 'Escape also leaves the editor');

  const scrolled = await page().evaluate('return window.scrollY;');
  const displayed = await page().evaluate(`return document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value;`);
  await page().evaluate(`
    const input = document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]');
    input.focus();
    input.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }));
    return true;
  `);
  assert.equal(await neededOf(), 43, 'a wheel event over the editor never commits');
  assert.equal(await page().evaluate('return window.scrollY;'), scrolled, 'and never scrolls the page under the pointer');
  assert.equal(await page().evaluate(`return document.querySelector('[data-mat="${matId}"] [data-mat-field="needed"]').value;`), displayed, 'the displayed value stays the uncommitted one');
});

test('90 Tab walks Needed to Update and Enter on a row opens the shared dialog (AC10)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const firstId = await page().evaluate('return document.querySelector("#material-body .mat-row").getAttribute("data-mat");');
  await page().evaluate(`document.querySelector('[data-mat="${firstId}"] [data-mat-field="needed"]').focus(); return true;`);
  await page().press('Tab', { code: 'Tab', keyCode: 9 });
  const afterTab = await page().evaluate(`
    const active = document.activeElement;
    return { tag: active.tagName, update: active.getAttribute('data-mat-update'), row: active.closest('.mat-row') ? active.closest('.mat-row').getAttribute('data-mat') : null };
  `);
  assert.equal(afterTab.tag, 'BUTTON', 'Tab leaves the editor for a button');
  assert.equal(afterTab.update, firstId, 'it is the row Update button');
  assert.equal(afterTab.row, firstId, 'inside the same row');

  await page().evaluate(`document.querySelector('[data-mat="${firstId}"]').focus(); return true;`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.match((await page().text('#inv-item')).trim(), /^.+$/);
  assert.match((await page().text('#inv-context')).trim(), /^(.+ · )?\d+ allocated of \d+ needed · \d+ in world$/);
  assert.equal(await page().count('#tile-dialog'), 0, 'one shared dialog, not a second one');
  await closeInventoryWithEscape();

  await page().evaluate('document.querySelector("#mat-needed").focus(); return true;');
  await page().press('Tab', { code: 'Tab', keyCode: 9 });
  const formTab = await page().evaluate('return { tag: document.activeElement.tagName, type: document.activeElement.getAttribute("type"), text: document.activeElement.textContent.trim() };');
  assert.equal(formTab.tag, 'BUTTON', 'Tab from the add form Needed reaches the Add button');
  assert.equal(formTab.type, 'submit');
  assert.equal(formTab.text, 'Add');
});

test('91 the world sidebar holds the contract width and hides on the Worlds tab (AC11)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await page().waitFor('document.documentElement.clientWidth === 1280');
  const panel = await page().evaluate(`
    const node = document.querySelector('#world-panel');
    const box = node.getBoundingClientRect();
    const select = document.querySelector('#world-select');
    return {
      width: box.width, hidden: node.hidden, left: box.left,
      ids: Array.from(node.querySelectorAll('[id]')).map((child) => child.id),
      name: document.querySelector('#world-panel-name').textContent.trim(),
      selected: select.options[select.selectedIndex].textContent.trim(),
      hasStats: !!document.querySelector('#world-stats'),
      progressVisible: !document.querySelector('#world-progress').hidden,
    };
  `);
  assert.ok(panel.width >= 190 && panel.width <= 210, '#world-panel is 190-210 wide (contract section 6), saw ' + panel.width);
  assert.equal(panel.hidden, false, 'the sidebar shows on Builds');
  const expected = ['world-avatar', 'world-select', 'world-panel-name', 'world-meta', 'world-progress', 'inactive-mode', 'unit-toggle', 'btn-shopping-list', 'btn-new-world', 'btn-import', 'btn-export'];
  assert.deepEqual(panel.ids.filter((id) => expected.includes(id)), expected, 'the sidebar keeps its identity, progress and action order');
  assert.equal(panel.hasStats, false, '#world-stats is retired');
  assert.equal(panel.progressVisible, true, 'progress lives in the sidebar');
  assert.equal(panel.name, panel.selected, 'the sidebar name mirrors the selected world');

  await page().click('#tab-materials');
  await page().waitFor('document.querySelector("#view-materials").hidden === false');
  const onMaterials = await page().evaluate(`return { hidden: document.querySelector('#world-panel').hidden, width: document.querySelector('#world-panel').getBoundingClientRect().width, progress: !document.querySelector('#world-progress').hidden };`);
  assert.equal(onMaterials.hidden, false, 'the sidebar stays on Materials');
  assert.ok(onMaterials.width >= 190 && onMaterials.width <= 210);
  assert.equal(onMaterials.progress, true);

  await page().click('#tab-worlds');
  await page().waitFor('document.querySelector("#view-worlds").hidden === false');
  assert.equal(await page().hidden('#world-panel'), true, 'the sidebar hands the width to the world cards');
  await page().clearViewport();
});

test('92 the retired strip, stepper and notes-action row are gone from the DOM (AC6/AC12)', async () => {
  await reset();
  const heading = await openFirstBuild();
  const build = await buildByName(heading);
  assert.ok(build, 'the demo build resolves by name');
  const counts = await page().evaluate(`
    const count = (selector) => document.querySelectorAll(selector).length;
    return {
      matSteps: count('#mat-steps'), matStep: count('.mat-step'), dataStep: count('[data-step]'), matStepAttr: count('[data-mat-step]'),
      stepper: count('.stepper'), stepperBtn: count('.stepper__btn'),
      notesActions: count('.notes-editor__actions'),
      buildPct: count('#build-pct'), buildSummary: count('#build-summary'), buildBar: count('#build-bar'), buildFill: count('#build-fill'),
      collectedField: count('[data-mat-field="collected"]'),
      rows: count('#material-body .mat-row'),
      editors: count('#material-body .mat-row [data-mat-field="needed"]'),
      gotCells: count('#material-body .mat-row [data-mat-got]'),
    };
  `);
  for (const selector of ['matSteps', 'matStep', 'dataStep', 'matStepAttr', 'stepper', 'stepperBtn', 'notesActions', 'buildPct', 'buildSummary', 'buildBar', 'buildFill', 'collectedField']) {
    assert.equal(counts[selector], 0, selector + ' must not exist in the v2 DOM');
  }
  assert.ok(counts.rows > 0, 'the v2 rows are present');
  assert.equal(counts.editors, counts.rows, 'every row carries its Needed editor');
  assert.equal(counts.gotCells, counts.rows, 'every row carries a read-only Got cell');
  assert.equal(counts.rows, build.build.materials.length, 'one row per material, no hidden row');
});

test('93 the detail progress band mirrors the row totals and reports the model percentage (AC2)', async () => {
  await reset();
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const totals = await buildTotals();
  assert.ok(totals.needed > 0, 'the demo build has materials to measure');
  const expected = await page().evaluate(`return TrackerModel.progressText(${totals.covered}, ${totals.needed});`);
  assert.match(expected, /^\d+ \/ \d+ items gathered \(\d+%\)$/, 'the model prints the contract phrase');
  assert.equal((await page().text('#detail-progress-text')).trim(), expected, 'the detail band prints the model line');
  assert.equal(Number(await page().attr('#detail-bar', 'aria-valuenow')), totals.pct, 'the bar reports the row-derived percentage');
  assert.equal(await page().evaluate('return document.querySelector("#detail-fill").style.width;'), totals.pct + '%');
  assert.equal(await page().attr('#detail-bar', 'role'), 'progressbar');

  const layout = await page().evaluate(`
    const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
    const tops = ['#build-header', '#detail-progress', '#mat-toolbar', '#material-table'].map((selector) => rect(selector).top);
    return {
      tops,
      band: rect('#detail-progress').width,
      table: rect('#material-table').width,
      stale: !!document.querySelector('#detail-body .progress-block, #build-summary, #build-pct'),
    };
  `);
  assert.deepEqual(layout.tops, [...layout.tops].sort((left, right) => left - right), 'header, progress, toolbar and table stack in that order');
  assert.ok(Math.abs(layout.band - layout.table) <= 1, 'the band spans the same width as the table');
  assert.equal(layout.stale, false, 'the retired gathered strip is gone');

  await seed17('duplicate-allocation-state.json');
  await page().waitFor('document.querySelector("#material-body .mat-row") !== null');
  const dupTotals = await buildTotals();
  const dupExpected = await page().evaluate(`return TrackerModel.progressText(${dupTotals.covered}, ${dupTotals.needed});`);
  assert.equal((await page().text('#detail-progress-text')).trim(), dupExpected, 'duplicate items do not double-count in the band');
});

test('94 compact builds view renders one allocation card per build and persists the choice (AC5)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await page().waitFor('document.querySelector("#compact-view") !== null');
  await page().click('#view-compact');
  await page().waitFor('!document.querySelector("#compact-view").hidden');
  const compact = await page().evaluate(`
    const cards = Array.from(document.querySelectorAll('#compact-grid .ccard'));
    const rect = (node) => node.getBoundingClientRect();
    return {
      count: cards.length,
      first: cards[0] ? { buildId: cards[0].getAttribute('data-build'), name: cards[0].querySelector('.ccard__name').textContent.trim(), tiles: cards[0].querySelectorAll('.ctile').length, pct: (cards[0].querySelector('.ccard__pct') || {}).textContent } : null,
      pairs: cards.slice(0, 2).map((card) => ({ left: rect(card).left, top: rect(card).top, right: rect(card).right })),
      sidebarHidden: document.querySelector('#world-panel').hidden,
      compactWorld: document.querySelector('#compact-world').textContent.trim(),
      key: localStorage.getItem('mbt.buildsView'),
      pressed: document.querySelector('#view-compact').getAttribute('aria-pressed'),
    };
  `);
  assert.ok(compact.count >= 2, 'every build gets a card, saw ' + compact.count);
  assert.ok(compact.first.buildId, 'a card identifies its build');
  assert.ok(compact.first.name.length > 0, 'a card names its build');
  assert.ok(compact.first.tiles > 0, 'a card renders one tile per allocated material');
  assert.match(compact.first.pct.trim(), /^\d+%$/);
  if (compact.pairs.length === 2) {
    const [left, right] = compact.pairs;
    assert.ok(Math.abs(left.top - right.top) <= 1, 'the first two cards share a row');
    assert.ok(right.left >= left.right - 1, 'cards do not overlap horizontally');
  }
  assert.equal(compact.sidebarHidden, true, 'compact mode gives the width to the cards');
  assert.match(compact.compactWorld, /Java/, 'the compact header names the world');
  assert.equal(compact.key, 'compact', 'the choice is persisted');
  assert.equal(compact.pressed, 'true');

  await page().reload();
  await page().waitFor('window.TrackerModel !== undefined');
  await page().waitFor('document.querySelector("#compact-view") !== null');
  const afterReload = await page().evaluate(`return { hidden: document.querySelector('#compact-view').hidden, cards: document.querySelectorAll('#compact-grid .ccard').length, key: localStorage.getItem('mbt.buildsView') };`);
  assert.equal(afterReload.key, 'compact', 'the preference survives a reload');
  assert.equal(afterReload.hidden, false, 'the compact view is still the active one');
  assert.equal(afterReload.cards, compact.count, 'the same cards render after the reload');

  await page().click('#view-standard');
  await page().waitFor('document.querySelector("#compact-view").hidden === true');
  assert.equal(await page().evaluate(`return localStorage.getItem('mbt.buildsView');`), 'standard');
  await page().clearViewport();
});

test('95 a compact tile opens the one shared quick-update dialog and Undo still works (AC4/AC10)', async () => {
  await reset();
  await page().setViewport(1280, 900);
  await page().click('#view-compact');
  await page().waitFor('!document.querySelector("#compact-view").hidden');
  const tile = await page().evaluate(`
    const node = document.querySelector('#compact-grid .ccard .ctile');
    return { matId: node.getAttribute('data-mat'), buildId: node.getAttribute('data-build'), aria: node.getAttribute('aria-label'), count: node.querySelector('.ctile__count').textContent.trim() };
  `);
  assert.ok(tile.matId && tile.buildId, 'the tile points at its build and material');
  assert.match(tile.aria, /need \d+ · have \d+ · \d+ left/, 'the tile tooltip explains the allocation');
  assert.match(tile.count, /^\d/, 'the tile prints a count');

  const item = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    for (const world of state.worlds) for (const build of world.builds) for (const mat of build.materials) if (mat.id === ${JSON.stringify(tile.matId)}) return mat.item;
    return null;
  `);
  assert.ok(item, 'the tile material exists in the document');

  await page().click('#compact-grid .ccard .ctile');
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.equal(await page().count('#tile-dialog'), 0, 'no second quick-update dialog exists any more');
  assert.equal((await page().text('#inv-item')).trim(), item);
  const before = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    return state.worlds.find((world) => (world.builds || []).some((build) => build.id === ${JSON.stringify(tile.buildId)})).inventory || {};
  `);

  await page().fill('#inv-delta', '+64');
  await page().click('#inv-ok');
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  const committed = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((candidate) => (candidate.builds || []).some((build) => build.id === ${JSON.stringify(tile.buildId)}));
    const before = ${JSON.stringify(before)};
    const changed = Object.keys(world.inventory).filter((key) => (world.inventory[key] || 0) !== (before[key] || 0));
    return { changed, delta: changed.length === 1 ? world.inventory[changed[0]] - (before[changed[0]] || 0) : null };
  `);
  assert.equal(committed.changed.length, 1, 'a tile update writes one inventory key');
  assert.equal(committed.delta, 64, 'the absolute delta lands as typed');
  assert.match((await toastText()).trim(), /^Inventory updated\./);
  assert.equal(await page().text('#toast-action'), 'Undo', 'with one step back, like every other commit');

  await page().click('#toast-action');
  await page().waitFor(`
    (function () {
      const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
      const world = state.worlds.find((candidate) => (candidate.builds || []).some((build) => build.id === ${JSON.stringify(tile.buildId)}));
      const before = ${JSON.stringify(before)};
      const keys = Array.from(new Set([...Object.keys(world.inventory || {}), ...Object.keys(before)])).sort();
      return keys.every((key) => (world.inventory[key] || 0) === (before[key] || 0));
    })()
  `);

  await page().click('#compact-grid .ccard .ctile');
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  await page().fill('#inv-delta', 'abc');
  await page().click('#inv-ok');
  assert.equal(await page().evaluate('return document.querySelector("#inventory-dialog").open;'), true, 'a bad delta keeps the dialog open');
  assert.equal(await page().hidden('#inv-error'), false, 'and explains itself');
  assert.match(await page().text('#inv-error'), /whole number/);
  assert.deepEqual(
    await page().evaluate(`const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2')); return state.worlds.find((world) => (world.builds || []).some((build) => build.id === ${JSON.stringify(tile.buildId)})).inventory || {};`),
    before,
    'a rejected delta changes nothing'
  );
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  const focusBack = await page().evaluate('return { cls: document.activeElement.className, mat: document.activeElement.getAttribute("data-mat") };');
  assert.match(focusBack.cls, /ctile/, 'Escape returns focus to the tile that opened the dialog');
  assert.equal(focusBack.mat, tile.matId);
  await page().click('#view-standard');
  await page().clearViewport();
});

test('96 stamps print UTC text from ISO data and the migration notice shows once (AC5/AC8)', async () => {
  await reset();
  const stamps = await page().evaluate(`
    const read = (node) => ({ iso: node.getAttribute('data-iso'), text: node.textContent.trim(), datetime: node.getAttribute('datetime'), title: node.getAttribute('title') });
    return {
      detail: Array.from(document.querySelectorAll('#detail-meta time.stamp')).map(read),
      world: Array.from(document.querySelectorAll('#world-meta time.stamp')).map(read),
      detailText: document.querySelector('#detail-meta').textContent.trim(),
      migratedHidden: document.querySelector('#migrated-from') ? document.querySelector('#migrated-from').hidden : null,
    };
  `);
  assert.ok(stamps.detail.length >= 1, 'the detail header stamps its build');
  assert.ok(stamps.world.length >= 1, 'the world header stamps its last update');
  for (const stamp of [...stamps.detail, ...stamps.world]) {
    assert.match(stamp.iso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'every stamp carries the raw ISO value');
    assert.match(stamp.text, /^(just now|\d+ min ago|\d+ h ago|\d+ days? ago)$/, 'the visible text is a relative age');
    assert.equal(stamp.datetime, stamp.iso);
    assert.match(stamp.title, /^Updated \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(/, 'the tooltip is the exact UTC timestamp');
    assert.ok(stamp.title.indexOf(stamp.iso) > -1, 'the tooltip carries the raw ISO value');
  }
  assert.match(stamps.detailText, /^Updated (just now|\d+ min ago|\d+ h ago|\d+ days? ago)$/, 'the detail row labels the update time');
  assert.equal(stamps.migratedHidden, true, 'a fresh v2 document has no migration notice');

  const legacy = JSON.parse(fs.readFileSync(fixture17('v1-migration-state.json'), 'utf8'));
  await injectV1State(legacy);
  const migrated = await page().evaluate(`
    const notice = document.querySelector('#migrated-from');
    const raw = localStorage.getItem('mc-build-tracker:v2');
    const state = JSON.parse(raw);
    return {
      count: document.querySelectorAll('#migrated-from').length,
      hidden: notice ? notice.hidden : null,
      text: notice ? notice.textContent.trim() : '',
      version: state.version,
      worlds: state.worlds.length,
      inventory: state.worlds.map((world) => world.inventory),
      collected: raw.includes('"collected"'),
      v1: localStorage.getItem('mc-build-tracker:v1') !== null,
    };
  `);
  assert.equal(migrated.count, 1, 'exactly one migration notice exists');
  assert.equal(migrated.hidden, false, 'the migrated document says so');
  assert.equal(migrated.text, 'Upgraded from an older backup: collected counts moved into the world inventory.');
  assert.equal(migrated.version, 2, 'the document lands as v2');
  assert.equal(migrated.worlds, 2);
  assert.deepEqual(migrated.inventory, [{ stone_bricks: 250, glass: 96, iron_ingot: 0 }, { stone_bricks: 100 }], 'the collected counts moved into the inventories');
  assert.equal(migrated.collected, false, 'no material keeps a collected count');
  assert.equal(migrated.v1, true, 'the legacy key is kept for a rollback');

  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const afterReload = await page().evaluate(`return { hidden: document.querySelector('#migrated-from').hidden, text: document.querySelector('#migrated-from').textContent.trim() };`);
  assert.equal(afterReload.hidden, true, 'the notice is shown once, not on every load');
  assert.equal(afterReload.text, '');
});


/* ------------------------------------------------ EDICT-0017 (S5 cases) --
   Cases 97–128 from docs/governance/EDICT-0017.md §3.3. Every case starts from a frozen fixture
   under tests/qa/edict-0017-fixtures/ and drives the real DOM; `:v2` is the only live storage key
   and `:v1` is only ever *seeded* by the two migration cases. */

async function materialRows() {
  return page().evaluate(`
    return Array.from(document.querySelectorAll('#material-body .mat-row')).map((row) => {
      const text = (sel) => { const node = row.querySelector(sel); return node ? node.textContent.trim() : ''; };
      const input = row.querySelector('[data-mat-field="needed"]');
      return {
        id: row.getAttribute('data-mat'),
        item: text('.mat-row__name'),
        needed: input ? input.value : '',
        got: text('[data-mat-got]'),
        covered: text('[data-mat-covered]'),
        remaining: text('[data-mat-remaining]'),
        surplus: text('[data-mat-surplus]'),
        shared: text('[data-mat-shared]'),
        done: row.classList.contains('mat-row--done'),
      };
    });
  `);
}

async function rowOrder() {
  return (await materialRows()).map((row) => row.id);
}

async function openBuildNamed(name) {
  const clicked = await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === ${JSON.stringify(name)});
    if (!entry) return false;
    entry.click();
    return true;
  `);
  assert.equal(clicked, true, 'a build named ' + name + ' exists in the list');
  await page().waitFor(`document.querySelector('#detail-heading').textContent.trim() === ${JSON.stringify(name)}`);
  await page().waitFor('!document.querySelector("#detail-body").hidden');
}

/** Seed a v2 fixture: the helper clears prefs, imports the JSON through the model, reloads. */
async function seed17(name) {
  await reset({ demo: false });
  const fixtureState = JSON.parse(fs.readFileSync(fixture17(name), 'utf8'));
  await injectState(fixtureState);
}

async function openInventoryForRow(matId) {
  await page().click('[data-mat="' + matId + '"] [data-mat-update]');
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
}

async function closeInventoryWithEscape() {
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
}

/** Contract §3: Remove lives in the row's overflow menu, never as a bare row button. */
async function deleteRowViaMenu(matId) {
  const target = matId || await page().evaluate(
    `return document.querySelector('#material-body .mat-row').getAttribute('data-mat');`
  );
  await page().click('[data-mat="' + target + '"] [data-mat-menu]');
  await page().waitFor(
    `document.querySelector('[data-mat="${target}"] [data-mat-menu]').getAttribute('aria-expanded') === 'true'`
  );
  await page().click('[data-mat="' + target + '"] [data-mat-remove]');
}

/** Enter inside either inventory field is the commit path (contract AC7). */
async function submitInventoryWithEnter() {
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
}

test('97 v1 state migrates once to v2 (storage key)', async () => {
  const v1 = JSON.parse(fs.readFileSync(fixture17('v1-migration-state.json'), 'utf8'));
  await injectV1State(v1);
  const after = await page().evaluate(`
    return { v1: localStorage.getItem('mc-build-tracker:v1'), v2: localStorage.getItem('mc-build-tracker:v2') };
  `);
  assert.ok(after.v1, 'the legacy document is read once and never deleted');
  assert.ok(after.v2, 'the migrated document is written under the v2 key');
  const migrated = JSON.parse(after.v2);
  assert.equal(migrated.version, 2, 'the live document is v2');
  assert.equal(migrated.migratedFrom, undefined,
    'the one-shot flag is not persisted: the notice comes from the in-memory migration, not the saved document');
  assert.equal(await page().hidden('#migrated-from'), false, 'the upgrade notice is shown once');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const second = await page().evaluate(`
    return { v1: localStorage.getItem('mc-build-tracker:v1'), v2: localStorage.getItem('mc-build-tracker:v2') };
  `);
  assert.equal(second.v1, after.v1, 'the legacy key is byte-identical after a second load');
  const secondState = JSON.parse(second.v2);
  assert.equal(secondState.version, 2, 'the v2 document is stable across loads');
  assert.equal(secondState.migratedFrom, undefined, 'the one-shot flag is not re-written to storage');
  assert.equal(await page().hidden('#migrated-from'), true, 'the notice does not come back on the next load');
});

test('98 migration sums collected per world/item case-insensitively', async () => {
  const v1 = JSON.parse(fs.readFileSync(fixture17('v1-migration-state.json'), 'utf8'));
  await injectV1State(v1);
  const migrated = await appState();
  assert.equal(migrated.version, 2);
  const byId = Object.fromEntries(migrated.worlds.map((world) => [world.id, world]));
  assert.deepEqual(byId['world-a'].inventory, { stone_bricks: 250, glass: 96, iron_ingot: 0 },
    'collected counts are summed per world and case-folded item; the garbage count contributes zero');
  assert.deepEqual(byId['world-b'].inventory, { stone_bricks: 100 }, 'each world keeps its own sum');
  for (const world of migrated.worlds) {
    for (const build of world.builds) {
      for (const material of build.materials) {
        assert.equal(Object.prototype.hasOwnProperty.call(material, 'collected'), false,
          'the retired collected field is gone from every material');
      }
    }
  }
  assert.deepEqual(byId['world-a'].builds.map((build) => build.name), ['Storage Hall', 'Iron Farm'],
    'registry order is preserved by the migration');
  assert.deepEqual(byId['world-a'].builds.map((build) => build.active), [true, true],
    'builds without an active flag default to active');
});

test('99 v1 file imports as v2 and does not double count', async () => {
  await reset({ demo: false });
  const v1Text = fs.readFileSync(fixture17('v1-migration-state.json'), 'utf8');
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog").open');
  await page().fill('#import-text', v1Text);
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#import-dialog").open === false');
  let imported = await appState();
  assert.equal(imported.version, 2, 'an imported v1 document lands as v2');
  assert.deepEqual(imported.worlds[0].inventory, { stone_bricks: 250, glass: 96, iron_ingot: 0 });
  // Importing the very same file again replaces the document, it does not add to it.
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog").open');
  await page().fill('#import-text', v1Text);
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#import-dialog").open === false');
  imported = await appState();
  assert.deepEqual(imported.worlds[0].inventory, { stone_bricks: 250, glass: 96, iron_ingot: 0 },
    'a second import of the same backup does not double the inventory');
  assert.equal(imported.worlds[0].builds[0].materials[0].collected, undefined);
});

test('100 v2 backup imports and rejects collected', async () => {
  await reset({ demo: false });
  const backup = {
    version: 2,
    activeWorldId: 'w-backup',
    worlds: [{
      id: 'w-backup',
      name: 'Backup World',
      edition: 'java',
      version: '1.21.4',
      notes: '',
      createdAt: '2026-09-14T08:05:00.000Z',
      updatedAt: '2026-10-25T21:40:00.000Z',
      inventory: { stone_bricks: 42 },
      builds: [{
        id: 'b-backup',
        name: 'Hut',
        status: 'building',
        active: true,
        coords: '',
        notes: '',
        materials: [{ id: 'm-backup', item: 'Stone Bricks', needed: 64 }],
      }],
    }],
  };
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog").open');
  await page().fill('#import-text', JSON.stringify(backup));
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#import-dialog").open === false');
  const imported = await appState();
  assert.equal(imported.version, 2);
  assert.equal(imported.worlds[0].inventory.stone_bricks, 42, 'v2 inventory imports as-is');
  const invalid = JSON.parse(JSON.stringify(backup));
  invalid.worlds[0].builds[0].materials[0].collected = 5;
  const before = await page().evaluate('return localStorage.getItem("mc-build-tracker:v2");');
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog").open');
  await page().fill('#import-text', JSON.stringify(invalid));
  await page().click('#import-restore');
  await page().waitFor('(document.querySelector("#import-error").textContent || "").trim().length > 0');
  const message = await page().text('#import-error');
  assert.ok(message.length > 0, 'a collected field is refused with a model error');
  assert.equal(await page().evaluate('return document.querySelector("#import-dialog").open;'), true,
    'the import dialog stays open on a rejected backup');
  assert.equal(await page().evaluate('return localStorage.getItem("mc-build-tracker:v2");'), before,
    'a rejected import writes nothing');
  await page().click('#import-cancel');
  await page().waitFor('document.querySelector("#import-dialog").open === false');
});

test('101 allocation priority for duplicate items across builds', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const wall = await materialRows();
  const byId = Object.fromEntries(wall.map((row) => [row.id, row]));
  assert.equal(byId['m1'].covered, '300', 'the first build in registry order takes its full need');
  assert.equal(byId['m1'].remaining, '0');
  assert.equal(byId['m3'].covered, '4', 'the later build gets only what the world inventory has left');
  assert.equal(byId['m3'].remaining, '28');
  assert.equal(byId['m1'].shared, 'shared with 2 builds',
    'a stock needed by two builds is flagged on the shared row');
  for (const row of wall) {
    assert.equal(Number(row.covered) + Number(row.remaining), Number(row.needed),
      'covered + remaining always equals needed for ' + row.item);
  }
  await openBuildNamed('Hut');
  const hut = await materialRows();
  assert.equal(hut[0].remaining, '150', 'a later build on the same item sees the leftover, not the full stock');
});

test('102 surplus appears once inventory exceeds total need', async () => {
  await seed17('surplus-state.json');
  await openBuildNamed('Single Wall');
  let rows = await materialRows();
  assert.equal(rows[0].remaining, '0');
  assert.equal(rows[0].surplus, '+385 surplus', '482 owned against 97 needed leaves a +385 surplus');
  assert.equal(await page().exists('#material-body .mat-row [data-mat-surplus]'), true);
  // A second build that raises the need past the stock makes the surplus disappear.
  const state = JSON.parse(fs.readFileSync(fixture17('surplus-state.json'), 'utf8'));
  state.worlds[0].builds.push({
    id: 'b2',
    name: 'Stock Wall',
    status: 'building',
    active: true,
    coords: '',
    notes: '',
    materials: [{ id: 'm2', item: 'Stone Bricks', needed: 400 }],
  });
  await injectState(state);
  await openBuildNamed('Single Wall');
  rows = await materialRows();
  assert.equal(rows[0].remaining, '0', 'the first build keeps its covered count');
  assert.equal((await page().text('#material-body .mat-row [data-mat-surplus]')).trim(), '–',
    'no surplus amount shows while the need still exceeds the stock');
  assert.equal(await page().evaluate('return document.querySelector("#material-body .mat-row [data-mat-surplus]").classList.contains("is-surplus");'), false,
    'no surplus cell exists while the world need still exceeds the stock');
  await openBuildNamed('Stock Wall');
  const stock = await materialRows();
  assert.equal(stock[0].remaining, '15', 'the leftover stock covers the second build down to 15');
});

test('103 inline Needed editor is a text field', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const field = await page().evaluate(`
    const input = document.querySelector('[data-mat="m1"] [data-mat-field="needed"]');
    return { tag: input.tagName, type: input.type, mode: input.getAttribute('inputmode'), value: input.value };
  `);
  assert.equal(field.tag, 'INPUT');
  assert.equal(field.type, 'text', 'Needed is a text editor so it can show "4 stacks + 44"');
  assert.equal(field.mode, 'numeric');
  assert.equal(field.value, '300');
  await page().fill('[data-mat="m1"] [data-mat-field="needed"]', '350');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  assert.equal(await buildByName('Wall').then((entry) => entry.build.materials[0].needed), 350,
    'Enter commits the typed number without opening a dialog');
  await page().fill('[data-mat="m1"] [data-mat-field="needed"]', '0');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  assert.equal(await buildByName('Wall').then((entry) => entry.build.materials[0].needed), 1,
    'the model clamps the need to at least 1');
  await page().evaluate(`
    const input = document.querySelector('[data-mat="m1"] [data-mat-field="needed"]');
    input.focus();
    input.value = '999';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("[data-mat=\\"m1\\"] [data-mat-field=needed]").value === "1"');
  assert.equal(await buildByName('Wall').then((entry) => entry.build.materials[0].needed), 1,
    'Escape reverts the edit instead of committing it');
});

test('104 Got shows world inventory and is read-only', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const got = await page().evaluate(`
    const cell = document.querySelector('[data-mat="m1"] [data-mat-got]');
    return {
      tag: cell.tagName,
      text: cell.textContent.trim(),
      editable: cell.getAttribute('contenteditable'),
      inputs: cell.querySelectorAll('input, textarea, select').length,
      title: cell.getAttribute('title') || '',
    };
  `);
  assert.equal(got.tag, 'SPAN', 'Got is a read-only cell, not an editor');
  assert.equal(got.inputs, 0, 'no form control lives inside the Got cell');
  assert.equal(got.editable, null);
  assert.equal(got.text, '350', 'Got is the world inventory for that item');
  assert.match(got.title, /inventory/i);
  await openBuildNamed('Hut');
  const hutGot = await materialRows();
  assert.equal(hutGot[0].got, '350', 'the same world stock is shown on every build that needs the item');
  await page().evaluate(`document.querySelector('[data-mat="m4"]').focus(); return true;`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  await closeInventoryWithEscape();
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 350, 'opening and closing writes nothing');
});

test('105 units toggle switches counts and stacks', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const oracle = await page().evaluate(`
    return {
      needed: window.TrackerModel.formatUnits(300, 'stone_bricks', 'stacks', 64),
      got: window.TrackerModel.formatUnits(350, 'stone_bricks', 'stacks', 64),
      remaining: window.TrackerModel.formatUnits(28, 'glass', 'stacks', 64),
    };
  `);
  assert.equal(oracle.needed, '4 stacks + 44');
  await page().click('#unit-toggle [data-unit="stacks"]');
  await page().waitFor('document.querySelector("#unit-toggle [data-unit=stacks]").getAttribute("aria-pressed") === "true"');
  const stacks = await materialRows();
  const byId = Object.fromEntries(stacks.map((row) => [row.id, row]));
  assert.equal(byId['m1'].needed, oracle.needed, 'Needed is written in stack syntax');
  assert.equal(byId['m1'].got, oracle.got);
  assert.equal(byId['m3'].remaining, oracle.remaining, 'Left follows the same formatting');
  assert.equal(await page().evaluate('return localStorage.getItem("mbt.units");'), 'stacks');
  await page().click('#unit-toggle [data-unit="shulkers"]');
  await page().waitFor('document.querySelector("#unit-toggle [data-unit=shulkers]").getAttribute("aria-pressed") === "true"');
  const shulkers = await materialRows();
  assert.equal(shulkers.length, 3, 'Shulkers renders every material row');
  assert.ok(shulkers.every((row) => row.needed.length > 0), 'Shulkers keeps every quantity readable');
  await page().click('#unit-toggle [data-unit="stacks"]');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await openBuildNamed('Wall');
  const reloaded = await materialRows();
  assert.equal(reloaded.find((row) => row.id === 'm1').needed, oracle.needed, 'the choice survives a reload');
  assert.equal(await page().evaluate('return document.querySelector("#unit-toggle [data-unit=stacks]").getAttribute("aria-pressed");'), 'true');
  await page().click('#unit-toggle [data-unit="items"]');
  await page().waitFor('document.querySelector("#unit-toggle [data-unit=items]").getAttribute("aria-pressed") === "true"');
  assert.equal((await materialRows()).find((row) => row.id === 'm1').needed, '300', 'switching back shows plain items');
});

test('106 hide completed hides done rows', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  assert.equal((await materialRows()).length, 3, 'the fixture has three rows');
  await page().click('#mat-hide-done');
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 1');
  const visible = await materialRows();
  assert.deepEqual(visible.map((row) => row.id), ['m3'], 'only the row that still needs items stays');
  assert.equal(await page().evaluate('return document.querySelector("#mat-hide-done").checked;'), true);
  assert.equal(await page().evaluate('return localStorage.getItem("mbt.density");'), 'on');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  await openBuildNamed('Wall');
  assert.equal((await materialRows()).length, 1, 'the filter survives a reload');
  await page().click('#mat-hide-done');
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 3');
  assert.equal((await materialRows()).length, 3, 'toggling off restores every row');

  await page().click('#view-compact');
  await page().waitFor('!document.querySelector("#compact-view").hidden');
  await page().click('#compact-hide-done');
  await page().waitFor('document.querySelector("#compact-hide-done").checked === true');
  const compactVisible = await page().evaluate(`
    const card = Array.from(document.querySelectorAll('#compact-grid .ccard')).find((node) =>
      node.querySelector('.ccard__name')?.textContent.trim() === 'Wall');
    return card ? Array.from(card.querySelectorAll('.ctile')).map((tile) => tile.getAttribute('data-mat')) : [];
  `);
  assert.deepEqual(compactVisible, ['m3'], 'Compact Hide completed keeps only the unfinished tile');
  await page().click('#compact-hide-done');
  await page().click('#view-standard');
});

test('107 three sort modes reorder deterministically', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  assert.deepEqual(await rowOrder(), ['m3', 'm2', 'm1'], 'default order is remaining, descending, name-tied');
  await page().fill('#mat-sort', 'name');
  await page().waitFor(`Array.from(document.querySelectorAll('#material-body .mat-row')).map((r) => r.getAttribute('data-mat')).join(',') === 'm2,m3,m1'`);
  assert.deepEqual(await rowOrder(), ['m2', 'm3', 'm1'], 'name order puts both Glass rows before Stone Bricks');
  assert.equal(await page().evaluate('return localStorage.getItem("mbt.sort");'), 'name');
  await page().fill('#mat-sort', 'category');
  await page().waitFor(`Array.from(document.querySelectorAll('#material-body .mat-row')).map((r) => r.getAttribute('data-mat')).join(',') === 'm2,m3,m1'`);
  assert.deepEqual(await rowOrder(), ['m2', 'm3', 'm1'],
    'both fixture items fall back to Misc, so category order ties on name and equals name order');
  assert.equal(await page().evaluate('return localStorage.getItem("mbt.sort");'), 'category');
  const options = await page().evaluate(`
    return Array.from(document.querySelectorAll('#mat-sort option')).map((option) => option.value);
  `);
  assert.deepEqual(options, ['remaining', 'name', 'category'], 'the three modes are frozen');
  await page().fill('#mat-sort', 'remaining');
  await page().waitFor(`Array.from(document.querySelectorAll('#material-body .mat-row')).map((r) => r.getAttribute('data-mat')).join(',') === 'm3,m2,m1'`);
});

test('108 grid density renders tiles with deficit', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  await page().click('#mat-view-grid');
  await page().waitFor('!document.querySelector("#material-grid").hidden');
  const chips = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-grid .mat-chip')).map((chip) => ({
      id: chip.getAttribute('data-mat'),
      count: chip.querySelector('[data-mat-chip-count]').textContent.trim(),
      done: chip.classList.contains('is-done'),
      tag: chip.tagName,
      focusable: chip.tabIndex >= 0,
      width: chip.getBoundingClientRect().width,
      height: chip.getBoundingClientRect().height,
    }));
  `);
  assert.equal(chips.length, 3, 'one tile per row');
  const byId = Object.fromEntries(chips.map((chip) => [chip.id, chip]));
  assert.equal(byId['m1'].count, '300', 'a covered tile shows the target quantity');
  assert.equal(byId['m3'].count, '28', 'an open tile shows the deficit');
  assert.equal(byId['m1'].done, true);
  assert.equal(byId['m3'].done, false);
  for (const chip of chips) {
    assert.equal(chip.tag, 'BUTTON', 'every tile is a real button');
    assert.equal(chip.focusable, true, 'every tile is in the Tab order');
    assert.ok(chip.width >= 44 && chip.height >= 44, 'a tile is at least 44x44 px (got ' + chip.width + 'x' + chip.height + ')');
    assert.ok(chip.width <= 80 && chip.height <= 80, 'a tile stays compact');
  }
  await page().evaluate(`document.querySelector('#material-grid .mat-chip[data-mat="m3"]').focus(); return true;`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.match(await page().text('#inv-item'), /Glass/);
  await closeInventoryWithEscape();
  await page().evaluate(`document.querySelector('#material-grid .mat-chip[data-mat="m3"]').focus(); return true;`);
  await page().press(' ', { code: 'Space', keyCode: 32 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  await closeInventoryWithEscape();
  const tabOrder = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-grid .mat-chip')).map((chip) => chip.getAttribute('data-mat'));
  `);
  assert.deepEqual(tabOrder, await rowOrder(), 'the Tab order follows the rendered row order');
});

test('109 inventory dialog opens from the row', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  await openInventoryForRow('m1');
  const dialog = await page().evaluate(`
    const active = document.activeElement;
    return {
      title: document.querySelector('#inv-title').textContent.trim(),
      item: document.querySelector('#inv-item').textContent.trim(),
      context: document.querySelector('#inv-context').textContent.trim(),
      absolute: document.querySelector('#inv-absolute').value,
      delta: document.querySelector('#inv-delta').value,
      focused: active ? active.id : '',
      selected: active && (active.selectionStart === 0 || active.selectionStart === null) &&
        (active.selectionStart === null || active.selectionEnd === String(active.value).length),
    };
  `);
  assert.equal(dialog.item, 'Stone Bricks');
  assert.match(dialog.context, /Wall/);
  assert.match(dialog.context, /300 allocated of 300 needed/);
  assert.match(dialog.context, /350 in world/);
  assert.equal(dialog.absolute, '350', 'the absolute field is prefilled from the world inventory');
  assert.equal(dialog.delta, '', 'the relative field starts empty');
  assert.equal(dialog.focused, 'inv-absolute', 'focus lands in the absolute field');
  assert.equal(dialog.selected, true, 'the prefilled value is selected for typing');
  await closeInventoryWithEscape();
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 350, 'Escape writes nothing');
});

test('110 absolute replacement commits and clamps', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const before = await appState();
  await openInventoryForRow('m1');
  await page().fill('#inv-absolute', '300');
  await page().fill('#inv-delta', '');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  const changed = await appState();
  assert.equal(changed.worlds[0].inventory.stone_bricks, 300, 'the absolute value replaces the world inventory');
  assert.equal(changed.worlds[0].builds[0].materials[0].collected, undefined, 'nothing is written to the retired collected field');
  const wall = await materialRows();
  assert.equal(wall.find((row) => row.id === 'm1').remaining, '0', 'the remaining count is recomputed');
  await openBuildNamed('Hut');
  assert.equal((await materialRows())[0].remaining, '200', 'the later build sees the smaller stock');
  assert.equal(await page().hidden('#toast-action'), false, 'the commit offers one Undo');
  await page().click('#toast-action');
  await page().waitFor('JSON.parse(localStorage.getItem("mc-build-tracker:v2")).worlds[0].inventory.stone_bricks === 350');
  assert.deepEqual(await appState(), before, 'Undo restores the exact pre-edit document');
  await openBuildNamed('Wall');
  await openInventoryForRow('m1');
  await page().fill('#inv-absolute', '-5');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 0, 'a negative absolute clamps to zero');
});

test('111 delta forms: 2s+10, +32, -1s, clamp', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const fixture = JSON.parse(fs.readFileSync(fixture17('invalid-delta-inputs.json'), 'utf8'));
  const oracle = await page().evaluate(`return window.TrackerModel.parseRelative('2s+10', ${fixture.stack});`);
  assert.equal(oracle.value, 2 * fixture.stack + 10, 'the parser oracle: 2s+10 means two stacks and ten');
  for (const entry of fixture.inputs) {
    const result = await page().evaluate(`
      return window.TrackerModel.parseRelative(${JSON.stringify(entry.text)}, ${fixture.stack});
    `);
    if (entry.expect === 'error') assert.ok(result.error, entry.text + ' is refused by the parser');
    else assert.equal(result.value, entry.expect, entry.text + ' resolves to ' + entry.expect);
  }
  const commitDelta = async (text) => {
    await openInventoryForRow('m1');
    await page().fill('#inv-absolute', '');
    await page().fill('#inv-delta', text);
    await page().press('Enter', { code: 'Enter', keyCode: 13 });
    await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  };
  await commitDelta('2s+10');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 350 + 138, '2s+10 adds 138');
  await commitDelta('+32');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 520, '+32 adds 32');
  await commitDelta('-1s');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 456, '-1s subtracts one stack');
  await commitDelta('-9999');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 0, 'a relative decrease clamps at zero');
  for (const invalid of ['abc', '2s+', '+1e9']) {
    await openInventoryForRow('m1');
    await page().fill('#inv-absolute', '');
    await page().fill('#inv-delta', invalid);
    await page().press('Enter', { code: 'Enter', keyCode: 13 });
    await page().waitFor('(document.querySelector("#inv-error").textContent || "").trim().length > 0');
    assert.equal(await page().evaluate('return document.querySelector("#inventory-dialog").open;'), true,
      invalid + ' keeps the dialog open');
    await closeInventoryWithEscape();
  }
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 0, 'invalid input writes nothing');
});

test('112 paste preview parses and creates', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const before = await appState();
  await page().click('#bulk-paste');
  await page().waitFor('document.querySelector("#paste-preview").open === true');
  await page().fill('#paste-text', ['64 stone bricks', '32 glass', 'mystery goo'].join('\n'));
  await page().waitFor('document.querySelectorAll("#paste-rows .paste-row").length === 2');
  const preview = await page().evaluate(`
    return {
      rows: Array.from(document.querySelectorAll('#paste-rows .paste-row')).map((row) => ({
        slug: row.getAttribute('data-slug'),
        text: row.textContent.trim(),
      })),
      errors: (document.querySelector('#paste-errors').textContent || '').trim(),
      okDisabled: document.querySelector('#paste-ok').disabled,
      context: document.querySelector('#paste-context').textContent.trim(),
    };
  `);
  assert.equal(preview.rows.length, 2, 'two lines matched, one did not');
  assert.match(preview.rows[0].text, /Stone Bricks/);
  assert.match(preview.rows[1].text, /Glass/);
  assert.match(preview.errors, /mystery goo/i, 'the unmatched line is reported verbatim');
  assert.equal(preview.okDisabled, false);
  assert.match(preview.context, /Wall/);
  await page().click('#paste-ok');
  await page().waitFor('document.querySelector("#paste-preview").open === false');
  const wall = await buildByName('Wall').then((entry) => entry.build);
  const byMaterialId = Object.fromEntries(wall.materials.map((material) => [material.id, material.needed]));
  assert.equal(wall.materials.length, 3, 'matched items merge into the existing rows instead of duplicating');
  assert.equal(byMaterialId['m1'], 364, 'the pasted quantity is added to the existing need');
  assert.equal(byMaterialId['m2'], 128, 'Glass merges into the first Glass row');
  assert.equal(byMaterialId['m3'], 32, 'the second Glass row is untouched');
  // Cancel never writes.
  const stateAfterAdd = await appState();
  await page().click('#bulk-paste');
  await page().waitFor('document.querySelector("#paste-preview").open === true');
  await page().fill('#paste-text', '32 glass');
  await page().waitFor('document.querySelectorAll("#paste-rows .paste-row").length === 1');
  await page().click('#paste-cancel');
  await page().waitFor('document.querySelector("#paste-preview").open === false');
  assert.deepEqual(await appState(), stateAfterAdd, 'Cancel writes nothing');
  assert.ok(before);
});

test('113 drag reorder persists and is not a no-op', async () => {
  await seed17('duplicate-allocation-state.json');
  const state = JSON.parse(fs.readFileSync(fixture17('duplicate-allocation-state.json'), 'utf8'));
  state.worlds[0].builds[1].status = 'building';
  await injectState(state);
  const before = await page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry')).map((entry) => ({
      name: entry.querySelector('.build-entry__name').textContent.trim(),
      order: entry.getAttribute('data-order'),
    }));
  `);
  assert.deepEqual(before.map((entry) => entry.name), ['Wall', 'Hut', 'Old Shed'],
    'same-rank builds keep registry order');
  assert.deepEqual(before.map((entry) => entry.order), ['0', '1', '2'], 'every entry carries its visible index');
  await page().evaluate(`
    const entries = Array.from(document.querySelectorAll('#build-list .build-entry'));
    const dt = new DataTransfer();
    entries[1].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    entries[0].dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    entries[0].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    entries[1].dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    return true;
  `);
  await page().waitFor(`Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim()).join('|') === 'Hut|Wall|Old Shed'`);
  const after = await page().evaluate(`
    return {
      names: Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim()),
      orders: Array.from(document.querySelectorAll('#build-list .build-entry')).map((entry) => entry.getAttribute('data-order')),
      nested: Array.from(document.querySelectorAll('.build-entry button button')).length,
    };
  `);
  assert.deepEqual(after.names, ['Hut', 'Wall', 'Old Shed'], 'the dropped build moved above the target');
  assert.deepEqual(after.orders, ['0', '1', '2'], 'data-order follows the rendered order');
  assert.equal(after.nested, 0, 'no button is nested inside another button');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const reloaded = await page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim());
  `);
  assert.deepEqual(reloaded, ['Hut', 'Wall', 'Old Shed'], 'the order is persisted');
  const compact = await page().evaluate(`
    document.querySelector('#view-compact').click();
    return Array.from(document.querySelectorAll('#compact-grid .ccard .ccard__name')).map((n) => n.textContent.trim());
  `);
  assert.deepEqual(compact, ['Hut', 'Wall', 'Old Shed'], 'the compact view follows the same registry order');
});

test('114 keyboard-only inventory path', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  await page().evaluate(`document.querySelector('[data-mat="m1"]').focus(); return true;`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.equal(await page().evaluate('return document.activeElement.id;'), 'inv-absolute');
  await page().fill('#inv-absolute', '123');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 123, 'Enter in the dialog commits');
  const focusBack = await page().evaluate(`
    const active = document.activeElement;
    return { tag: active.tagName, mat: active.getAttribute && active.getAttribute('data-mat') };
  `);
  assert.equal(focusBack.mat, 'm1', 'focus returns to the row that opened the dialog');
  await page().evaluate(`document.querySelector('[data-mat="m1"]').focus(); return true;`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  const rowFocus = await page().evaluate(`
    const active = document.activeElement;
    return { tag: active.tagName, mat: active.getAttribute && active.getAttribute('data-mat') };
  `);
  assert.equal(rowFocus.mat, 'm1', 'Escape restores focus to the row that opened the dialog');
  assert.equal(await page().evaluate('return document.querySelector("#copy-coords").tabIndex >= 0;'), true,
    'the Copy control stays in the keyboard order');
});

test('115 copy list puts the count in plain text', async () => {
  await seed17('duplicate-allocation-state.json');
  await page().evaluate(`
    window.__copied = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text) => { window.__copied = text; return Promise.resolve(); } },
    });
    return true;
  `);
  await page().click('#btn-copy-list');
  await page().waitFor('typeof window.__copied === "string" && window.__copied.length > 0');
  const copied = await page().evaluate('return window.__copied;');
  assert.match(copied, /^Stone Bricks x500 \(150 left\)$/m, 'the plain count is the aggregated need: ' + copied);
  assert.match(copied, /^Glass x128 \(28 left\)$/m);
  assert.equal(/\*\*/.test(copied), false, 'no markdown bold');
  assert.equal(/\[\s?\]/.test(copied), false, 'no markdown checkboxes');
  assert.equal(/-\s/.test(copied), false, 'no markdown list bullets');
  const toast = (await page().text('#toast')).trim();
  assert.match(toast, /copied/i, 'the toast names the copied list');
});

test('116 row dialogs are icon, name, delete only', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  await page().click('[data-mat="m1"] .mat-row__name');
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.match(await page().text('#inv-item'), /Stone Bricks/);
  await closeInventoryWithEscape();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().click('#icon-cancel');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  await page().click('#build-rename');
  await page().waitFor('document.querySelector("#build-name").hidden === false');
  await page().click('#build-name-cancel');
  await page().waitFor('document.querySelector("#build-name").hidden === true');
  const beforeCount = await page().count('#build-list .build-entry');
  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  await page().click('#confirm-ok');
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry').length === ${beforeCount - 1}`);
  assert.equal(await page().hidden('#toast-action'), false, 'the delete offers an Undo');
  await page().click('#toast-action');
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry').length === ${beforeCount}`);
  assert.equal(await page().count('#build-list .build-entry'), beforeCount, 'Undo restores the deleted build');
});

test('117 sidebar controls collapse, filter and carry world actions', async () => {
  await seed17('duplicate-allocation-state.json');
  assert.equal(await page().evaluate('return document.body.classList.contains("is-sidebar-collapsed");'), false);
  await page().click('#sidebar-toggle');
  await page().waitFor('document.body.classList.contains("is-sidebar-collapsed")');
  const collapsed = await page().evaluate(`
    const panel = document.querySelector('#world-panel');
    return {
      width: Math.round(panel.getBoundingClientRect().width),
      pressed: document.querySelector('#sidebar-toggle').getAttribute('aria-pressed'),
      label: document.querySelector('#sidebar-toggle').getAttribute('aria-label'),
    };
  `);
  assert.ok(collapsed.width >= 56 && collapsed.width <= 70, 'the collapsed rail is about 56px wide (got ' + collapsed.width + ')');
  assert.equal(collapsed.pressed, 'true');
  assert.match(collapsed.label, /expand/i);
  assert.equal(await page().evaluate('return localStorage.getItem("mbt.sidebar");'), 'closed');
  const options = await page().evaluate(`
    return Array.from(document.querySelectorAll('#inactive-mode option')).map((option) => option.value);
  `);
  assert.deepEqual(options, ['priority', 'end', 'hide'], 'exactly three inactive modes');
  for (const selector of ['#unit-toggle [data-unit=items]', '#btn-shopping-list', '#btn-new-world', '#btn-import', '#btn-export']) {
    assert.equal(await page().hidden(selector), false, selector + ' stays reachable while collapsed');
  }
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  assert.equal(await page().evaluate('return document.body.classList.contains("is-sidebar-collapsed");'), true,
    'the collapsed state survives a reload');
  await page().click('#sidebar-toggle');
  await page().waitFor('!document.body.classList.contains("is-sidebar-collapsed")');
});

test('118 world progress agrees with allocation', async () => {
  await seed17('duplicate-allocation-state.json');
  const oracle = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const summary = window.TrackerModel.worldSummary(world);
    return { text: window.TrackerModel.progressText(summary.covered, summary.needed), covered: summary.covered, needed: summary.needed };
  `);
  assert.equal((await page().text('#world-progress-text')).trim(), oracle.text);
  await page().fill('#inactive-mode', 'hide');
  await page().waitFor('localStorage.getItem("mbt.inactiveMode") === "hide"');
  const names = await page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim());
  `);
  assert.deepEqual(names, ['Wall', 'Hut'], 'the inactive old build is dropped from the list');
  const after = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    return window.TrackerModel.progressText(window.TrackerModel.worldSummary(world).covered, window.TrackerModel.worldSummary(world).needed);
  `);
  assert.equal((await page().text('#world-progress-text')).trim(), after,
    'progress still agrees with the allocation of the participating builds');
  assert.match(after, /items gathered \(\d+%\)$/, 'the percentage is never negative or capped away');
});

test('119 shopping list dialog lists deficits once', async () => {
  await seed17('duplicate-allocation-state.json');
  await page().click('#btn-shopping-list');
  await page().waitFor('document.querySelector("#shopping-dialog").open === true');
  const rows = await page().evaluate(`
    return Array.from(document.querySelectorAll('#shopping-body .mat-row')).map((row) => ({
      slug: row.getAttribute('data-mat'),
      count: row.querySelector('[data-shopping-count]').textContent.trim(),
      builds: row.querySelector('.mat-row__builds') ? row.querySelector('.mat-row__builds').textContent.trim() : '',
    }));
  `);
  assert.deepEqual(rows.map((row) => row.slug), ['stone_bricks', 'glass'], 'one row per slug, largest deficit first');
  assert.equal(rows[0].count, '150', 'Stone Bricks is 500 needed against 350 owned');
  assert.equal(rows[1].count, '28', 'Glass is 128 needed against 100 owned');
  assert.equal(new Set(rows.map((row) => row.slug)).size, rows.length, 'no duplicate slug');
  assert.equal(rows.some((row) => /Old Shed/.test(row.builds)), false, 'the done build is not an owner');
  assert.match(rows[0].builds, /Wall/);
  assert.match(rows[0].builds, /Hut/);
  await page().click('#shopping-close');
  await page().waitFor('document.querySelector("#shopping-dialog").open === false');
});

test('120 done build leaves the rollup but not the list', async () => {
  await seed17('inactive-state.json');
  const oracle = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    return {
      summary: window.TrackerModel.worldSummary(world),
      text: window.TrackerModel.progressText(window.TrackerModel.worldSummary(world).covered, window.TrackerModel.worldSummary(world).needed),
    };
  `);
  assert.equal((await page().text('#world-progress-text')).trim(), oracle.text);
  const list = await page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim());
  `);
  assert.ok(list.includes('Finished Tower'), 'the done build stays in the list');
  assert.equal(list[list.length - 1], 'Finished Tower', 'in priority mode the done build sorts last');
  await openBuildNamed('Finished Tower');
  const rows = await materialRows();
  assert.equal(rows[0].covered, rows[0].needed, 'its own detail shows it fully covered');
  assert.equal(rows[0].remaining, '0');
  const coveredAfter = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const summary = window.TrackerModel.worldSummary(world);
    return { covered: summary.covered, needed: summary.needed };
  `);
  assert.equal(coveredAfter.covered, oracle.summary.covered, 'the done build consumes nothing from the world rollup');
  assert.equal(coveredAfter.needed, oracle.summary.needed);
});

test('121 compact view renders one count per tile', async () => {
  await seed17('duplicate-allocation-state.json');
  await page().click('#view-compact');
  await page().waitFor('!document.querySelector("#view-compact").hidden || document.querySelector("#compact-grid").children.length > 0');
  await page().waitFor('document.querySelectorAll("#compact-grid .ccard").length === 3');
  const cards = await page().evaluate(`
    return Array.from(document.querySelectorAll('#compact-grid .ccard')).map((card) => ({
      build: card.getAttribute('data-build'),
      name: card.querySelector('.ccard__name').textContent.trim(),
      tiles: Array.from(card.querySelectorAll('.ctile')).map((tile) => ({
        mat: tile.getAttribute('data-mat'),
        count: tile.querySelector('.ctile__count').textContent.trim(),
        done: tile.classList.contains('ctile--done'),
        text: tile.textContent,
      })),
    }));
  `);
  assert.equal(cards.length, 3);
  assert.equal(cards.some((card) => /undefined/.test(JSON.stringify(card))), false,
    'no tile renders the string undefined');
  const wall = cards.find((card) => card.name === 'Wall');
  const tile = wall.tiles.find((entry) => entry.mat === 'm1');
  assert.equal(tile.count, '300', 'a finished tile shows its total required count');
  assert.equal(tile.done, true);
  const oracle = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v2'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    const alloc = window.TrackerModel.allocate(world);
    const covered = alloc.perMaterial['m1'] || 0;
    return window.TrackerModel.formatUnits(covered >= 300 ? 300 : Math.max(0, 300 - covered), 'stone_bricks', 'items', 64);
  `);
  assert.equal(oracle, tile.count);
  await page().evaluate(`document.querySelector('#compact-grid .ccard .ctile[data-mat="m1"]').click(); return true;`);
  await page().waitFor('document.querySelector("#inventory-dialog").open === true');
  assert.match(await page().text('#inv-item'), /Stone Bricks/);
  const before = (await appState()).worlds[0].inventory.stone_bricks;
  await page().fill('#inv-absolute', '400');
  await page().fill('#inv-delta', '');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.querySelector("#inventory-dialog").open === false');
  assert.equal((await appState()).worlds[0].inventory.stone_bricks, 400, 'one commit writes once');
  assert.notEqual(before, 400);
});

test('122 mobile 390 stacks the material table', async () => {
  await page().setViewport(390, 844);
  try {
    await seed17('duplicate-allocation-state.json');
    await openBuildNamed('Wall');
    const metrics = await page().evaluate(`
      const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
      const doc = document.documentElement;
      const body = document.querySelector('#material-body');
      const overflowAncestors = [];
      let node = body.parentElement;
      while (node && node !== document.body) {
        const style = getComputedStyle(node);
        if (['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflowX)) overflowAncestors.push(node.id || node.className);
        node = node.parentElement;
      }
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        scrollHeight: doc.scrollHeight,
        innerHeight: window.innerHeight,
        overflowAncestors,
        firstRowTag: rows[0].tagName,
        rowColumns: getComputedStyle(rows[0]).gridTemplateColumns,
      };
    `);
    assert.ok(metrics.scrollWidth <= metrics.innerWidth + 1, 'no horizontal overflow at 390px');
    assert.deepEqual(metrics.overflowAncestors, [], 'the table is not trapped in an inner scroll box');
    assert.ok(metrics.scrollHeight > metrics.innerHeight, 'the page grows instead of clipping');
    assert.equal(metrics.firstRowTag, 'DIV');
    await page().click('#mat-view-grid');
    await page().waitFor('!document.querySelector("#material-grid").hidden');
    const columns = await page().evaluate(`
      const chips = Array.from(document.querySelectorAll('#material-grid .mat-chip'));
      const lefts = Array.from(new Set(chips.map((chip) => Math.round(chip.getBoundingClientRect().left))));
      return { count: chips.length, perRow: Math.max(...Object.values(chips.reduce((acc, chip) => {
        const key = Math.round(chip.getBoundingClientRect().top);
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}))), columns: lefts.length };
    `);
    assert.equal(columns.count, 3);
    assert.ok(columns.columns <= 4, 'the grid reflows to at most four chips per row');
    await page().evaluate(`document.querySelector('#material-grid .mat-chip[data-mat="m1"]').click(); return true;`);
    await page().waitFor('document.querySelector("#inventory-dialog").open === true');
    await closeInventoryWithEscape();
  } finally {
    await page().clearViewport();
  }
});

test('123 sticky toolbar stays above the viewport bottom', async () => {
  await page().setViewport(1280, 700);
  try {
    await seed17('duplicate-allocation-state.json');
    const state = JSON.parse(fs.readFileSync(fixture17('duplicate-allocation-state.json'), 'utf8'));
    const wall = state.worlds[0].builds[0];
    for (let index = 0; index < 30; index += 1) {
      wall.materials.push({ id: 'extra-' + index, item: index % 2 === 0 ? 'Glass' : 'Stone Bricks', needed: 10 + index });
    }
    await injectState(state);
    await openBuildNamed('Wall');
    const sticky = await page().evaluate(`
      const toolbar = document.querySelector('#mat-toolbar');
      return { position: getComputedStyle(toolbar).position, top: toolbar.getBoundingClientRect().top, rows: document.querySelectorAll('#material-body .mat-row').length };
    `);
    assert.equal(sticky.position, 'sticky', 'the toolbar is sticky');
    assert.ok(sticky.rows >= 10, 'the build is long enough to scroll');
    await page().evaluate('window.scrollTo(0, 600); return true;');
    await page().waitFor('window.scrollY > 100');
    const scrolled = await page().evaluate(`
      const toolbar = document.querySelector('#mat-toolbar');
      const rect = toolbar.getBoundingClientRect();
      const last = document.querySelector('#material-body .mat-row:last-child');
      const lastRect = last.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportBottom: window.innerHeight, lastTop: lastRect.top };
    `);
    assert.ok(Math.abs(scrolled.top) <= 16, 'the toolbar pins to the top while scrolling (top ' + scrolled.top + ')');
    assert.ok(scrolled.bottom < scrolled.viewportBottom, 'the toolbar stays above the viewport bottom');
  } finally {
    await page().clearViewport();
    await page().evaluate('window.scrollTo(0, 0); return true;');
  }
});

test('124 timestamps show UTC slice and raw ISO title', async () => {
  const v1 = JSON.parse(fs.readFileSync(fixture17('v1-migration-state.json'), 'utf8'));
  await injectV1State(v1);
  const stamps = await page().evaluate(`
    return Array.from(document.querySelectorAll('.stamp[data-iso]')).map((node) => ({
      text: node.textContent.trim(),
      iso: node.getAttribute('data-iso'),
      title: node.getAttribute('title'),
      datetime: node.getAttribute('datetime'),
    }));
  `);
  assert.ok(stamps.length >= 1, 'the sidebar renders the world stamps');
  for (const stamp of stamps) {
    assert.match(stamp.text, /^(just now|\d+ min ago|\d+ h ago|\d+ days? ago)$/, 'the visible stamp is a relative age');
    assert.equal(stamp.datetime, stamp.iso);
    assert.ok(stamp.title.indexOf('(' + stamp.iso + ')') > -1, 'the tooltip keeps the raw ISO timestamp');
    assert.match(stamp.title, /^Updated \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(/, 'the tooltip prefixes the exact UTC time');
    const expected = await page().evaluate(`return window.TrackerModel.formatStamp(${JSON.stringify(stamp.iso)});`);
    assert.ok(stamp.title.indexOf(expected) > -1, 'the tooltip text is M.formatStamp(iso)');
  }
  assert.equal(await page().hidden('#migrated-from'), false, 'the migration notice is shown once');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  assert.equal(await page().hidden('#migrated-from'), true, 'and not again on the next load');
});

test('125 export v2 round-trips', async () => {
  await seed17('duplicate-allocation-state.json');
  await page().evaluate(`
    window.__blobRef = null;
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { window.__blobRef = blob; return real(blob); };
    return true;
  `);
  await page().click('#btn-export');
  await page().waitFor('window.__blobRef instanceof Blob');
  const text = await page().evaluate('return window.__blobRef.text();');
  const exported = JSON.parse(text);
  assert.equal(exported.version, 2, 'the backup is v2');
  assert.ok(exported.worlds[0].inventory, 'the inventory travels on the world');
  assert.equal(JSON.stringify(exported).includes('"collected"'), false, 'no retired collected fields are exported');
  const before = await appState();
  await page().click('#btn-import');
  await page().waitFor('document.querySelector("#import-dialog").open');
  await page().fill('#import-text', text);
  await page().click('#import-restore');
  await page().waitFor('document.querySelector("#import-dialog").open === false');
  const after = await appState();
  assert.deepEqual(after.worlds[0].inventory, before.worlds[0].inventory, 'the inventory round-trips');
  assert.deepEqual(after.worlds[0].builds.map((build) => [build.name, build.active, build.materials.length]),
    before.worlds[0].builds.map((build) => [build.name, build.active, build.materials.length]),
    'build order, active flags and material counts round-trip');
});

test('126 materials region scrolls the page, not itself', async () => {
  await page().setViewport(1280, 900);
  try {
    await seed17('duplicate-allocation-state.json');
    const state = JSON.parse(fs.readFileSync(fixture17('duplicate-allocation-state.json'), 'utf8'));
    const wall = state.worlds[0].builds[0];
    for (let index = 0; index < 14; index += 1) {
      wall.materials.push({ id: 'extra-' + index, item: index % 2 === 0 ? 'Glass' : 'Stone Bricks', needed: 10 + index });
    }
    await injectState(state);
    await openBuildNamed('Wall');
    const geometry = await page().evaluate(`
      const body = document.querySelector('#material-body');
      const ancestors = [];
      let node = body.parentElement;
      while (node && node !== document.documentElement) {
        const style = getComputedStyle(node);
        if (['auto', 'scroll'].includes(style.overflowY) || ['auto', 'scroll'].includes(style.overflowX)) ancestors.push(node.id || node.className || node.tagName);
        node = node.parentElement;
      }
      const lastRow = body.querySelector('.mat-row:last-child');
      const form = document.querySelector('#add-material-form');
      return {
        ancestors,
        scrollHeight: document.documentElement.scrollHeight,
        innerHeight: window.innerHeight,
        lastRowBottom: lastRow.getBoundingClientRect().bottom,
        formTop: form.getBoundingClientRect().top,
        toolbarTop: document.querySelector('#mat-toolbar').getBoundingClientRect().top,
      };
    `);
    assert.deepEqual(geometry.ancestors, [], 'no ancestor of #material-body is an inner scroll box');
    assert.ok(geometry.scrollHeight > geometry.innerHeight, 'the page grows with the rows');
    assert.ok(geometry.formTop >= geometry.lastRowBottom - 1, 'the add form sits below the last row, not inside a scroller');
    assert.ok(geometry.toolbarTop >= 0 && geometry.toolbarTop < geometry.innerHeight,
      'the toolbar is on screen above the rows');
    await page().evaluate(`
      const toolbar = document.querySelector('#mat-toolbar');
      const target = Math.min(document.documentElement.scrollHeight - window.innerHeight,
        toolbar.getBoundingClientRect().top + window.scrollY + 120);
      window.scrollTo(0, target);
      return target;
    `);
    await page().waitFor('window.scrollY > 0');
    const pinned = await page().evaluate(
      'return document.querySelector("#mat-toolbar").getBoundingClientRect().top;'
    );
    assert.ok(pinned >= -1 && pinned <= 16, 'the toolbar pins while the materials region scrolls the page');
  } finally {
    await page().clearViewport();
  }
});

test('127 inactive builds follow priority/end/hide', async () => {
  await seed17('inactive-state.json');
  assert.equal(await page().count('#build-list .build-entry--inactive'), 1, 'the paused build is dimmed in place in priority mode');
  await page().fill('#inactive-mode', 'end');
  await page().waitFor(`Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim()).join('|') === 'Active Hut|Finished Tower|Paused Barn'`);
  await page().fill('#inactive-mode', 'hide');
  await page().waitFor(`Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim()).join('|') === 'Active Hut|Finished Tower'`);
  const hidden = await page().evaluate(`
    return Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim());
  `);
  assert.deepEqual(hidden, ['Active Hut', 'Finished Tower'], 'hide drops the inactive build from the list');
  await page().fill('#inactive-mode', 'priority');
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry--inactive').length === 1`);
  const before = await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Paused Barn');
    return { actions: entry.querySelectorAll('.build-entry__actions button').length };
  `);
  assert.equal(before.actions, 3, 'hover actions are Edit, Activate and Remove buttons');
  await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Paused Barn');
    entry.querySelector('[data-build-activate]').click();
    return true;
  `);
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry--inactive').length === 0`);
  const active = await buildByName('Paused Barn');
  assert.equal(active.build.active, true, 'activation flips the active flag');
  const count = await page().count('#build-list .build-entry');
  await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Active Hut');
    entry.querySelector('[data-build-remove]').click();
    return true;
  `);
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  await page().click('#confirm-ok');
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry').length === ${count - 1}`);
  assert.equal(await page().hidden('#toast-action'), false, 'removal offers Undo');
  await page().click('#toast-action');
  await page().waitFor(`document.querySelectorAll('#build-list .build-entry').length === ${count}`);
});

test('128 build header groups identity and notes', async () => {
  await seed17('duplicate-allocation-state.json');
  await openBuildNamed('Wall');
  const grouping = await page().evaluate(`
    const order = ['#build-header', '#detail-progress', '#mat-toolbar', '#material-table', '#material-body'];
    const nodes = order.map((sel) => document.querySelector(sel));
    const indices = nodes.map((node, index) => {
      const position = node.compareDocumentPosition(document.querySelector('#material-body'));
      return index;
    });
    const header = document.querySelector('#build-header');
    return {
      present: nodes.every(Boolean),
      headerBeforeBody: (header.compareDocumentPosition(document.querySelector('#material-body')) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      headerBeforeToolbar: (header.compareDocumentPosition(document.querySelector('#mat-toolbar')) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      hasHeading: !!document.querySelector('#detail-heading'),
      hasStatus: !!header.querySelector('#status-group'),
      hasCoords: !!header.querySelector('#build-coords'),
      hasNotesAffordances: !!header.querySelector('#notes-edit') && !!header.querySelector('#notes-text'),
      hasNameEdit: !!header.querySelector('#build-rename') && !!header.querySelector('#build-name'),
      indices,
    };
  `);
  assert.equal(grouping.present, true, 'the header, progress, toolbar and body all exist');
  assert.equal(grouping.headerBeforeBody, true, 'the header precedes the material body');
  assert.equal(grouping.headerBeforeToolbar, true, 'the header precedes the toolbar');
  assert.equal(grouping.hasHeading, true);
  assert.equal(grouping.hasStatus, true);
  assert.equal(grouping.hasCoords, true);
  assert.equal(grouping.hasNotesAffordances, true);
  assert.equal(grouping.hasNameEdit, true);
  await page().click('#notes-edit');
  await page().waitFor('!document.querySelector("#notes-editor").hidden');
  await page().fill('#build-notes', 'Two deep for the terrace.');
  await page().click('#notes-save');
  await page().waitFor('document.querySelector("#notes-editor").hidden === true');
  assert.equal((await page().text('#notes-text')).trim(), 'Two deep for the terrace.');
  const stored = await buildByName('Wall');
  assert.equal(stored.build.notes, 'Two deep for the terrace.', 'the notes are persisted on the build');
});

test('66 the whole run, including the new surfaces, stayed free of console errors', async () => {
  assert.deepEqual(app.consoleErrors, []);
});
