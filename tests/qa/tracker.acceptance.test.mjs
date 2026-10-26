/**
 * EDICT-0017 v2 amendment of independent acceptance tests (测试部, EDICT-0005).
 * v1 semantics retired with EDICT-0017: a material no longer carries `collected`; the stock lives
 * once per world in `world.inventory` and `M.allocate` gives each build its share. The browser
 * cases 97-128 cover the same behaviour end to end; these assertions stay computed here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const HTML = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const APP = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const MODEL = fs.readFileSync(path.join(SRC, 'tracker', 'model.js'), 'utf8');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(MODEL, sandbox, { filename: 'model.js' });
const M = sandbox.TrackerModel;
const plain = (value) => JSON.parse(JSON.stringify(value));
const slugOf = (item) => String(item || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

/* ------------------------------------------------------------- behaviour */

test('AC-1 seed data passes the model validator and has useful coverage', () => {
  const state = M.seedState();
  assert.deepEqual(plain(M.validate(state)), []);
  assert.ok(state.worlds.length >= 2, 'sample should include more than one world');
  for (const world of state.worlds) {
    assert.ok(world.builds.length >= 1, `world "${world.name}" should have a build`);
  }
  const survival = state.worlds[0];
  assert.ok(M.worldSummary(survival).materials >= 8, 'the demo world should show a real shopping list');
});

test('AC-2 shopping list is the sum of every build, computed independently here', () => {
  const state = M.seedState();
  const world = state.worlds[0];

  // independent expectation over the v2 shape: no per-material collected; one world inventory.
  const expected = new Map();
  for (const build of world.builds) {
    if (build.active === false) continue;
    for (const material of build.materials) {
      const key = material.item.trim().toLowerCase();
      const row = expected.get(key) || { needed: 0, builds: 0 };
      row.needed += Math.max(0, material.needed);
      row.builds += 1;
      expected.set(key, row);
    }
  }
  for (const [key, want] of expected) {
    const stock = Math.max(0, Number(world.inventory[slugOf(key)]) || 0);
    want.covered = Math.min(want.needed, stock);
    want.remaining = Math.max(0, want.needed - want.covered);
    want.pct = want.needed ? Math.round((want.covered / want.needed) * 100) : 0;
  }

  const rows = M.aggregateWorld(world);
  assert.equal(rows.length, expected.size);
  for (const row of rows) {
    const want = expected.get(row.item.toLowerCase());
    assert.ok(want, `unexpected row ${row.item}`);
    assert.equal(row.needed, want.needed, `needed for ${row.item}`);
    assert.equal(row.covered, want.covered, `covered for ${row.item}`);
    assert.equal(row.collected, want.covered, 'covered aliases the old collected read');
    assert.equal(row.remaining, want.remaining, `remaining for ${row.item}`);
    assert.equal(row.pct, want.pct);
    assert.equal(row.done, want.remaining === 0);
  }
});

test('AC-3 "left to collect" is never negative even when over-farmed', () => {
  let state = M.createWorld(M.emptyState(), { name: 'Overfarm' }).state;
  const world = state.worlds[0];
  const build = M.createBuild(state, world.id, { name: 'Wall' });
  state = build.state;
  state = M.addMaterial(state, world.id, build.build.id, { item: 'Dirt', needed: 10 }).state;
  /* EDICT-0017: the inventory is world-scoped, so the setter takes the world and returns it. */
  const stocked = M.setInventory(state.worlds[0], 'dirt', 999).world;
  state = Object.assign({}, state, {
    worlds: state.worlds.map((entry) => (entry.id === stocked.id ? stocked : entry)),
  });
  const world2 = state.worlds[0];
  const row = M.aggregateWorld(world2)[0];
  assert.equal(row.remaining, 0);
  assert.equal(row.done, true);
  assert.equal(row.covered, row.needed, 'over-farmed coverage caps at the need');
  assert.equal(M.worldSummary(world2).remaining, 0);
});

