/**
 * Independent acceptance tests for the Minecraft Build Tracker (测试部, EDICT-0005).
 * Two layers:
 *  1. behaviour — the shipped model, driven through a vm context exactly as the app loads it;
 *  2. contract — static invariants of the shipped HTML/CSS/JS that the user relies on
 *     (offline, local assets, labelled controls, pixel-art rendering, square GUI).
 * Assertions are computed here, not copied from 兵部's unit suite.
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

  // independent expectation
  const expected = new Map();
  for (const build of world.builds) {
    for (const material of build.materials) {
      const key = material.item.trim().toLowerCase();
      const row = expected.get(key) || { needed: 0, collected: 0 };
      row.needed += material.needed;
      row.collected += Math.min(material.collected, material.needed);
      expected.set(key, row);
    }
  }

  const rows = M.aggregateWorld(world);
  assert.equal(rows.length, expected.size);
  for (const row of rows) {
    const want = expected.get(row.item.toLowerCase());
    assert.equal(row.needed, want.needed, `needed for ${row.item}`);
    assert.equal(row.collected, want.collected, `collected for ${row.item}`);
    assert.equal(row.remaining, want.needed - want.collected, `remaining for ${row.item}`);
    assert.equal(row.pct, Math.round((want.collected / want.needed) * 100));
  }
});

test('AC-3 "left to collect" is never negative even when over-farmed', () => {
  let state = M.createWorld(M.emptyState(), { name: 'Overfarm' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'Wall' });
  state = build.state;
  state = M.addMaterial(state, worldId, build.build.id, { item: 'Dirt', needed: 10, collected: 999 }).state;
  const row = M.aggregateWorld(state.worlds[0])[0];
  assert.equal(row.remaining, 0);
  assert.equal(row.done, true);
  assert.ok(M.worldSummary(state.worlds[0]).remaining >= 0);
});

test('AC-4 a material added twice is one shopping-list row with summed quantities', () => {
  let state = M.createWorld(M.emptyState(), { name: 'Merge' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'Base' });
  state = build.state;
  state = M.addMaterial(state, worldId, build.build.id, { item: 'Oak Planks', needed: 64, collected: 0 }).state;
  state = M.addMaterial(state, worldId, build.build.id, { item: 'oak planks', needed: 32, collected: 8 }).state;
  const rows = M.aggregateWorld(state.worlds[0]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].needed, 96);
  assert.equal(rows[0].collected, 8);
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
  assert.ok(slugs.length >= 40, `expected the real vanilla set, found ${slugs.length} icons`);
  const namesMatch = /window\.MC_ICON_NAMES\s*=\s*(\[[^\]]*\])/.exec(iconsJs);
  const names = JSON.parse(namesMatch[1]);
  assert.equal(names.length, slugs.length, 'one display name per icon');

  const manifest = JSON.parse(fs.readFileSync(path.join(iconsDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.count, slugs.length);
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
    for (const icon of manifest.icons) {
      assert.ok(
        ['faces', 'uniform', 'none'].includes(icon.lighting),
        `${icon.slug}: per-icon lighting treatment must be recorded`
      );
    }
    assert.ok(
      manifest.icons.some((icon) => icon.kind === 'prop') && manifest.icons.some((icon) => icon.kind === 'item'),
      'full cubes, 3D props and flat sprites must be distinguished'
    );
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
      assert.equal(
        icon.source,
        `icon-exports-x256/minecraft__${icon.slug}.png`,
        `${icon.slug}: source render path must be recorded`
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
  const ids = new Set([...HTML.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const arrayBlock = APP.split('var ids = [')[1].split('];')[0];
  const queried = [...arrayBlock.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]);
  assert.ok(queried.length >= 40, 'the app should cache its elements explicitly');
  for (const id of queried) assert.ok(ids.has(id), `app.js caches #${id} but the HTML has no such element`);
});

test('AC-13 the UI is a single-screen app with tabs, one h1 and a skip link', () => {
  assert.equal((HTML.match(/<h1\b/g) || []).length, 1, 'exactly one h1');
  assert.match(HTML, /<html lang="en"/);
  assert.match(HTML, /role="tablist"/);
  assert.equal((HTML.match(/class="tab"/g) || []).length, 3, 'three section tabs');
  assert.equal((HTML.match(/id="view-/g) || []).length, 3, 'three section panels');
  assert.equal((HTML.match(/class="picker-tab"/g) || []).length, 2, 'two picker tabs');
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
  assert.equal(bricks.collected, 200);
});

