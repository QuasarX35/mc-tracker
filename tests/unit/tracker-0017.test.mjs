// EDICT-0017 unit suite: v1 migration, shared inventory, priority allocation, units, deltas.
// Fixtures under tests/qa/edict-0017-fixtures/ are frozen by 測試部 (read-only here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const fixtures = path.join(repo, 'tests', 'qa', 'edict-0017-fixtures');

function loadModel() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of ['src/assets/icons/icons.js', 'src/tracker/model.js']) {
    vm.runInContext(readFileSync(path.join(repo, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.TrackerModel;
}

const M = loadModel();
const fixtureJSON = (name) => JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'));
const snapshot = (value) => JSON.parse(JSON.stringify(value));
const world = (state, id) => state.worlds.find((entry) => entry.id === id);
const byId = (builds) => builds.map((build) => build.id);

/* ------------------------------- constants ------------------------------- */

test('schema, storage keys and the round-5 constants', () => {
  assert.equal(M.SCHEMA, 2);
  assert.equal(M.STORAGE_KEY, 'mc-build-tracker:v2');
  assert.equal(M.V1_STORAGE_KEY, 'mc-build-tracker:v1');
  assert.equal(M.SHULKER_SLOTS, 27);
  assert.equal(M.ITEMS_PER_MINUTE, 30);
  assert.equal(M.DEFAULT_STACK, 64);
});

test('emptyState is a version 2 document', () => {
  const state = M.emptyState();
  assert.equal(state.version, 2);
  assert.deepEqual(snapshot(state.worlds), []);
  assert.deepEqual(snapshot(M.validate(state)), []);
});

/* ------------------------------- migration ------------------------------- */

test('migrateV1 sums collected per world and item, case-insensitively', () => {
  const input = fixtureJSON('v1-migration-state.json');
  const before = snapshot(input);
  const migrated = M.migrateV1(input);

  assert.equal(migrated.version, 2);
  assert.equal(migrated.migratedFrom, 1);
  assert.deepEqual(snapshot(migrated.worlds[0].inventory), { stone_bricks: 250, glass: 96, iron_ingot: 0 });
  assert.deepEqual(snapshot(migrated.worlds[1].inventory), { stone_bricks: 100 });
  // The frozen fixture must come out clean enough to validate, and must not be mutated.
  assert.deepEqual(snapshot(M.validate(migrated)), []);
  assert.deepEqual(snapshot(input), before);
});

test('migrateV1 drops the per-build collected count', () => {
  const migrated = M.migrateV1(fixtureJSON('v1-migration-state.json'));
  assert.equal(JSON.stringify(snapshot(migrated)).includes('"collected"'), false);
  migrated.worlds.forEach((entry) => {
    entry.builds.forEach((build) => {
      build.materials.forEach((material) => {
        assert.equal(material.collected, undefined);
        assert.ok(material.needed >= 1);
      });
    });
  });
});

test('migration clamps a malformed collected before validation', () => {
  // `"garbage"` sits next to a real 96; only the real count survives.
  const migrated = M.migrateV1(fixtureJSON('v1-migration-state.json'));
  assert.equal(migrated.worlds[0].inventory.glass, 96);
  const broken = snapshot(migrated);
  broken.worlds[0].builds[0].materials[0].needed = 0;
  const repaired = M.migrateV1({ version: 1, activeWorldId: 'x', worlds: [broken.worlds[0]] });
  assert.equal(repaired.worlds[0].builds[0].materials[0].needed, 1);
});

test('migrateV1 preserves build order, defaults active, and is idempotent', () => {
  const input = fixtureJSON('v1-migration-state.json');
  const once = M.migrateV1(input);
  const twice = M.migrateV1(once);
  const expected = input.worlds.map((entry) => byId(entry.builds));
  assert.deepEqual(snapshot(once.worlds.map((entry) => byId(entry.builds))), snapshot(expected));
  assert.deepEqual(snapshot(twice), snapshot(once));
  assert.deepEqual(snapshot(twice.worlds[0].inventory), snapshot(once.worlds[0].inventory));
  once.worlds.forEach((entry) => entry.builds.forEach((build) => assert.equal(build.active, true)));
});

test('a v1 document imports through importJSON once', () => {
  const result = M.importJSON(readFileSync(path.join(fixtures, 'v1-migration-state.json'), 'utf8'));
  assert.equal(result.error, undefined);
  assert.equal(result.state.version, 2);
  assert.equal(world(result.state, 'world-a').inventory.stone_bricks, 250);
});

test('load reads the v1 key once and never rewrites it', () => {
  const storage = M.memoryStorage();
  const raw = readFileSync(path.join(fixtures, 'v1-migration-state.json'), 'utf8');
  storage.setItem('mc-build-tracker:v1', raw);
  const loaded = M.load(storage);
  assert.equal(loaded.error, undefined);
  assert.equal(loaded.state.migratedFrom, 1);
  assert.equal(storage.getItem('mc-build-tracker:v1'), raw);
  assert.equal(storage.getItem('mc-build-tracker:v2'), null);
});

test('save writes v2 and drops migratedFrom so the notice shows once', () => {
  const storage = M.memoryStorage();
  const migrated = M.migrateV1(fixtureJSON('v1-migration-state.json'));
  M.save(storage, migrated);
  const stored = JSON.parse(storage.getItem('mc-build-tracker:v2'));
  assert.equal(stored.version, 2);
  assert.equal(stored.migratedFrom, undefined);
  const reloaded = M.load(storage);
  assert.equal(reloaded.state.migratedFrom, undefined);
});

/* ------------------------------ import/export ---------------------------- */

test('export keeps the top-level shape and version 2', () => {
  const state = M.migrateV1(fixtureJSON('v1-migration-state.json'));
  const parsed = JSON.parse(M.exportJSON(state));
  assert.equal(parsed.version, 2);
  // migratedFrom is the one optional extras key contract §1 allows (a one-shot notice).
  const keys = Object.keys(parsed).sort();
  assert.deepEqual(keys.filter((key) => key !== 'migratedFrom'), ['activeWorldId', 'version', 'worlds']);
  assert.equal(Array.isArray(parsed.worlds), true);
});

test('a v2 document carrying a top-level inventory is refused', () => {
  const state = snapshot(fixtureJSON('duplicate-allocation-state.json'));
  state.inventory = { stone_bricks: 10 };
  assert.notDeepEqual(M.validate(state), []);
  assert.ok(M.importJSON(JSON.stringify(state)).error);
});

test('a v2 material carrying collected is refused', () => {
  const state = snapshot(fixtureJSON('duplicate-allocation-state.json'));
  state.worlds[0].builds[0].materials[0].collected = 5;
  assert.ok(M.validate(state).some((line) => line.includes('collected')));
});

test('every frozen v2 fixture imports cleanly', () => {
  for (const name of ['duplicate-allocation-state.json', 'surplus-state.json', 'inactive-state.json']) {
    const result = M.importJSON(readFileSync(path.join(fixtures, name), 'utf8'));
    assert.equal(result.error, undefined, name);
    assert.equal(result.state.version, 2);
  }
});

test('a refused import leaves the caller data untouched', () => {
  const state = snapshot(fixtureJSON('duplicate-allocation-state.json'));
  const before = snapshot(state);
  assert.ok(M.importJSON('{"version": 9}').error);
  assert.ok(M.importJSON('not json').error);
  assert.deepEqual(snapshot(state), before);
});

/* ------------------------------- inventory ------------------------------- */

test('inventoryOf zero-fills every item the builds mention', () => {
  const state = M.migrateV1(fixtureJSON('v1-migration-state.json'));
  const inventory = M.inventoryOf(world(state, 'world-a'));
  assert.equal(inventory.stone_bricks, 250);
  assert.equal(inventory.glass, 96);
  assert.equal(inventory.iron_ingot, 0);
  assert.equal(typeof M.inventoryOf(null), 'object');
});

test('setInventory and addInventory clamp at zero and stay integers', () => {
  const base = world(fixtureJSON('duplicate-allocation-state.json'), 'w1');
  assert.equal(M.setInventory(base, 'stone_bricks', 999).world.inventory.stone_bricks, 999);
  assert.equal(M.setInventory(base, 'stone_bricks', -5).world.inventory.stone_bricks, 0);
  assert.equal(M.setInventory(base, 'stone_bricks', 12.7).world.inventory.stone_bricks, 12);
  assert.equal(M.addInventory(base, 'stone_bricks', 50).world.inventory.stone_bricks, 400);
  assert.equal(M.addInventory(base, 'stone_bricks', -10000).world.inventory.stone_bricks, 0);
  assert.equal(M.addInventory(base, 'glass', '2s').world.inventory.glass, 100);
});

/* ------------------------------- allocation ------------------------------ */

test('allocation fills the earlier build first and never double counts', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const alloc = M.allocate(world(state, 'w1'));

  assert.deepEqual(snapshot(alloc.slugs.stone_bricks), {
    inventory: 350, covered: 350, remaining: 150, surplus: 0, shared: 2
  });
  // Glass is needed twice inside b1 (96 + 32) and only once by anybody.
  assert.deepEqual(snapshot(alloc.slugs.glass), {
    inventory: 100, covered: 100, remaining: 28, surplus: 0, shared: 1
  });
  // The first build is fully covered, the second gets what is left.
  const b1 = M.buildProgress(alloc, 'b1');
  const b2 = M.buildProgress(alloc, 'b2');
  assert.equal(b1.remaining, 28);
  assert.equal(b2.covered, 50);
  assert.equal(b2.remaining, 150);
  assert.ok(alloc.perMaterial.m1 + alloc.perMaterial.m4 <= 350);
  assert.equal(alloc.perMaterial.m1, 300);
});

test('an inactive or finished build never steals stock', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const alloc = M.allocate(world(state, 'w1'));
  // b3 is `done` and `active: false`; it needs 50 but the rollup ignores it.
  assert.equal(M.buildProgress(alloc, 'b3').covered, 50); // complete, not allocated
  assert.equal(alloc.slugs.stone_bricks.covered, 350);
});

test('surplus is reported honestly and never as a negative remaining', () => {
  const state = fixtureJSON('surplus-state.json');
  const alloc = M.allocate(world(state, 'w1'));
  assert.equal(alloc.slugs.stone_bricks.inventory, 482);
  assert.equal(alloc.slugs.stone_bricks.covered, 97);
  assert.equal(alloc.slugs.stone_bricks.surplus, 385);
  assert.equal(alloc.slugs.stone_bricks.remaining, 0);
  Object.values(alloc.slugs).forEach((entry) => {
    assert.ok(entry.remaining >= 0);
    assert.ok(entry.surplus >= 0);
  });
});

test('a second build can consume the surplus away', () => {
  const state = snapshot(fixtureJSON('surplus-state.json'));
  const w1 = world(state, 'w1');
  const built = M.addMaterial({ version: 2, activeWorldId: 'w1', worlds: [w1] }, 'w1', 'b1', {
    item: 'Stone Bricks', needed: 386
  });
  assert.equal(built.error, undefined);
  const alloc = M.allocate(world(built.state, 'w1'));
  assert.equal(alloc.slugs.stone_bricks.surplus, 0);
});

test('inactive builds leave the rollup and their surplus shows', () => {
  const state = fixtureJSON('inactive-state.json');
  const alloc = M.allocate(world(state, 'w1'));
  assert.equal(alloc.slugs.stone_bricks.covered, 40);
  assert.equal(alloc.slugs.stone_bricks.remaining, 0);
  assert.equal(alloc.slugs.stone_bricks.surplus, 20);
  assert.equal(alloc.slugs.glass.covered, 10);
  // The paused barn is out of the priority race entirely.
  assert.equal(M.buildProgress(alloc, 'b2').covered, 0);
});

/* --------------------------------- text --------------------------------- */

test('progressText is the one sentence every panel prints', () => {
  assert.equal(M.progressText(213, 727), '213 / 727 items gathered (29%)');
  assert.equal(M.progressText(0, 0), '0 / 0 items gathered (0%)');
  assert.equal(M.progressText(96, 96), '96 / 96 items gathered (100%)');
  assert.equal(M.progressText(-5, 10), '0 / 10 items gathered (0%)');
  assert.equal(M.progressText(50, 10), '10 / 10 items gathered (100%)');
});

test('formatUnits covers items, stacks, shulkers and singular forms', () => {
  assert.equal(M.formatUnits(184, 'stone_bricks', 'items'), '184');
  assert.equal(M.formatUnits(184, 'stone_bricks', 'stacks'), '2 stacks + 56');
  assert.equal(M.formatUnits(64, 'stone_bricks', 'stacks'), '1 stack');
  assert.equal(M.formatUnits(20, 'stone_bricks', 'stacks'), '20');
  assert.equal(M.formatUnits(0, 'stone_bricks', 'stacks'), '0');
  // Ender pearls stack to 16, so a shulker of them is 432 — not 1,728.
  assert.equal(M.formatUnits(432, 'ender_pearl', 'shulkers'), '1 shulker');
  assert.equal(M.formatUnits(864, 'ender_pearl', 'shulkers'), '2 shulkers');
  assert.equal(M.formatUnits(-30, 'stone_bricks', 'stacks'), '0');
});

test('stackNotation is the tooltip form', () => {
  assert.equal(M.stackNotation(184, 'stone_bricks'), '184 = 2 stacks + 56');
  assert.equal(M.stackNotation(64, 'stone_bricks'), '64 = 1 stack');
  assert.equal(M.stackNotation(40, 'stone_bricks'), '40');
  assert.equal(M.stackNotation(432, 'ender_pearl', undefined, 'shulkers'), '432 = 1 shulker');
});

/* -------------------------------- deltas -------------------------------- */

test('parseRelative accepts every documented delta form', () => {
  assert.deepEqual(snapshot(M.parseRelative('64', 64)), { value: 64 });
  assert.deepEqual(snapshot(M.parseRelative('+64', 64)), { value: 64 });
  assert.deepEqual(snapshot(M.parseRelative('-32', 64)), { value: -32 });
  assert.deepEqual(snapshot(M.parseRelative('  -32  ', 64)), { value: -32 });
  assert.deepEqual(snapshot(M.parseRelative('0', 64)), { value: 0 });
  assert.deepEqual(snapshot(M.parseRelative('2s', 64)), { value: 128 });
  assert.deepEqual(snapshot(M.parseRelative('2st', 64)), { value: 128 });
  assert.deepEqual(snapshot(M.parseRelative('2 stacks', 64)), { value: 128 });
  assert.deepEqual(snapshot(M.parseRelative('-2s', 64)), { value: -128 });
  assert.deepEqual(snapshot(M.parseRelative('', 64)), { value: 0 });
  assert.deepEqual(snapshot(M.parseRelative('   ', 64)), { value: 0 });
  // The frozen oracle (case 111).
  assert.deepEqual(snapshot(M.parseRelative('2s+10', 64)), { value: 138 });
});

test('parseRelative rejects the frozen invalid inputs', () => {
  const fixture = fixtureJSON('invalid-delta-inputs.json');
  for (const entry of fixture.inputs) {
    const parsed = M.parseRelative(entry.text, fixture.stack);
    if (entry.expect === 'error') {
      assert.ok(parsed.error, entry.text);
      assert.equal(parsed.value, undefined);
    } else {
      assert.equal(parsed.value, entry.expect, entry.text);
    }
  }
});

test('stack sizes come from the catalogue, not a single global', () => {
  assert.equal(M.stackSizeFor('ender_pearl'), 16);
  assert.equal(M.stackSizeFor('water_bucket'), 1);
  assert.equal(M.stackSizeFor('stone_bricks'), 64);
  assert.equal(M.stackSizeFor('not_a_real_item'), 64);
});

/* ---------------------------- list operations ---------------------------- */

test('moveBuild reorders, clamps and persists the order', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const w1 = world(state, 'w1');
  assert.deepEqual(snapshot(byId(M.moveBuild(w1, 'b2', 0).world.builds)), ['b2', 'b1', 'b3']);
  assert.deepEqual(snapshot(byId(M.moveBuild(w1, 'b1', 99).world.builds)), ['b2', 'b3', 'b1']);
  assert.deepEqual(snapshot(byId(M.moveBuild(w1, 'b1', -4).world.builds)), ['b1', 'b2', 'b3']);
  assert.ok(M.moveBuild(w1, 'nope', 0).error);
});

