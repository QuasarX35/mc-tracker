/**
 * Comprehensive UI acceptance suite for the Minecraft Build Tracker (测试部, EDICT-0009).
 *
 * Drives the real app in real Chrome through the DevTools Protocol (see ui/harness.mjs).
 * EDICT-0013 froze this case list at the S2 audit; every case maps to a frozen acceptance
 * sentence. The suite is deliberately black-box: it clicks, types and reads the DOM, never
 * app internals, so it fails when a user would notice.
 *
 * 49 cases: onboarding, worlds, builds, title rename (D2), status, deletion, materials,
 * quantity steppers (D5), notes view/edit (D4), coords copy (D3), item picker (D6/D7/D8),
 * image upload, search cap, Escape semantics, themed select (D9), backdrop blur (D10),
 * accessibility, responsive layout, visual contract and console cleanliness.
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
const EVIDENCE = path.join(ROOT, 'reports', 'qa', 'evidence', 'edict-0013');
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

/** Current app state, straight from the page's persisted model. */
async function appState() {
  return page().evaluate(`
    const raw = localStorage.getItem('mc-build-tracker:v1');
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
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
    for (const world of state.worlds) {
      for (const build of world.builds) if (build.name === ${JSON.stringify(name)}) return { build, worldId: world.id };
    }
    return null;
  `);
}

/**
 * The whole build's gathered percentage and remaining count, computed from the
 * rendered rows. `#build-pct` is build-wide, so a single row cannot reach 100%.
 */
async function buildTotals() {
  return page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
    let needed = 0;
    let collected = 0;
    for (const row of rows) {
      const n = Number(row.querySelector('[data-mat-field="needed"]').value);
      const c = Number(row.querySelector('[data-mat-field="collected"]').value);
      needed += n;
      collected += Math.min(c, n);
    }
    return { pct: needed ? Math.round((collected / needed) * 100) : 0, remaining: needed - collected, needed, collected };
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
async function addMaterialViaPicker(nameQuery, { needed = null, collected = null, slug = null } = {}) {
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
  if (collected !== null) await page().fill('#mat-collected', String(collected));
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
  assert.equal(await page().value('#build-coords'), '210 / 70 / -18');
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
  state.worlds[0].builds[0].materials.push({ id: 'mat_mystery', item: 'Mystery Goo', needed: 3, collected: 1 });
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
  await page().fill(`[data-mat="${materialId}"][data-mat-field="needed"]`, '20');
  await page().fill(`[data-mat="${materialId}"][data-mat-field="collected"]`, '999');
  const clamped = await page().evaluate(`
    const row = document.querySelector('#material-body .mat-row');
    return Number(row.querySelector('.num:not(input)').textContent.trim());
  `);
  assert.equal(clamped, 0, 'collected above needed leaves nothing to gather');
  const complete = await buildTotals();
  assert.equal(await page().text('#build-pct'), `${complete.pct}%`,
    'the percentage is the whole build, computed from the rows');
  assert.equal(await page().attr('#build-bar', 'aria-valuenow'), String(complete.pct));
  await page().fill(`[data-mat="${materialId}"][data-mat-field="collected"]`, '5');
  const partial = await buildTotals();
  assert.equal(await page().text('#build-pct'), `${partial.pct}%`);
  assert.equal(await page().text('#build-summary').then((text) => text.includes(`${partial.remaining} to go`)), true,
    'the summary states how much is still to gather across the build');
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
  await page().click('#material-body .row-delete');
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
  assert.match(await page().text('#mat-totals'), /items · .* gathered · .* to go · \d+%/);
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
    const got = document.querySelector('#material-body [data-mat-field=collected]');
    return {
      width: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      got: got ? getComputedStyle(got).display : 'missing',
    };
  `);
  assert.ok(metrics.width <= metrics.inner + 1, `no horizontal scroll (${metrics.width} <= ${metrics.inner})`);
  assert.equal(metrics.got, 'none', 'the Got column collapses under 640px');
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

test('26 the panorama drifts unless reduced motion is requested', async () => {
  await reset();
  await page().emulateReducedMotion(false);
  await page().waitFor('window.__backdrop !== undefined');
  assert.equal(await page().evaluate('return window.__backdrop;'), 'panorama');
  assert.equal(
    await page().evaluate('return document.documentElement.classList.contains("has-panorama");'),
    true
  );
  const moving = await page().evaluate(`
    const style = getComputedStyle(document.querySelector('.backdrop'), '::before');
    return { image: style.backgroundImage, animation: style.animationName };
  `);
  assert.match(moving.image, /backdrop\.webp/, 'the generated panorama is the layer image');
  assert.equal(moving.animation, 'panorama-drift', 'the slow pan is applied');
  await page().emulateReducedMotion(true);
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
  const still = await page().evaluate(
    'return getComputedStyle(document.querySelector(".backdrop"), "::before").animationName;'
  );
  assert.equal(still, 'none', 'reduced motion stops the pan');
  await page().emulateReducedMotion(false);
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

test('31 the picker searches the expanded catalog and caps the grid (D6)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  const total = await page().count('#icon-grid .icon-tile');
  const slugs = await page().count('#icon-grid [data-icon-slug]');
  assert.equal(slugs, 150, 'the first page shows exactly the render cap of catalog tiles');
  assert.equal(total, 151, 'the cap plus the single None tile in icon mode');
  assert.match(await page().text('#icon-count-hint'), /showing 150 of \d+ — refine your search/);
  const lazy = await page().count('#icon-grid img[loading="lazy"]');
  assert.ok(lazy > 0, 'tiles load lazily');
  for (const query of ['oak log', 'red concrete', 'diamond sword', 'glass']) {
    await page().fill('#icon-search', query);
    await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile").length > 0');
    const hit = await page().evaluate(`
      const query = ${JSON.stringify(query)};
      return Array.from(document.querySelectorAll('#icon-grid .icon-tile'))
        .map((tile) => tile.querySelector('.icon-tile__name').textContent.toLowerCase())
        .some((name) => name.includes(query.split(' ')[0]) && name.includes(query.split(' ').slice(-1)[0]));
    `);
    assert.equal(hit, true, `search "${query}" finds the item`);
  }
  await page().fill('#icon-search', 'oak_log');
  const slugHit = await page().evaluate(
    'return !!document.querySelector("#icon-grid [data-icon-slug=oak_log]");'
  );
  assert.equal(slugHit, true, 'a slug query also matches');
});

test('32 Escape clears the picker query before closing it', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open');
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
    const steps = Array.from(row.querySelectorAll('.mat-step')).map((button) => ({
      step: button.dataset.step,
      stack: button.dataset.stack,
      text: button.textContent.trim(),
      aria: button.getAttribute('aria-label'),
    }));
    return { id: row.dataset.mat, needed: Number(row.querySelector('[data-mat-field=needed]').value), steps };
  `);
}

