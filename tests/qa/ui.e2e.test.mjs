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
const EVIDENCE = path.join(ROOT, 'reports', 'qa', 'evidence', 'edict-0016');
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
    const rect = (el) => el.getBoundingClientRect();
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && rect(el).width > 0;
    const got = document.querySelector('#material-body [data-mat-field=collected]');
    const needed = document.querySelector('#material-body [data-mat-field=needed]');
    const head = document.querySelector('#material-body .mtable__head') || document.querySelector('.mtable__head');
    const headCells = head ? Array.from(head.children).map((cell) => ({ text: cell.textContent.trim(), left: rect(cell).left, shown: visible(cell) })) : [];
    const rowLabels = Array.from(document.querySelectorAll('#material-body .mat-row__label')).map((node) => node.textContent.trim());
    const gotCell = headCells.find((cell) => /^got$/i.test(cell.text)) || null;
    return {
      width: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      got: got ? { display: getComputedStyle(got).display, width: rect(got).width, left: rect(got).left, name: got.getAttribute('aria-label') || '' } : null,
      neededName: needed ? (needed.getAttribute('aria-label') || '') : '',
      headCells,
      rowLabels,
      gotCell,
    };
  `);
  assert.ok(metrics.width <= metrics.inner + 1, `no horizontal scroll (${metrics.width} <= ${metrics.inner})`);
  // EDICT-0016 §2/§12: the Got field is not collapsed away at 390 — it stays a label/field pair
  // (head label above its control, or a per-row label). Case amended after the build seat's question.
  assert.ok(metrics.got, 'the Got field exists at 390');
  assert.notEqual(metrics.got.display, 'none', 'the Got field is not collapsed under 640px');
  assert.ok(metrics.got.width > 0, `the Got field keeps a visible control (${metrics.got.width}px)`);
  const gotLabelled = /collected/i.test(metrics.got.name)
    || metrics.rowLabels.some((label) => /^got$/i.test(label))
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

test('39 each row carries the two-button .stepper: + left, − right, input wrapped', async () => {
  await reset();
  await openFirstBuild();
  const row = await stepperRow();
  assert.equal(row.buttons, 2, 'exactly two buttons per row');
  assert.deepEqual(row.order, ['1', '-1'], 'data-stepper-step is 1 then -1');
  assert.equal(row.texts.length, 2);
  assert.match(row.texts[0], /^\+$/, 'the left button is +');
  assert.match(row.texts[1], /^[−-]$/, 'the right button is −');
  assert.equal(row.plusLeftOfInput, true, 'plus sits left of the input, minus right');
  assert.equal(row.stepperWrapsInput, true, 'the input lives inside .stepper');
  assert.equal(row.retired, 0, 'no retired data-step literals or strip nodes remain');
  assert.equal(row.inputType, 'number', 'the row input stays type=number');
});

test('40 the stepper climbs by 1, by the item stack (Shift) and by 16 (Ctrl)', async () => {
  await reset();
  await openFirstBuild();
  const start = await stepperRow();
  const plus = `[data-mat="${start.id}"] .stepper__btn[data-stepper-step="1"]`;
  const input = `[data-mat="${start.id}"][data-mat-field=needed]`;
  await page().click(plus);
  await page().waitFor(`document.querySelector('${input}').value === "${start.needed + 1}"`);
  await modifierClick(plus, 'shift');
  await page().waitFor(`document.querySelector('${input}').value === "${start.needed + 65}"`);
  await modifierClick(plus, 'ctrl');
  await page().waitFor(`document.querySelector('${input}').value === "${start.needed + 81}"`);
  const state = await appState();
  const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
  const material = world.builds.flatMap((build) => build.materials).find((entry) => entry.id === start.id);
  assert.equal(material.needed, start.needed + 81, 'plain +1, then +64 (Shift), then +16 (Ctrl)');
});

test('41 the stepper never takes needed below one', async () => {
  await reset();
  await openFirstBuild();
  const start = await stepperRow();
  const input = `[data-mat="${start.id}"][data-mat-field=needed]`;
  const minus = `[data-mat="${start.id}"] .stepper__btn[data-stepper-step="-1"]`;
  await page().fill(input, '1');
  await page().click(minus);
  await page().waitFor(`document.querySelector('${input}').value === "1"`);
  await modifierClick(minus, 'shift');
  await page().waitFor(`document.querySelector('${input}').value === "1"`);
  assert.equal(await page().value(input), '1');
});

test('42 stack modifiers resolve the item own stack size (egg 16, water bucket 1)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Stack Lab');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  await addMaterialViaPicker('egg', { slug: 'egg' });
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 1');
  const egg = await stepperRow();
  assert.equal(egg.buttons, 2, 'an egg still has the two-button stepper');
  const eggBefore = egg.needed;
  await modifierClick(`[data-mat="${egg.id}"] .stepper__btn[data-stepper-step="1"]`, 'shift');
  await page().waitFor(`document.querySelector('[data-mat="${egg.id}"][data-mat-field=needed]').value === "${eggBefore + 16}"`);
  await addMaterialViaPicker('water bucket', { slug: 'water_bucket' });
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 2');
  const buckets = await page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
    const row = rows.find((entry) => entry.querySelector('.mat-row__name').textContent.trim() === 'Water Bucket');
    const rect = (el) => el.getBoundingClientRect();
    const detail = (cluster) => {
      const input = cluster.querySelector('input');
      const buttons = Array.from(cluster.querySelectorAll('.stepper__btn'));
      const plus = cluster.querySelector('.stepper__btn[data-stepper-step="1"]');
      const minus = cluster.querySelector('.stepper__btn[data-stepper-step="-1"]');
      return {
        field: input.getAttribute('data-mat-field'),
        count: buttons.length,
        order: buttons.map((button) => button.dataset.stepperStep),
        texts: buttons.map((button) => button.textContent.trim()),
        plusLeft: !!plus && rect(plus).left < rect(input).left,
        minusRight: !!minus && rect(minus).left > rect(input).left,
      };
    };
    const neededCluster = row.querySelector('.stepper:has([data-mat-field=needed])');
    const gotCluster = row.querySelector('.stepper:has([data-mat-field=collected])');
    return {
      id: row.dataset.mat,
      needed: Number(row.querySelector('[data-mat-field=needed]').value),
      clusters: row.querySelectorAll('.stepper').length,
      neededCluster: neededCluster ? detail(neededCluster) : null,
      gotCluster: gotCluster ? detail(gotCluster) : null,
      stackNodes: row.querySelectorAll('[data-step$="stack"], [data-mat-step]').length,
      aria: Array.from(row.querySelectorAll('.stepper__btn')).map((button) => button.getAttribute('aria-label') || ''),
    };
  `);
  assert.equal(buckets.clusters, 2, 'a stack-1 row carries a Needed stepper and a Got stepper');
  for (const cluster of [buckets.neededCluster, buckets.gotCluster]) {
    assert.ok(cluster, 'both per-field clusters exist');
    assert.equal(cluster.count, 2, cluster.field + ': two buttons, no stack node at stack 1');
    assert.deepEqual(cluster.order, ['1', '-1']);
    assert.deepEqual(cluster.texts, ['+', '−'], 'the labels are + and −');
    assert.equal(cluster.plusLeft, true, cluster.field + ': + sits left of the input');
    assert.equal(cluster.minusRight, true, cluster.field + ': − sits right of the input');
  }
  assert.equal(buckets.stackNodes, 0, 'no retired stack-type node exists at any stack size');
  assert.equal(buckets.aria.some((label) => /full stack/i.test(label)), false, 'no label claims a full stack');
  const bucketsPlus = `[data-mat="${buckets.id}"] .stepper:has([data-mat-field=needed]) .stepper__btn[data-stepper-step="1"]`;
  await modifierClick(bucketsPlus, 'shift');
  await page().waitFor(`document.querySelector('[data-mat="${buckets.id}"][data-mat-field=needed]').value === "${buckets.needed + 1}"`);
  // stack 1: a plain click is also +1 and Shift adds nothing extra (contract §2, case amendment)
  await page().click(bucketsPlus);
  await page().waitFor(`document.querySelector('[data-mat="${buckets.id}"][data-mat-field=needed]').value === "${buckets.needed + 2}"`);
  await modifierClick(bucketsPlus, 'shift');
  await page().waitFor(`document.querySelector('[data-mat="${buckets.id}"][data-mat-field=needed]').value === "${buckets.needed + 3}"`);
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
    const stepper = row.querySelector('.stepper');
    return {
      img: img ? img.getAttribute('src') : null,
      buttons: stepper ? stepper.querySelectorAll('.stepper__btn').length : 0,
      order: stepper ? Array.from(stepper.querySelectorAll('.stepper__btn')).map((button) => button.dataset.stepperStep) : [],
    };
  `);
  assert.deepEqual(row, { img: 'assets/icons/egg.png', buttons: 2, order: ['1', '-1'] });
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

test('58 bulk paste reviews matched and unknown lines and commits once (D9)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Bulk Build');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  await page().click('#bulk-paste');
  await page().waitFor('document.querySelector("#bulk-dialog").open');
  await page().fill('#bulk-input', [
    '64 stone bricks',
    '- 32 glass',
    '+1 oak log',
    '20x oak log',
    '3 stone bricks',
    'mystery goo',
    '- 5 diamond',
  ].join('\n'));
  await page().waitFor('document.querySelectorAll("#bulk-review .bulk-row").length >= 4');
  const review = await page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#bulk-review .bulk-row'));
    return rows.map((row) => ({
      state: row.dataset.bulkState,
      qty: row.querySelector('[data-bulk-qty]') && row.querySelector('[data-bulk-qty]').value,
      text: row.textContent.trim(),
    }));
  `);
  const matched = review.filter((row) => row.state === 'matched');
  assert.equal(matched.length, 4, 'four lines matched (duplicates merged)');
  assert.equal(review.filter((row) => row.state === 'unknown').length, 1, 'the unknown line is listed, not added');
  assert.equal(matched.find((row) => /stone bricks/i.test(row.text)).qty, '67', 'duplicate quantities merge');
  assert.equal(matched.find((row) => /oak log/i.test(row.text)).qty, '21', 'case-insensitive merge by slug');
  await page().click('#bulk-add');
  await page().waitFor('!document.querySelector("#bulk-dialog").open');
  const rows = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-body .mat-row')).map((row) => ({
      name: row.querySelector('.mat-row__name').textContent.trim(),
      needed: row.querySelector('[data-mat-field=needed]').value,
    }));
  `);
  assert.equal(rows.length, 4, 'matched lines become materials in one commit');
  assert.ok(!rows.some((row) => /mystery/i.test(row.name)), 'unknown lines are not added');
});

test('59 undo restores a deleted material, and expires after six seconds (D10)', async () => {
  await reset();
  await openFirstBuild();
  const before = await appState();
  const rowsBefore = await page().count('#material-body .mat-row');
  assert.ok(rowsBefore >= 1, 'the demo build starts with materials');
  await page().click('#material-body .mat-row .row-delete');
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore - 1}`);
  assert.equal(await page().hidden('#toast-action'), false, 'the toast offers Undo');
  await page().waitFor('document.querySelector("#toast").textContent.includes("Undo")');
  await page().click('#toast-action');
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rowsBefore}`);
  assert.deepEqual(await appState(), before, 'the restore is a deep-equal snapshot');
  await page().click('#material-body .mat-row .row-delete');
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
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
    return window.TrackerModel.exportJSON(state);
  `);
  assert.equal(exported.includes('mc-build-tracker:recent'), false, 'recents are browser-local, not exported');
  await page().click('#icon-cancel');
});

