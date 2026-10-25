/**
 * Unit tests for EDICT-0014's pure helpers (兵部):
 *   - the icon suggestion oracle (§8) against the frozen fixture file the browser cases use
 *   - the keyword table's catalogue integrity
 *   - `iconAuto` provenance on builds/worlds
 *   - the bulk paste parser (§5)
 * The model is a classic script (file:// support), so both it and icons.js are loaded into
 * a vm context instead of imported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MODEL_PATH = path.join(ROOT, 'src', 'tracker', 'model.js');
const ICONS_PATH = path.join(ROOT, 'src', 'assets', 'icons', 'icons.js');
const FIXTURES_PATH = path.join(ROOT, 'tests', 'qa', 'edict-0014-fixtures', 'suggestion-fixtures.json');

const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(ICONS_PATH, 'utf8'), sandbox, { filename: ICONS_PATH });
vm.runInContext(fs.readFileSync(MODEL_PATH, 'utf8'), sandbox, { filename: MODEL_PATH });

const M = sandbox.TrackerModel;
const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));
const CATALOG = { names: sandbox.MC_ICON_NAMES, order: sandbox.MC_ICON_SET };
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8')).fixtures;

function emptyBuild(name, extra = {}) {
  return { id: 'b-test', name, status: 'planned', coords: '', notes: '', materials: [], ...extra };
}

test('the catalogue is present and complete enough for the picker', () => {
  assert.ok(Array.isArray(sandbox.MC_ICON_SET));
  assert.ok(sandbox.MC_ICON_SET.length >= 1000, 'expected the full catalogue, got ' + sandbox.MC_ICON_SET.length);
  assert.equal(Object.keys(sandbox.MC_ICON_NAMES).length, sandbox.MC_ICON_SET.length);
  assert.equal(Object.keys(sandbox.MC_ICON_STACKS).length, sandbox.MC_ICON_SET.length);
});

for (const fixture of FIXTURES) {
  test('suggestion fixture: ' + fixture.id, () => {
    const result = M.suggestIcon(fixture.build, fixture.world, CATALOG);
    assert.deepEqual(plain(result), plain(fixture.expected));
  });
}

test('the two-argument form returns null by contract', () => {
  const fixture = FIXTURES[0];
  assert.equal(M.suggestIcon(fixture.build, fixture.world), null);
  assert.equal(M.suggestIcon(null, null, CATALOG), null);
});

test('every keyword in the frozen table names a real catalogue item', () => {
  const missing = M.SUGGEST_KEYWORDS
    .filter((row) => sandbox.MC_ICON_SET.indexOf(row[1]) < 0)
    .map((row) => row[0] + ' -> ' + row[1]);
  assert.equal(missing.length, 0, 'not in the catalogue: ' + missing.join(', '));
});

test('equal material counts fall back to catalogue order', () => {
  const catalog = { names: { alpha: 'Alpha Item', beta: 'Beta Item' }, order: ['alpha', 'beta'] };
  const build = emptyBuild('Shed', {
    materials: [
      { id: 'm1', item: 'Beta', needed: 5, collected: 0 },
      { id: 'm2', item: 'Alpha', needed: 5, collected: 0 }
    ]
  });
  const result = M.suggestIcon(build, { name: 'Survival' }, catalog);
  assert.equal(result.slug, 'alpha');
  assert.equal(result.reason, 'most of the materials are Alpha Item');
});

test('the material with the largest needed amount wins', () => {
  const catalog = { names: { alpha: 'Alpha Item', beta: 'Beta Item' }, order: ['alpha', 'beta'] };
  const build = emptyBuild('Shed', {
    materials: [
      { id: 'm1', item: 'Alpha', needed: 5, collected: 0 },
      { id: 'm2', item: 'Beta', needed: 500, collected: 0 }
    ]
  });
  assert.equal(M.suggestIcon(build, { name: 'Survival' }, catalog).slug, 'beta');
});

test('unknown materials are skipped, and the world icon is the last resort', () => {
  const catalog = { names: { stone: 'Stone' }, order: ['stone'] };
  const build = emptyBuild('Shed', { materials: [{ id: 'm1', item: 'Mystery Goo', needed: 900, collected: 0 }] });
  const world = { name: 'Survival', icon: { kind: 'item', slug: 'stone' } };
  const result = M.suggestIcon(build, world, catalog);
  assert.deepEqual(plain(result), { slug: 'stone', name: 'Stone', reason: 'came from the world icon' });
});

test('an uploaded (image) world icon cannot become an item suggestion', () => {
  const catalog = { names: { stone: 'Stone' }, order: ['stone'] };
  const build = emptyBuild('Shed');
  const world = { name: 'Survival', icon: { kind: 'image', dataUrl: 'data:image/png;base64,AAAA' } };
  assert.equal(M.suggestIcon(build, world, catalog), null);
});

test('the world name is scanned after the notes, and never the coords', () => {
  const catalog = { names: { netherrack: 'Netherrack', bookshelf: 'Bookshelf' }, order: ['netherrack', 'bookshelf'] };
  const world = { name: 'Nether Base' };
  assert.deepEqual(plain(M.suggestIcon(emptyBuild('Shed'), world, catalog)), {
    slug: 'netherrack',
    name: 'Netherrack',
    reason: 'matched "nether" in the world name'
  });
  const noted = emptyBuild('Shed', { notes: 'add a library' });
  assert.equal(M.suggestIcon(noted, world, catalog).slug, 'bookshelf');
  const coordsOnly = emptyBuild('Shed', { coords: '100 / 64 / 100' });
  assert.equal(M.suggestIcon(coordsOnly, { name: 'Survival' }, catalog), null);
});

test('iconAuto is an explicit provenance flag: setBuildIcon stores false on a manual pick', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const created = M.createBuild(state, worldId, { name: 'B' });
  state = created.state;
  const buildId = created.build.id;
  assert.equal(created.build.icon, null, 'a new build stores icon: null, never undefined');

  let applied = M.setBuildIcon(state, worldId, buildId, { kind: 'item', slug: 'stone' }, true);
  assert.equal(applied.build.iconAuto, true);
  assert.equal(M.validate(applied.state).length, 0, M.validate(applied.state).join('; '));

  /* EDICT-0014 §8: a manual pick must survive a later rename, so it stores `false`, not nothing. */
  applied = M.setBuildIcon(state, worldId, buildId, { kind: 'item', slug: 'stone' }, false);
  assert.equal(applied.build.iconAuto, false);

  applied = M.setBuildIcon(state, worldId, buildId, null);
  assert.equal(applied.build.icon, undefined);
  assert.equal(applied.build.iconAuto, undefined);

  const patched = M.updateBuild(state, worldId, buildId, {
    icon: { kind: 'item', slug: 'stone' }, iconAuto: true
  });
  assert.equal(patched.build.iconAuto, true);
  const cleared = M.updateBuild(patched.state, worldId, buildId, { iconAuto: false });
  assert.equal(cleared.build.iconAuto, undefined);

  const broken = plain(patched.state);
  broken.worlds[0].builds[0].iconAuto = 'yes';
  assert.ok(M.validate(broken).some((error) => /iconAuto/.test(error)));
});