test('39 each material row carries the six needed steppers (D5)', async () => {
  await reset();
  await openFirstBuild();
  const row = await stepperRow();
  assert.equal(row.steps.length, 6, 'exactly six buttons per row');
  assert.deepEqual(row.steps.map((entry) => entry.step), ['+1', '+10', '+stack', '-1', '-10', '-stack']);
  assert.deepEqual(row.steps.map((entry) => entry.text), ['+1', '+10', '+stack', '-1', '-10', '-stack'],
    'the frozen contract labels the stack buttons "+stack", not the resolved number');
  const stoneStack = row.steps.find((entry) => entry.step === '+stack');
  assert.equal(stoneStack.stack, '64', 'stone stacks to 64 (contract §4 data-stack)');
  assert.match(stoneStack.aria, /full stack of 64/, 'the accessible name states the resolved size');
});

test('40 the steppers climb by 1, by 10 and by one stack (D5)', async () => {
  await reset();
  await openFirstBuild();
  const start = await stepperRow();
  const click = (step) => page().click(`[data-mat="${start.id}"][data-step="${step}"]`);
  await click('+1');
  await page().waitFor(`document.querySelector('[data-mat="${start.id}"][data-mat-field=needed]').value === "${start.needed + 1}"`);
  await click('+10');
  await page().waitFor(`document.querySelector('[data-mat="${start.id}"][data-mat-field=needed]').value === "${start.needed + 11}"`);
  await click('+stack');
  await page().waitFor(`document.querySelector('[data-mat="${start.id}"][data-mat-field=needed]').value === "${start.needed + 75}"`);
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const material = world.builds.flatMap((build) => build.materials).find((entry) => entry.id === start.id);
  assert.equal(material.needed, start.needed + 75);
});