test('AC-4 a material added twice is one shopping-list row with summed quantities', () => {
  let state = M.createWorld(M.emptyState(), { name: 'Merge' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'Base' });
  state = build.state;
  state = M.addMaterial(state, worldId, build.build.id, { item: 'Oak Planks', needed: 64 }).state;
  state = M.addMaterial(state, worldId, build.build.id, { item: 'oak planks', needed: 32 }).state;
  const rows = M.aggregateWorld(state.worlds[0]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].needed, 96);
  assert.equal(rows[0].covered, 0, 'an empty inventory covers nothing until it is filled');
});

test('AC-5 deleting a world removes its builds and cannot leave a dangling active world', () => {
  let state = M.seedState();
  const doomed = state.worlds[0];
  state = M.deleteWorld(state, doomed.id).state;
  assert.ok(!M.findWorld(state, doomed.id));
  assert.ok(state.worlds.some((world) => world.id === state.activeWorldId));
  for (const world of state.worlds) {
    assert.ok(Array.isArray(world.builds));
  }
});

test('AC-6 backup round-trip preserves the whole state, and bad files are refused', () => {
  const state = M.seedState();
  const restored = M.importJSON(M.exportJSON(state));
  assert.ok(!restored.error);
  assert.deepEqual(plain(restored.state), plain(state));

  assert.ok(M.importJSON('{}').error, 'an empty object must be refused');
  assert.ok(M.importJSON('{"version":1,"worlds":[{"id":"x"}]}').error, 'worlds without builds must be refused');
  assert.ok(M.importJSON('[1,2,3]').error, 'an array is not a backup');
});

test('AC-7 browser storage failure is reported, not thrown', () => {
  const thrower = { getItem() { return '{"version":1,"worlds":[]}'; }, setItem() { throw new Error('quota'); } };
  assert.ok(M.save(thrower, M.emptyState()).error);
  const reader = { getItem() { throw new Error('denied'); } };
  assert.ok(M.load(reader).error);
});

/* -------------------------------------------------------------- contract */

test('AC-8 the page is offline-only: no remote fonts, scripts, styles or images', () => {
  const remote = /https?:\/\//g;
  for (const [name, text] of [['index.html', HTML], ['styles.css', CSS], ['app.js', APP], ['model.js', MODEL]]) {
    const hits = text.match(remote) || [];
    assert.deepEqual(hits, [], `${name} must not reference remote resources`);
  }
  assert.ok(!/@import\s+url/.test(CSS), 'CSS must not @import a remote stylesheet');
});