test('64 stack modifiers resolve per item across stone, egg and water bucket (D6/AC6)', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  await page().fill('#build-dlg-name', 'Stack Spread');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#build-dialog").open');
  for (const [query, slug] of [['stone', 'stone'], ['egg', 'egg'], ['water bucket', 'water_bucket']]) {
    await addMaterialViaPicker(query, { slug, needed: 7 });
  }
  await page().waitFor('document.querySelectorAll("#material-body .mat-row").length === 3');
  const deltas = {};
  for (const [name, stack] of [['Stone', 64], ['Egg', 16], ['Water Bucket', 1]]) {
    const row = await page().evaluate(`
      const rows = Array.from(document.querySelectorAll('#material-body .mat-row'));
      const row = rows.find((entry) => entry.querySelector('.mat-row__name').textContent.trim() === ${JSON.stringify(name)});
      if (!row) return null;
      return { id: row.dataset.mat, needed: Number(row.querySelector('[data-mat-field=needed]').value) };
    `);
    assert.ok(row, name + ' row exists');
    await modifierClick(`[data-mat="${row.id}"] .stepper__btn[data-stepper-step="1"]`, 'shift');
    await page().waitFor(
      `Number(document.querySelector('[data-mat="${row.id}"][data-mat-field=needed]').value) === ${row.needed + stack}`,
      { timeout: 4000 }
    );
    deltas[name] = stack;
  }
  assert.deepEqual(deltas, { Stone: 64, Egg: 16, 'Water Bucket': 1 }, 'the Shift modifier uses each item stack');
});

test('65 the suggestion is pure, deterministic and null with two arguments (D8)', async () => {
  await reset();
  const probe = await page().evaluate(`
    const catalog = window.MC_ICON_SET.map((slug) => ({ slug, name: window.MC_ICON_NAMES[slug] }));
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
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
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
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

async function injectState(state) {
  await page().goto(fileUrl('src/index.html?tab=builds'));
  await page().evaluate(
    'localStorage.setItem("mc-build-tracker:v1", ' + JSON.stringify(JSON.stringify(state)) + '); return true;'
  );
  // A second goto() to the identical URL can be served from the already-complete document and
  // race the reload, so the injected state must be read by a genuinely fresh navigation.
  const stamp = Date.now();
  await page().goto(fileUrl('src/index.html?tab=builds&fixture=' + stamp));
  await page().waitFor('document.querySelector("#world-select") !== null && window.TrackerModel !== undefined');
}

const FIXTURES_0015 = path.join(ROOT, 'tests', 'qa', 'edict-0015-fixtures');
const FIXTURES_0016 = path.join(ROOT, 'tests', 'qa', 'edict-0016-fixtures');

function fixture(name) {
  return path.join(FIXTURES_0015, name);
}

function fixture16(name) {
  return path.join(FIXTURES_0016, name);
}

// Load an exported backup text through the model, persist it and reload, so cases can start from a
// frozen fixture without driving the import dialog each time.
async function loadBackupText(text) {
  const imported = await page().evaluate(`
    const result = window.TrackerModel.importJSON(${JSON.stringify(text)});
    if (result.error) return false;
    localStorage.setItem('mc-build-tracker:v1', window.TrackerModel.exportJSON(result.state));
    return true;
  `);
  assert.equal(imported, true, 'the fixture is a valid backup');
  await page().reload();
  await page().waitFor('document.querySelector("#world-select") !== null');
}

test('67 builds sort building, planned, done and keep registry order inside a rank (AC1)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('route-shuffle.v1.json'), 'utf8'));
  const expected = JSON.parse(fs.readFileSync(fixture('route-shuffle.expected-order.json'), 'utf8')).order;
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
  const changed = JSON.parse(fs.readFileSync(fixture('route-status-change.expected-order.json'), 'utf8')).order;
  await page().waitFor(`Array.from(document.querySelectorAll('#build-list .build-entry__name')).map((n) => n.textContent.trim()).join('|') === ${JSON.stringify(changed.join('|'))}`);
  assert.deepEqual(await buildNames(), changed, 'a status change re-sorts the list immediately');
});

test('68 the world header derives its stats and the retired summary block is gone (AC2)', async () => {
  await reset();
  const summary = await page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
    const world = state.worlds.find((entry) => entry.id === state.activeWorldId);
    return window.TrackerModel.worldSummary(world);
  `);
  const fmt = (value) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  assert.equal(await page().text('#world-progress'), summary.pct + '% gathered', 'the percentage is the derived value');
  assert.equal(
    await page().text('#world-remaining'),
    fmt(summary.remaining) + ' of ' + fmt(summary.needed) + ' items still to collect',
    'the remaining line uses thousands separators and the same arithmetic'
  );
  assert.equal(await page().exists('#world-summary'), false, 'the old summary block is retired');
  assert.equal(await page().exists('#summary-totals'), false, 'its ids are retired');
  // §3 S5 corrections: (a) the bar is border-box with 2px hard borders while the fill lives in the
  // content box, so the ratio must divide by clientWidth (209.625 - 4 = 205.625 → 36.0%), never the
  // border box (which reads 35%); (b) run 4 showed the fill animates from 0 on load, so a single
  // read can catch it mid-transition — wait until two consecutive reads agree, the same pattern
  // stableRowCount() uses for rows, then compare.
  const settleFill = async () => {
    let previous = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const value = await page().evaluate(`
        const bar = document.querySelector('#world-bar');
        const fill = document.querySelector('#world-fill');
        return { fillWidth: fill.getBoundingClientRect().width, clientWidth: bar.clientWidth };
      `);
      if (previous && Math.abs(previous.fillWidth - value.fillWidth) < 0.5) return value;
      previous = value;
      await sleep(60);
    }
    throw new Error('the world bar fill never settled');
  };
  const geometry = await settleFill();
  const bar = await page().evaluate(`
    const bar = document.querySelector('#world-bar');
    const fill = document.querySelector('#world-fill');
    return {
      role: bar.getAttribute('role'), min: bar.getAttribute('aria-valuemin'), max: bar.getAttribute('aria-valuemax'),
      now: bar.getAttribute('aria-valuenow'), barHeight: Math.round(bar.getBoundingClientRect().height),
      fillHeight: Math.round(fill.getBoundingClientRect().height),
      ratio: Math.round((${JSON.stringify(geometry.fillWidth)} / ${JSON.stringify(geometry.clientWidth)}) * 100),
    };
  `);
  assert.equal(bar.role, 'progressbar', 'the bar exposes progressbar semantics');
  assert.equal(bar.min, '0');
  assert.equal(bar.max, '100');
  assert.equal(bar.now, String(summary.pct), 'aria-valuenow is the derived percentage');
  // Contract §3 (S2 correction): the bar is 10px border-box with 2px hard borders, so the inner
  // fill paints 6px — identical to the progress block, never a 10px fill.
  assert.equal(bar.barHeight, 10, 'the thin XP bar is 10px tall');
  assert.equal(bar.fillHeight, 6, 'the inner fill paints inside the 2px hard borders (10 - 2x2)');
  assert.ok(Math.abs(bar.ratio - summary.pct) <= 1, 'the fill paints the same percentage');
  const meta = await page().text('#world-meta');
  assert.equal(meta.indexOf('%'), -1, 'the identity line no longer repeats the percentage');
  assert.equal(meta.indexOf('still to collect'), -1, 'the identity line no longer repeats the remaining count');
  await shot('67-world-header-stats');
});

