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
 *                icon?, materials: [{ id, item, needed, collected }] }],
 *     icon?
 *   }]
 * }
 *
 * `icon` is optional and additive (EDICT-0010): either
 *   { kind: 'item',  slug: 'stone_bricks' }   // a locally extracted Minecraft icon
 *   { kind: 'image', dataUrl: 'data:image/webp;base64,...' }  // an uploaded image
 * so schema version 1 stays valid and older backups keep importing.
 */
(function (root) {
  'use strict';

  var SCHEMA = 1;
  var STORAGE_KEY = 'mc-build-tracker:v1';
  var STATUSES = ['planned', 'building', 'done'];

  /* ---------------------------------- icons --------------------------------- */
  /* Identity for worlds and builds (EDICT-0010). Images are stored inline so that
     a backup export stays self-contained; the size cap keeps localStorage sane. */
  var ICON_KINDS = ['item', 'image'];
  var ICON_SLUG_RE = /^[a-z0-9_]{1,64}$/;
  var ICON_DATA_URL_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
  var ICON_DATA_URL_MAX = 120000;

  function normalizeIcon(input) {
    if (input === null || input === undefined || input === '') return { icon: null };
    if (typeof input !== 'object') return { error: 'Icon must be an object.' };
    var kind = cleanText(input.kind, 8);
    if (ICON_KINDS.indexOf(kind) < 0) return { error: 'Unknown icon kind.' };
    if (kind === 'item') {
      var slug = cleanText(input.slug, 64);
      if (!ICON_SLUG_RE.test(slug)) return { error: 'Item icon slug is not valid.' };
      return { icon: { kind: 'item', slug: slug } };
    }
    var dataUrl = String(input.dataUrl == null ? '' : input.dataUrl);
    if (!ICON_DATA_URL_RE.test(dataUrl)) {
      return { error: 'Image icon must be a PNG, JPEG or WebP data URL.' };
    }
    if (dataUrl.length > ICON_DATA_URL_MAX) {
      return { error: 'Image icon is too large after resizing.' };
    }
    return { icon: { kind: 'image', dataUrl: dataUrl } };
  }

  /**
   * EDICT-0014 §8: `iconAuto` records that an icon came from a suggestion. Absence means
   * false, so only `true` is ever stored; clearing the icon clears the flag too.
   */
  function setIconAuto(target, auto) {
    if (!target) return;
    if (auto === true) target.iconAuto = true;
    else delete target.iconAuto;
  }

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

  /**
   * Notes are the one multi-line field: the block structure is kept (D4), but runs of
   * spaces and tabs inside a line collapse, each line loses its edges, blank lines at both
   * ends are dropped and the whole block is capped at `max` characters.
   */
  function cleanNotes(value, max) {
    var limit = typeof max === 'number' ? max : 400;
    var lines = String(value == null ? '' : value).replace(/\r\n?/g, '\n').split('\n');
    lines = lines.map(function (line) {
      return line.replace(/[ \t]+/g, ' ').replace(/^ +/, '').replace(/ +$/, '');
    });
    while (lines.length && !lines[0]) lines.shift();
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    var text = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    if (text.length > limit) text = text.slice(0, limit);
    return text.replace(/[ \t\n]+$/, '');
  }

  function toInt(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function toSignedInt(value) {
    var n = Number(value);
    return isFinite(n) ? Math.floor(n) : 0;
  }

  /**
   * One Needed stepper click (D5): `delta` is signed (+1, +10, +stack, -1, …) and the
   * result never drops below 1, matching updateMaterial's floor.
   */
  function stepNeeded(needed, delta) {
    return Math.max(1, toInt(needed) + toSignedInt(delta));
  }

  var DEFAULT_STACK = 64;

  /**
   * Maximum stack size for an item slug (D5): `stacks` defaults to the catalog the icon
   * generator publishes (`window.MC_ICON_STACKS`); an unknown or malformed entry falls back
   * to 64. Always a positive integer.
   */
  function stackSizeFor(slug, stacks) {
    var map = stacks || (root && root.MC_ICON_STACKS) || null;
    var key = String(slug == null ? '' : slug).trim().toLowerCase();
    var value = map && Object.prototype.hasOwnProperty.call(map, key) ? Number(map[key]) : NaN;
    if (!isFinite(value) || value < 1) return DEFAULT_STACK;
    return Math.floor(value);
  }

  /* ---------------------------- item identity ---------------------------- */

  /** "stone_bricks" -> "Stone Bricks"; the fallback display name for a catalogue slug. */
  function titleizeItem(slug) {
    return String(slug == null ? '' : slug).split('_').filter(Boolean).map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  /** "Stone Bricks" -> "stone_bricks"; the one normalisation materials and slugs share. */
  function itemSlug(item) {
    return String(item == null ? '' : item)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /* --------------------------- icon suggestions --------------------------- */

  /**
   * EDICT-0014 §8: the frozen keyword table (`.tmp/plan/suggestion-table.md`, 104 rows).
   * Each row is [keyword, slug, display name]. This list is DATA, not an algorithm:
   * `suggestIcon` only scans it, longest whole-word keyword first.
   */
  var SUGGEST_KEYWORDS = [
    ['iron', 'iron_block', 'Iron Block'], ['gold', 'gold_block', 'Gold Block'],
    ['copper', 'copper_block', 'Copper Block'], ['diamond', 'diamond_block', 'Diamond Block'],
    ['emerald', 'emerald_block', 'Emerald Block'], ['redstone', 'redstone_block', 'Redstone Block'],
    ['quartz', 'quartz_block', 'Quartz Block'], ['netherite', 'netherite_block', 'Netherite Block'],
    ['farm', 'wheat', 'Wheat'], ['crop', 'wheat', 'Wheat'], ['sugar', 'sugar_cane', 'Sugar Cane'],
    ['pumpkin', 'pumpkin', 'Pumpkin'], ['melon', 'melon', 'Melon'], ['bamboo', 'bamboo', 'Bamboo'],
    ['tree', 'oak_log', 'Oak Log'], ['wood', 'oak_log', 'Oak Log'], ['timber', 'oak_log', 'Oak Log'],
    ['log cabin', 'oak_log', 'Oak Log'], ['storage', 'chest', 'Chest'], ['warehouse', 'chest', 'Chest'],
    ['depot', 'chest', 'Chest'], ['silo', 'chest', 'Chest'], ['chest', 'chest', 'Chest'],
    ['hall', 'oak_planks', 'Oak Planks'], ['house', 'oak_planks', 'Oak Planks'],
    ['home', 'oak_planks', 'Oak Planks'], ['base', 'oak_planks', 'Oak Planks'],
    ['cabin', 'oak_planks', 'Oak Planks'], ['hut', 'oak_planks', 'Oak Planks'],
    ['tower', 'stone_bricks', 'Stone Bricks'], ['spire', 'stone_bricks', 'Stone Bricks'],
    ['keep', 'stone_bricks', 'Stone Bricks'], ['wall', 'stone_bricks', 'Stone Bricks'],
    ['rampart', 'stone_bricks', 'Stone Bricks'], ['fort', 'stone_bricks', 'Stone Bricks'],
    ['castle', 'stone_bricks', 'Stone Bricks'], ['fortress', 'stone_bricks', 'Stone Bricks'],
    ['bridge', 'stone_bricks', 'Stone Bricks'], ['aqueduct', 'stone_bricks', 'Stone Bricks'],
    ['mine', 'stone', 'Stone'], ['shaft', 'stone', 'Stone'], ['quarry', 'stone', 'Stone'],
    ['tunnel', 'stone', 'Stone'], ['nether', 'netherrack', 'Netherrack'],
    ['portal', 'obsidian', 'Obsidian'], ['blaze', 'blaze_rod', 'Blaze Rod'],
    ['wither', 'wither_skeleton_skull', 'Wither Skeleton Skull'],
    ['end island', 'end_stone', 'End Stone'], ['ender', 'ender_pearl', 'Ender Pearl'],
    ['shulker', 'shulker_box', 'Shulker Box'], ['bee', 'beehive', 'Beehive'],
    ['honey', 'honey_bottle', 'Honey Bottle'], ['enchant', 'enchanting_table', 'Enchanting Table'],
    ['library', 'bookshelf', 'Bookshelf'], ['books', 'bookshelf', 'Bookshelf'],
    ['smith', 'anvil', 'Anvil'], ['forge', 'anvil', 'Anvil'], ['anvil', 'anvil', 'Anvil'],
    ['brew', 'brewing_stand', 'Brewing Stand'], ['potion', 'brewing_stand', 'Brewing Stand'],
    ['village', 'cobblestone', 'Cobblestone'], ['villager', 'cobblestone', 'Cobblestone'],
    ['market', 'cobblestone', 'Cobblestone'], ['ship', 'oak_planks', 'Oak Planks'],
    ['dock', 'oak_planks', 'Oak Planks'], ['pier', 'oak_planks', 'Oak Planks'],
    ['harbour', 'oak_planks', 'Oak Planks'], ['boat', 'oak_boat', 'Oak Boat'],
    ['road', 'cobblestone', 'Cobblestone'], ['path', 'cobblestone', 'Cobblestone'],
    ['glass', 'glass', 'Glass'], ['greenhouse', 'glass', 'Glass'],
    ['terracotta', 'terracotta', 'Terracotta'], ['clay', 'clay', 'Clay'],
    ['wool', 'white_wool', 'White Wool'], ['sheep', 'white_wool', 'White Wool'],
    ['barn', 'wheat', 'Wheat'], ['lantern', 'lantern', 'Lantern'], ['lamp', 'lantern', 'Lantern'],
    ['lighting', 'torch', 'Torch'], ['torch', 'torch', 'Torch'], ['ladder', 'ladder', 'Ladder'],
    ['obsidian', 'obsidian', 'Obsidian'], ['prismarine', 'prismarine', 'Prismarine'],
    ['monument', 'prismarine', 'Prismarine'], ['guardian', 'prismarine', 'Prismarine'],
    ['brick', 'bricks', 'Bricks'], ['sandstone', 'sandstone', 'Sandstone'],
    ['desert', 'sandstone', 'Sandstone'], ['snow', 'snow_block', 'Snow Block'],
    ['ice', 'ice', 'Ice'], ['aquarium', 'water_bucket', 'Water Bucket'],
    ['rail', 'rail', 'Rail'], ['railway', 'rail', 'Rail'], ['minecart', 'minecart', 'Minecart'],
    ['bed', 'white_bed', 'White Bed'], ['kitchen', 'furnace', 'Furnace'],
    ['furnace', 'furnace', 'Furnace'], ['smelter', 'furnace', 'Furnace'],
    ['kiln', 'furnace', 'Furnace'], ['spawn', 'torch', 'Torch'], ['grinder', 'torch', 'Torch'],
    ['xp', 'experience_bottle', 'Experience Bottle'], ['trap', 'tripwire_hook', 'Tripwire Hook']
  ];

  function catalogNames(catalog) {
    return (catalog && catalog.names) || {};
  }

  function catalogOrder(catalog) {
    if (catalog && Array.isArray(catalog.order)) return catalog.order;
    var names = catalogNames(catalog);
    return Object.keys(names);
  }

  function catalogIndex(catalog, slug) {
    var order = catalogOrder(catalog);
    for (var i = 0; i < order.length; i += 1) if (order[i] === slug) return i;
    return -1;
  }

  function catalogName(catalog, slug, fallback) {
    var names = catalogNames(catalog);
    if (Object.prototype.hasOwnProperty.call(names, slug)) return String(names[slug]);
    return fallback || titleizeItem(slug);
  }

  /** Whole-word, case-insensitive keyword test; spaces in a keyword match any whitespace run. */
  function keywordHit(text, keyword) {
    if (!text) return false;
    var words = String(keyword).split(/\s+/).map(escapeRegExp).join('\\s+');
    return new RegExp('(^|[^a-z0-9_])' + words + '([^a-z0-9_]|$)', 'i').test(String(text));
  }

  /** The longest tabulated keyword present in `text` (ties keep table order). */
  function longestKeyword(text) {
    var best = null;
    for (var i = 0; i < SUGGEST_KEYWORDS.length; i += 1) {
      var row = SUGGEST_KEYWORDS[i];
      if (!keywordHit(text, row[0])) continue;
      if (!best || row[0].length > best[0].length) best = row;
    }
    return best;
  }

  function keywordSuggestion(row, where, catalog) {
    return {
      slug: row[1],
      name: catalogName(catalog, row[1], row[2]),
      reason: 'matched "' + row[0] + '" in the ' + where
    };
  }

  /**
   * EDICT-0014 §8 (frozen): the deterministic icon suggestion for a build.
   * `catalog` is `{ names: {slug: displayName}, order: [slug...] }` (an array of slugs is
   * also accepted). Pure and stable; the two-argument form returns null by contract.
   * Order: longest whole-word keyword in the name, then the notes, then the world name;
   * then the material with the largest `needed` (ties: catalogue order); then the world icon.
   */
  function suggestIcon(build, world, catalog) {
    if (!build || !catalog) return null;
    var hit = longestKeyword(build.name);
    if (hit) return keywordSuggestion(hit, 'name', catalog);
    hit = longestKeyword(build.notes);
    if (hit) return keywordSuggestion(hit, 'notes', catalog);
    hit = longestKeyword(world && world.name);
    if (hit) return keywordSuggestion(hit, 'world name', catalog);

    var best = null;
    (build.materials || []).forEach(function (material) {
      var slug = itemSlug(material && material.item);
      var index = catalogIndex(catalog, slug);
      if (index < 0) return;
      var needed = toInt(material && material.needed);
      if (!best || needed > best.needed || (needed === best.needed && index < best.index)) {
        best = { slug: slug, needed: needed, index: index };
      }
    });
    if (best) {
      return {
        slug: best.slug,
        name: catalogName(catalog, best.slug),
        reason: 'most of the materials are ' + catalogName(catalog, best.slug)
      };
    }

    var icon = world && world.icon;
    if (icon && icon.kind === 'item' && catalogIndex(catalog, icon.slug) >= 0) {
      return {
        slug: icon.slug,
        name: catalogName(catalog, icon.slug),
        reason: 'came from the world icon'
      };
    }
    return null;
  }

  /* ------------------------------ bulk paste ------------------------------ */

  var BULK_LINE = /^\s*([-+]?)\s*(\d+)?\s*(?:[x×]\s*)?(.+?)\s*$/;

  /**
   * EDICT-0014 §5: parse a pasted materials list into review rows.
   * Accepts `64 stone bricks`, `- 32 glass`, `+1 oak log`, `20x oak log`; blank lines are
   * skipped, quantities clamp to >= 1, names that are not in the catalogue stay as
   * `state: 'unknown'` so the dialog can list them without adding them.
   */
  function parseBulk(text, catalog) {
    var names = catalogNames(catalog);
    var byKey = {};
    catalogOrder(catalog).forEach(function (slug) {
      byKey[itemSlug(slug)] = slug;
      byKey[itemSlug(catalogName(catalog, slug))] = slug;
    });
    var rows = [];
    String(text == null ? '' : text).split(/\r\n?|\n/).forEach(function (line) {
      if (!line.trim()) return;
      var match = BULK_LINE.exec(line);
      var quantity = 1;
      var label = line.trim();
      if (match) {
        quantity = match[2] ? Number(match[2]) : 1;
        label = String(match[3] || '').trim();
      }
      if (!label) return;
      var key = itemSlug(label);
      var slug = byKey[key] || null;
      /* EDICT-0014 §5: when no exact name/slug matches, accept a unique >= 3 character prefix
         (so "oak log" still matches after a typo-free abbreviation like "oak lo"); an ambiguous
         prefix stays unmatched on purpose, because guessing a material is worse than asking. */
      if (!slug && key.length >= 3) {
        var prefixed = catalogOrder(catalog).filter(function (candidate) {
          return itemSlug(candidate).indexOf(key) === 0 ||
            itemSlug(catalogName(catalog, candidate)).indexOf(key) === 0;
        });
        if (prefixed.length === 1) slug = prefixed[0];
      }
      rows.push({
        raw: line.trim(),
        qty: Math.max(1, toInt(quantity)),
        name: slug ? catalogName(catalog, slug) : label,
        slug: slug,
        state: slug ? 'matched' : 'unknown'
      });
    });
    return { rows: rows };
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
    var normalizedIcon = normalizeIcon(input && input.icon);
    if (normalizedIcon.error) return { error: normalizedIcon.error, state: state };
    var world = {
      id: uid('world'),
      name: name,
      edition: (input && input.edition) === 'bedrock' ? 'bedrock' : 'java',
      version: cleanText(input && input.version, 24) || '1.21',
      notes: cleanText(input && input.notes, 240),
      createdAt: nowIso(),
      builds: []
    };
    if (normalizedIcon.icon) world.icon = normalizedIcon.icon;
    if (input && input.iconAuto === true) world.iconAuto = true;
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
    if (patch.icon !== undefined) {
      var normalizedWorldIcon = normalizeIcon(patch.icon);
      if (normalizedWorldIcon.error) return { error: normalizedWorldIcon.error, state: state };
      if (normalizedWorldIcon.icon) world.icon = normalizedWorldIcon.icon;
      else { delete world.icon; delete world.iconAuto; }
    }
    if (patch.iconAuto !== undefined) setIconAuto(world, patch.iconAuto);
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
    var normalizedBuildIcon = normalizeIcon(input && input.icon);
    if (normalizedBuildIcon.error) return { error: normalizedBuildIcon.error, state: state };
    var build = {
      id: uid('build'),
      name: name,
      status: STATUSES.indexOf(input && input.status) >= 0 ? input.status : 'planned',
      coords: cleanText(input && input.coords, 32),
      notes: cleanNotes(input && input.notes, 400),
      materials: [],
      /* EDICT-0014 §8: `icon` is always present on a build — null means "no stored icon, the
         view may show a suggestion", which is how a suggestion stays a view decision. */
      icon: normalizedBuildIcon.icon || null
    };
    if (input && input.iconAuto === true) build.iconAuto = true;
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
    if (patch.notes !== undefined) build.notes = cleanNotes(patch.notes, 400);
    if (patch.icon !== undefined) {
      var normalizedBuildIconPatch = normalizeIcon(patch.icon);
      if (normalizedBuildIconPatch.error) return { error: normalizedBuildIconPatch.error, state: state };
      if (normalizedBuildIconPatch.icon) build.icon = normalizedBuildIconPatch.icon;
      else { delete build.icon; delete build.iconAuto; }
    }
    if (patch.iconAuto !== undefined) setIconAuto(build, patch.iconAuto);
    return { state: next, build: build };
  }

  function setWorldIcon(state, worldId, iconInput, auto) {
    var next = clone(state);
    var world = findWorld(next, worldId);
    if (!world) return { error: 'Unknown world.', state: state };
    var normalized = normalizeIcon(iconInput);
    if (normalized.error) return { error: normalized.error, state: state };
    if (normalized.icon) {
      world.icon = normalized.icon;
      if (auto !== undefined) setIconAuto(world, auto);
    } else {
      delete world.icon;
      delete world.iconAuto;
    }
    return { state: next, world: world };
  }

  function setBuildIcon(state, worldId, buildId, iconInput, auto) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    var normalized = normalizeIcon(iconInput);
    if (normalized.error) return { error: normalized.error, state: state };
    if (normalized.icon) {
      build.icon = normalized.icon;
      /* EDICT-0014 §8: an explicit pick stores `iconAuto: false` (a manual choice must survive a
         rename); applying the suggestion stores true. Only an omitted flag deletes the field. */
      if (auto === true) build.iconAuto = true;
      else if (auto === false) build.iconAuto = false;
    } else {
      delete build.icon;
      delete build.iconAuto;
    }
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

  function validateIcon(icon, label, errors) {
    if (icon === undefined || icon === null) return;
    if (typeof icon !== 'object') {
      errors.push('Icon for ' + label + ' is malformed.');
      return;
    }
    if (ICON_KINDS.indexOf(icon.kind) < 0) {
      errors.push('Icon for ' + label + ' has an unknown kind.');
      return;
    }
    if (icon.kind === 'item') {
      if (typeof icon.slug !== 'string' || !ICON_SLUG_RE.test(icon.slug)) {
        errors.push('Icon for ' + label + ' has an invalid item slug.');
      }
      return;
    }
    if (typeof icon.dataUrl !== 'string' || !ICON_DATA_URL_RE.test(icon.dataUrl)) {
      errors.push('Icon for ' + label + ' is not a valid image data URL.');
      return;
    }
    if (icon.dataUrl.length > ICON_DATA_URL_MAX) {
      errors.push('Icon for ' + label + ' exceeds the size limit.');
    }
  }

  function validate(state) {
    var errors = [];
    if (!state || state.version !== SCHEMA) errors.push('Unsupported data version.');
    if (!state || !Array.isArray(state.worlds)) return errors.concat('worlds must be an array');
    state.worlds.forEach(function (world) {
      if (!world.id || !world.name) errors.push('A world is missing id or name.');
      validateIcon(world.icon, 'world "' + world.name + '"', errors);
      if (world.iconAuto !== undefined && typeof world.iconAuto !== 'boolean') {
        errors.push('World ' + world.name + ' has a non-boolean iconAuto.');
      }
      if (!Array.isArray(world.builds)) errors.push('World ' + world.name + ' has no builds array.');
      (world.builds || []).forEach(function (build) {
        if (!build.id || !build.name) errors.push('A build in ' + world.name + ' is missing id or name.');
        if (STATUSES.indexOf(build.status) < 0) errors.push('Build ' + build.name + ' has an unknown status.');
        validateIcon(build.icon, 'build "' + build.name + '"', errors);
        if (build.iconAuto !== undefined && typeof build.iconAuto !== 'boolean') {
          errors.push('Build ' + build.name + ' has a non-boolean iconAuto.');
        }
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
      notes: 'Main long-term survival world. Keep the base at spawn tidy.',
      icon: { kind: 'item', slug: 'grass_block' }
    }).state;
    var survival = state.worlds[0];
    var ironFarm = createBuild(state, survival.id, {
      name: 'Iron Farm (spawn)',
      status: 'building',
      coords: '120 / 64 / -40',
      notes: 'Village-based farm, 3 modules. Needs to be roofed before the next storm.',
      icon: { kind: 'item', slug: 'iron_ingot' }
    });
    state = ironFarm.state;
    var storageRoom = createBuild(state, survival.id, {
      name: 'Storage Hall',
      status: 'planned',
      coords: '0 / 62 / 30',
      notes: 'Double chest wall, sorting for 20 item types.',
      icon: { kind: 'item', slug: 'crafting_table' }
    });
    state = storageRoom.state;
    var netherHub = createBuild(state, survival.id, {
      name: 'Nether Hub',
      status: 'planned',
      coords: '8 / 70 / 8',
      notes: 'Four tunnels + ice road later; start with the portal room.',
      icon: { kind: 'item', slug: 'obsidian' }
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
      notes: 'Testing redstone contraptions on a flat world.',
      icon: { kind: 'item', slug: 'glass' }
    });
    state = creative.state;
    var castle = createBuild(state, state.worlds[1].id, {
      name: 'Castle Wall',
      status: 'done',
      coords: '-200 / 70 / 0',
      notes: 'Wall is finished; towers are a separate build later.',
      icon: { kind: 'item', slug: 'stone_bricks' }
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
    ICON_KINDS: ICON_KINDS,
    ICON_DATA_URL_MAX: ICON_DATA_URL_MAX,
    DEFAULT_STACK: DEFAULT_STACK,
    cleanText: cleanText,
    cleanNotes: cleanNotes,
    stepNeeded: stepNeeded,
    stackSizeFor: stackSizeFor,
    titleizeItem: titleizeItem,
    itemSlug: itemSlug,
    SUGGEST_KEYWORDS: SUGGEST_KEYWORDS,
    suggestIcon: suggestIcon,
    parseBulk: parseBulk,
    normalizeIcon: normalizeIcon,
    setWorldIcon: setWorldIcon,
    setBuildIcon: setBuildIcon,
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

