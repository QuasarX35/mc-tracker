/**
 * Comprehensive UI acceptance suite for the Minecraft Build Tracker (测试部, EDICT-0009).
 *
 * Drives the real app in real Chrome through the DevTools Protocol (see ui/harness.mjs).
 * Every user flow the app has is exercised: empty state, worlds, builds, materials,
 * shopping list, filters, copy, export, import (valid + invalid), persistence, deep
 * links, tabs and keyboard, accessibility, responsive layout, visual contract and the
 * icon fallback. Console errors count as failures.
 *
 * Run: node tests/qa/ui.e2e.test.mjs
 */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, fileUrl } from './ui/harness.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EVIDENCE = path.join(ROOT, 'reports', 'qa', 'evidence', 'edict-0009');
let app;

before(async () => {
  app = await launch({ appUrl: fileUrl('src/index.html') });
});

after(async () => {
  if (!app) return;
  await app.close();
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

/** Current app state, straight from the page's model. */
async function appState() {
  return page().evaluate(`
    const raw = localStorage.getItem('mc-build-tracker:v1');
    return raw ? JSON.parse(raw) : null;
  `);
}

async function worldNames() {
  return page().evaluate(`
    return Array.from(document.querySelectorAll('#world-select option')).map((o) => o.textContent.trim());
  `);
}

async function toastText() {
  return page().text('#toast');
}

async function closeDialogIfOpen(selector) {
  await page().evaluate(`
    const dialog = document.querySelector(${JSON.stringify(selector)});
    if (dialog && dialog.open) dialog.close('cancel');
    return true;
  `);
}

function tmpFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-qa-'));
  const file = path.join(dir, name);
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

/** Poll a page predicate (waitFor takes expressions, this takes statements). */
async function poll(check, timeout = 6000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error('poll timed out');
}

/* ------------------------------------------------------------- 1. empty state */

test('01 empty state: no worlds, guidance shown, nothing crashes', async () => {
  await reset({ demo: false });
  assert.equal(await page().count('#world-select option'), 1, 'only the placeholder option');
  assert.match(await page().text('#world-select option'), /No worlds yet/);
  assert.equal(await page().text('#world-meta'), 'No world selected');
  assert.equal(await page().exists('#build-empty'), true, 'build empty state');
  assert.equal(await page().hidden('#build-empty'), false);
  assert.equal(await page().hidden('#detail-empty'), false);
  assert.equal(await page().hidden('#world-empty'), false);
  assert.equal(await page().exists('#btn-sample'), true);
  assert.equal(app.consoleErrors.length, 0, app.consoleErrors.join(' | '));
  await page().screenshot(path.join(EVIDENCE, '01-empty-state.png'));
});
test('02 empty state: "New Build" without a world guides instead of failing silently', async () => {
  await reset({ demo: false });
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#toast").hidden === false');
  assert.match(await toastText(), /Create a world first/);
  assert.equal(await page().attr('#tab-worlds', 'aria-selected'), 'true', 'switches to Worlds tab');
  assert.equal(await page().exists('#build-dialog[open]'), false);
});

/* --------------------------------------------------------------- 2. sample data */
test('03 sample worlds load and populate the dashboard', async () => {
  await reset({ demo: false });
  await page().click('#btn-sample');
  await page().waitFor('document.querySelectorAll(".world-card").length >= 2');
  const names = await worldNames();
  assert.ok(names.includes('Survival SMP'), names.join(','));
  assert.ok(names.includes('Creative Flat'), names.join(','));
  assert.match(await page().text('#world-meta'), /Java 1\.21\.4 · 3 builds · \d+% gathered/);
  assert.equal(await page().count('.build-entry'), 3);
  assert.equal(await page().text('#detail-heading'), 'Iron Farm (spawn)');
  assert.match(await page().text('#world-summary'), /Survival SMP/);
  await page().screenshot(path.join(EVIDENCE, '02-sample-worlds.png'));
});

/* --------------------------------------------------------------------- 3. tabs */
test('04 tabs: click and keyboard switch panels with correct ARIA', async () => {
  await reset();
  assert.equal(await page().hidden('#view-builds'), false);
  await page().click('#tab-materials');
  assert.equal(await page().hidden('#view-materials'), false);
  assert.equal(await page().hidden('#view-builds'), true);
  assert.equal(await page().attr('#tab-materials', 'aria-selected'), 'true');
  assert.equal(await page().attr('#tab-builds', 'aria-selected'), 'false');
  assert.equal(await page().attr('#tab-materials', 'aria-controls'), 'view-materials');

  await page().click('#tab-worlds');
  assert.equal(await page().hidden('#view-worlds'), false);
  // a programmatic .click() does not move focus, so focus the tab first — a real click does
  await page().evaluate('document.querySelector("#tab-worlds").focus(); return true;');
  assert.equal(await page().evaluate('return document.activeElement.id;'), 'tab-worlds');
  await page().press('ArrowLeft', { code: 'ArrowLeft', keyCode: 37 });
  await page().waitFor('document.querySelector("#tab-materials").getAttribute("aria-selected") === "true"');
  assert.equal(await page().evaluate('return document.activeElement.id;'), 'tab-materials', 'roving focus follows selection');
  await page().press('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  await page().waitFor('document.querySelector("#tab-worlds").getAttribute("aria-selected") === "true"');
});
test('05 world dialog: required name blocks creation, valid input creates + activates', async () => {
  await reset();
  const before = (await worldNames()).length;
  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog").open === true');

  await page().click('#world-save');
  await page().waitFor('true');
  assert.equal(await page().exists('#world-dialog[open]'), true, 'dialog stays open');
  assert.equal((await worldNames()).length, before, 'no world created');
  assert.equal(await page().evaluate('return document.querySelector("#world-name").validity.valid;'), false);

  await page().fill('#world-name', 'QA World');
  await page().fill('#world-version', '1.20.1');
  await page().evaluate(`
    const select = document.querySelector('#world-edition');
    select.value = 'bedrock';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().click('#world-save');
  await page().waitFor('document.querySelector("#world-dialog").open === false');
  await page().waitFor('Array.from(document.querySelectorAll("#world-select option")).some((o) => o.textContent.trim() === "QA World")');
  assert.match(await page().text('#world-meta'), /Bedrock 1\.20\.1/);
  const activeName = await page().evaluate(`
    const select = document.querySelector('#world-select');
    return select.options[select.selectedIndex].textContent.trim();
  `);
  assert.equal(activeName, 'QA World', 'new world becomes active');
  const state = await appState();
  assert.ok(state.worlds.some((world) => world.name === 'QA World' && world.edition === 'bedrock'));
});
test('06 world edit: dialog pre-fills and a rename reaches the cards', async () => {
  await reset();
  await page().click('#tab-worlds');
  await page().click('[data-world-edit]');
  await page().waitFor('document.querySelector("#world-dialog").open === true');
  assert.match(await page().evaluate('return document.querySelector("#world-name").value;'), /Survival SMP|Creative Flat/);
  await page().fill('#world-name', 'Renamed World');
  await page().click('#world-save');
  await page().waitFor('document.querySelector("#world-dialog").open === false');
  await page().waitFor('document.querySelector(".world-card__name").textContent.includes("Renamed")');
  assert.match(await page().text('#world-cards'), /Renamed World/);
});
test('07 world delete: cancel keeps it, confirm removes it and repoints the active world', async () => {
  await reset();
  await page().click('#tab-worlds');
  const total = await page().count('.world-card');
  assert.ok(total >= 2);

  await page().click('[data-world-delete]');
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  await page().click('#confirm-dialog button[value="cancel"]');
  await page().waitFor('document.querySelector("#confirm-dialog").open === false');
  assert.equal(await page().count('.world-card'), total, 'cancel keeps the world');

  await page().click('[data-world-delete]');
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  assert.match(await page().text('#confirm-text'), /cannot be undone/);
  await page().click('#confirm-ok');
  await page().waitFor(`document.querySelectorAll(".world-card").length === ${total - 1}`);
  const state = await appState();
  assert.ok(state.worlds.length === total - 1);
  assert.ok(state.worlds.some((w) => w.id === state.activeWorldId), 'active world still valid');
});

/* ------------------------------------------------------------------- 5. builds */
test('08 build dialog: required name, then creation selects the new build', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open === true');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('true');
  assert.equal(await page().exists('#build-dialog[open]'), true, 'invalid submit kept the dialog');

  await page().fill('#build-dlg-name', 'QA Tower');
  await page().fill('#build-dlg-coords', '10 / 70 / 10');
  await page().evaluate(`
    const s = document.querySelector('#build-dlg-status');
    s.value = 'building';
    return true;
  `);
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('document.querySelector("#build-dialog").open === false');
  await page().waitFor('document.querySelector("#detail-heading").textContent === "QA Tower"');
  assert.match(await page().text('#build-list'), /QA Tower/);
  assert.equal(await page().evaluate('return document.querySelector("#build-coords").value;'), '10 / 70 / 10');
  assert.equal(await page().evaluate('return document.querySelector("#status-group [data-status=\\"building\\"]").getAttribute("aria-pressed");'), 'true');
});
test('09 build inline edit: name, coords and notes persist through a reload', async () => {
  await reset();
  await page().fill('#build-name', 'Renamed Farm');
  await page().waitFor('document.querySelector("#detail-heading").textContent === "Renamed Farm"');
  await page().fill('#build-coords', '1 / 2 / 3');
  await page().fill('#build-notes', 'Roof first, then villagers.');
  await page().reload();
  await page().waitFor('document.querySelector("#detail-heading").textContent === "Renamed Farm"');
  assert.equal(await page().evaluate('return document.querySelector("#build-coords").value;'), '1 / 2 / 3');
  assert.equal(await page().evaluate('return document.querySelector("#build-notes").value;'), 'Roof first, then villagers.');
});
test('10 status buttons: aria-pressed and the list chip follow the click', async () => {
  await reset();
  await page().click('#status-group [data-status="done"]');
  await page().waitFor('document.querySelector("#status-group [data-status=\\"done\\"]").getAttribute("aria-pressed") === "true"');
  const chip = await page().evaluate(`
    const active = document.querySelector('.build-entry[aria-current="true"] .chip');
    return active ? active.textContent.trim() : null;
  `);
  assert.equal(chip, 'Done');
  assert.equal(await page().evaluate('return document.querySelector("#status-group [data-status=\\"planned\\"]").getAttribute("aria-pressed");'), 'false');
});
test('11 build delete: cancel keeps it, confirm removes it', async () => {
  await reset();
  const total = await page().count('.build-entry');
  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  await page().click('#confirm-dialog button[value="cancel"]');
  await page().waitFor('document.querySelector("#confirm-dialog").open === false');
  assert.equal(await page().count('.build-entry'), total);

  await page().click('#build-delete');
  await page().waitFor('document.querySelector("#confirm-dialog").open === true');
  await page().click('#confirm-ok');
  await page().waitFor(`document.querySelectorAll(".build-entry").length === ${total - 1}`);
  assert.match(await page().text('#toast'), /Build deleted/);
});

/* ---------------------------------------------------------------- 6. materials */
test('12 add material: validation, creation, and duplicate merge', async () => {
  await reset();
  // whitespace passes the browser's required check but fails the model's own rule
  await page().fill('#mat-item', '   ');
  await page().fill('#mat-needed', '1');
  await page().click('#add-material-form button[type="submit"]');
  await page().waitFor('document.querySelector("#toast").hidden === false');
  assert.match(await toastText(), /material needs an item name/);
  assert.equal((await appState()).worlds[0].builds[0].materials.some((m) => !m.item.trim()), false);

  await page().fill('#mat-item', 'Mystery Goo');
  await page().fill('#mat-needed', '7');
  await page().fill('#mat-collected', '2');
  await page().click('#add-material-form button[type="submit"]');
  await page().waitFor('document.querySelector("#material-body").textContent.includes("Mystery Goo")');
  const row = await page().evaluate(`
    const target = Array.from(document.querySelectorAll('#material-body .mat-row'))
      .find((r) => r.textContent.includes('Mystery Goo'));
    return {
      needed: target.querySelector('[data-mat-field="needed"]').value,
      collected: target.querySelector('[data-mat-field="collected"]').value,
    };
  `);
  assert.deepEqual(row, { needed: '7', collected: '2' });

  await page().fill('#mat-item', 'mystery goo');
  await page().fill('#mat-needed', '3');
  await page().fill('#mat-collected', '0');
  await page().click('#add-material-form button[type="submit"]');
  await page().waitFor('document.querySelector("#material-body").textContent.includes("Mystery Goo")');
  const merged = await page().evaluate(`
    return Array.from(document.querySelectorAll('#material-body .mat-row'))
      .filter((r) => /mystery goo/i.test(r.textContent))
      .map((r) => r.querySelector('[data-mat-field="needed"]').value);
  `);
  assert.deepEqual(merged, ['10'], 'case-insensitive duplicates merge with summed quantities');
  assert.equal(await page().evaluate('return document.querySelector("#item-options").innerHTML.includes("Mystery Goo");'), true, 'datalist learns new items');
});
test('13 material fallback icon: items without a vanilla texture show a lettered slot', async () => {
  await reset();
  await page().fill('#mat-item', 'Mystery Goo');
  await page().fill('#mat-needed', '5');
  await page().click('#add-material-form button[type="submit"]');
  await page().waitFor('document.querySelector("#material-body").textContent.includes("Mystery Goo")');
  const slot = await page().evaluate(`
    const row = Array.from(document.querySelectorAll('#material-body .mat-row')).find((r) => r.textContent.includes('Mystery Goo'));
    const slot = row.querySelector('.slot');
    return { img: !!slot.querySelector('img'), letter: slot.querySelector('.slot__letter')?.textContent || null, tip: slot.getAttribute('data-tip') };
  `);
  assert.deepEqual(slot, { img: false, letter: 'M', tip: 'Mystery Goo' });
});
test('14 inline quantity edit: Left and the XP bar follow the numbers, over-farm clamps', async () => {
  await reset();
  await page().fill('#material-body .mat-row [data-mat-field="needed"]', '20');
  await page().fill('#material-body .mat-row [data-mat-field="collected"]', '999');
  await page().waitFor("document.querySelector('#material-body .mat-row [data-mat-field=collected]').value === '999'");

  const row = await page().evaluate(`
    const first = document.querySelector('#material-body .mat-row');
    const nums = Array.from(first.querySelectorAll(':scope > .num')).map((n) => n.textContent.trim());
    return {
      needed: first.querySelector('[data-mat-field="needed"]').value,
      collected: first.querySelector('[data-mat-field="collected"]').value,
      left: nums[nums.length - 1],
      pct: document.querySelector('#build-pct').textContent.trim(),
      bar: document.querySelector('#build-bar').getAttribute('aria-valuenow'),
    };
  `);
  assert.equal(row.needed, '20');
  assert.equal(row.collected, '999', 'raw over-farmed count is preserved');
  assert.equal(row.left, '0', 'Left never goes negative');

  const expected = await page().evaluate(`
    let needed = 0, got = 0;
    for (const r of document.querySelectorAll('#material-body .mat-row')) {
      const n = Number(r.querySelector('[data-mat-field="needed"]').value);
      const c = Number(r.querySelector('[data-mat-field="collected"]').value);
      needed += n; got += Math.min(c, n);
    }
    return [Math.round((got / needed) * 100), needed, got];
  `);
  assert.equal(row.bar, String(expected[0]), 'aria-valuenow matches the computed share');
  assert.equal(row.pct, `${expected[0]}%`);
  assert.match(await page().text('#build-summary'), new RegExp(`of ${expected[1]} items gathered`));
});
test('15 remove material: row disappears, empty state appears when none remain', async () => {
  await reset();
  const rows = await page().count('#material-body .mat-row');
  await page().click('#material-body .row-delete');
  await page().waitFor(`document.querySelectorAll("#material-body .mat-row").length === ${rows - 1}`);
  while ((await page().count('#material-body .mat-row')) > 0) {
    await page().click('#material-body .row-delete');
    await page().waitFor('true');
  }
  assert.equal(await page().hidden('#material-empty'), false);
  assert.match(await page().text('#build-summary'), /No materials listed yet/);
});

/* ------------------------------------------------------------ 7. shopping list */
test('16 shopping list: sums items across builds and names the builds using them', async () => {
  await reset();
  await page().click('#tab-materials');
  await page().waitFor('document.querySelectorAll("#world-material-body .mat-row").length > 0');
  const bricks = await page().evaluate(`
    const rows = Array.from(document.querySelectorAll('#world-material-body .mat-row'));
    const row = rows.find((r) => r.querySelector('.mat-row__name').textContent === 'Stone Bricks');
    return { needed: row.querySelectorAll('.num')[0].textContent, builds: row.querySelector('.mat-row__builds').textContent };
  `);
  assert.equal(bricks.needed, '640', '384 + 256 across two builds');
  assert.match(bricks.builds, /Iron Farm \(spawn\)/);
  assert.match(bricks.builds, /Storage Hall/);
  assert.match(await page().text('#mat-totals'), /\d+ items · \d+ \/ \d+ gathered · \d+ to go · \d+%/);
  assert.match(await page().text('#materials-lede'), /summed by item/);
  await page().screenshot(path.join(EVIDENCE, '03-shopping-list.png'));
});
test('17 shopping filters: still-needed / everything / gathered / search / no-match', async () => {
  await reset();
  await page().click('#tab-materials');
  await page().waitFor('document.querySelectorAll("#world-material-body .mat-row").length > 0');

  const all = await page().count('#world-material-body .mat-row');
  await page().evaluate(`
    const filter = document.querySelector('#mat-filter');
    filter.value = 'done';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().waitFor('!document.querySelector("#world-material-body").textContent.includes("Stone Bricks")');
  const done = await page().count('#world-material-body .mat-row');
  assert.ok(done >= 1 && done < all, `gathered (${done}) should be a real subset of all (${all})`);

  await page().evaluate(`
    const filter = document.querySelector('#mat-filter');
    filter.value = 'remaining';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().fill('#mat-search', 'stone');
  await page().waitFor('document.querySelectorAll("#world-material-body .mat-row").length > 0');
  const stoneRows = await page().evaluate(`
    return Array.from(document.querySelectorAll('#world-material-body .mat-row__name'))
      .map((node) => node.textContent.trim());
  `);
  assert.ok(stoneRows.length >= 2, `Stone Bricks and Cobblestone both match: ${stoneRows.join(', ')}`);
  assert.ok(stoneRows.every((name) => /stone/i.test(name)));

  await page().fill('#mat-search', 'zzzz');
  await page().waitFor('document.querySelector("#world-material-empty").hidden === false');
  assert.match(await page().text('#world-material-empty'), /Nothing matches/);
});
test('18 copy list: writes the outstanding list to the clipboard', async () => {
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
  await page().waitFor('typeof window.__copied === "string"');
  const copied = await page().evaluate('return window.__copied;');
  assert.match(copied, /Stone Bricks x640 \(\d+ left\)/);
  assert.match(copied, /Glass x96 \(done\)/);
  assert.match(await page().text('#toast'), /Shopping list copied/);
});

/* -------------------------------------------------------------- 8. import/export */
test('19 export: produces a dated JSON backup containing the full state', async () => {
  await reset();
  await page().evaluate(`
    window.__exported = null;
    URL.createObjectURL = (blob) => { window.__exported = { blob }; return 'blob:stub'; };
    HTMLAnchorElement.prototype.click = function () { window.__exported.name = this.download; };
    return true;
  `);
  await page().click('#btn-export');
  await page().waitFor('window.__exported && window.__exported.name');
  const result = await page().evaluate(`
    return {
      name: window.__exported.name,
      json: await window.__exported.blob.text(),
    };
  `);
  assert.match(result.name, /^minecraft-build-tracker-\d{4}-\d{2}-\d{2}\.json$/);
  const backup = JSON.parse(result.json);
  assert.equal(backup.version, 1);
  assert.equal(backup.worlds.length, 2);
  assert.match(await page().text('#toast'), /Backup downloaded/);
});
test('20 import: a valid backup replaces the state', async () => {
  await reset();
  const backup = await appState();
  backup.worlds[0].name = 'Imported World';
  const file = tmpFile('backup.json', JSON.stringify(backup));
  await page().upload('#file-import', file);
  await page().waitFor('Array.from(document.querySelectorAll("#world-select option")).some((o) => o.textContent.trim() === "Imported World")');
  assert.match(await page().text('#toast'), /Backup restored/);
  const state = await appState();
  assert.equal(state.worlds.length, 2);
});
test('21 import: malformed and foreign files are refused without touching good data', async () => {
  await reset();
  const worldsBefore = await worldNames();
  const badJson = tmpFile('bad.json', '{ not json');
  await page().upload('#file-import', badJson);
  await page().waitFor('document.querySelector("#toast").hidden === false');
  assert.match(await toastText(), /not valid JSON/);
  assert.deepEqual(await worldNames(), worldsBefore);

  const foreign = tmpFile('foreign.json', JSON.stringify({ version: 1, worlds: [{ id: 'x' }] }));
  await page().upload('#file-import', foreign);
  await page().waitFor('document.querySelector("#toast").textContent.includes("not a tracker backup")');
  assert.deepEqual(await worldNames(), worldsBefore, 'state untouched after refusal');
});

/* -------------------------------------------------------- 9. persistence/deeplink */
test('22 persistence and deep links: reload keeps data, ?tab opens the view', async () => {
  await reset();
  await page().evaluate(`
    const name = document.querySelector('#build-name');
    name.value = 'Persisted Build';
    name.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  `);
  await page().reload();
  await page().waitFor('document.querySelector("#detail-heading").textContent === "Persisted Build"');

  await page().goto(fileUrl('src/index.html?tab=materials'));
  await page().waitFor('document.querySelector("#tab-materials").getAttribute("aria-selected") === "true"');
  assert.equal(await page().hidden('#view-materials'), false);

  await page().evaluate('localStorage.clear(); return true;');
  await page().goto(fileUrl('src/index.html?demo=1&tab=builds'));
  await page().waitFor('document.querySelectorAll(".build-entry").length === 3');
  await page().screenshot(path.join(EVIDENCE, '04-builds.png'));
});

/* --------------------------------------------------------- 10. accessibility */
test('23 a11y: skip link, labelled controls, dialog semantics, live regions', async () => {
  await reset();
  const audit = await page().evaluate(`
    const controls = Array.from(document.querySelectorAll('input, select, textarea'));
    const labelled = controls.every((el) => {
      if (el.type === 'hidden' || el.hidden) return true;
      if (el.getAttribute('aria-label')) return true;
      if (el.id && document.querySelector('label[for="' + el.id + '"]')) return true;
      return !!el.closest('label');
    });
    const invalidControl = controls.find((el) => !el.getAttribute('aria-label') && !(el.id && document.querySelector('label[for="' + el.id + '"]')) && !el.closest('label') && el.type !== 'hidden' && !el.hidden);
    return {
      labelled,
      firstFocusable: document.querySelector('.skip-link') === document.body.querySelector('a, button, input, select, textarea'),
      skipHref: document.querySelector('.skip-link').getAttribute('href'),
      liveRegions: document.querySelectorAll('[aria-live="polite"]').length,
      progressbars: document.querySelectorAll('[role="progressbar"][aria-valuenow]').length,
      tablist: document.querySelectorAll('[role="tablist"][aria-label="Sections"] [role="tab"]').length,
      pickerTablist: document.querySelectorAll('[role="tablist"][aria-label="Icon type"] [role="tab"]').length,
      invalidControl: invalidControl ? (invalidControl.id || invalidControl.outerHTML.slice(0, 80)) : null,
    };
  `);
  assert.equal(audit.labelled, true, `unlabelled control: ${audit.invalidControl}`);
  assert.equal(audit.firstFocusable, true);
  assert.equal(audit.skipHref, '#main');
  assert.ok(audit.liveRegions >= 2, 'toast + status line');
  assert.ok(audit.progressbars >= 2, 'build + world progress bars');
  assert.equal(audit.tablist, 3);
  assert.equal(audit.pickerTablist, 2, 'icon picker tabs also expose the tab pattern');

  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog").open === true');
  const dialog = await page().evaluate(`
    const el = document.querySelector('#world-dialog');
    return { open: el.open, modal: el.matches(':modal'), name: el.querySelector('h2')?.textContent.trim() };
  `);
  assert.deepEqual(dialog, { open: true, modal: true, name: 'New World' });
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#world-dialog").open === false');
});
test('24 a11y: keyboard focus ring is visible on the first control', async () => {
  await reset();
  await page().evaluate('document.body.focus(); window.scrollTo(0, 0); return true;');
  await page().press('Tab', { code: 'Tab', keyCode: 9 });
  const focus = await page().evaluate(`
    const el = document.activeElement;
    const css = getComputedStyle(el);
    return {
      className: el.className,
      tag: el.tagName,
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
      outlineColor: css.outlineColor,
    };
  `);
  assert.equal(focus.className, 'skip-link', JSON.stringify(focus));
  assert.notEqual(focus.outlineStyle, 'none', JSON.stringify(focus));
  assert.notEqual(focus.outlineWidth, '0px', JSON.stringify(focus));
});
test('25 responsive: 390px has no horizontal overflow and collapses columns', async () => {
  await reset();
  await page().setViewport(390, 900);
  await page().click('#tab-materials');
  await page().waitFor('true');
  const layout = await page().evaluate(`
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      gotHidden: getComputedStyle(document.querySelector('#world-material-body .got-col')).display === 'none',
      progressHidden: getComputedStyle(document.querySelector('#world-material-body .progress-col')).display === 'none',
    };
  `);
  assert.ok(layout.scrollWidth <= layout.innerWidth + 1, `overflow: ${layout.scrollWidth} > ${layout.innerWidth}`);
  assert.equal(layout.gotHidden, true, 'Got column collapses');
  assert.equal(layout.progressHidden, true, 'Progress column collapses');
  await page().screenshot(path.join(EVIDENCE, '05-mobile-390.png'));
  await page().clearViewport();
});

/* --------------------------------------------------------- 12. visual contract */
test('26 visual contract: Minecraft GUI tokens, square corners, pixel font, high-resolution item renders', async () => {
  await reset();
  const style = await page().evaluate(`
    const panel = getComputedStyle(document.querySelector('.panel'));
    const button = getComputedStyle(document.querySelector('.mc-btn'));
    const body = getComputedStyle(document.body);
    const icon = document.querySelector('.slot img');
    const avatar = document.querySelector('.avatar img');
    return {
      panelBg: panel.backgroundColor,
      panelRadius: panel.borderRadius,
      buttonRadius: button.borderRadius,
      font: body.fontFamily,
      iconRendering: icon ? getComputedStyle(icon).imageRendering : 'no-icon',
      iconWidth: icon ? icon.naturalWidth : 0,
      iconHeight: icon ? icon.naturalHeight : 0,
      iconDisplayWidth: icon ? getComputedStyle(icon).width : 'no-icon',
      avatarRendering: avatar ? getComputedStyle(avatar).imageRendering : 'no-avatar',
      avatarWidth: avatar ? avatar.naturalWidth : 0,
      masthead: document.querySelector('.masthead__title').textContent,
    };
  `);
  assert.equal(style.panelBg, 'rgb(198, 198, 198)', 'GUI grey #c6c6c6');
  assert.equal(style.panelRadius, '0px', 'square corners');
  assert.equal(style.buttonRadius, '0px');
  assert.match(style.font, /Pixelify/);
  assert.equal(style.iconRendering, 'auto', '256px item renders are downscaled smoothly, not pixel-doubled');
  assert.equal(style.iconWidth, 256, 'icons are the game\'s 256×256 inventory renders');
  assert.equal(style.iconHeight, 256);
  assert.equal(style.iconDisplayWidth, '22px', 'material slots still show a 22px icon');
  assert.equal(style.avatarRendering, 'auto', 'avatar renders are downscaled smoothly');
  assert.equal(style.avatarWidth, 256, 'avatars use the same high-resolution renders');
  assert.equal(style.masthead, 'Build Tracker');
});

/* ---------------------------------------------------------------- 13. hygiene */
test('27 identity: a world can take an item icon from the picker', async () => {
  await reset();
  await page().click('#btn-new-world');
  await page().waitFor('document.querySelector("#world-dialog").open === true');
  await page().fill('#world-name', 'Icon World');
  await page().click('#world-icon-change');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().fill('#icon-search', 'oak log');
  await page().waitFor('document.querySelectorAll("#icon-grid .icon-tile").length === 2');
  await page().click('#icon-grid [data-icon-slug="oak_log"]');
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  assert.equal(await page().attr('#world-icon img', 'src'), 'assets/icons/oak_log.png', 'dialog preview');
  await page().click('#world-save');
  await page().waitFor('document.querySelector("#world-dialog").open === false');
  await page().waitFor('document.querySelector("#world-avatar img") !== null');
  assert.equal(await page().attr('#world-avatar img', 'src'), 'assets/icons/oak_log.png', 'topbar avatar');
  await page().reload();
  await page().waitFor('document.querySelector("#world-avatar img") !== null');
  assert.equal(await page().attr('#world-avatar img', 'src'), 'assets/icons/oak_log.png', 'persists');
  const state = await appState();
  assert.deepEqual(state.worlds.find((world) => world.name === 'Icon World').icon, { kind: 'item', slug: 'oak_log' });
});

test('28 identity: a build created with an icon shows it in the list and the detail', async () => {
  await reset();
  await page().click('#btn-new-build');
  await page().waitFor('document.querySelector("#build-dialog").open === true');
  await page().fill('#build-dlg-name', 'Icon Tower');
  await page().click('#build-dlg-icon-change');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().fill('#icon-search', 'diamond');
  await page().click('#icon-grid [data-icon-slug="diamond"]');
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  await page().click('#build-dialog button[type="submit"]:not([formnovalidate])');
  await page().waitFor('document.querySelector("#detail-heading").textContent === "Icon Tower"');
  assert.equal(await page().attr('#detail-avatar img', 'src'), 'assets/icons/diamond.png', 'detail avatar');
  const rowIcon = await page().evaluate(`
    const row = Array.from(document.querySelectorAll('.build-entry')).find((entry) => entry.textContent.includes('Icon Tower'));
    return row.querySelector('.avatar img').getAttribute('src');
  `);
  assert.equal(rowIcon, 'assets/icons/diamond.png', 'build row avatar');
  await page().reload();
  await page().waitFor('document.querySelectorAll(".build-entry").length >= 4');
  // A reload resets the selection to the first build, so select the new one like a user would.
  await page().evaluate(`
    const row = Array.from(document.querySelectorAll('.build-entry')).find((entry) => entry.textContent.includes('Icon Tower'));
    row.click();
    return true;
  `);
  await page().waitFor('document.querySelector("#detail-heading").textContent === "Icon Tower"');
  assert.equal(await page().attr('#detail-avatar img', 'src'), 'assets/icons/diamond.png', 'persists');
});

test('29 identity: the detail avatar changes and removes the build icon', async () => {
  await reset();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().fill('#icon-search', 'glass');
  await page().click('#icon-grid [data-icon-slug="glass"]');
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  await page().waitFor('document.querySelector("#detail-avatar img[src$=\'glass.png\']") !== null');
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().click('#icon-grid [data-icon-none]');
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#detail-avatar .avatar__letter") !== null');
  assert.equal(await page().text('#detail-avatar .avatar__letter'), 'I', 'letter fallback');
  const state = await appState();
  assert.equal(state.worlds[0].builds[0].icon, undefined, 'icon removed from the model');
});

test('30 identity: an uploaded image is cropped, stored inline and survives reload', async () => {
  await reset();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().click('#icon-tab-image');
  await page().upload('#icon-file', path.join(ROOT, 'src', 'assets', 'icons', 'diamond.png'));
  await poll(async () => page().evaluate(`
    const img = document.querySelector('#icon-preview img');
    return !!img && img.getAttribute('src').startsWith('data:image/');
  `));
  const preview = await page().evaluate(`
    const img = document.querySelector('#icon-preview img');
    return { prefix: img.getAttribute('src').slice(0, 22), width: img.naturalWidth };
  `);
  assert.match(preview.prefix, /^data:image\//);
  assert.equal(preview.width, 128, 'downscaled to 128x128');
  await page().click('#icon-use');
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  const stored = await appState();
  const icon = stored.worlds[0].builds[0].icon;
  assert.equal(icon.kind, 'image');
  assert.match(icon.dataUrl, /^data:image\//);
  assert.ok(icon.dataUrl.length <= 120000, 'data URL within the model cap');
  await page().reload();
  await poll(async () => page().evaluate(`
    const img = document.querySelector('#detail-avatar img');
    return !!img && img.getAttribute('src').startsWith('data:image/') && img.naturalWidth === 128;
  `));
});

test('31 identity: a non-image upload is refused and changes nothing', async () => {
  await reset();
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().click('#icon-tab-image');
  const note = tmpFile('note.txt', 'this is not an image');
  await page().upload('#icon-file', note);
  await poll(async () => page().evaluate('return !document.querySelector("#icon-error").hidden || !document.querySelector("#toast").hidden;'));
  assert.match(await page().text('#icon-error'), /Use a PNG, JPEG or WebP image/);
  const state = await appState();
  assert.deepEqual(state.worlds[0].builds[0].icon, { kind: 'item', slug: 'iron_ingot' }, 'state untouched');
  await page().click('#icon-cancel');
});

test('32 identity: picker search filters and Escape restores focus', async () => {
  await reset();
  await page().evaluate('document.querySelector("#detail-avatar").focus(); return true;');
  await page().click('#detail-avatar');
  await page().waitFor('document.querySelector("#icon-dialog").open === true');
  await page().fill('#icon-search', 'stone');
  await poll(async () => (await page().count('#icon-grid .icon-tile')) >= 2);
  const names = await page().evaluate(`
    return Array.from(document.querySelectorAll('#icon-grid .icon-tile[data-icon-slug] .icon-tile__name'))
      .map((node) => node.textContent.trim());
  `);
  assert.ok(names.every((name) => /stone/i.test(name)), names.join(', '));
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#icon-search").value === ""');
  assert.equal(await page().exists('#icon-dialog[open]'), true, 'first Escape clears the query');
  await page().press('Escape', { code: 'Escape', keyCode: 27 });
  await page().waitFor('document.querySelector("#icon-dialog").open === false');
  assert.equal(await page().evaluate('return document.activeElement.id;'), 'detail-avatar', 'focus returns to the trigger');
});

test('33 backdrop: the panorama is used when present and respects reduced motion', async () => {
  // Headless Chrome reports prefers-reduced-motion: reduce by default; assert the pan
  // under an explicit no-preference, then verify reduced motion freezes it.
  await page().emulateReducedMotion(false);
  await reset();
  await poll(async () => page().evaluate('return window.__backdrop !== undefined;'));
  const status = await page().evaluate(`
    const before = getComputedStyle(document.querySelector('.backdrop'), '::before');
    return {
      backdrop: window.__backdrop,
      hasClass: document.documentElement.classList.contains('has-panorama'),
      image: before.backgroundImage,
      animation: before.animationName,
      dirt: getComputedStyle(document.querySelector('.backdrop')).backgroundImage,
    };
  `);
  assert.ok(['panorama', 'dirt'].includes(status.backdrop));
  if (status.backdrop === 'dirt') {
    assert.equal(status.hasClass, false);
    assert.match(status.dirt, /dirt\.png/);
    return;
  }
  assert.equal(status.hasClass, true);
  assert.match(status.image, /backdrop\.webp/);
  assert.equal(status.animation, 'panorama-drift');
  await page().emulateReducedMotion(true);
  await page().reload();
  await poll(async () => page().evaluate('return window.__backdrop !== undefined;'));
  const reduced = await page().evaluate(`
    return getComputedStyle(document.querySelector('.backdrop'), '::before').animationName;
  `);
  assert.equal(reduced, 'none', 'prefers-reduced-motion stops the pan');
  await page().emulateReducedMotion(false);
});

test('34 backdrop: blocking the panorama falls back to dirt without errors', async () => {
  await reset();
  await poll(async () => page().evaluate('return window.__backdrop !== undefined;'));
  const initial = await page().evaluate('return window.__backdrop;');
  await page().blockUrls(['*assets/panorama/backdrop.webp*']);
  await page().reload();
  await poll(async () => page().evaluate('return window.__backdrop === "dirt";'));
  const state = await page().evaluate(`
    return {
      hasClass: document.documentElement.classList.contains('has-panorama'),
      dirt: getComputedStyle(document.querySelector('.backdrop')).backgroundImage,
      before: getComputedStyle(document.querySelector('.backdrop'), '::before').backgroundImage,
    };
  `);
  assert.equal(state.hasClass, false);
  assert.match(state.dirt, /dirt\.png/);
  assert.ok(state.before === 'none' || state.before === '', 'panorama layer stays off');
  await page().unblockUrls();
  await page().reload();
  await poll(async () => page().evaluate('return window.__backdrop !== undefined;'));
  assert.equal(await page().evaluate('return window.__backdrop;'), initial, 'restored once reachable again');
});

test('35 identity: an icon whose texture is missing falls back to a letter', async () => {
  await reset();
  const stored = await appState();
  stored.worlds[0].builds[0].icon = { kind: 'item', slug: 'texture_not_extracted' };
  await page().evaluate(`localStorage.setItem('mc-build-tracker:v1', ${JSON.stringify(JSON.stringify(stored))}); return true;`);
  await page().reload();
  await poll(async () => page().evaluate('return !!document.querySelector(".build-entry__identity .avatar__letter");'));
  assert.equal(await page().text('.build-entry__identity .avatar__letter'), 'I');
});

test('36 no console errors or uncaught exceptions across the whole suite', async () => {
  assert.deepEqual(app.consoleErrors, [], app.consoleErrors.join('\n'));
});