test('41 the steppers never take needed below one (D5)', async () => {
  await reset();
  await openFirstBuild();
  const row = await page().evaluate(`
    const row = document.querySelector('#material-body .mat-row');
    return row.dataset.mat;
  `);
  await page().fill(`[data-mat="${row}"][data-mat-field="needed"]`, '1');
  for (const step of ['-1', '-10', '-stack']) {
    await page().click(`[data-mat="${row}"][data-step="${step}"]`);
    await page().waitFor(`document.querySelector('[data-mat="${row}"][data-mat-field=needed]').value === "1"`);
  }
  assert.equal(await page().value(`[data-mat="${row}"][data-mat-field="needed"]`), '1');
});

test('42 stack buttons use the item own stack size (D5)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Stack Lab');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  await addMaterialViaPicker('egg', { slug: 'egg' });
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 1');
  const egg = await stepperRow();
  assert.deepEqual(egg.steps.filter((entry) => entry.step === '+stack').map((entry) => entry.stack), ['16'],
    'an egg stacks to 16');
  await addMaterialViaPicker('water bucket', { slug: 'water_bucket' });
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 2');
  const buckets = await page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
    const row = rows.find((entry) => entry.querySelector('.mat-row__name').textContent.trim() === 'Water Bucket');
    const button = row.querySelector('[data-step="+stack"]');
    return { stack: button.dataset.stack, text: button.textContent.trim(), aria: button.getAttribute('aria-label') };
  `);
  assert.equal(buckets.stack, '1', 'a filled bucket stacks to one');
  assert.equal(buckets.text, '+stack', 'the visible label stays the frozen "+stack"');
  assert.match(buckets.aria, /full stack of 1/, 'the accessible name states the resolved stack size');
});

test('43 the needed input stays type=number with the spinners hidden (D5)', async () => {
  await reset();
  await openFirstBuild();
  const type = await page().evaluate(
    'return document.querySelector("#material-body [data-mat-field=needed]").type;'
  );
  assert.equal(type, 'number', 'the field keeps the numeric keyboard and min clamp');
  const css = fs.readFileSync(CSS_PATH, 'utf8');
  assert.match(css, /::-webkit-inner-spin-button\s*\{[^}]*-webkit-appearance:\s*none/, 'inner spinner hidden');
  assert.match(css, /::-webkit-outer-spin-button/, 'outer spinner hidden');
  assert.match(css, /-moz-appearance:\s*textfield/, 'Firefox spinner hidden');
  // Deliberately not asserted: getComputedStyle(input, '::-webkit-inner-spin-button')
  // reports `appearance: textfield` in Chromium 155 even when the rule above hides it,
  // so a pseudo-element computed check would be a lie. The stylesheet rules are the proof.
});

/* ---------------------------------------------------- item chooser (D7/D8) */

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
  await openFirstBuild();
  await addMaterialViaPicker('egg', { slug: 'egg' });
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length > 0');
  assert.equal(await page().text('#mat-choice-name'), 'Choose item…', 'the chip resets after adding');
  const row = await page().evaluate(`
    const row = Array.from(document.querySelectorAll('#material-body .mat-row'))
      .find((entry) => entry.querySelector('.mat-row__name').textContent.trim() === 'Egg');
    if (!row) return null;
    const img = row.querySelector('.slot img');
    return { img: img ? img.getAttribute('src') : null, steps: row.querySelectorAll('.mat-step').length };
  `);
  assert.deepEqual(row, { img: 'assets/icons/egg.png', steps: 6 });
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

test('48 the backdrop is less blurred and still 2560x640 (D10)', async () => {
  await reset();
  await page().emulateReducedMotion(false);
  await page().waitFor('window.__backdrop !== undefined');
  const layer = await page().evaluate(`
    const style = getComputedStyle(document.querySelector('.backdrop'), '::before');
    return { filter: style.filter };
  `);
  const match = /blur\(([\d.]+)px\)/.exec(layer.filter);
  assert.ok(match, `the layer carries a blur (${layer.filter})`);
  assert.ok(Number(match[1]) <= 1, `the blur is at most 1px (found ${match[1]}px)`);
  const size = await page().evaluate(`
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve({ width: 0, height: 0 });
      image.src = 'assets/panorama/backdrop.webp';
    });
  `);
  assert.deepEqual(size, { width: 2560, height: 640 }, 'the regenerated backdrop keeps its strip geometry');
  await shot('48-backdrop-narrow-blur');
});

/* ------------------------------------------------------------- suite tail */

test('49 the whole run stayed free of console errors', async () => {
  assert.deepEqual(app.consoleErrors, []);
});