test('setBuildActive pauses a build without touching the others', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const w1 = world(state, 'w1');
  const off = M.setBuildActive(w1, 'b1', false).world;
  assert.equal(off.builds[0].active, false);
  const alloc = M.allocate(off);
  assert.equal(alloc.slugs.stone_bricks.covered, 200); // only b2 (200) is still in the race
  assert.equal(alloc.slugs.stone_bricks.remaining, 0);
  assert.equal(alloc.slugs.glass, undefined); // glass belonged to the paused build only
  const on = M.setBuildActive(off, 'b1', true).world;
  assert.equal(on.builds[0].active, true);
});

test('shoppingList lists active builds only, biggest gap first', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const rows = M.shoppingList(world(state, 'w1'));
  assert.deepEqual(snapshot(rows.map((row) => row.slug)), ['stone_bricks', 'glass']);
  assert.equal(rows[0].remaining, 150);
  assert.deepEqual(snapshot(rows[0].builds), ['b1', 'b2']);
  assert.equal(rows[1].remaining, 28);
  rows.forEach((row) => assert.ok(row.remaining > 0));
});

/* ------------------------------- timestamps ------------------------------ */

test('stamps survive the round trip through v2', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const w1 = world(state, 'w1');
  assert.equal(M.formatStamp(w1.createdAt), '2026-09-14 08:05');
  assert.match(M.formatStamp(w1.updatedAt), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal(M.formatStamp('yesterday'), '\u2014');
});

test('a mutation dates the world and leaves createdAt alone', () => {
  const state = fixtureJSON('duplicate-allocation-state.json');
  const w1 = world(state, 'w1');
  const before = { createdAt: w1.createdAt, updatedAt: w1.updatedAt };
  const result = M.updateMaterial(
    { version: 2, activeWorldId: 'w1', worlds: [w1] }, 'w1', 'b1', 'm1', { needed: 301 }
  );
  assert.equal(result.error, undefined);
  const after = world(result.state, 'w1');
  assert.equal(after.createdAt, before.createdAt);
  assert.ok(after.updatedAt >= before.updatedAt);
  assert.equal(after.inventory.stone_bricks, 350); // allocation changed, stock did not
});


