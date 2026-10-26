/**
 * Minecraft Build Tracker — domain model (EDICT-0005).
 *
 * Classic script on purpose: the app must open from `file://` with a double click,
 * where ES modules are blocked by CORS. Tests load this file into a `node:vm`
 * context and drive the exported `TrackerModel` object, so the logic is still
 * unit-testable without a bundler or a DOM.
 *
 * State shape (schema version 2, EDICT-0017):
 * {
 *   version: 2,
 *   activeWorldId: string|null,
 *   migratedFrom?: 1,                       // set once by migrateV1, dropped by the first v2 save
 *   worlds: [{
 *     id, name, edition: 'java'|'bedrock', version, notes, createdAt, updatedAt,
 *     inventory: { [slug]: integer },        // the shared per-world stock
 *     builds: [{ id, name, status: 'planned'|'building'|'done', coords, notes,
 *                active: boolean, icon?, materials: [{ id, item, needed }] }],
 *     icon?
 *   }]
 * }
 *
 * Two changes against schema 1: a build no longer stores `collected` (the world inventory
 * decides what is covered — see `allocate`), and a build carries `active`, which the rollups
 * and priority allocation honour. `migrateV1` folds every build's old `collected` into the
 * world inventory once, so an old backup keeps importing.
 *
 * `icon` is optional and additive (EDICT-0010): either
 *   { kind: 'item',  slug: 'stone_bricks' }   // a locally extracted Minecraft icon
 *   { kind: 'image', dataUrl: 'data:image/webp;base64,...' }  // an uploaded image
 */