test('AC-9 every local asset referenced by the page exists on disk', () => {
  const refs = new Set();
  for (const match of HTML.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    if (!/^https?:/.test(match[1])) refs.add(match[1]);
  }
  for (const match of CSS.matchAll(/url\('([^']+)'\)/g)) refs.add(match[1]);
  assert.ok(refs.size >= 5, 'expected the page to reference styles, scripts, font, texture and favicon');
  for (const ref of refs) {
    const abs = path.resolve(SRC, ref);
    assert.ok(fs.existsSync(abs), `missing asset: ${ref}`);
  }
});

test('AC-10 icons come from the local client, are git-ignored, and degrade gracefully', () => {
  const iconsDir = path.join(SRC, 'assets', 'icons');
  const iconsJs = fs.readFileSync(path.join(iconsDir, 'icons.js'), 'utf8');
  const setMatch = /window\.MC_ICON_SET\s*=\s*(\[[^\]]*\])/.exec(iconsJs);
  assert.ok(setMatch, 'icons.js must declare window.MC_ICON_SET');
  const slugs = JSON.parse(setMatch[1]);
  assert.ok(slugs.length >= 1363, `EDICT-0013 opens the catalog: expected >= 1363 icons, found ${slugs.length}`);
  const namesMatch = /window\.MC_ICON_NAMES\s*=\s*([\[{][\s\S]*?[\]}])/.exec(iconsJs);
  assert.ok(namesMatch, 'icons.js must declare window.MC_ICON_NAMES');
  const names = JSON.parse(namesMatch[1]);
  if (Array.isArray(names)) {
    assert.equal(names.length, slugs.length, 'one display name per icon');
  } else {
    assert.equal(Object.keys(names).length, slugs.length, 'one display name per icon');
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(iconsDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.count, slugs.length);
  assert.equal(manifest.curated, 53, 'the curated 53 stay first in ordering');
  assert.equal(manifest.source.version, '1.21.4');
  assert.match(manifest.source.jar, /\.minecraft/, 'provenance must point at the local client install');
  assert.ok(
    ['hires-exports', 'jar-fallback'].includes(manifest.source.mode),
    'manifest must record which source mode produced the icons'
  );
  const highRes = manifest.source.mode === 'hires-exports';
  const pixels = highRes ? manifest.pixels : 16;
  if (highRes) {
    assert.ok(pixels >= 128, `high-resolution renders expected, got ${pixels}px`);
    assert.match(manifest.source.renderer, /IconExporter/, 'render provenance must name the exporter');
    assert.match(manifest.source.exports, /icon-exports/, 'render provenance must name the local export folder');
    assert.match(
      manifest.source.method,
      /256|inventory render/i,
      'method must describe the high-resolution inventory renders'
    );
    const correction = manifest.source.lighting_correction;
    assert.ok(correction && correction.applied === true, 'the 3D brightness correction must be recorded');
    assert.match(
      correction.reason,
      /IconExporter[\s\S]*PR #41/,
      'the correction must cite the upstream dark-lighting bug and its fix'
    );
    assert.equal(correction.target_vanilla_face_factors.top, 0.99, 'vanilla top-face brightness target');
    assert.ok(correction.gains.top > 1, 'the top face must be brightened');
    assert.ok(correction.gains.left > 1, 'the left face must be brightened');
    assert.ok(correction.gains.right < 1, 'the right face must be darkened back to the vanilla ratio');
    // EDICT-0013 F3: every icon carries a lighting class from the frozen enum.
    for (const icon of manifest.icons) {
      assert.ok(
        ['block', 'flat', '3d-other'].includes(icon.lighting),
        `${icon.slug}: lighting must be block|flat|3d-other (found '${icon.lighting}')`
      );
    }
    assert.ok(manifest.icons.some((icon) => icon.lighting === 'block'), 'full cubes take the 3D gain');
    assert.ok(manifest.icons.some((icon) => icon.lighting === 'flat'), 'flat sprites stay untouched');
  }

  // Licensing contract: the extractor and the filename manifest are committed; Mojang's
  // pixels are not. If this fails, the repo is redistributing game assets.
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /src\/assets\/icons\/\*\.png/, 'generated vanilla PNGs must be git-ignored');
  const provenance = fs.readFileSync(path.join(iconsDir, 'PROVENANCE.md'), 'utf8');
  assert.match(provenance, /Mojang/, 'licensing notice must name the rights holder');
  assert.match(provenance, /not[\s\S]{0,80}redistribut/i, 'notice must state no redistribution');
  assert.match(provenance, /NOT AN OFFICIAL MINECRAFT PRODUCT/);
  assert.match(HTML, /assets\/icons\/icons\.js/, 'the page must load the generated icon set');
  assert.match(APP, /MC_ICON_SET/, 'the app must use the generated icon set');
  assert.match(APP, /wireIconFallbacks/, 'missing icons must degrade to lettered slots, not broken images');

  const pngs = fs.readdirSync(iconsDir).filter((file) => file.endsWith('.png')).sort();
  if (!pngs.length) return; // fresh clone without the game: the manifest-only contract applies
  assert.equal(pngs.length, slugs.length, 'exactly one PNG per declared icon, no stale files');

  for (const icon of manifest.icons) {
    const buffer = fs.readFileSync(path.join(iconsDir, icon.image));
    assert.equal(buffer.readUInt32BE(16), pixels, `${icon.slug}: width`);
    assert.equal(buffer.readUInt32BE(20), pixels, `${icon.slug}: height`);
    assert.equal(icon.pixels, pixels, `${icon.slug}: per-icon pixel size must match the manifest`);
    if (highRes) {
      // The exporter names component-variant renders by appending the component's state to
      // the file name (e.g. minecraft__lingering_potion__{...}.png). The contract records the
      // render that produced the pixels, so a variant suffix is legitimate; the slug prefix
      // and the .png extension are what must be exact.
      assert.ok(
        icon.source.startsWith(`icon-exports-x256/minecraft__${icon.slug}`) && icon.source.endsWith('.png'),
        `${icon.slug}: source render path must be recorded (found ${icon.source})`
      );
    }
    assert.equal(buffer.toString('ascii', 1, 4), 'PNG', `${icon.slug}: PNG signature`);
    const digest = createHash('sha256').update(buffer).digest('hex');
    assert.equal(digest, icon.sha256, `${icon.slug}: hash must match the manifest`);
  }
});

