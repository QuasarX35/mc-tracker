/**
 * Unit tests for the build-tracker domain model (兵部, EDICT-0005).
 * The model is a classic script (file:// support), so it is loaded into a vm
 * context rather than imported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MODEL_PATH = path.resolve(import.meta.dirname, '..', '..', 'src', 'tracker', 'model.js');
const SOURCE = fs.readFileSync(MODEL_PATH, 'utf8');

function loadModel(extraGlobals = {}) {
  const sandbox = { console, ...extraGlobals };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: MODEL_PATH });
  return sandbox.TrackerModel;
}

const M = loadModel();
const plain = (value) => JSON.parse(JSON.stringify(value));

test('emptyState has schema version and no worlds', () => {
  const state = M.emptyState();
  assert.equal(state.version, M.SCHEMA);
  assert.deepEqual(plain(state.worlds), []);
  assert.equal(state.activeWorldId, null);
});

test('createWorld validates a name and sets the first world active', () => {
  let state = M.emptyState();
  const failed = M.createWorld(state, { name: '   ' });
  assert.ok(failed.error);
  assert.equal(failed.state, state);

  const created = M.createWorld(state, { name: '  Survival  ', edition: 'java', version: '1.21.4' });
  state = created.state;
  assert.equal(state.worlds.length, 1);
  assert.equal(state.worlds[0].name, 'Survival');
  assert.equal(state.activeWorldId, state.worlds[0].id);
  assert.deepEqual(plain(state.worlds[0].builds), []);
});

test('createWorld is pure: the input state is not mutated', () => {
  const state = M.emptyState();
  M.createWorld(state, { name: 'A' });
  assert.equal(state.worlds.length, 0);
});

test('builds require a world and a name, and default to planned', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  assert.ok(M.createBuild(state, 'nope', { name: 'X' }).error);
  assert.ok(M.createBuild(state, worldId, { name: ' ' }).error);

  const created = M.createBuild(state, worldId, { name: 'Iron Farm', coords: '1 2 3' });
  state = created.state;
  assert.equal(state.worlds[0].builds[0].status, 'planned');
  assert.equal(created.build.name, 'Iron Farm');
});

test('addMaterial merges duplicate items instead of duplicating rows', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const buildId = build.build.id;

  state = M.addMaterial(state, worldId, buildId, { item: 'Stone', needed: 10, collected: 2 }).state;
  state = M.addMaterial(state, worldId, buildId, { item: 'stone', needed: 5, collected: 1 }).state;

  const materials = state.worlds[0].builds[0].materials;
  assert.equal(materials.length, 1);
  assert.equal(materials[0].needed, 15);
  assert.equal(materials[0].collected, 3);
});

test('addMaterial rejects empty names and non-positive quantities', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: '', needed: 1 }).error);
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: 'X', needed: 0 }).error);
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: 'X', needed: -4 }).error);
});

test('collected above needed is allowed but clamped in progress and aggregation', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const added = M.addMaterial(state, worldId, build.build.id, { item: 'Glass', needed: 64, collected: 100 });
  state = added.state;
  const material = state.worlds[0].builds[0].materials[0];

  const progress = M.materialProgress(material);
  assert.equal(progress.collected, 64);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.done, true);

  const rows = M.aggregateWorld(state.worlds[0]);
  assert.equal(rows[0].collected, 64);
  assert.equal(rows[0].remaining, 0);
});

test('updateMaterial clamps needed at 1 for the whole stepper range', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = M.addMaterial(build.state, worldId, build.build.id, { item: 'Stone', needed: 5 }).state;
  const buildId = build.build.id;
  const materialId = state.worlds[0].builds[0].materials[0].id;
  const needed = () => state.worlds[0].builds[0].materials[0].needed;
  const set = (value) => {
    state = M.updateMaterial(state, worldId, buildId, materialId, { needed: value }).state;
    return needed();
  };

  // The six step buttons (+1, +10, +stack, -1, -10, -stack) must be pure arithmetic on needed.
  assert.equal(set(5 + 1), 6);
  assert.equal(set(6 + 10), 16);
  assert.equal(set(16 + 64), 80);
  assert.equal(set(80 - 1), 79);
  assert.equal(set(79 - 10), 69);
  assert.equal(set(69 - 64), 5);

  // The floor is 1: a -stack step from 1 must never store 0 or a negative needed.
  assert.equal(set(1 - 64), 1);
  assert.equal(set(0), 1);
  assert.equal(set(-12), 1);
  assert.equal(set(-1e6), 1);

  // A number input can hand over an empty string or unparsable text; both land on the floor.
  assert.equal(set('42'), 42);
  assert.equal(set(''), 1);
  assert.equal(set('abc'), 1);
  assert.equal(set(NaN), 1);

  // Unknown material ids are rejected without corrupting state.
  const missing = M.updateMaterial(state, worldId, buildId, 'nope', { needed: 9 });
  assert.ok(missing.error);
  assert.equal(missing.state, state);
});

test('updateBuild trims and limits the text the title and notes editors send', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const buildId = build.build.id;

  const renamed = M.updateBuild(state, worldId, buildId, { name: '  Nether   Hub  ' });
  assert.equal(renamed.build.name, 'Nether Hub');
  const blank = M.updateBuild(state, worldId, buildId, { name: '   ' });
  assert.ok(blank.error);
  assert.equal(blank.state, state);

  const coords = M.updateBuild(state, worldId, buildId, { coords: '  120  64  -30 ' });
  assert.equal(coords.build.coords, '120 64 -30');
  const notes = M.updateBuild(state, worldId, buildId, { notes: '  roof first, then villagers  ' });
  assert.equal(notes.build.notes, 'roof first, then villagers');

  // The editors do not enforce JS lengths themselves: the model slices at the documented caps.
  const longName = M.updateBuild(state, worldId, buildId, { name: 'n'.repeat(80) });
  assert.equal(longName.build.name.length, 64);
  const longCoords = M.updateBuild(state, worldId, buildId, { coords: 'c'.repeat(50) });
  assert.equal(longCoords.build.coords.length, 32);
  const longNotes = M.updateBuild(state, worldId, buildId, { notes: 'x'.repeat(500) });
  assert.equal(longNotes.build.notes.length, 400);
});

test('aggregateWorld sums the same item across builds and names the builds', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const one = M.createBuild(state, worldId, { name: 'Farm' });
  state = one.state;
  const two = M.createBuild(state, worldId, { name: 'Hall' });
  state = two.state;
  state = M.addMaterial(state, worldId, one.build.id, { item: 'Stone Bricks', needed: 100, collected: 40 }).state;
  state = M.addMaterial(state, worldId, two.build.id, { item: 'stone bricks', needed: 50, collected: 10 }).state;
  state = M.addMaterial(state, worldId, two.build.id, { item: 'Oak Planks', needed: 20, collected: 20 }).state;

  const rows = M.aggregateWorld(state.worlds[0]);
  const bricks = rows.find((row) => row.item.toLowerCase() === 'stone bricks');
  assert.equal(bricks.needed, 150);
  assert.equal(bricks.collected, 50);
  assert.equal(bricks.remaining, 100);
  assert.deepEqual(plain(bricks.builds).sort(), ['Farm', 'Hall']);
  // gathered items sort after outstanding ones
  assert.equal(rows[rows.length - 1].done, true);
});

test('worldSummary and globalSummary roll up numbers consistently', () => {
  const state = M.seedState();
  const world = state.worlds[0];
  const summary = M.worldSummary(world);
  assert.equal(summary.builds, world.builds.length);
  assert.equal(summary.needed, summary.collected + summary.remaining);

  const global = M.globalSummary(state);
  assert.equal(global.builds, state.worlds.reduce((n, w) => n + w.builds.length, 0));
  assert.ok(global.needed >= summary.needed);
  assert.equal(global.byStatus.done, global.byStatus.done);
});

test('deleteWorld removes its builds and repoints the active world', () => {
  let state = M.seedState();
  const first = state.worlds[0];
  const second = state.worlds[1];
  state = M.deleteWorld(M.setActiveWorld(state, first.id).state, first.id).state;
  assert.equal(state.worlds.length, 1);
  assert.equal(state.activeWorldId, second.id);
  assert.ok(!M.findWorld(state, first.id));
});

test('deleteBuild removes only that build; unknown ids are rejected', () => {
  const state = M.seedState();
  const world = state.worlds[0];
  const buildId = world.builds[0].id;
  const next = M.deleteBuild(state, world.id, buildId).state;
  assert.equal(next.worlds[0].builds.length, world.builds.length - 1);
  assert.ok(M.deleteBuild(state, world.id, 'missing').error);
});

test('export/import round-trips, and import rejects foreign or corrupt data', () => {
  const state = M.seedState();
  const text = M.exportJSON(state);
  const imported = M.importJSON(text);
  assert.ok(!imported.error);
  assert.deepEqual(plain(imported.state), plain(state));

  assert.ok(M.importJSON('not json').error);
  assert.ok(M.importJSON('{"version":1}').error);
  const wrongVersion = M.importJSON(JSON.stringify({ version: 99, worlds: [] }));
  assert.ok(wrongVersion.error);
});

test('validate catches invalid status, quantities and missing ids', () => {
  const state = M.seedState();
  state.worlds[0].builds[0].status = 'nonsense';
  state.worlds[0].builds[0].materials[0].needed = 0;
  const errors = M.validate(state);
  assert.ok(errors.length >= 2);
});

test('load/save round-trips through a storage adapter and reports failures', () => {
  const storage = M.memoryStorage();
  const state = M.seedState();
  assert.equal(M.save(storage, state).ok, true);
  const loaded = M.load(storage);
  assert.deepEqual(plain(loaded.state), plain(state));

  const broken = { getItem: () => '{bad json' };
  assert.ok(M.load(broken).error);
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.ok(M.save(full, state).error);
});

test('cleanNotes keeps the block structure but tidies each line (D4)', () => {
  assert.equal(M.cleanNotes('  roof first, then villagers  '), 'roof first, then villagers');
  // line breaks survive: notes are the one multi-line field
  assert.equal(M.cleanNotes('Roof first.\nThen villagers.'), 'Roof first.\nThen villagers.');
  // CRLF and lone CR are normalised to LF
  assert.equal(M.cleanNotes('a\r\nb\rc'), 'a\nb\nc');
  // runs of spaces/tabs inside a line collapse; edge blank lines and trailing spaces go
  assert.equal(M.cleanNotes('\n\n  Wall   of\tbricks  \n\n\nTowers later  \n  \n'), 'Wall of bricks\n\nTowers later');
  // the cap applies to the whole block, and trailing whitespace never survives it
  assert.equal(M.cleanNotes('x'.repeat(500)).length, 400);
  const cappedBlock = M.cleanNotes(Array(200).fill('line').join('\n'));
  assert.ok(cappedBlock.length <= 400);
  assert.equal(cappedBlock.split('\n').length, 80);
  assert.ok(!/[ \t\n]$/.test(cappedBlock));
  assert.equal(M.cleanNotes('abc  '), 'abc');
  assert.equal(M.cleanNotes(null), '');
  assert.equal(M.cleanNotes(undefined), '');
});

test('stepNeeded is signed arithmetic with a floor of 1 (D5)', () => {
  assert.equal(M.stepNeeded(5, 1), 6);
  assert.equal(M.stepNeeded(6, 10), 16);
  assert.equal(M.stepNeeded(16, 64), 80);
  assert.equal(M.stepNeeded(80, -1), 79);
  assert.equal(M.stepNeeded(79, -10), 69);
  assert.equal(M.stepNeeded(69, -64), 5);
  // never below one, whatever the input type
  assert.equal(M.stepNeeded(1, -64), 1);
  assert.equal(M.stepNeeded(0, -1), 1);
  assert.equal(M.stepNeeded('', -10), 1);
  assert.equal(M.stepNeeded('12', 10), 22);
  assert.equal(M.stepNeeded(NaN, 1), 1);
  assert.equal(M.stepNeeded(5, '1'), 6);
  assert.equal(M.stepNeeded(5, '-1'), 4);
});

test('stackSizeFor resolves the item stack size from the published catalog (D5)', () => {
  const stacks = { stone: 64, egg: 16, water_bucket: 1, bucket: 16, diamond_sword: 1 };
  assert.equal(M.stackSizeFor('stone', stacks), 64);
  assert.equal(M.stackSizeFor('egg', stacks), 16);
  assert.equal(M.stackSizeFor('water_bucket', stacks), 1);
  assert.equal(M.stackSizeFor('bucket', stacks), 16);
  assert.equal(M.stackSizeFor('diamond_sword', stacks), 1);
  // unknown slugs and malformed values fall back to 64, never to 0/NaN
  assert.equal(M.stackSizeFor('unknown_block', stacks), 64);
  assert.equal(M.stackSizeFor('egg'), 64);
  assert.equal(M.stackSizeFor(undefined), 64);
  assert.equal(M.stackSizeFor('stone', { stone: 0 }), 64);
  assert.equal(M.stackSizeFor('stone', { stone: 'nonsense' }), 64);
  // the default catalog is read from the generator's global when no map is passed
  assert.equal(M.stackSizeFor('stone'), 64);
  const withGlobal = loadModel({ MC_ICON_STACKS: { stone: 64, egg: 16, water_bucket: 1 } });
  assert.equal(withGlobal.stackSizeFor('egg'), 16);
  assert.equal(withGlobal.stackSizeFor('water_bucket'), 1);
  assert.equal(withGlobal.stackSizeFor('red_concrete'), 64);
});

test('updateBuild stores multi-line notes while name and coords stay single-line', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const buildId = build.build.id;

  const notes = M.updateBuild(state, worldId, buildId, { notes: '  Roof first.\r\n\r\nThen   villagers.  ' });
  assert.equal(notes.build.notes, 'Roof first.\n\nThen villagers.');
  assert.equal(notes.build.notes.split('\n').length, 3);
  const empty = M.updateBuild(notes.state, worldId, buildId, { notes: '   ' });
  assert.equal(empty.build.notes, '');
});

test('seedState is self-consistent and useful as a demo', () => {
  const state = M.seedState();
  assert.ok(state.worlds.length >= 2);
  assert.deepEqual(plain(M.validate(state)), []);
  const survival = state.worlds[0];
  assert.ok(survival.builds.length >= 3);
  assert.ok(M.worldSummary(survival).materials >= 6);
  assert.equal(state.activeWorldId, survival.id);
});

test('an uploaded image icon commits to a build and survives save/load (D7)', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  state = M.createBuild(state, worldId, { name: 'B' }).state;
  const buildId = state.worlds[0].builds[0].id;

  // 128px WebP data URL, the shape processImageFile() produces.
  const dataUrl = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4T' + 'BAAAAAwAAMwA=';
  const result = M.setBuildIcon(state, worldId, buildId, { kind: 'image', dataUrl });
  assert.equal(result.error, undefined);
  assert.deepEqual(plain(result.build.icon), { kind: 'image', dataUrl });

  const storage = M.memoryStorage();
  assert.deepEqual(plain(M.save(storage, result.state)), { ok: true });
  const loaded = M.load(storage);
  assert.equal(loaded.error, undefined);
  assert.deepEqual(plain(loaded.state.worlds[0].builds[0].icon), { kind: 'image', dataUrl });

  // A malformed or oversized data URL is rejected instead of silently dropped.
  assert.ok(M.setBuildIcon(state, worldId, buildId, { kind: 'image', dataUrl: 'not-a-data-url' }).error);
});