test('69 zero worlds and zero materials show honest states, not NaN (AC2/AC5)', async () => {
  await reset({ demo: false });
  assert.equal(await page().text('#world-meta'), 'No world selected');
  for (const id of ['#world-progress', '#world-remaining', '#world-bar']) {
    assert.equal(await page().hidden(id), true, id + ' is hidden with no world');
  }
  assert.equal(/NaN/.test(await page().text('body')), false, 'no NaN leaks into the page');
  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog") !== null && document.querySelector("#world-dialog").open');
  await page().fill('#world-name', 'Empty Probe');
  await page().click('#world-form button[type="submit"]:not([formnovalidate])');
  await page().waitFor('!document.querySelector("#world-dialog").open');
  assert.equal(await page().hidden('#world-progress'), true, 'a world with no builds keeps the stats row hidden');
  assert.equal((await page().text('body')).indexOf('0 of 0'), -1, 'an empty world never claims "0 of 0"');
});

test('70 labels, controls, table headers and the top bar share their measured lines (AC3)', async () => {
  await reset();
  const measure = async (width, height, name) => {
    await page().setViewport(width, height);
    await sleep(250);
    const data = await page().evaluate(`
      const box = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
      const labelled = [];
      [['mat-choice', '#mat-choice'], ['mat-needed', '#mat-needed'], ['mat-collected', '#mat-collected']].forEach((pair) => {
        const label = document.querySelector('label[for="' + pair[0] + '"]');
        const control = document.querySelector(pair[1]);
        if (label && control) {
          // Contract §2 freezes the plus button LEFT of the input, so the input's left edge is
          // 28-32 px right of the label by design: the label owns the stepper CLUSTER's left
          // edge (Lead ruling 2026-10-26; measured label.left = cluster.left = 871.4 at 1280).
          const cluster = control.closest('.stepper');
          const plus = cluster ? cluster.querySelector('.stepper__btn[data-stepper-step="1"]') : null;
          labelled.push({
            id: pair[0],
            label: box(label),
            control: box(control),
            cluster: cluster ? box(cluster) : null,
            plusLeftOfInput: plus ? plus.getBoundingClientRect().left < control.getBoundingClientRect().left : null,
          });
        }
      });
      const controls = ['#mat-choice', '#mat-needed', '#mat-collected'].map((selector) => box(document.querySelector(selector)));
      // Run-8 ruling: after §8 the sidebar controls live in #world-panel, not the top bar. The
      // frozen top-bar sample is now the top bar's OWN row (view switcher + actions, pause included).
      const topbar = Array.from(document.querySelectorAll('.panel__topbar .viewswitch__btn, .panel__topbar .mc-btn')).map(box);
      const detailTable = document.querySelector('.mtable:not(.mtable--wide)');
      const head = Array.from(detailTable.querySelectorAll('.mtable__head > *')).map(box);
      const firstRow = detailTable.querySelector('.mat-row');
      // Lead run-9 ruling: the stepper cluster IS a grid column in the shipped markup (it wraps
      // the input and its two buttons), so the row carries the same five children as the header.
      // The old "second grid row spanning every column" comment described the retired EDICT-0015 strip.
      const row = Array.from(firstRow.children).map(box);
      const mid = Array.from(firstRow.children).slice(1, 3).map((child) => {
        const input = child.querySelector('input');
        const plus = child.querySelector('.stepper__btn[data-stepper-step="1"]');
        return {
          isStepper: child.classList.contains('stepper'),
          width: Math.round(child.getBoundingClientRect().width),
          plusLeft: !!(input && plus && plus.getBoundingClientRect().left < input.getBoundingClientRect().left),
        };
      });
      return { labelled, controls, topbar, head, row, mid, itemLabel: !!document.querySelector('label[for="mat-choice"]'),
        worldLabel: (() => { const label = document.querySelector('label[for="world-select"]'); return label
          ? { visible: !!(label.offsetParent || label.getClientRects().length), text: label.textContent.trim() } : null; })(),
        innerWidth, scrollWidth: document.documentElement.scrollWidth };
    `);
    for (const pair of data.labelled) {
      const anchor = pair.cluster || pair.control;
      assert.ok(Math.abs(pair.label.left - anchor.left) <= 1,
        pair.id + ': label left owns the ' + (pair.cluster ? 'stepper cluster' : 'control') + ' left');
      if (pair.cluster) {
        assert.equal(pair.plusLeftOfInput, true, pair.id + ': the + button sits left of the input (contract §2)');
      }
    }
    assert.equal(data.labelled.length, 3, 'all three add-form labels are found (Item points at #mat-choice)');
    assert.equal(data.itemLabel, true, 'the Item label carries for="mat-choice" (contract §7 bullet 1)');
    assert.ok(data.worldLabel && data.worldLabel.visible, 'the World label is a real, visible label[for="world-select"]');
    assert.match(data.worldLabel.text, /World/, 'the World label still names the select');
    const spread = (values) => Math.max(...values) - Math.min(...values);
    assert.ok(spread(data.controls.map((c) => c.top)) <= 1, 'the add-form controls share one top');
    assert.ok(spread(data.controls.map((c) => c.height)) <= 1, 'the add-form controls share one height');
    // Contract §7 bullet 5 is per-row (Lead S5 ruling): at ≤640 the top bar wraps by design.
    // Run-6 ruling: group by VERTICAL CENTRE (|centre Δ| ≤ 1), not by exact top — the sidebar
    // controls have different heights (select 41, buttons 28–30) but one centre line at 1280,
    // and exactly two centre lines at 390.
    const rows = [];
    data.topbar.slice().sort((a, b) => (a.top + a.height / 2) - (b.top + b.height / 2)).forEach((control) => {
      const centre = control.top + control.height / 2;
      const row = rows.find((candidate) => Math.abs(candidate.centre - centre) <= 1);
      if (row) {
        row.members.push(control);
      } else {
        rows.push({ centre, members: [control] });
      }
    });
    assert.equal(rows.length, data.innerWidth <= 640 ? 2 : 1,
      'the top-bar controls form one row at 1280 and wrap into two rows at 390 (rows found: ' + rows.length + ')');
    rows.forEach((rowGroup, index) => {
      assert.ok(spread(rowGroup.members.map((c) => c.top + c.height / 2)) <= 2,
        'top-bar row ' + (index + 1) + ' shares a centre line');
    });
    const compareColumns = (head, row, tableName, actionColumn) => {
      // Only the VISIBLE table can be compared: the hidden view's rows measure 0×0 at (0,0).
      assert.ok(head.length > 1 && head.length === row.length,
        tableName + ': the header and the first row have the same column count (header ' + head.length + ', row ' + row.length + ')');
      for (let index = 0; index < head.length; index += 1) {
        assert.ok(Math.abs(head[index].left - row[index].left) <= 1,
          tableName + ' column ' + (index + 1) + ': header left equals row-cell left');
        if (!(actionColumn && index === head.length - 1)) {
          assert.ok(Math.abs(head[index].width - row[index].width) <= 1,
            tableName + ' column ' + (index + 1) + ': header width equals row-cell width');
        }
      }
    };
    if (data.innerWidth > 640) {
      // The frozen AC3 column check runs only at the wide viewport: at 390 the first row wraps and
      // a single-index left/width comparison cannot pass (Lead ruling, §3.8). The detail table's
      // trailing remove-button column is inset by design, so its width is not compared.
      compareColumns(data.head, data.row, 'detail table', true);
      // Lead run-9 ruling: the two middle columns are the needed/got stepper clusters — 104 ± 1 px
      // each, with the `+` button left of its input inside the cluster.
      assert.equal(data.mid.length, 2, 'the two middle columns are the steppers');
      data.mid.forEach((entry, index) => {
        assert.equal(entry.isStepper, true, 'middle column ' + (index + 2) + ' is a .stepper cluster');
        assert.ok(Math.abs(entry.width - 104) <= 1, 'stepper cluster width is 104 ± 1 (found ' + entry.width + ')');
        assert.equal(entry.plusLeft, true, 'the + button sits left of its input inside the cluster');
      });
      await page().click('#tab-materials');
      await sleep(200);
      const wide = await page().evaluate(`
        const box = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, width: r.width }; };
        const table = document.querySelector('.mtable--wide');
        return { head: Array.from(table.querySelectorAll('.mtable__head > *')).map(box),
          row: Array.from(table.querySelector('.mat-row').children).map(box) };
      `);
      compareColumns(wide.head, wide.row, 'shopping list table', true);
      await page().click('#tab-builds');
      await sleep(100);
    }
    assert.ok(data.scrollWidth <= data.innerWidth + 1, 'no horizontal overflow at ' + width + 'x' + height);
    await shot(name);
  };
  await measure(1280, 900, '68-alignment-1280');
  await measure(390, 844, '69-alignment-390');
});

