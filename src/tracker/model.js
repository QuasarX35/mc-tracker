/**
 * Minecraft Build Tracker — domain model (EDICT-0005).
 *
 * Classic script on purpose: the app must open from `file://` with a double click,
 * where ES modules are blocked by CORS. Tests load this file into a `node:vm`
 * context and drive the exported `TrackerModel` object, so the logic is still
 * unit-testable without a bundler or a DOM.
 *
 * State shape (schema version 1):
 * {
 *   version: 1,
 *   activeWorldId: string|null,
 *   worlds: [{
 *     id, name, edition: 'java'|'bedrock', version, notes, createdAt,
 *     builds: [{ id, name, status: 'planned'|'building'|'done', coords, notes,
 *                materials: [{ id, item, needed, collected }] }]
 *   }]
 * }
 */
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var STORAGE_KEY = 'mc-build-tracker:v1';
  var STATUSES = ['planned', 'building', 'done'];

  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function cleanText(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function toInt(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function emptyState() {
    return { version: SCHEMA, activeWorldId: null, worlds: [] };
  }

  /* ------------------------------- lookups ------------------------------- */

  function findWorld(state, worldId) {
    for (var i = 0; i < state.worlds.length; i += 1) {
      if (state.worlds[i].id === worldId) return state.worlds[i];
    }
    return null;
  }

  function findBuild(world, buildId) {
    if (!world) return null;
    for (var i = 0; i < world.builds.length; i += 1) {
      if (world.builds[i].id === buildId) return world.builds[i];
    }
    return null;
  }

  function activeWorld(state) {
    return findWorld(state, state.activeWorldId) || state.worlds[0] || null;
  }

  /* -------------------------------- worlds -------------------------------- */

  function createWorld(state, input) {
    var next = clone(state);
    var name = cleanText(input && input.name, 48);
    if (!name) return { error: 'A world needs a name.', state: state };
    var world = {
      id: uid('world'),
      name: name,
      edition: (input && input.edition) === 'bedrock' ? 'bedrock' : 'java',
      version: cleanText(input && input.version, 24) || '1.21',
      notes: cleanText(input && input.notes, 240),
      createdAt: nowIso(),
      builds: []
    };
    next.worlds.push(world);
    if (!next.activeWorldId) next.activeWorldId = world.id;
    return { state: next, world: world };
  }

  function updateWorld(state, worldId, patch) {
    var next = clone(state);
    var world = findWorld(next, worldId);
    if (!world) return { error: 'Unknown world.', state: state };
    if (patch.name !== undefined) {
      var name = cleanText(patch.name, 48);
      if (!name) return { error: 'A world needs a name.', state: state };
      world.name = name;
    }
    if (patch.edition !== undefined) world.edition = patch.edition === 'bedrock' ? 'bedrock' : 'java';
    if (patch.version !== undefined) world.version = cleanText(patch.version, 24);
    if (patch.notes !== undefined) world.notes = cleanText(patch.notes, 240);
    return { state: next, world: world };
  }

  function deleteWorld(state, worldId) {
    var next = clone(state);
    var before = next.worlds.length;
    next.worlds = next.worlds.filter(function (w) { return w.id !== worldId; });
    if (next.worlds.length === before) return { error: 'Unknown world.', state: state };
    if (next.activeWorldId === worldId) next.activeWorldId = next.worlds.length ? next.worlds[0].id : null;
    return { state: next };
  }

  function setActiveWorld(state, worldId) {
    if (!findWorld(state, worldId)) return { error: 'Unknown world.', state: state };
    var next = clone(state);
    next.activeWorldId = worldId;
    return { state: next };
  }

  /* -------------------------------- builds -------------------------------- */

  function createBuild(state, worldId, input) {
    var next = clone(state);
    var world = findWorld(next, worldId);
    if (!world) return { error: 'Unknown world.', state: state };
    var name = cleanText(input && input.name, 64);
    if (!name) return { error: 'A build needs a name.', state: state };
    var build = {
      id: uid('build'),
      name: name,
      status: STATUSES.indexOf(input && input.status) >= 0 ? input.status : 'planned',
      coords: cleanText(input && input.coords, 32),
      notes: cleanText(input && input.notes, 400),
      materials: []
    };
    world.builds.push(build);
    return { state: next, build: build };
  }

  function updateBuild(state, worldId, buildId, patch) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    if (patch.name !== undefined) {
      var name = cleanText(patch.name, 64);
      if (!name) return { error: 'A build needs a name.', state: state };
      build.name = name;
    }
    if (patch.status !== undefined && STATUSES.indexOf(patch.status) >= 0) build.status = patch.status;
    if (patch.coords !== undefined) build.coords = cleanText(patch.coords, 32);
    if (patch.notes !== undefined) build.notes = cleanText(patch.notes, 400);
    return { state: next, build: build };
  }

  function deleteBuild(state, worldId, buildId) {
    var next = clone(state);
    var world = findWorld(next, worldId);
    if (!world) return { error: 'Unknown world.', state: state };
    var before = world.builds.length;
    world.builds = world.builds.filter(function (b) { return b.id !== buildId; });
    if (world.builds.length === before) return { error: 'Unknown build.', state: state };
    return { state: next };
  }

  /* ------------------------------- materials ------------------------------ */

  function addMaterial(state, worldId, buildId, input) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    var item = cleanText(input && input.item, 48);
    if (!item) return { error: 'A material needs an item name.', state: state };
    var needed = toInt(input && input.needed);
    if (needed < 1) return { error: 'Needed must be at least 1.', state: state };
    var existing = build.materials.filter(function (m) {
      return m.item.toLowerCase() === item.toLowerCase();
    })[0];
    if (existing) {
      next = updateMaterial(next, worldId, buildId, existing.id, {
        needed: existing.needed + needed,
        collected: existing.collected + toInt(input && input.collected)
      }).state;
      return { state: next };
    }
    build.materials.push({
      id: uid('mat'),
      item: item,
      needed: needed,
      collected: Math.min(needed, toInt(input && input.collected))
    });
    return { state: next };
  }

  function updateMaterial(state, worldId, buildId, materialId, patch) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    var material = null;
    for (var i = 0; i < build.materials.length; i += 1) {
      if (build.materials[i].id === materialId) material = build.materials[i];
    }
    if (!material) return { error: 'Unknown material.', state: state };
    if (patch.item !== undefined) {
      var item = cleanText(patch.item, 48);
      if (!item) return { error: 'A material needs an item name.', state: state };
      material.item = item;
    }
    if (patch.needed !== undefined) material.needed = Math.max(1, toInt(patch.needed));
    if (patch.collected !== undefined) material.collected = toInt(patch.collected);
    // Collected can exceed needed (a player over-farms); the shopping list clamps it.
    return { state: next, material: material };
  }

  function deleteMaterial(state, worldId, buildId, materialId) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    var before = build.materials.length;
    build.materials = build.materials.filter(function (m) { return m.id !== materialId; });
    if (build.materials.length === before) return { error: 'Unknown material.', state: state };
    return { state: next };
  }

  /* ------------------------------ aggregation ----------------------------- */

  function materialProgress(material) {
    var collected = Math.min(material.collected, material.needed);
    return {
      needed: material.needed,
      collected: collected,
      rawCollected: material.collected,
      remaining: Math.max(0, material.needed - collected),
      pct: material.needed ? Math.round((collected / material.needed) * 100) : 0,
      done: collected >= material.needed
    };
  }

  /**
   * Shopping list for a world: one row per item, summed across every build,
   * with the builds that need it so the player knows why it is on the list.
   */
  function aggregateWorld(world) {
    if (!world) return [];
    var byItem = {};
    world.builds.forEach(function (build) {
      build.materials.forEach(function (material) {
        var key = material.item.toLowerCase();
        if (!byItem[key]) {
          byItem[key] = { item: material.item, needed: 0, collected: 0, builds: [], materialIds: [] };
        }
        var row = byItem[key];
        row.needed += material.needed;
        row.collected += Math.min(material.collected, material.needed);
        if (row.builds.indexOf(build.name) < 0) row.builds.push(build.name);
        row.materialIds.push(material.id);
      });
    });
    return Object.keys(byItem).map(function (key) {
      var row = byItem[key];
      row.remaining = Math.max(0, row.needed - row.collected);
      row.pct = row.needed ? Math.round((row.collected / row.needed) * 100) : 0;
      row.done = row.remaining === 0;
      return row;
    }).sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.item.localeCompare(b.item);
    });
  }

  /** Whole-world roll-up: builds by status, materials, progress. */
  function worldSummary(world) {
    var summary = {
      builds: 0,
      byStatus: { planned: 0, building: 0, done: 0 },
      materials: 0,
      needed: 0,
      collected: 0,
      remaining: 0,
      pct: 0
    };
    if (!world) return summary;
    world.builds.forEach(function (build) {
      summary.builds += 1;
      summary.byStatus[build.status] = (summary.byStatus[build.status] || 0) + 1;
      build.materials.forEach(function (material) {
        summary.materials += 1;
        summary.needed += material.needed;
        summary.collected += Math.min(material.collected, material.needed);
      });
    });
    summary.remaining = Math.max(0, summary.needed - summary.collected);
    summary.pct = summary.needed ? Math.round((summary.collected / summary.needed) * 100) : 0;
    return summary;
  }

  /** Cross-world roll-up for the "all worlds" view. */
  function globalSummary(state) {
    var total = worldSummary(null);
    state.worlds.forEach(function (world) {
      var s = worldSummary(world);
      total.builds += s.builds;
      total.materials += s.materials;
      total.needed += s.needed;
      total.collected += s.collected;
      ['planned', 'building', 'done'].forEach(function (k) { total.byStatus[k] += s.byStatus[k]; });
    });
    total.remaining = Math.max(0, total.needed - total.collected);
    total.pct = total.needed ? Math.round((total.collected / total.needed) * 100) : 0;
    return total;
  }

  /* ----------------------------- persistence ------------------------------ */

  function validate(state) {
    var errors = [];
    if (!state || state.version !== SCHEMA) errors.push('Unsupported data version.');
    if (!state || !Array.isArray(state.worlds)) return errors.concat('worlds must be an array');
    state.worlds.forEach(function (world) {
      if (!world.id || !world.name) errors.push('A world is missing id or name.');
      if (!Array.isArray(world.builds)) errors.push('World ' + world.name + ' has no builds array.');
      (world.builds || []).forEach(function (build) {
        if (!build.id || !build.name) errors.push('A build in ' + world.name + ' is missing id or name.');
        if (STATUSES.indexOf(build.status) < 0) errors.push('Build ' + build.name + ' has an unknown status.');
        (build.materials || []).forEach(function (material) {
          if (!material.id || !material.item) errors.push('A material in ' + build.name + ' is missing id or item.');
          if (!(material.needed >= 1)) errors.push('Material ' + material.item + ' needs at least 1.');
          if (!(material.collected >= 0)) errors.push('Material ' + material.item + ' has a negative collected count.');
        });
      });
    });
    return errors;
  }

  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { error: 'That is not valid JSON.' };
    }
    var errors = validate(parsed);
    if (errors.length) return { error: 'That file is not a tracker backup: ' + errors[0] };
    var state = clone(parsed);
    state.version = SCHEMA;
    if (!state.activeWorldId || !findWorld(state, state.activeWorldId)) {
      state.activeWorldId = state.worlds.length ? state.worlds[0].id : null;
    }
    return { state: state };
  }

  function memoryStorage() {
    var data = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function (k, v) { data[k] = String(v); },
      removeItem: function (k) { delete data[k]; }
    };
  }

  function load(storage) {
    var store = storage || root.localStorage;
    try {
      var raw = store && store.getItem(STORAGE_KEY);
      if (!raw) return { state: null };
      var imported = importJSON(raw);
      if (imported.error) return { error: imported.error };
      return { state: imported.state };
    } catch (err) {
      return { error: 'Could not read saved data: ' + err.message };
    }
  }

  function save(storage, state) {
    var store = storage || root.localStorage;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (err) {
      return { error: 'Could not save: ' + err.message };
    }
  }

  /* -------------------------------- sample -------------------------------- */

  function seedState() {
    var state = emptyState();
    state = createWorld(state, {
      name: 'Survival SMP',
      edition: 'java',
      version: '1.21.4',
      notes: 'Main long-term survival world. Keep the base at spawn tidy.'
    }).state;
    var survival = state.worlds[0];
    var ironFarm = createBuild(state, survival.id, {
      name: 'Iron Farm (spawn)',
      status: 'building',
      coords: '120 / 64 / -40',
      notes: 'Village-based farm, 3 modules. Needs to be roofed before the next storm.'
    });
    state = ironFarm.state;
    var storageRoom = createBuild(state, survival.id, {
      name: 'Storage Hall',
      status: 'planned',
      coords: '0 / 62 / 30',
      notes: 'Double chest wall, sorting for 20 item types.'
    });
    state = storageRoom.state;
    var netherHub = createBuild(state, survival.id, {
      name: 'Nether Hub',
      status: 'planned',
      coords: '8 / 70 / 8',
      notes: 'Four tunnels + ice road later; start with the portal room.'
    });
    state = netherHub.state;

    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Stone Bricks', needed: 384, collected: 200 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Iron Ingot', needed: 64, collected: 0 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Glass', needed: 96, collected: 96 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Torch', needed: 32, collected: 12 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Oak Planks', needed: 512, collected: 64 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Crafting Table', needed: 12, collected: 0 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Stone Bricks', needed: 256, collected: 0 }).state;
    state = addMaterial(state, survival.id, netherHub.build.id, { item: 'Cobblestone', needed: 768, collected: 300 }).state;
    state = addMaterial(state, survival.id, netherHub.build.id, { item: 'Coal', needed: 128, collected: 128 }).state;

    var creative = createWorld(state, {
      name: 'Creative Flat',
      edition: 'bedrock',
      version: '1.21',
      notes: 'Testing redstone contraptions on a flat world.'
    });
    state = creative.state;
    var castle = createBuild(state, state.worlds[1].id, {
      name: 'Castle Wall',
      status: 'done',
      coords: '-200 / 70 / 0',
      notes: 'Wall is finished; towers are a separate build later.'
    });
    state = castle.state;
    state = addMaterial(state, state.worlds[1].id, castle.build.id, { item: 'Stone Bricks', needed: 1024, collected: 1024 }).state;
    state = addMaterial(state, state.worlds[1].id, castle.build.id, { item: 'Dirt', needed: 256, collected: 256 }).state;
    state.activeWorldId = state.worlds[0].id;
    return state;
  }

  var api = {
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    STATUSES: STATUSES,
    uid: uid,
    emptyState: emptyState,
    seedState: seedState,
    findWorld: findWorld,
    findBuild: findBuild,
    activeWorld: activeWorld,
    createWorld: createWorld,
    updateWorld: updateWorld,
    deleteWorld: deleteWorld,
    setActiveWorld: setActiveWorld,
    createBuild: createBuild,
    updateBuild: updateBuild,
    deleteBuild: deleteBuild,
    addMaterial: addMaterial,
    updateMaterial: updateMaterial,
    deleteMaterial: deleteMaterial,
    materialProgress: materialProgress,
    aggregateWorld: aggregateWorld,
    worldSummary: worldSummary,
    globalSummary: globalSummary,
    validate: validate,
    exportJSON: exportJSON,
    importJSON: importJSON,
    memoryStorage: memoryStorage,
    load: load,
    save: save
  };

  root.TrackerModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