(function (root) {
  'use strict';

  var SCHEMA = 2;
  var STORAGE_KEY = 'mc-build-tracker:v2';
  var V1_STORAGE_KEY = 'mc-build-tracker:v1';
  var STATUSES = ['planned', 'building', 'done'];
  /* A shulker box holds 27 stacks of its item, whatever the item's own stack size is. */
  var SHULKER_SLOTS = 27;
  /* EDICT-0017 §1: a fixed gathering rate. It lives in the model now so round 6 can turn a
     remaining count into minutes without re-deriving the constant; nothing shows it yet. */
  var ITEMS_PER_MINUTE = 30;

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

  /* ------------------------------- timestamps ------------------------------ */

  /**
   * EDICT-0016 §7: ISO 8601 stamps are optional, absent-safe and never fabricated. A full ISO
   * prefix is the only shape accepted, so a bare number (which `new Date` would turn into a 1970
   * date) and a non-date string both display as an em dash instead of inventing a date.
   */
  var ISO_STAMP_PREFIX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

  function formatStamp(iso) {
    if (typeof iso !== 'string') return '\u2014';
    var text = iso.trim();
    if (!ISO_STAMP_PREFIX.test(text)) return '\u2014';
    var parsed = new Date(text);
    if (!parsed || isNaN(parsed.getTime())) return '\u2014';
    return text.slice(0, 16).replace('T', ' ');
  }

  /** Present keys only, so an absent stamp stays absent instead of becoming `null`. */
  function timestamps(entity) {
    var out = {};
    if (!entity || typeof entity !== 'object') return out;
    if (entity.createdAt !== undefined) out.createdAt = entity.createdAt;
    if (entity.updatedAt !== undefined) out.updatedAt = entity.updatedAt;
    return out;
  }

  /**
   * `updatedAt` moves on every successful mutation; `createdAt` never does. A loaded entity with
   * no `createdAt` keeps it absent — touch must not fabricate one (EDICT-0016 §7).
   */
  function touch(entity) {
    if (!entity || typeof entity !== 'object') return entity;
    entity.updatedAt = nowIso();
    return entity;
  }

  /** First write of both stamps on a brand-new entity; an existing `createdAt` is never rewritten. */
  function stampCreated(entity) {
    if (!entity || typeof entity !== 'object') return entity;
    var stamp = nowIso();
    if (entity.createdAt === undefined) entity.createdAt = stamp;
    entity.updatedAt = stamp;
    return entity;
  }

  /* ---------------------------- relative parsing --------------------------- */

  var STACK_SYNTAX = /^([+\-])?\s*(\d+)\s*s(?:t|tack|tacks)?$/i;
  /**
   * EDICT-0017 §1: the same stack syntax with an optional trailing item count, so `2s+10` is
   * two stacks plus ten items. Anchored, so `2s+` and `1s@16` stay errors.
   */
  var STACK_PLUS_SYNTAX = /^([+\-])?\s*(\d+)\s*s(?:t|tack|tacks)?\s*(?:([+\-])\s*(\d+))?$/i;
  var PLAIN_SYNTAX = /^([+\-])?\s*(\d+)$/;
  var RELATIVE_ERROR = 'Enter a whole number, or +64 / -32 / 2s / 2s+10.';

  function stackSizeOr(value, fallback) {
    var size = Number(value);
    if (!isFinite(size) || size < 1) return fallback;
    return Math.floor(size);
  }

  /** `2s` / `2st` / `-2s` -> a signed item count; anything else is `{ error }`. */
  function parseStackSyntax(text, stack) {
    var raw = String(text == null ? '' : text).trim();
    var match = STACK_SYNTAX.exec(raw);
    if (!match) return { error: RELATIVE_ERROR };
    var count = Number(match[2]);
    if (!isFinite(count)) return { error: RELATIVE_ERROR };
    return { value: (match[1] === '-' ? -1 : 1) * count * stackSizeOr(stack, DEFAULT_STACK) };
  }

  /**
   * EDICT-0016 §10 / EDICT-0017 §1: the quick-update dialog's relative field. A plain integer
   * is an item count, `2s`/`2st` are stacks of this item (64-stack item: `2s` is +128) and
   * `2s+10` adds ten items on top of the two stacks. Anchored; anything else is `{ error }`.
   */
  function parseRelative(text, stack) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { value: 0 };
    var stackMatch = STACK_PLUS_SYNTAX.exec(raw);
    if (stackMatch) {
      var stacks = Number(stackMatch[2]);
      if (!isFinite(stacks)) return { error: RELATIVE_ERROR };
      var size = stackSizeOr(stack, DEFAULT_STACK);
      var extra = stackMatch[4] ? Number(stackMatch[4]) : 0;
      if (!isFinite(extra)) return { error: RELATIVE_ERROR };
      var whole = (stackMatch[1] === '-' ? -1 : 1) * stacks * size;
      var rest = (stackMatch[3] === '-' ? -1 : 1) * extra;
      return { value: whole + rest };
    }
    var match = PLAIN_SYNTAX.exec(raw);
    if (!match) return { error: RELATIVE_ERROR };
    var amount = Number(match[2]);
    if (!isFinite(amount)) return { error: RELATIVE_ERROR };
    return { value: match[1] === '-' ? -amount : amount };
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

  /* --------------------------- build ordering ----------------------------- */

  /**
   * EDICT-0015 §2: the build list is sorted by status rank building → planned → done, and
   * stays in registry order inside a rank. `STATUSES` keeps the taxonomy order used by the
   * status buttons; this table is the display order the contract freezes.
   */
  var STATUS_RANK = { building: 0, planned: 1, done: 2 };

  function statusRank(status) {
    return Object.prototype.hasOwnProperty.call(STATUS_RANK, status) ? STATUS_RANK[status] : 1;
  }

  /** A sorted copy: the registry (`world.builds`) is never mutated by rendering. */
  function sortBuilds(builds) {
    return (builds || []).map(function (build, index) {
      return { build: build, index: index };
    }).sort(function (left, right) {
      var byStatus = statusRank(left.build.status) - statusRank(right.build.status);
      return byStatus !== 0 ? byStatus : left.index - right.index;
    }).map(function (entry) {
      return entry.build;
    });
  }

  /* --------------------------- units and inventory ------------------------- */

  /**
   * EDICT-0017 §1: units are display-only. `items` is the stored unit; `stacks` is the item's
   * own stack size and `shulkers` is 27 of those stacks (a shulker of Ender Pearls is 432, not
   * 1728), so the same stored count formats differently per item without changing the data.
   */
  function unitSize(unit, slug, stacks) {
    if (unit === 'shulkers') return stackSizeFor(slug, stacks) * SHULKER_SLOTS;
    if (unit === 'stacks') return stackSizeFor(slug, stacks);
    return 1;
  }

  /** `2 stacks + 56`, `1 stack`, or the bare number when it does not fill one stack. */
  function stackText(value, size, label) {
    var qty = Math.floor(value / size);
    var rem = value - qty * size;
    if (qty <= 0) return String(value);
    var unit = qty === 1 ? label.replace(/s$/, '') : label;
    return rem > 0 ? qty + ' ' + unit + ' + ' + rem : qty + ' ' + unit;
  }

  function formatUnits(n, slug, unit, stacks) {
    var value = Math.max(0, toInt(n));
    if (unit === 'stacks') return stackText(value, stackSizeFor(slug, stacks), 'stacks');
    if (unit === 'shulkers') return stackText(value, stackSizeFor(slug, stacks) * SHULKER_SLOTS, 'shulkers');
    return String(value);
  }

  /** Tooltip helper: `184 = 2 stacks + 56`; a count below one stack stays a bare number. */
  function stackNotation(n, slug, stacks, unit) {
    var value = Math.max(0, toInt(n));
    var kind = unit === 'shulkers' ? 'shulkers' : 'stacks';
    if (unit === 'items') return String(value);
    if (value < unitSize(kind, slug, stacks)) return String(value);
    return value + ' = ' + formatUnits(value, slug, kind, stacks);
  }

  /**
   * The shared stock of one world, keyed by item slug. Every item the world's builds mention is
   * present (missing key = 0), so a caller never has to guard a lookup; stored keys that no build
   * mentions survive untouched.
   */
  function inventoryOf(world) {
    var out = {};
    var stored = world && world.inventory && typeof world.inventory === 'object' ? world.inventory : {};
    if (world && Array.isArray(world.builds)) {
      world.builds.forEach(function (build) {
        (build.materials || []).forEach(function (material) {
          var slug = itemSlug(material && material.item);
          if (slug && !Object.prototype.hasOwnProperty.call(out, slug)) out[slug] = 0;
        });
      });
    }
    Object.keys(stored).forEach(function (slug) {
      out[slug] = Math.max(0, toInt(stored[slug]));
    });
    return out;
  }

  /**
   * EDICT-0017 §1: these three take a **world** (that is the scope the inventory lives in) and
   * return `{ state, world }` where both keys are the same next object, matching the return shape
   * of the state-level mutators they sit beside.
   */
  function setInventory(world, slug, value) {
    var key = itemSlug(slug);
    if (!key) return { error: 'An inventory entry needs an item.', state: clone(world) };
    var next = clone(world);
    if (!next || typeof next !== 'object') return { error: 'Unknown world.', state: next };
    if (!next.inventory || typeof next.inventory !== 'object' || Array.isArray(next.inventory)) {
      next.inventory = {};
    }
    next.inventory[key] = Math.max(0, toInt(value));
    touch(next);
    return { state: next, world: next };
  }

  function addInventory(world, slug, delta) {
    var key = itemSlug(slug);
    if (!key) return { error: 'An inventory entry needs an item.', state: clone(world) };
    var current = Math.max(0, toInt(inventoryOf(world)[key]));
    return setInventory(world, key, Math.max(0, current + toSignedInt(delta)));
  }

  /**
   * EDICT-0017 §2 — the one place counts are decided. Priority allocation in build order: each
   * item's stock fills the first active build that needs it, then whatever is left flows to the
   * next; a build that is done still consumes stock (it was built) unless it is inactive.
   */
  function allocate(world) {
    var perMaterial = {};
    var perBuild = {};
    var slugs = {};
    var builds = world && Array.isArray(world.builds) ? world.builds : [];
    var inventory = inventoryOf(world);

    builds.forEach(function (build) {
      var total = 0;
      (build.materials || []).forEach(function (material) {
        total += Math.max(0, toInt(material && material.needed));
      });
      perBuild[build.id] = { covered: 0, needed: total };
    });

    var order = [];
    var bySlug = {};
    builds.forEach(function (build) {
      /* EDICT-0017 fixtures (README, `inactive-state.json`): a build that is `done` leaves the
         rollup as well — it already consumed its materials, so it must not steal stock from the
         builds that are still being built. `active: false` pauses a build the same way. */
      if (build.active === false || build.status === 'done') return;
      (build.materials || []).forEach(function (material) {
        var slug = itemSlug(material && material.item);
        if (!slug) return;
        if (!bySlug[slug]) {
          bySlug[slug] = [];
          order.push(slug);
        }
        bySlug[slug].push({ build: build, material: material });
      });
    });

    order.forEach(function (slug) {
      var stock = Math.max(0, toInt(inventory[slug]));
      var remaining = stock;
      var covered = 0;
      var needed = 0;
      var shared = 0;

      /* Grouped by build, because the build order is the priority order. */
      var buckets = [];
      var current = null;
      bySlug[slug].forEach(function (row) {
        if (row.build !== current) {
          current = row.build;
          buckets.push({ build: row.build, rows: [] });
        }
        buckets[buckets.length - 1].rows.push(row);
      });

      buckets.forEach(function (bucket) {
        var buildNeed = 0;
        bucket.rows.forEach(function (row) {
          buildNeed += Math.max(0, toInt(row.material.needed));
        });
        needed += buildNeed;
        if (buildNeed > 0) shared += 1;
        var left = Math.min(buildNeed, remaining);
        remaining -= left;
        covered += left;
        /* Inside one build the rows are filled in material order. */
        bucket.rows.forEach(function (row) {
          var rowNeeded = Math.max(0, toInt(row.material.needed));
          var rowCovered = Math.min(rowNeeded, left);
          left -= rowCovered;
          perMaterial[row.material.id] = rowCovered;
          var progress = perBuild[bucket.build.id];
          progress.covered += rowCovered;
        });
      });

      slugs[slug] = {
        inventory: stock,
        covered: covered,
        remaining: Math.max(0, needed - covered),
        surplus: Math.max(0, remaining),
        shared: shared
      };
    });

    /* A finished build is out of the priority race but its own progress is still meaningful:
       it is complete, so it reports full coverage rather than a 0% gap nobody can act on. */
    builds.forEach(function (build) {
      if (build.status !== 'done') return;
      var done = perBuild[build.id];
      if (done) done.covered = done.needed;
    });

    return { perMaterial: perMaterial, perBuild: perBuild, slugs: slugs };
  }

  function buildProgress(alloc, buildId) {
    var entry = alloc && alloc.perBuild ? alloc.perBuild[buildId] : null;
    var needed = entry ? Math.max(0, toInt(entry.needed)) : 0;
    var covered = entry ? Math.min(needed, Math.max(0, toInt(entry.covered))) : 0;
    return { covered: covered, needed: needed, remaining: Math.max(0, needed - covered) };
  }

  /** EDICT-0017 §1: the one sentence every progress surface prints. */
  function progressText(covered, needed) {
    var want = Math.max(0, toInt(needed));
    /* The numerator is capped at the goal: allocation can never cover more than a build needs,
       and a stray larger value must not print `50 / 10` in a sentence people read. */
    var have = Math.min(want, Math.max(0, toInt(covered)));
    var pct = want ? Math.round((have / want) * 100) : 0;
    return have + ' / ' + want + ' items gathered (' + pct + '%)';
  }

  /** EDICT-0017 §1: what is still missing, biggest gap first, across the active builds only. */
  function shoppingList(world) {
    var alloc = allocate(world);
    var builds = world && Array.isArray(world.builds) ? world.builds : [];
    var rows = Object.keys(alloc.slugs).map(function (slug) {
      var entry = alloc.slugs[slug];
      var item = titleizeItem(slug);
      var owners = [];
      builds.forEach(function (build) {
        if (build.active === false) return;
        (build.materials || []).forEach(function (material) {
          if (itemSlug(material && material.item) !== slug) return;
          if (item === titleizeItem(slug)) item = cleanText(material.item, 48) || item;
          if (owners.indexOf(build.id) < 0) owners.push(build.id);
        });
      });
      return { slug: slug, item: item, remaining: entry.remaining, builds: owners };
    });
    return rows.filter(function (row) {
      return row.remaining > 0;
    }).sort(function (a, b) {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function setBuildActive(world, buildId, active) {
    var next = clone(world);
    var build = findBuild(next, buildId);
    if (!build) return { error: 'Unknown build.', state: clone(world) };
    build.active = active !== false;
    touch(build);
    touch(next);
    return { state: next, world: next };
  }

  function moveBuild(world, buildId, toIndex) {
    var next = clone(world);
    if (!next || !Array.isArray(next.builds)) return { error: 'Unknown build.', state: next };
    var from = -1;
    next.builds.forEach(function (build, index) {
      if (build && build.id === buildId) from = index;
    });
    if (from < 0) return { error: 'Unknown build.', state: next };
    var target = Math.floor(Number(toIndex));
    if (!isFinite(target)) target = from;
    target = Math.max(0, Math.min(next.builds.length - 1, target));
    var moved = next.builds.splice(from, 1)[0];
    next.builds.splice(target, 0, moved);
    touch(next);
    return { state: next, world: next };
  }

  /* --------------------------- custom materials --------------------------- */

  /* Frozen strings (EDICT-0015 §4, tests/qa/edict-0015-fixtures/README.md). */
  var CUSTOM_ITEM_ERRORS = {
    name: 'Custom material needs a name.',
    duplicate: 'Name already used by another material.',
    stack: 'Stack size must be between 1 and 999.',
    icon: 'Icon must be a catalogue item or an uploaded image.'
  };

  function catalogueSlugs() {
    return root && Array.isArray(root.MC_ICON_SET) ? root.MC_ICON_SET : [];
  }

  function catalogueDisplayName(slug) {
    var names = root && root.MC_ICON_NAMES;
    if (names && typeof names === 'object' && !Array.isArray(names) && typeof names[slug] === 'string') {
      return names[slug];
    }
    return titleizeItem(slug);
  }

  /** The frozen icon rule: `null`, a catalogue item slug, or an uploaded data URL. */
  function customIconError(icon) {
    if (icon === null || icon === undefined) return null;
    if (typeof icon !== 'object' || ICON_KINDS.indexOf(icon.kind) < 0) return CUSTOM_ITEM_ERRORS.icon;
    if (icon.kind === 'item') {
      if (typeof icon.slug !== 'string' || !ICON_SLUG_RE.test(icon.slug)) return CUSTOM_ITEM_ERRORS.icon;
      return null;
    }
    if (typeof icon.dataUrl !== 'string' || !ICON_DATA_URL_RE.test(icon.dataUrl)) return CUSTOM_ITEM_ERRORS.icon;
    if (icon.dataUrl.length > ICON_DATA_URL_MAX) return CUSTOM_ITEM_ERRORS.icon;
    return null;
  }

  function registryList(list) {
    return Array.isArray(list) ? list : [];
  }

  /** Case-insensitive registry lookup by display name; first match wins. */
  function registryEntry(list, name) {
    var wanted = itemSlug(name);
    if (!wanted) return null;
    var items = registryList(list);
    for (var i = 0; i < items.length; i += 1) {
      if (items[i] && itemSlug(items[i].name) === wanted) return items[i];
    }
    return null;
  }

  /**
   * Nearest-first resolution (EDICT-0015 §4): build registry → world registry → account
   * registry → built-in catalogue → null.
   */
  function customItem(state, world, build, name) {
    return registryEntry(build && build.customItems, name)
      || registryEntry(world && world.customItems, name)
      || registryEntry(state && state.customItems, name);
  }

  function resolveItem(state, world, build, name) {
    var text = cleanText(name, 60);
    if (!text) return null;
    var scopes = [['build', build], ['world', world], ['account', state]];
    for (var i = 0; i < scopes.length; i += 1) {
      var owner = scopes[i][1];
      var entry = registryEntry(owner && owner.customItems, text);
      if (entry) {
        return {
          name: entry.name,
          stack: entry.stack,
          icon: entry.icon || null,
          custom: true,
          scope: scopes[i][0]
        };
      }
    }
    var slug = itemSlug(text);
    if (slug && catalogueSlugs().indexOf(slug) >= 0) {
      return {
        name: catalogueDisplayName(slug),
        stack: stackSizeFor(slug),
        icon: { kind: 'item', slug: slug },
        custom: false,
        scope: null
      };
    }
    return null;
  }

  /**
   * EDICT-0015 §4: validate a spec and append it to one registry. Never mutates the
   * argument state — the caller commits the returned clone.
   */
  function createCustomItem(state, world, build, target, spec) {
    var rawName = String((spec && spec.name) == null ? '' : spec.name).trim();
    var name = cleanText(rawName, 60);
    if (!name || rawName.length > 60) return { error: CUSTOM_ITEM_ERRORS.name };
    var stackValue = spec && spec.stack === undefined ? DEFAULT_STACK : Number(spec && spec.stack);
    if (!isFinite(stackValue) || stackValue !== Math.floor(stackValue) || stackValue < 1 || stackValue > 999) {
      return { error: CUSTOM_ITEM_ERRORS.stack };
    }
    var iconError = customIconError(spec && spec.icon);
    if (iconError) return { error: iconError };
    var icon = (spec && spec.icon) || null;
    if (icon && icon.kind === 'item' && catalogueSlugs().length && catalogueSlugs().indexOf(icon.slug) < 0) {
      return { error: CUSTOM_ITEM_ERRORS.icon };
    }
    var next = clone(state);
    var owner = null;
    if (target === 'build') {
      var ownWorld = findWorld(next, world && world.id);
      owner = findBuild(ownWorld, build && build.id);
    } else if (target === 'world') {
      owner = findWorld(next, world && world.id);
    } else if (target === 'account') {
      owner = next;
    }
    if (!owner) return { error: 'Custom material cannot be saved here.' };
    if (!Array.isArray(owner.customItems)) owner.customItems = [];
    if (registryEntry(owner.customItems, name)) return { error: CUSTOM_ITEM_ERRORS.duplicate };
    var entry = { id: uid('custom'), name: name, stack: Math.floor(stackValue), icon: icon };
    /* EDICT-0016 §7: custom items carry both stamps in all three scopes. */
    stampCreated(entry);
    owner.customItems.push(entry);
    if (owner !== next) touch(owner);
    return { state: next, entry: entry };
  }

  function validateCustomRegistry(list, label, errors) {
    if (list === undefined || list === null) return;
    if (!Array.isArray(list)) {
      errors.push(label + ' must be an array.');
      return;
    }
    var seen = {};
    list.forEach(function (entry) {
      if (!entry || typeof entry !== 'object') {
        errors.push(CUSTOM_ITEM_ERRORS.name);
        return;
      }
      var rawName = String(entry.name == null ? '' : entry.name).trim();
      var name = cleanText(rawName, 60);
      if (!name || rawName.length > 60) {
        errors.push(CUSTOM_ITEM_ERRORS.name);
        return;
      }
      var key = itemSlug(name);
      if (seen[key]) errors.push(CUSTOM_ITEM_ERRORS.duplicate);
      seen[key] = true;
      var stack = Number(entry.stack);
      if (!isFinite(stack) || stack !== Math.floor(stack) || stack < 1 || stack > 999) {
        errors.push(CUSTOM_ITEM_ERRORS.stack);
      }
      var iconError = customIconError(entry.icon);
      if (iconError) errors.push(iconError);
      if (!entry.id) errors.push('A custom material is missing its id.');
    });
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
      /* EDICT-0017 §1: the shared per-world stock starts empty. */
      inventory: {},
      builds: []
    };
    /* EDICT-0016 §7: the world keeps its createdAt and gains updatedAt on creation. */
    stampCreated(world);
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
    touch(world);
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
      /* EDICT-0017 §1: a new build is active unless the caller says otherwise, so priority
         allocation and the rollups count it from the start. */
      active: !(input && input.active === false),
      materials: [],
      /* EDICT-0014 §8: `icon` is always present on a build — null means "no stored icon, the
         view may show a suggestion", which is how a suggestion stays a view decision. */
      icon: normalizedBuildIcon.icon || null
    };
    if (input && input.iconAuto === true) build.iconAuto = true;
    /* EDICT-0016 §7: a new build stamps both fields and bumps its world's updatedAt. */
    stampCreated(build);
    world.builds.push(build);
    touch(world);
    return { state: next, build: build };
  }

  function updateBuild(state, worldId, buildId, patch) {
    var next = clone(state);
    var owner = findWorld(next, worldId);
    var build = findBuild(owner, buildId);
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
    touch(build);
    touch(owner);
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
    touch(world);
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
    touch(build);
    touch(findWorld(next, worldId));
    return { state: next, build: build };
  }

  function deleteBuild(state, worldId, buildId) {
    var next = clone(state);
    var world = findWorld(next, worldId);
    if (!world) return { error: 'Unknown world.', state: state };
    var before = world.builds.length;
    world.builds = world.builds.filter(function (b) { return b.id !== buildId; });
    if (world.builds.length === before) return { error: 'Unknown build.', state: state };
    touch(world);
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
        needed: existing.needed + needed
      }).state;
      return { state: next };
    }
    /* EDICT-0017 §1: a material is a requirement only — the world inventory decides how much of
       it is covered, so there is no per-build `collected` to seed any more. */
    build.materials.push({
      id: uid('mat'),
      item: item,
      needed: needed
    });
    touch(build);
    touch(findWorld(next, worldId));
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
    touch(build);
    touch(findWorld(next, worldId));
    return { state: next, material: material };
  }

  function deleteMaterial(state, worldId, buildId, materialId) {
    var next = clone(state);
    var build = findBuild(findWorld(next, worldId), buildId);
    if (!build) return { error: 'Unknown build.', state: state };
    var before = build.materials.length;
    build.materials = build.materials.filter(function (m) { return m.id !== materialId; });
    if (build.materials.length === before) return { error: 'Unknown material.', state: state };
    touch(build);
    /* The world owns the build: deleting a material must date the world too, or the sidebar
       keeps showing a stale "Updated" stamp. */
    touch(findWorld(next, worldId));
    return { state: next };
  }

  /* ------------------------------ aggregation ----------------------------- */

  /**
   * EDICT-0017 §1: a material is a requirement plus however much of it the shared stock covers,
   * so `covered` is passed in from `allocate` instead of read off the row. `collected` stays as an
   * alias so the 0016-era rollups keep one vocabulary.
   */
  function materialProgress(material, covered) {
    var needed = Math.max(0, toInt(material && material.needed));
    var supplied = Math.min(needed, Math.max(0, toInt(covered)));
    return {
      needed: needed,
      covered: supplied,
      collected: supplied,
      remaining: Math.max(0, needed - supplied),
      pct: needed ? Math.round((supplied / needed) * 100) : 0,
      done: supplied >= needed
    };
  }

  /**
   * Shopping list for a world: one row per item, summed across the **active** builds, with the
   * builds that need it so the player knows why it is on the list.
   */
  function aggregateWorld(world) {
    if (!world) return [];
    var alloc = allocate(world);
    var bySlug = {};
    var order = [];
    (world.builds || []).forEach(function (build) {
      if (build.active === false) return;
      (build.materials || []).forEach(function (material) {
        var slug = itemSlug(material && material.item);
        if (!slug) return;
        if (!bySlug[slug]) {
          bySlug[slug] = { item: material.item, needed: 0, covered: 0, builds: [], materialIds: [] };
          order.push(slug);
        }
        var row = bySlug[slug];
        row.needed += Math.max(0, toInt(material.needed));
        row.covered += Math.max(0, toInt(alloc.perMaterial[material.id]));
        if (row.builds.indexOf(build.name) < 0) row.builds.push(build.name);
        row.materialIds.push(material.id);
      });
    });
    return order.map(function (slug) {
      var row = bySlug[slug];
      row.collected = row.covered;
      row.remaining = Math.max(0, row.needed - row.covered);
      row.pct = row.needed ? Math.round((row.covered / row.needed) * 100) : 0;
      row.done = row.remaining === 0;
      return row;
    }).sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.item.localeCompare(b.item);
    });
  }

  /** Whole-world roll-up over the active builds: builds by status, materials, progress. */
  function worldSummary(world) {
    var summary = {
      builds: 0,
      byStatus: { planned: 0, building: 0, done: 0 },
      materials: 0,
      needed: 0,
      covered: 0,
      collected: 0,
      remaining: 0,
      pct: 0
    };
    if (!world) return summary;
    var alloc = allocate(world);
    (world.builds || []).forEach(function (build) {
      summary.builds += 1;
      summary.byStatus[build.status] = (summary.byStatus[build.status] || 0) + 1;
      if (build.active === false) return;
      var progress = buildProgress(alloc, build.id);
      summary.materials += (build.materials || []).length;
      summary.needed += progress.needed;
      summary.covered += progress.covered;
    });
    summary.collected = summary.covered;
    summary.remaining = Math.max(0, summary.needed - summary.covered);
    summary.pct = summary.needed ? Math.round((summary.covered / summary.needed) * 100) : 0;
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
      total.covered += s.covered;
      ['planned', 'building', 'done'].forEach(function (k) { total.byStatus[k] += s.byStatus[k]; });
    });
    total.collected = total.covered;
    total.remaining = Math.max(0, total.needed - total.covered);
    total.pct = total.needed ? Math.round((total.covered / total.needed) * 100) : 0;
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
    /* EDICT-0017 §1: the inventory lives on the world, never at the top level. */
    if (state.inventory !== undefined) {
      errors.push('The inventory belongs to a world, not the whole tracker.');
    }
    state.worlds.forEach(function (world) {
      if (!world.id || !world.name) errors.push('A world is missing id or name.');
      validateIcon(world.icon, 'world "' + world.name + '"', errors);
      if (world.iconAuto !== undefined && typeof world.iconAuto !== 'boolean') {
        errors.push('World ' + world.name + ' has a non-boolean iconAuto.');
      }
      validateInventory(world.inventory, world.name, errors);
      validateCustomRegistry(world.customItems, 'World "' + world.name + '" custom items', errors);
      if (!Array.isArray(world.builds)) errors.push('World ' + world.name + ' has no builds array.');
      (world.builds || []).forEach(function (build) {
        if (!build.id || !build.name) errors.push('A build in ' + world.name + ' is missing id or name.');
        if (STATUSES.indexOf(build.status) < 0) errors.push('Build ' + build.name + ' has an unknown status.');
        if (build.active !== undefined && typeof build.active !== 'boolean') {
          errors.push('Build ' + build.name + ' has a non-boolean active flag.');
        }
        validateIcon(build.icon, 'build "' + build.name + '"', errors);
        if (build.iconAuto !== undefined && typeof build.iconAuto !== 'boolean') {
          errors.push('Build ' + build.name + ' has a non-boolean iconAuto.');
        }
        validateCustomRegistry(build.customItems, 'Build "' + build.name + '" custom items', errors);
        (build.materials || []).forEach(function (material) {
          if (!material.id || !material.item) errors.push('A material in ' + build.name + ' is missing id or item.');
          if (!(material.needed >= 1)) errors.push('Material ' + material.item + ' needs at least 1.');
          /* EDICT-0017 §1: the shared inventory replaced the per-build count. */
          if (material.collected !== undefined) {
            errors.push('Material ' + material.item + ' still carries a collected count.');
          }
        });
      });
    });
    validateCustomRegistry(state.customItems, 'Account custom items', errors);
    return errors;
  }

  /** The world stock: an object of slug -> non-negative integer, nothing else. */
  function validateInventory(inventory, worldName, errors) {
    if (inventory === undefined || inventory === null) return;
    if (typeof inventory !== 'object' || Array.isArray(inventory)) {
      errors.push('World ' + worldName + ' has a malformed inventory.');
      return;
    }
    Object.keys(inventory).forEach(function (slug) {
      if (!ICON_SLUG_RE.test(String(slug))) {
        errors.push('World ' + worldName + ' has an invalid inventory item name.');
        return;
      }
      var value = inventory[slug];
      if (typeof value !== 'number' || !isFinite(value) || value < 0 || value !== Math.floor(value)) {
        errors.push('World ' + worldName + ' has a negative or fractional inventory count.');
      }
    });
  }

  function exportJSON(state) {
    return JSON.stringify(state, null, 2);
  }

  /**
   * EDICT-0017 §1/§5 — v1 -> v2. Every old per-build `collected` is summed into the owning
   * world's shared inventory (case-insensitive, via the item slug), the row loses `collected`,
   * the build gains `active: true`, and every count is clamped/coerced **before** `validate`
   * runs — a v1 row may carry `collected: "garbage"`, which becomes 0 instead of an import
   * error. Pure, idempotent (a v2 state only gets its missing inventories filled) and never
   * throws on a malformed row.
   */
  /* The frozen EDICT-0017 v2 fixtures spell "no custom items" as `{}`, which `validate` rightly
     rejects as a registry shape. An EMPTY object carries no entries, so it is dropped on import;
     anything else non-array is left in place to be reported as the defect it is. */
  function emptyRegistryObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
  }

  function migrateV1(state) {
    var next = clone(state && typeof state === 'object' ? state : {});
    var worlds = Array.isArray(next.worlds) ? next.worlds : [];
    worlds.forEach(function (world) {
      if (!world || typeof world !== 'object') return;
      if (!Array.isArray(world.builds)) world.builds = [];
      /* The frozen v2 fixtures carry `customItems: {}` (an empty object, not an array). An
         import must not brick on it: the registry is simply dropped, which reads as "none". */
      if (emptyRegistryObject(world.customItems)) delete world.customItems;
      var inventory = {};
      world.builds.forEach(function (build) {
        if (!build || typeof build !== 'object') return;
        if (!Array.isArray(build.materials)) build.materials = [];
        if (emptyRegistryObject(build.customItems)) delete build.customItems;
        if (typeof build.active !== 'boolean') build.active = true;
        build.materials = build.materials.filter(function (material) {
          if (!material || typeof material !== 'object') return false;
          if (!material.id) material.id = uid('mat');
          return !!cleanText(material.item, 48);
        });
        build.materials.forEach(function (material) {
          var slug = itemSlug(material.item);
          var collected = toInt(material.collected);
          if (slug) inventory[slug] = (inventory[slug] || 0) + collected;
          delete material.collected;
          material.needed = Math.max(1, toInt(material.needed));
        });
      });
      /* A v2 state keeps its richer inventory; a second pass must not re-sum anything. */
      world.inventory = next.version === SCHEMA && world.inventory && typeof world.inventory === 'object'
        ? world.inventory
        : inventory;
    });
    next.worlds = worlds;
    if (emptyRegistryObject(next.customItems)) delete next.customItems;
    if (next.version !== SCHEMA) next.migratedFrom = 1;
    next.version = SCHEMA;
    return next;
  }

  function importJSON(text) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return { error: 'That is not valid JSON.' };
    }
    /* Contract §5 (D1): a **v2** document that still carries a per-build `collected` is refused,
       because v2 keeps the stock on the world only. A v1 document is migrated (its collected is
       folded into the world inventory by migrateV1, which is the whole point of the upgrade). */
    if (parsed && typeof parsed === 'object' && parsed.version === SCHEMA && Array.isArray(parsed.worlds)) {
      var collectedError = null;
      parsed.worlds.forEach(function (world) {
        if (collectedError || !world || !Array.isArray(world.builds)) return;
        world.builds.forEach(function (build) {
          if (collectedError || !build || !Array.isArray(build.materials)) return;
          build.materials.forEach(function (material) {
            if (!collectedError && material && material.collected !== undefined) {
              collectedError = 'Material ' + material.item + ' still carries a collected count.';
            }
          });
        });
      });
      if (collectedError) return { error: 'That file is not a tracker backup: ' + collectedError };
    }
    /* Both generations go through the same coercion pass: `migrateV1` is idempotent on a v2
       document (it only fills what is missing), and running it on v1 is the migration itself. */
    var candidate = parsed && typeof parsed === 'object' && (parsed.version === 1 || parsed.version === SCHEMA)
      ? migrateV1(parsed)
      : parsed;
    var errors = validate(candidate);
    if (errors.length) return { error: 'That file is not a tracker backup: ' + errors[0] };
    var state = clone(candidate);
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
      var legacy = false;
      /* EDICT-0017 §1: the v1 key is read once so an existing install keeps its data. It is
         never deleted or rewritten — only the v2 key is written. */
      if (!raw) {
        raw = store && store.getItem(V1_STORAGE_KEY);
        legacy = !!raw;
      }
      if (!raw) return { state: null };
      var imported = importJSON(raw);
      if (imported.error) return { error: imported.error };
      if (legacy && imported.state) imported.state.migratedFrom = 1;
      return { state: imported.state };
    } catch (err) {
      return { error: 'Could not read saved data: ' + err.message };
    }
  }

  function save(storage, state) {
    var store = storage || root.localStorage;
    try {
      /* EDICT-0017 §3.8: `migratedFrom` is a one-shot notice — the first v2 write drops it, so a
         reload no longer claims the data was just migrated. */
      var payload = state && typeof state === 'object' ? clone(state) : state;
      if (payload && typeof payload === 'object') delete payload.migratedFrom;
      store.setItem(STORAGE_KEY, JSON.stringify(payload));
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

    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Stone Bricks', needed: 384 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Iron Ingot', needed: 64 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Glass', needed: 96 }).state;
    state = addMaterial(state, survival.id, ironFarm.build.id, { item: 'Torch', needed: 32 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Oak Planks', needed: 512 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Crafting Table', needed: 12 }).state;
    state = addMaterial(state, survival.id, storageRoom.build.id, { item: 'Stone Bricks', needed: 256 }).state;
    state = addMaterial(state, survival.id, netherHub.build.id, { item: 'Cobblestone', needed: 768 }).state;
    state = addMaterial(state, survival.id, netherHub.build.id, { item: 'Coal', needed: 128 }).state;
    /* EDICT-0017: the sample ships a shared stock so priority allocation is visible on load. */
    state.worlds[0].inventory = {
      stone_bricks: 200, glass: 96, torch: 12, oak_planks: 64, cobblestone: 300, coal: 128
    };

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
    state = addMaterial(state, state.worlds[1].id, castle.build.id, { item: 'Stone Bricks', needed: 1024 }).state;
    state = addMaterial(state, state.worlds[1].id, castle.build.id, { item: 'Dirt', needed: 256 }).state;
    state.worlds[1].inventory = { stone_bricks: 1024, dirt: 256 };
    state.activeWorldId = state.worlds[0].id;
    return state;
  }

  var api = {
    SCHEMA: SCHEMA,
    STORAGE_KEY: STORAGE_KEY,
    V1_STORAGE_KEY: V1_STORAGE_KEY,
    STATUSES: STATUSES,
    SHULKER_SLOTS: SHULKER_SLOTS,
    ITEMS_PER_MINUTE: ITEMS_PER_MINUTE,
    ICON_KINDS: ICON_KINDS,
    ICON_DATA_URL_MAX: ICON_DATA_URL_MAX,
    DEFAULT_STACK: DEFAULT_STACK,
    cleanText: cleanText,
    cleanNotes: cleanNotes,
    stepNeeded: stepNeeded,
    stackSizeFor: stackSizeFor,
    formatStamp: formatStamp,
    timestamps: timestamps,
    touch: touch,
    parseRelative: parseRelative,
    unitSize: unitSize,
    formatUnits: formatUnits,
    stackNotation: stackNotation,
    inventoryOf: inventoryOf,
    setInventory: setInventory,
    addInventory: addInventory,
    allocate: allocate,
    buildProgress: buildProgress,
    progressText: progressText,
    shoppingList: shoppingList,
    setBuildActive: setBuildActive,
    moveBuild: moveBuild,
    migrateV1: migrateV1,
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
    save: save,
    statusRank: statusRank,
    sortBuilds: sortBuilds,
    CUSTOM_ITEM_ERRORS: CUSTOM_ITEM_ERRORS,
    customItem: customItem,
    resolveItem: resolveItem,
    createCustomItem: createCustomItem
  };

  root.TrackerModel = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