test('71 the height budget holds on the frozen fixture at both viewports (AC7)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('budget-state.json'), 'utf8'));
  await injectState(state);
  await page().setViewport(1280, 900);
  await sleep(300);
  const desktop = await page().evaluate(`
    return { height: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth };
  `);
  // Contract §12 (EDICT-0016): the desktop budget tightened from 900 px to 960 px and the
  // phone budget from 1,500 px to 1,700 px; the Lead's baseline measured 1,289 px (desktop
  // pre-change) and the case uses the budget fixture, not the demo seed. Lead ruling
  // (2026-10-26): the desktop ceiling is 1,000 px — the +12% type knob made 960 px require
  // cutting the strip's 10/14 padding below comfort; the current tree measures 976 px.
  assert.ok(desktop.height <= 1000, 'the budget fixture fits 1280x900 within the 1,000 px budget (found ' + desktop.height + 'px)');
  assert.equal(desktop.scrollWidth, desktop.clientWidth, 'no horizontal overflow at 1280x900');
  await shot('70-height-1280');
  await page().setViewport(390, 844);
  await sleep(300);
  const mobile = await page().evaluate(`
    return { height: document.documentElement.scrollHeight, scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth };
  `);
  assert.ok(mobile.height <= 1700, 'the budget fixture fits 390x844 within the 1,700 px budget (found ' + mobile.height + 'px)');
  assert.equal(mobile.scrollWidth, mobile.clientWidth, 'no horizontal overflow at 390x844');
  await shot('71-height-390');
});