test('iconAuto survives an export/import round trip', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W', icon: { kind: 'item', slug: 'stone' } }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  state = M.setBuildIcon(state, worldId, build.build.id, { kind: 'item', slug: 'stone' }, true).state;
  assert.equal(state.worlds[0].builds[0].iconAuto, true);

  const imported = M.importJSON(M.exportJSON(state));
  assert.equal(imported.error, undefined);
  assert.equal(imported.state.worlds[0].builds[0].iconAuto, true);
});

test('parseBulk reads every documented line form', () => {
  const parsed = M.parseBulk([
    '64 stone bricks',
    '- 32 glass',
    '+1 oak log',
    '20x oak log',
    '0 cobblestone',
    'mystery goo',
    '',
    '   '
  ].join('\n'), CATALOG);

  assert.equal(parsed.rows.length, 6);
  const [stone, glass, logOne, logTwenty, cobble, unknown] = parsed.rows;
  assert.equal(stone.name, 'Stone Bricks');
  assert.equal(stone.slug, 'stone_bricks');
  assert.equal(stone.qty, 64);
  assert.equal(stone.state, 'matched');
  assert.equal(glass.qty, 32);
  assert.equal(glass.state, 'matched');
  assert.equal(logOne.qty, 1);
  assert.equal(logTwenty.qty, 20);
  assert.equal(logOne.slug, logTwenty.slug);
  assert.equal(cobble.qty, 1, 'quantities clamp to at least 1');
  assert.equal(unknown.name, 'mystery goo');
  assert.equal(unknown.slug, null);
  assert.equal(unknown.state, 'unknown');
});

test('bulk rows merge into the build case-insensitively', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const created = M.createBuild(state, worldId, { name: 'B' });
  state = created.state;
  const buildId = created.build.id;

  const parsed = M.parseBulk('1 oak log\n20x oak log\n64 stone bricks', CATALOG);
  parsed.rows.filter((row) => row.state === 'matched').forEach((row) => {
    state = M.addMaterial(state, worldId, buildId, { item: row.name, needed: row.qty, collected: 0 }).state;
  });

  const materials = state.worlds[0].builds[0].materials;
  assert.equal(materials.length, 2);
  assert.equal(materials[0].item, 'Oak Log');
  assert.equal(materials[0].needed, 21);
  assert.equal(materials[1].needed, 64);
});

test('stack sizes resolve from the published catalogue', () => {
  assert.equal(M.stackSizeFor('stone', sandbox.MC_ICON_STACKS), 64);
  assert.equal(M.stackSizeFor('egg', sandbox.MC_ICON_STACKS), 16);
  assert.equal(M.stackSizeFor('water_bucket', sandbox.MC_ICON_STACKS), 1);
  assert.equal(M.stackSizeFor('something_unknown', sandbox.MC_ICON_STACKS), 64);
});

test('bulk paste accepts a unique prefix and refuses an ambiguous one', () => {
  const catalog = {
    names: { alpha_item: 'Alpha Item', beta_item: 'Beta Item', gamma: 'Gamma' },
    order: ['alpha_item', 'beta_item', 'gamma']
  };
  const unique = M.parseBulk('2 alph', catalog).rows;
  assert.equal(unique.length, 1);
  assert.equal(unique[0].slug, 'alpha_item');

  const ambiguous = M.parseBulk('1 item', catalog).rows;
  assert.equal(ambiguous[0].state, 'unknown');

  const tooShort = M.parseBulk('1 ga', catalog).rows;
  assert.equal(tooShort[0].state, 'unknown');

  const exactWins = M.parseBulk('1 gamma', catalog).rows;
  assert.equal(exactWins[0].slug, 'gamma');
});

test('bulk paste ignores blank lines and clamps quantity at one', () => {
  const rows = M.parseBulk('\n   \n0 cobblestone\n\n- 0 oak log\n', CATALOG).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].qty, 1);
  assert.equal(rows[1].qty, 1);
});