test('AC-11 every control is labelled and no inline event handler ships', () => {
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const forTargets = new Set([...HTML.matchAll(/<label[^>]*\sfor="([^"]+)"/g)].map((match) => match[1]));

  const controls = [...HTML.matchAll(/<(input|select|textarea)\b([^>]*)>/g)];
  assert.ok(controls.length >= 15, `expected a form-rich app, found ${controls.length} controls`);
  for (const [, tag, attrs] of controls) {
    if (/\shidden\b/.test(attrs) || /type="hidden"/.test(attrs)) continue;
    const idMatch = /\sid="([^"]+)"/.exec(attrs);
    const aria = /\saria-label="[^"]+"/.test(attrs);
    const wrapped = new RegExp(`<label[^>]*>[^<]*<${tag}`).test(HTML);
    assert.ok((idMatch && forTargets.has(idMatch[1])) || aria || wrapped,
      `unlabelled <${tag}${idMatch ? '#' + idMatch[1] : ''}>`);
    assert.ok(ids.has(idMatch ? idMatch[1] : ''), `control id missing from document: ${idMatch && idMatch[1]}`);
  }
  assert.ok(!/\son(click|change|submit|input)=/i.test(HTML), 'no inline on* handlers (CSP-friendly)');
});

test('AC-12 app.js only touches element ids that exist in the document', () => {
  /* EDICT-0017: collectEls() caches every `[id]` in the document, so the invariant is that every
     id app.js *names* in an els[...] lookup exists in the shipped markup. */
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const queried = [...APP.matchAll(/els\['([a-z0-9-]+)'\]/g)].map((match) => match[1]);
  assert.ok(queried.length >= 100, `the app should name its elements explicitly (found ${queried.length})`);
  for (const id of new Set(queried)) assert.ok(ids.has(id), `app.js uses els['${id}'] but the HTML has no such element`);
  assert.match(APP, /function collectEls\(\)[\s\S]*querySelectorAll\('\[id\]'\)/,
    'collectEls must cache every id in the document');
});