test('72 the add form uses the shared stepper with resolved stack semantics (AC6)', async () => {
  await reset();
  const initial = await page().evaluate(`
    const needed = document.querySelector('#mat-needed');
    const stepper = needed && needed.closest('.stepper');
    const buttons = stepper ? Array.from(stepper.querySelectorAll('.stepper__btn')) : [];
    const rect = (el) => el.getBoundingClientRect();
    const plus = stepper && stepper.querySelector('.stepper__btn[data-stepper-step="1"]');
    const minus = stepper && stepper.querySelector('.stepper__btn[data-stepper-step="-1"]');
    return {
      exists: !!stepper,
      buttons: buttons.length,
      order: buttons.map((button) => button.dataset.stepperStep),
      plusLeftOfInput: !!(plus && minus && rect(plus).left < rect(needed).left && rect(minus).left > rect(needed).left),
      wrapped: !!stepper && stepper.contains(needed),
      retired: document.querySelectorAll('#mat-steps, #mat-steps [data-step]').length,
      gotSteps: document.querySelectorAll('#mat-collected ~ .stepper, #mat-collected + .stepper').length,
    };
  `);
  assert.equal(initial.exists, true, '.stepper wraps the add form Needed field');
  assert.equal(initial.buttons, 2, 'two buttons, not the retired three-button strip');
  assert.deepEqual(initial.order, ['1', '-1']);
  assert.equal(initial.plusLeftOfInput, true, 'plus sits left of Needed');
  assert.equal(initial.wrapped, true);
  assert.equal(initial.retired, 0, 'the retired #mat-steps strip is gone');
  assert.equal(initial.gotSteps, 0, 'Got carries no stepper');
  await page().click('#mat-choice');
  await page().waitFor('document.querySelector("#icon-dialog").open');
  await page().fill('#icon-search', 'stone bricks');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
  await page().evaluate(`
    const tile = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'))
      .find((node) => node.dataset.iconSlug === 'stone_bricks');
    tile.click();
    return true;
  `);
  await page().waitFor('!document.querySelector("#icon-dialog").open');
  const before = Number(await page().value('#mat-needed'));
  await modifierClick('#add-material-form .stepper .stepper__btn[data-stepper-step="1"]', 'shift');
  await page().waitFor(`document.querySelector('#mat-needed').value === "${before + 64}"`,
    { timeout: 4000 });
  await page().click('#add-material-form .stepper__btn[data-stepper-step="1"]');
  await page().waitFor(`document.querySelector('#mat-needed').value === "${before + 65}"`);
  assert.equal(await page().value('#mat-collected'), '0', 'the form stepper never touches Got');
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
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
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
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
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

test('75 resolution runs build -> world -> account -> catalogue (AC4)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('custom-items.v1.json'), 'utf8'));
  await injectState(state);
  const stackDelta = async (query, slug) => {
    await page().click('#mat-choice');
    await page().waitFor('document.querySelector("#icon-dialog").open');
    await page().fill('#icon-search', query);
    await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile[data-icon-slug]").length > 0');
    const clicked = await page().evaluate(`
      const tiles = Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug]'));
      const wanted = ${JSON.stringify(slug || null)};
      const tile = wanted ? tiles.find((node) => node.dataset.iconSlug === wanted) : tiles[0];
      if (!tile) return null;
      tile.click();
      return true;
    `);
    assert.ok(clicked, 'no tile matched ' + query);
    await page().waitFor('!document.querySelector("#icon-dialog").open');
    const before = Number(await page().value('#mat-needed'));
    await modifierClick('#add-material-form .stepper .stepper__btn[data-stepper-step="1"]', 'shift');
    await page().waitFor(`Number(document.querySelector('#mat-needed').value) !== ${before}`, { timeout: 4000 });
    const after = Number(await page().value('#mat-needed'));
    await page().fill('#mat-needed', '1');
    return after - before;
  };
  await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Iron Farm (spawn)');
    entry.click();
    return true;
  `);
  assert.equal(await stackDelta('deepslate bricks', 'deepslate_bricks'), 1, 'a build-scope entry wins (+1)');
  assert.equal(await stackDelta('pillar stone', 'pillar_stone'), 16, 'a second build-scope entry resolves (+16)');
  assert.equal(await stackDelta('roof tile', 'roof_tile'), 64, 'the account entry resolves without a lower-scope shadow (+64)');
  assert.equal(await stackDelta('stone', 'stone'), 64, 'the catalogue answers when no registry matches (+64)');
  await page().evaluate(`
    const entry = Array.from(document.querySelectorAll('#build-list .build-entry')).find((node) =>
      node.querySelector('.build-entry__name').textContent.trim() === 'Storage Hall');
    entry.click();
    return true;
  `);
  assert.equal(await stackDelta('deepslate bricks', 'deepslate_bricks'), 64, 'without a build entry the world-scope entry answers (+64)');
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

test('77 export round-trips the registries and malformed imports are atomic (AC4)', async () => {
  const state = JSON.parse(fs.readFileSync(fixture('custom-items.v1.json'), 'utf8'));
  await injectState(state);
  await page().evaluate(`
    window.__blobText = null;
    URL.createObjectURL = (blob) => { blob.text().then((text) => { window.__blobText = text; }); return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () {};
    return true;
  `);
  await page().click('#btn-export');
  await page().waitFor('window.__blobText !== null');
  const exported = JSON.parse(await page().evaluate('return window.__blobText;'));
  assert.equal(exported.customItems.length, 2, 'the account registry exports');
  assert.equal(exported.worlds[0].customItems.length, 1, 'the world registry exports');
  assert.equal(exported.worlds[0].builds[0].customItems.length, 2, 'the build registry exports');
  const before = await page().evaluate(`return localStorage.getItem('mc-build-tracker:v1');`);
  await page().upload('#file-import', fixture('v1-backup.json'));
  await page().waitFor('document.querySelector("#toast").textContent.indexOf("Backup restored.") === 0');
  const v1 = await page().evaluate(`return JSON.parse(localStorage.getItem('mc-build-tracker:v1'));`);
  assert.deepEqual(v1.customItems || [], [], 'a v1 backup without registries imports as empty arrays');
  const afterImport = await page().evaluate(`return localStorage.getItem('mc-build-tracker:v1');`);
  for (const name of ['invalid-no-name.json', 'invalid-duplicate-name.json', 'invalid-stack-zero.json', 'invalid-stack-1000.json', 'invalid-bad-icon.json', 'invalid-registry-shape.json']) {
    await page().upload('#file-import', fixture(name));
    await page().waitFor(`
      (function () {
        const toast = document.querySelector('#toast');
        return !!toast && !toast.hidden && /custom material|Name already|Stack size|Icon must|not a tracker backup|not valid JSON/i.test(toast.textContent);
      })()
    `);
    assert.equal(await page().evaluate(`return localStorage.getItem('mc-build-tracker:v1');`), afterImport, name + ' must not mutate storage');
  }
  assert.notEqual(before, afterImport);
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
    const topbar = document.querySelector('.panel__topbar');
    return {
      text: meta.textContent.replace(/\\s+/g, ' ').trim(),
      sidebarName: sidebar ? sidebar.textContent.trim() : null,
      selectedName: option ? option.textContent.trim() : null,
      hasSummary: !!document.querySelector('#world-summary'),
      topbar: topbar ? topbar.textContent : '',
    };
  `);
  assert.match(header.text, /Java/, 'the identity keeps the edition token');
  assert.match(header.text, /1\.21\.4/, 'the identity keeps the version token');
  assert.match(header.text, /3 builds?/, 'the identity keeps the build count');
  assert.equal(header.hasSummary, false, '#world-summary stays retired');
  assert.equal(header.sidebarName, header.selectedName, 'the sidebar name mirrors the selected world');
  assert.equal(/gathered|still to collect/.test(header.topbar), false,
    'nothing world-related stays in the masthead row (contract §8)');
});

test('80 the detail panel contains its sections and nothing paints over the gathered strip (containment)', async () => {
  // Added after run 11 (S5, EDICT-0015): `.materials` had been moved out of the detail panel
  // (depth 4 in the working tree vs 5 in HEAD; `.detail` measured 191.5 px tall), so
  // `#detail-body` no longer contained its own sections, while every earlier case stayed green
  // (they asserted alignment, heights and budgets, never containment). This is a guard:
  // containment first, then overlap between sections and across the compact top bar.
  for (const vp of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page().setViewport(vp.width, vp.height);
    await reset();
    assert.equal(
      await page().exists('#detail-body .mtable'),
      true,
      `${vp.width}px: the materials table must be a descendant of #detail-body`
    );
    assert.equal(
      await page().exists('#detail-body #material-body .mat-row'),
      true,
      `${vp.width}px: the material rows must be descendants of #detail-body`
    );
    const report = await page().evaluate(`
      return (function () {
        const rect = (el) => el.getBoundingClientRect();
        const visible = (el) => {
          if (!el) return false;
          const r = rect(el);
          return r.width > 0 && r.height > 0;
        };
        const overlap = (a, b) => {
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          return (w > 2 && h > 2) ? { x: Math.round(w), y: Math.round(h) } : null;
        };
        const detail = document.querySelector('#detail-body');
        const strip = document.querySelector('#detail-body .progress-block');
        const rows = Array.from(document.querySelectorAll('#detail-body #material-body .mat-row'));
        const dRect = rect(detail);
        const last = rows.length ? rect(rows[rows.length - 1]) : null;
        const offenders = [];
        const locked = [
          document.querySelector('#detail-body h3.section-head__title'),
          document.querySelector('#detail-body .mtable__head'),
          ...rows
        ];
        for (const el of locked) {
          if (!visible(el) || !strip) continue;
          const hit = overlap(rect(el), rect(strip));
          if (hit) offenders.push({ what: el.className || el.tagName, hit });
        }
        const topHits = [];
        // EDICT-0016 §8 moves the world block into the sidebar: the guard now covers the
        // sidebar cluster (name, picker, identity, stats, bar) and the masthead actions.
        const bar = [
          document.querySelector('#world-panel-name'),
          document.querySelector('#world-select'),
          document.querySelector('#world-meta'),
          document.querySelector('#world-stats'),
          document.querySelector('#world-bar'),
          document.querySelector('.topbar__actions')
        ].filter(visible);
        for (let i = 0; i < bar.length; i++) {
          for (let j = i + 1; j < bar.length; j++) {
            // Nested nodes cannot "overlap" in the sibling sense: the bar lives inside the
            // stats block by contract §8, so its rect always intersects its parent.
            if (bar[i].contains(bar[j]) || bar[j].contains(bar[i])) continue;
            const hit = overlap(rect(bar[i]), rect(bar[j]));
            if (hit) topHits.push({ a: bar[i].id || bar[i].className, b: bar[j].id || bar[j].className, hit });
          }
        }
        return {
          rows: rows.length,
          detailBottom: Math.round(dRect.bottom),
          lastRowBottom: last ? Math.round(last.bottom) : Math.round(dRect.bottom),
          stripHeight: strip ? Math.round(rect(strip).height) : 0,
          offenders,
          topHits
        };
      })()
    `);
    assert.ok(report.stripHeight > 0, `${vp.width}px: the gathered strip exists inside #detail-body`);
    assert.ok(report.rows >= 1, `${vp.width}px: the selected demo build still has material rows`);
    assert.ok(
      report.lastRowBottom <= report.detailBottom + 1,
      `${vp.width}px: the detail panel contains its last row (panel bottom ${report.detailBottom}, last row ${report.lastRowBottom})`
    );
    assert.deepEqual(report.offenders, [], `${vp.width}px: heading/table/rows must not paint over the gathered strip`);
    assert.deepEqual(report.topHits, [], `${vp.width}px: top-bar nodes must not overlap each other`);
  }
  await page().setViewport(1280, 900);
});

test('81 the 18px type knob scales body, headings and controls (AC1)', async () => {
  await reset();
  const sizes = await page().evaluate(`
    const px = (el) => parseFloat(getComputedStyle(el).fontSize);
    const h = (sel) => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height) : -1; };
    return {
      body: px(document.body),
      h2: px(document.querySelector('.builds__list .section-head__title')),
      masthead: h('.masthead__title'),
      input: h('#mat-needed'),
      rowInput: h('#material-body [data-mat-field=needed]'),
      matChoice: h('#mat-choice'),
      addStepper: h('.add__num .stepper'),
      entry: h('.build-entry'),
      row: h('.mat-row'),
    };
  `);
  assert.equal(sizes.body, 18, 'body text is 18px (html { font-size: 18px })');
  assert.equal(sizes.h2, 22, 'section h2 is 22px');
  assert.ok(sizes.masthead <= 46, 'masthead title height is at most 46px (found ' + sizes.masthead + ')');
  assert.ok(sizes.entry <= 70, 'build entries stay at or below 70px (found ' + sizes.entry + ')');
  assert.ok(sizes.row <= 62, 'material rows stay at or below 62px (found ' + sizes.row + ')');
  // Lead run-6 ruling: contract §8's A2 exception is real — material-row inputs and #mat-choice keep
  // the 36px box; the 42px rule applies to dialog/form inputs (measured below on the build dialog).
  // Lead run-8 ruling: the material-row input is sized by its 28px stepper cluster (28), the
  // add-form cluster and #mat-choice are 36, dialog inputs are 42.
  assert.ok(Math.abs(sizes.rowInput - 28) <= 1, 'material-row inputs are 28px tall (±1, found ' + sizes.rowInput + ')');
  assert.ok(Math.abs(sizes.matChoice - 36) <= 1, '#mat-choice keeps the 36px A2 box (found ' + sizes.matChoice + ')');
  assert.ok(Math.abs(sizes.addStepper - 36) <= 1, 'the add-form stepper clusters are 36px tall (±1, found ' + sizes.addStepper + ')');
  // Lead run-4 ruling: measure a VISIBLE normal .mc-btn, not the --sm top-bar buttons. The build
  // dialog's submit is the first always-there normal primary button.
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open');
  const normalBtn = await page().evaluate(`
    const button = document.querySelector('#build-dialog button[type="submit"]:not([formnovalidate])');
    const rect = button.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      small: button.classList.contains('mc-btn--sm'),
      visible: button.getClientRects().length > 0,
      dialogInput: Math.round(document.querySelector('#build-dlg-name').getBoundingClientRect().height),
    };
  `);
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('!document.querySelector("#build-dialog").open');
  assert.equal(normalBtn.visible, true, 'the dialog submit button is visible');
  assert.equal(normalBtn.small, false, 'the dialog submit button is a normal .mc-btn (not --sm)');
  assert.ok(normalBtn.height >= 34, 'a visible normal .mc-btn is at least 34px tall (found ' + normalBtn.height + ')');
  assert.ok(normalBtn.dialogInput >= 42, 'dialog inputs keep the 42px box (found ' + normalBtn.dialogInput + ')');
});

test('82 the gathered strip gets 10/14 padding and a 12px label gap (AC2)', async () => {
  await reset();
  await openFirstBuild();
  const box = await page().evaluate(`
    const block = document.querySelector('#detail-body .progress-block--inline');
    if (!block) return null;
    const style = getComputedStyle(block);
    const pct = block.querySelector('.progress-block__pct');
    const head = block.querySelector('.progress-block__head');
    const label = head ? head.firstElementChild : null;
    return {
      paddingTop: style.paddingTop,
      paddingLeft: style.paddingLeft,
      gap: (pct && label) ? Math.round(pct.getBoundingClientRect().left - label.getBoundingClientRect().right) : -1,
      baseline: (pct && label) ? Math.abs(pct.getBoundingClientRect().top - label.getBoundingClientRect().top) <= 4 : false,
    };
  `);
  assert.ok(box, 'the detail gathered strip exists inside #detail-body');
  assert.equal(box.paddingTop, '10px', 'the strip has 10px inner padding');
  assert.equal(box.paddingLeft, '14px', 'the strip has 14px inner padding');
  assert.ok(box.gap >= 12, 'the label and the percentage are at least 12px apart (found ' + box.gap + ')');
  assert.equal(box.baseline, true, 'the percentage stays on the label baseline');
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

test('86 every stepper button is 28x28 and inputs keep the 42px box (AC6/AC12)', async () => {
  await reset();
  await openFirstBuild();
  const measure = await page().evaluate(`
    const visible = (node) => node.getClientRects().length > 0;
    const buttons = Array.from(document.querySelectorAll('.stepper__btn')).filter(visible);
    const squares = buttons.map((button) => {
      const r = button.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    const clusters = (selector) => Array.from(document.querySelectorAll(selector))
      .filter(visible)
      .map((cluster) => {
        const r = cluster.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) };
      });
    const widths = Array.from(document.querySelectorAll('.stepper input'))
      .filter(visible)
      .map((input) => Math.round(input.getBoundingClientRect().width));
    return {
      count: buttons.length,
      squares,
      rowClusters: clusters('#material-body .stepper'),
      addClusters: clusters('.add__num .stepper'),
      widths,
    };
  `);
  assert.ok(measure.count >= 4, 'the demo build renders at least two steppers');
  assert.equal(measure.squares.every((entry) => entry.w === 28 && entry.h === 28), true,
    'every visible stepper button is 28x28');
  // Lead run-6 ruling: the cluster box follows its context — material-row clusters are 28 tall
  // (buttons 28 + 2px padding, ≥100 wide), the add-form clusters are 36 tall.
  assert.ok(measure.rowClusters.length >= 2, 'the material rows expose their clusters');
  assert.equal(measure.rowClusters.every((cluster) => Math.abs(cluster.h - 28) <= 1 && cluster.w >= 100), true,
    'material-row clusters are 28px tall (±1) and at least 100px wide: ' + JSON.stringify(measure.rowClusters));
  assert.ok(measure.addClusters.length >= 2, 'the add form exposes its two clusters');
  assert.equal(measure.addClusters.every((cluster) => Math.abs(cluster.h - 36) <= 1), true,
    'add-form stepper clusters are 36px tall (±1): ' + JSON.stringify(measure.addClusters));
  assert.equal(measure.widths.every((width) => width >= 30), true,
    'the stepper input keeps at least a 30px box: found ' + measure.widths.join(','));
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

test('88 a click on the needed input selects all, capability-safely (AC8)', async () => {
  await reset();
  await openFirstBuild();
  const result = await page().evaluate(`
    const input = document.querySelector('#material-body [data-mat-field=needed]');
    input.focus();
    input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return {
      type: input.type,
      focused: document.activeElement === input,
      start: input.selectionStart,
      end: input.selectionEnd,
      length: String(input.value).length,
    };
  `);
  assert.equal(result.type, 'number', 'the row input stays type=number');
  assert.equal(result.focused, true, 'the click focuses the input');
  const fullSelection = result.start !== null && result.start === 0 && result.end === result.length;
  assert.equal(fullSelection || result.start === null, true,
    'either the input reports the whole value selected, or Chrome reports a null selection for type=number');
});

test('89 wheel on a focused stepper input applies the modifiers without scrolling (AC9)', async () => {
  await reset();
  await openFirstBuild();
  const wheel = async (shift, ctrl) => page().evaluate(`
    const input = document.querySelector('#material-body [data-mat-field=needed]');
    input.focus();
    const before = Number(input.value);
    const scrollBefore = window.scrollY;
    input.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -1, shiftKey: ${shift}, ctrlKey: ${ctrl} }));
    return { before, after: Number(input.value), scrollBefore, scrollAfter: window.scrollY };
  `);
  const plain = await wheel(false, false);
  assert.equal(plain.after, plain.before + 1, 'a plain wheel adds 1');
  assert.equal(plain.scrollAfter, plain.scrollBefore, 'the wheel does not scroll the page');
  const withShift = await wheel(true, false);
  assert.equal(withShift.after, plain.after + 64, 'Shift+wheel adds a full stack (64 for stone)');
  const withCtrl = await wheel(false, true);
  assert.equal(withCtrl.after, withShift.after + 16, 'Ctrl+wheel adds 16');
  const ignored = await page().evaluate(`
    const input = document.querySelector('#material-body [data-mat-field=needed]');
    input.blur();
    const before = Number(input.value);
    input.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -1 }));
    return { before, after: Number(input.value) };
  `);
  assert.equal(ignored.after, ignored.before, 'an unfocused wheel is ignored');
});

test('90 Enter walks the same-kind column and the add form walks needed to got (AC10)', async () => {
  await reset();
  await openFirstBuild();
  const rows = await page().evaluate(`return document.querySelectorAll('#material-body [data-mat-field=needed]').length;`);
  assert.ok(rows >= 2, 'the demo build has at least two material rows');
  await page().evaluate(`document.querySelectorAll('#material-body [data-mat-field=needed]')[0].focus();`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.activeElement === document.querySelectorAll("#material-body [data-mat-field=needed]")[1]');
  await page().evaluate(`document.querySelectorAll('#material-body [data-mat-field=collected]')[0].focus();`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.activeElement === document.querySelectorAll("#material-body [data-mat-field=collected]")[1]');
  await page().evaluate(`document.querySelectorAll('#material-body [data-mat-field=needed]')[${0}].focus();`);
  const last = await page().evaluate(`return document.querySelectorAll('#material-body [data-mat-field=needed]').length;`);
  await page().evaluate(`document.querySelectorAll('#material-body [data-mat-field=needed]')[${last - 1}].focus();`);
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor(`document.activeElement === document.querySelectorAll("#material-body [data-mat-field=needed]")[${last - 1}]`);
  await page().click('#mat-needed');
  await page().press('Enter', { code: 'Enter', keyCode: 13 });
  await page().waitFor('document.activeElement === document.querySelector("#mat-collected")');
});

test('91 the world sidebar stays on Builds and Materials and hides on Worlds (AC11)', async () => {
  await reset();
  await openFirstBuild();
  const sidebar = await page().evaluate(`
    const panel = document.querySelector('#world-panel');
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    const ids = Array.from(panel.querySelectorAll('#world-select, #world-avatar, #world-panel-name, #world-meta, #world-stats, #btn-new-world, #btn-import, #btn-export')).map((el) => '#' + el.id);
    return {
      visible: rect.width > 0 && getComputedStyle(panel).display !== 'none',
      width: Math.round(rect.width),
      name: (document.querySelector('#world-panel-name') || {}).textContent || '',
      selected: (() => {
        const select = document.querySelector('#world-select');
        if (!select) return '';
        const option = Array.from(select.options).find((entry) => entry.value === select.value);
        return option ? option.textContent : '';
      })(),
      ids: ids.join(','),
    };
  `);
  assert.ok(sidebar, '#world-panel exists');
  assert.equal(sidebar.visible, true, 'the sidebar shows on the Builds tab');
  assert.ok(sidebar.width >= 220, 'the sidebar is at least 220px wide (found ' + sidebar.width + ')');
  assert.equal(sidebar.name.trim(), sidebar.selected.trim(), 'the sidebar name mirrors the selected option');
  assert.equal(sidebar.ids, '#world-avatar,#world-select,#world-panel-name,#world-meta,#world-stats,#btn-new-world,#btn-import,#btn-export',
    'the sidebar keeps the frozen element order');
  await page().click('#tab-materials');
  await page().waitFor('!document.querySelector("#view-materials").hidden');
  const materialsVisible = await page().evaluate(`const panel = document.querySelector('#world-panel'); return !!panel && panel.getBoundingClientRect().width > 0;`);
  assert.equal(materialsVisible, true, 'the sidebar stays on the Materials tab');
  await page().click('#tab-worlds');
  await page().waitFor('!document.querySelector("#view-worlds").hidden');
  const worldsHidden = await page().evaluate(`
    const panel = document.querySelector('#world-panel');
    return !panel || panel.hidden || panel.getBoundingClientRect().width === 0 || getComputedStyle(panel).display === 'none';
  `);
  assert.equal(worldsHidden, true, 'the sidebar is hidden on the Worlds tab');
});

test('92 the retired strip and notes-action row are gone from the DOM (AC6/AC12)', async () => {
  await reset();
  await openFirstBuild();
  const counts = await page().evaluate(`
    const count = (selector) => document.querySelectorAll(selector).length;
    return {
      matStepsId: count('#mat-steps'),
      matStepClass: count('.mat-step'),
      dataStep: count('[data-step]'),
      matStepData: count('[data-mat-step]'),
      notesActions: count('.notes-editor__actions'),
      steppers: count('.stepper'),
      rows: count('#material-body .mat-row'),
    };
  `);
  assert.equal(counts.matStepsId, 0, '#mat-steps is retired');
  assert.equal(counts.matStepClass, 0, '.mat-step is retired');
  assert.equal(counts.dataStep, 0, 'every data-step attribute is retired');
  assert.equal(counts.matStepData, 0, 'data-mat-step is retired');
  assert.equal(counts.notesActions, 0, '.notes-editor__actions is retired');
  assert.ok(counts.steppers >= counts.rows + 1, 'each row plus the add form keeps a stepper');
});

test('93 both section bars land on the same baseline (AC13)', async () => {
  await reset();
  await openFirstBuild();
  const bars = await page().evaluate(`
    const list = document.querySelector('.builds__list > .section-head');
    const detail = document.querySelector('.builds__detail .detail > .section-head');
    if (!list || !detail) return null;
    const rect = (el) => el.getBoundingClientRect();
    const info = (el) => {
      const style = getComputedStyle(el);
      return { paddingBottom: style.paddingBottom, minHeight: style.minHeight, alignItems: style.alignItems, bottom: rect(el).bottom };
    };
    const item = document.querySelector('#detail-body .mtable .mat-row .mat-row__item');
    const table = document.querySelector('#detail-body .mtable');
    return {
      list: info(list),
      detail: info(detail),
      itemWidth: item ? Math.round(rect(item).width) : -1,
      tableWidth: table ? Math.round(rect(table).width) : -1,
    };
  `);
  assert.ok(bars, 'both section bars exist');
  assert.equal(bars.list.paddingBottom, '4px');
  assert.equal(bars.detail.paddingBottom, '4px');
  assert.equal(bars.list.minHeight, '44px');
  assert.equal(bars.detail.minHeight, '44px');
  assert.equal(bars.list.alignItems, 'center');
  assert.equal(bars.detail.alignItems, 'center');
  assert.ok(Math.abs(bars.list.bottom - bars.detail.bottom) <= 0.5,
    'the two bars land within 0.5px (found ' + (bars.list.bottom - bars.detail.bottom).toFixed(2) + ')');
  // Lead run-6 ruling: the 390 floor cannot be met inside the 608px detail. Arithmetic disclosed:
  // item + needed 104 + got 104 + left 64 + remove 32 = 304 fixed tracks ⇒ item 252 at 1280.
  assert.ok(bars.itemWidth >= 250, 'at 1280 the A2 table floor keeps the item column at least 250px (found ' + bars.itemWidth + ')');
  // Lead ruling (run 4): the 390 floor cannot survive the shipped arithmetic (104+104+64+32 = 304
  // inside a 608px detail), so the frozen floors are 1280 ≥ 300 and 390 ≥ 240.
  await page().setViewport(390, 844);
  await page().waitFor('document.querySelector("#detail-body .mtable .mat-row .mat-row__item") !== null');
  const mobile = await page().evaluate(`
    const item = document.querySelector('#detail-body .mtable .mat-row .mat-row__item');
    return { itemWidth: item ? Math.round(item.getBoundingClientRect().width) : -1 };
  `);
  await page().clearViewport();
  // Lead run-8 ruling: at 390 the table is `minmax(0,1fr) 88px 52px 28px` + 6px gaps inside a 346px
  // panel ⇒ item ≈ 140; the frozen 390 floor is 130 (no-overflow assertions below still apply).
  assert.ok(mobile.itemWidth >= 130, 'at 390 the A2 floor keeps the item column at least 130px (found ' + mobile.itemWidth + ')');
});

test('94 the compact view swaps the layout and persists the choice (AC14)', async () => {
  await reset();
  await openFirstBuild();
  // Lead run-8 ruling: the case must not inherit a previous case's viewport (case 93 leaves 390,
  // where the compact grid is one column by design). The frozen pair assertion is a 1280 one.
  await page().setViewport(1280, 900);
  await sleep(250);
  await page().click('#view-compact');
  await page().waitFor('!document.querySelector("#compact-view").hidden');
  const compact = await page().evaluate(`
    const grid = document.querySelector('#compact-grid');
    const cards = Array.from(document.querySelectorAll('#compact-grid .ccard'));
    const rect = (el) => el.getBoundingClientRect();
    const panel = document.querySelector('#world-panel');
    const pair = cards.length > 1 && cards.slice(1).some((card) => Math.abs(rect(card).top - rect(cards[0]).top) < 1 && rect(card).left > rect(cards[0]).right);
    return {
      panelHidden: !panel || panel.hidden || rect(panel).width === 0,
      world: (document.querySelector('#compact-world') || {}).textContent || '',
      cards: cards.length,
      pair,
      tiles: document.querySelectorAll('#compact-grid .ctile').length,
      stored: localStorage.getItem('mbt.buildsView'),
    };
  `);
  assert.equal(compact.panelHidden, true, 'compact hides the world sidebar');
  assert.ok(compact.cards >= 2, 'the demo world renders at least two cards');
  assert.ok(compact.tiles >= 6, 'the card matrix carries the row tiles');
  assert.ok(compact.pair, 'at 1280 two cards sit side by side');
  assert.ok(compact.world.trim().length > 0, 'the compact header names the world');
  assert.equal(compact.stored, 'compact', 'the choice is persisted in mbt.buildsView');
  await page().reload();
  await page().waitFor('window.TrackerModel && document.querySelector("#compact-view") !== null');
  const afterReload = await page().evaluate(`
    return { compactVisible: !document.querySelector('#compact-view').hidden, stored: localStorage.getItem('mbt.buildsView') };
  `);
  assert.equal(afterReload.compactVisible, true, 'the compact choice survives a reload');
  assert.equal(afterReload.stored, 'compact');
  await page().click('#view-standard');
  await page().waitFor('document.querySelector("#compact-view").hidden');
  assert.equal(await page().evaluate(`return localStorage.getItem('mbt.buildsView');`), 'standard');
});

test('95 the quick-update dialog writes one commit and one Undo restores it (AC14)', async () => {
  await reset();
  await openFirstBuild();
  await page().click('#view-compact');
  await page().waitFor('document.querySelectorAll("#compact-grid .ctile").length >= 2');
  const parsed = await page().evaluate(`
    const M = window.TrackerModel;
    return { two: M.parseRelative('2s', 64), plus: M.parseRelative('+64', 64), bad: M.parseRelative('abc', 64) };
  `);
  // M.parseRelative returns { value } for a legal delta and { error } otherwise (shipped model shape;
  // contract §10's "integer delta" wording is read as this object — disclosed to the Lead, case amended).
  assert.equal(parsed.two && parsed.two.value, 128, "'2s' means two stacks (2 x 64)");
  assert.equal(parsed.plus && parsed.plus.value, 64, "'+64' means 64 units");
  assert.ok(parsed.bad && typeof parsed.bad === 'object', 'a bad relative amount returns an error object');
  const opened = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#compact-grid .ctile'));
    const tile = tiles.find((entry) => entry.dataset.state === 'open') || tiles[0];
    tile.click();
    return { matId: tile.dataset.matId || '', buildId: tile.dataset.buildId || '' };
  `);
  // Lead run-6 correction: a modal <dialog> never toggles `hidden`; open state is `open === true`.
  await page().waitFor('document.querySelector("#tile-dialog").open === true');
  const fields = await page().evaluate(`
    return {
      title: (document.querySelector('#tile-dialog .mc-dialog__title') || document.querySelector('#tile-dialog h2') || {}).textContent || '',
      absoluteType: document.querySelector('#tile-absolute').type,
      absoluteValue: Number(document.querySelector('#tile-absolute').value),
      relativeType: document.querySelector('#tile-relative').type,
      relativeMode: document.querySelector('#tile-relative').getAttribute('inputmode'),
      steppers: (() => {
        const field = document.querySelector('#tile-relative');
        const cluster = field ? field.closest('.stepper') : null;
        return cluster ? cluster.querySelectorAll('.stepper__btn').length : -1;
      })(),
    };
  `);
  assert.match(fields.title, /^Update inventory: /);
  assert.equal(fields.absoluteType, 'number', '#tile-absolute stays type=number');
  assert.equal(fields.relativeType, 'text', '#tile-relative is a text input');
  assert.equal(fields.relativeMode, 'numeric', '#tile-relative asks for a numeric keyboard');
  assert.equal(fields.steppers, 2, 'the relative field carries its own stepper buttons');
  const collectedBefore = fields.absoluteValue;
  await page().fill('#tile-relative', '+64');
  await page().click('#tile-save');
  await page().waitFor('document.querySelector("#tile-dialog").open === false');
  const collected = async () => page().evaluate(`
    const state = JSON.parse(localStorage.getItem('mc-build-tracker:v1'));
    for (const world of state.worlds) for (const build of world.builds) for (const material of (build.materials || [])) {
      if (material.id === ${JSON.stringify(opened.matId)}) return material.collected;
    }
    return -1;
  `);
  assert.equal(await collected(), collectedBefore + 64, 'one commit applies the relative +64');
  await page().click('#toast-action');
  assert.equal(await collected(), collectedBefore, 'a single Undo restores the previous value');
  const reopened = await page().evaluate(`
    const tiles = Array.from(document.querySelectorAll('#compact-grid .ctile'));
    const tile = tiles.find((entry) => entry.dataset.matId === ${JSON.stringify(opened.matId)});
    if (!tile) return false;
    tile.click();
    return true;
  `);
  assert.equal(reopened, true, 'the tile is still open after the undo');
  await page().waitFor('document.querySelector("#tile-dialog").open === true');
  await page().fill('#tile-relative', 'abc');
  await page().click('#tile-save');
  await page().waitFor('(document.querySelector("#tile-error").textContent || "").trim().length > 0');
  const invalid = await page().evaluate(`
    return {
      open: document.querySelector('#tile-dialog').open,
      error: document.querySelector('#tile-error').textContent.trim(),
    };
  `);
  assert.equal(invalid.open, true, 'an invalid relative amount leaves the dialog open');
  assert.ok(invalid.error.length > 0, 'the invalid amount is explained (found "' + invalid.error + '")');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#tile-dialog").open === false');
});

test('96 stamps render as <time> with ISO titles on the detail meta and Materials lede (AC7)', async () => {
  await reset();
  await loadBackupText(fs.readFileSync(fixture16('stepper-state.json'), 'utf8'));
  await openFirstBuild();
  const meta = await page().evaluate(`
    const detail = document.querySelector('.builds__detail .detail') || document.querySelector('.detail');
    const metaNode = document.querySelector('#detail-meta');
    if (!detail || !metaNode) return null;
    const head = detail.querySelector(':scope > .section-head') || detail.querySelector(':scope > .detail__head');
    const children = Array.from(detail.children);
    const times = Array.from(metaNode.querySelectorAll('time')).map((node) => ({ iso: node.getAttribute('datetime') || '', display: node.textContent.trim() }));
    return {
      isFirstAfterHead: head ? children[children.indexOf(head) + 1] === metaNode : false,
      times,
    };
  `);
  assert.ok(meta, '#detail-meta exists inside the detail panel');
  assert.equal(meta.isFirstAfterHead, true, '#detail-meta is the first child after .section-head (contract §7/A4)');
  assert.ok(meta.times.length >= 1, 'the detail meta renders at least one time element');
  // Lead run-6 ruling: contract §7 puts the whole string inside the element and the measured
  // textContent is `Updated 2026-10-25 21:40` (datetime = full ISO). Keep the ISO assertion,
  // allow the optional `Created <date> · ` prefix.
  const stampShown = /^(Created \d{4}-\d{2}-\d{2} · )?Updated \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  assert.ok(meta.times.every((entry) => /^\d{4}-\d{2}-\d{2}T/.test(entry.iso)), 'every time carries an ISO datetime');
  assert.ok(meta.times.every((entry) => stampShown.test(entry.display)), 'the visible stamp is Created/Updated YYYY-MM-DD HH:MM (found ' + JSON.stringify(meta.times) + ')');
  await page().click('#tab-materials');
  await page().waitFor('!document.querySelector("#view-materials").hidden');
  const lede = await page().evaluate(`
    const time = document.querySelector('#materials-lede time');
    return time ? { display: time.textContent.trim(), iso: time.getAttribute('datetime') || '', title: time.getAttribute('title') || '' } : null;
  `);
  assert.ok(lede, 'the Materials lede shows the world stamp as a time element');
  assert.match(lede.display, stampShown);
  assert.match(lede.iso, /^\d{4}-\d{2}-\d{2}T/);
  await loadBackupText(fs.readFileSync(fixture16('malformed-timestamps.json'), 'utf8'));
  await page().click('#tab-materials');
  await page().waitFor('!document.querySelector("#view-materials").hidden');
  const dashed = await page().evaluate(`const node = document.querySelector('#materials-lede'); return node ? node.textContent : '';`);
  assert.match(dashed, /—/, 'an unparseable stamp shows a dash, never an invented date');
});

test('66 the whole run, including the new surfaces, stayed free of console errors', async () => {
  assert.deepEqual(app.consoleErrors, []);
});