test('AC-13 the UI is a single-screen app with tabs, one h1 and a skip link', () => {
  assert.equal((HTML.match(/<h1\b/g) || []).length, 1, 'exactly one h1');
  assert.match(HTML, /<html lang="en"/);
  assert.match(HTML, /role="tablist"/);
  assert.equal((HTML.match(/class="tab"/g) || []).length, 3, 'three section tabs');
  assert.equal((HTML.match(/id="view-/g) || []).length >= 3, true, 'the three section panels exist');
  assert.equal((HTML.match(/role="tabpanel"/g) || []).length, 3, 'three section tabpanels (compact view is not a tabpanel)');
  assert.equal((HTML.match(/class="picker-tab/g) || []).length, 0, 'the redundant icon-picker tabs are gone (D7)');
  assert.ok(!HTML.includes('id="icon-tab-item"') && !HTML.includes('id="icon-tab-image"'),
    'the Item/Image picker buttons must be removed, not hidden');
  assert.match(HTML, /class="skip-link" href="#main"/);
  assert.match(HTML, /<main[^>]*id="main"/);
  for (const match of HTML.matchAll(/<(img)\b([^>]*)>/g)) {
    assert.ok(/\salt="[^"]*"/.test(match[2]), 'images need an alt attribute (empty if decorative)');
  }
});

test('AC-14 pixel-art contract: no rounded corners, no blur, local bitmap font', () => {
  assert.ok(!/border-radius/.test(CSS), 'Minecraft GUI is square: no border-radius anywhere');
  assert.match(CSS, /image-rendering:\s*pixelated/);
  assert.match(CSS, /@font-face/);
  assert.ok(!/@import/.test(CSS), 'the bundled font must not be fetched from a CDN');
  assert.match(CSS, /--mc-panel/);
  assert.match(CSS, /--mc-xp/);
});

test('AC-15 accessibility affordances are present in the shipped CSS and markup', () => {
  assert.match(CSS, /:focus-visible/);
  assert.match(CSS, /prefers-reduced-motion/);
  assert.match(HTML, /aria-live="polite"/, 'status/toast must be announced');
  assert.match(HTML, /role="progressbar"/);
  assert.match(HTML, /aria-valuenow/);
  assert.match(HTML, /aria-selected="true"/);
});

/* regression for QA finding D1 (cycle 1): the demo seed silently lost a material */
test('AC-16 seed regression: the Iron Farm keeps all four materials including Stone Bricks', () => {
  const state = M.seedState();
  const farm = state.worlds[0].builds.find((build) => /iron farm/i.test(build.name));
  assert.ok(farm, 'demo seed should contain the Iron Farm build');
  assert.equal(farm.materials.length, 4, 'regression: a dropped addMaterial() left only three rows');
  const bricks = farm.materials.find((material) => material.item === 'Stone Bricks');
  assert.ok(bricks, 'regression: Stone Bricks vanished from the demo seed');
  assert.equal(bricks.needed, 384);
  assert.equal(bricks.collected, undefined, 'EDICT-0017 moved the stock to the world inventory');
  assert.equal(state.worlds[0].inventory.stone_bricks, 200, 'the demo world holds the 200 Stone Bricks');
});

/* EDICT-0013 F1: the frozen DOM contract exists in the shipped markup before the browser suite
   can test it. EDICT-0017 retired the per-build collector and the stepper; the frozen names now
   list the v2 controls (contract-0017 §3). */
test('AC-17 the EDICT-0013 controls are present under their frozen names', () => {
  for (const id of [
    'build-rename', 'build-name', 'build-name-save', 'build-name-cancel',
    'build-coords', 'copy-coords',
    'notes-text', 'notes-edit', 'build-notes', 'notes-save', 'notes-cancel',
    'mat-choice', 'mat-choice-slot', 'mat-choice-name', 'mat-item', 'mat-needed', 'mat-error',
    'icon-dialog', 'icon-dialog-title', 'icon-search', 'icon-grid', 'icon-file', 'icon-upload',
    'icon-count-hint', 'icon-preview', 'icon-use', 'icon-cancel',
    'inventory-dialog', 'inv-absolute', 'inv-delta', 'inv-error', 'inv-ok', 'inv-cancel',
    'paste-preview', 'paste-rows', 'paste-errors', 'paste-ok', 'paste-cancel',
    'mat-toolbar', 'mat-sort', 'mat-hide-done', 'mat-view-table', 'mat-view-grid',
  ]) {
    assert.match(HTML, new RegExp(`id="${id}"`), `missing frozen control #${id}`);
  }
  const matItem = /<input[^>]*id="mat-item"[^>]*>/.exec(HTML);
  assert.ok(matItem, '#mat-item must stay in the DOM (the submit handler reads it)');
  assert.match(matItem[0], /type="hidden"/, '#mat-item is a hidden value input now (D8)');
  assert.match(HTML, /id="mat-error"[^>]*role="alert"/, 'the add-material error must be announced inline');
  assert.match(HTML, /id="mat-needed"[^>]*type="number"/, 'the add form keeps the numeric Needed field');
  assert.match(APP, /MC_ICON_STACKS/, 'the app must consume the per-item stack table');
  assert.match(APP, /data-mat-update/, 'the row Update button is rendered by the app');
  assert.ok(!/data-stepper-step/.test(APP), 'the stepper buttons are retired (EDICT-0017 §2)');
  assert.ok(!/data-step="/.test(APP), 'the retired data-step literals are gone (EDICT-0016 §2)');
  assert.ok(!/renderItemOptions/.test(APP), 'the datalist render path is retired (D8)');
  assert.ok(!HTML.includes('item-options'), 'the #item-options datalist must be gone');
  assert.ok(!HTML.includes('id="mat-collected"'), 'the per-build collected input is retired (EDICT-0017 §3)');
  assert.ok(!HTML.includes('id="tile-dialog"'), 'the second dialog is retired (EDICT-0017 §3)');
});
