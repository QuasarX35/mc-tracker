/**
 * Minecraft Build Tracker — UI layer (EDICT-0005).
 * Classic script: the app must run from file:// (no bundler, no modules).
 * All state transitions go through TrackerModel; this file only renders and binds.
 */
(function () {
  'use strict';

  var M = window.TrackerModel;

  /**
   * Item icons are the game's own 256×256 inventory renders (exported from the owner's Java
   * Edition client with IconExporter and assembled by scripts/mc-icons.py; EDICT-0011).
   * `assets/icons/icons.js` lists the available slugs; items without one fall back to a
   * lettered slot instead of a misleading picture.
   */
  var ICON_SET = window.MC_ICON_SET || [];
  var ICON_NAMES = window.MC_ICON_NAMES || null;
  var FALLBACK_ITEMS = ['Stone', 'Cobblestone', 'Stone Bricks', 'Dirt', 'Sand', 'Oak Planks',
    'Oak Log', 'Glass', 'Torch', 'Chest', 'Iron Ingot', 'Coal'];
  var COMMON_ITEMS = FALLBACK_ITEMS.slice();

  function slugifyItem(name) {
    return String(name == null ? '' : name)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function iconFor(item) {
    var slug = slugifyItem(item);
    return ICON_SET.indexOf(slug) >= 0 ? slug : null;
  }

  /** "oak_log" -> "Oak Log"; used when the generated catalog has no display name. */
  function titleSlug(slug) {
    return String(slug || '').split('_').filter(Boolean).map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
  }

  /**
   * EDICT-0013 D6: `window.MC_ICON_SET` lists every available slug; display names come from
   * `window.MC_ICON_NAMES` (an object keyed by slug in the expanded catalog, an array of names
   * in EDICT-0011 builds) and fall back to the slug itself. The seeded common items rank first
   * so the picker opens on the blocks a builder actually uses, not on alphabetical noise.
   */
  function buildIconCatalog() {
    if (!ICON_SET.length) return [];
    var names = {};
    if (Array.isArray(ICON_NAMES)) {
      ICON_SET.forEach(function (slug, index) { names[slug] = ICON_NAMES[index] || titleSlug(slug); });
    } else if (ICON_NAMES && typeof ICON_NAMES === 'object') {
      Object.keys(ICON_NAMES).forEach(function (slug) { names[slug] = String(ICON_NAMES[slug]); });
    }
    var entries = ICON_SET.map(function (slug, index) {
      return { slug: slug, name: names[slug] || titleSlug(slug), order: index };
    });
    entries.sort(function (a, b) {
      var ai = COMMON_ITEMS.indexOf(a.name);
      var bi = COMMON_ITEMS.indexOf(b.name);
      if (ai < 0) ai = COMMON_ITEMS.length;
      if (bi < 0) bi = COMMON_ITEMS.length;
      return ai === bi ? a.order - b.order : ai - bi;
    });
    return entries;
  }

  function catalogEntry(slug) {
    for (var i = 0; i < ICON_CATALOG.length; i += 1) {
      if (ICON_CATALOG[i].slug === slug) return ICON_CATALOG[i];
    }
    return null;
  }

  /** Max stack size for an item (EDICT-0013 D5); unknown items default to 64. */
  function stackSizeFor(item) {
    return M.stackSizeFor(slugifyItem(item), window.MC_ICON_STACKS);
  }

  var STATUS_LABEL = { planned: 'Planned', building: 'Building', done: 'Done' };

  var els = {};
  var state = null;
  var ui = {
    view: 'builds',
    buildsView: 'standard',
    selectedBuildId: null,
    filter: 'remaining',
    query: '',
    pickerMode: 'icon',
    titleEditing: false,
    notesEditing: false,
    editingBuildId: null,
    dialogBuildId: null,
    units: 'items',
    sort: 'remaining',
    hideDone: false,
    matView: 'table',
    sidebarCollapsed: false,
    inactiveMode: 'priority',
    invTarget: null,
    pasteTarget: null,
    openMenu: null,
    dragBuildId: null
  };
  var editingWorldId = null;
  var dialogIcon = { world: null, build: null };
  var draftIcon = null;
  var iconTarget = null;
  var lastIconTrigger = null;
  var ICON_CATALOG = buildIconCatalog();
  var pendingConfirm = null;
  var BUILDS_VIEW_KEY = 'mbt.buildsView';
  /* EDICT-0017 §4: the one place a display preference is named, so read and write cannot drift. */
  var PREF_KEY = {
    units: 'mbt.units',
    sort: 'mbt.sort',
    hideDone: 'mbt.density',
    sidebar: 'mbt.sidebar',
    inactive: 'mbt.inactiveMode'
  };
  var PENCIL_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M9 0h3v2L2 12H0V9L9 0Z"/></svg>';
  var TRASH_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4 0h4v1h3v2H1V1h3V0Zm-2 4h8l-.6 8H2.6L2 4Zm2 1v6h1V5H4Zm3 0v6h1V5H7Z"/></svg>';
  /* Contract §5: the one 14-unit check. Never a text glyph — U+2713 is in neither Minecraft.ttf
     nor Pixelify Sans, so a `✓` character renders as a tofu box. It scales to its container
     (100%/100%) because `.ctile__done` is a border-box 14px badge whose content box is 10px;
     `.mc-btn--icon svg` still wins at 14×14 wherever that rule applies. */
  var PLUS_ICON = '<svg viewBox="0 0 12 12" width="100%" height="100%" aria-hidden="true" focusable="false"><path d="M5 0h2v5h5v2H7v5H5V7H0V5h5V0Z"/></svg>';
  var CHECK_ICON = '<svg viewBox="0 0 14 14" width="100%" height="100%" aria-hidden="true" ' +
    'focusable="false" style="display:block">' +
    '<path d="M1 7 L4.5 10.5 L12 2 L13 3.5 L4.5 13 L0 8.5 Z" fill="currentColor"/></svg>';
  /* ------------------------------------------------------------------ util */

  function $(id) { return document.getElementById(id); }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Inner markup of an inventory slot: the item render, else the lettered fallback. */
  function slotInnerHtml(item, lazy) {
    var icon = iconFor(item);
    var letter = String(item).trim().charAt(0).toUpperCase() || '?';
    if (!icon) return '<span class="slot__letter">' + escapeHtml(letter) + '</span>';
    return '<img' + (lazy ? ' loading="lazy" decoding="async"' : '') +
      ' src="assets/icons/' + icon + '.png" alt="" width="22" height="22" data-letter="' + escapeHtml(letter) + '">';
  }

  function slotHtml(item, options) {
    var lazy = !!(options && options.lazy);
    return '<span class="slot" data-tip="' + escapeHtml(item) + '" aria-hidden="true">' +
      slotInnerHtml(item, lazy) + '</span>';
  }

  /** EDICT-0013 D8: the add-material row shows the chosen item in a slot + name chip. */
  function renderMaterialChoice() {
    var name = els['mat-item'].value;
    var empty = !name;
    els['mat-choice-name'].textContent = empty ? 'Choose item…' : name;
    els['mat-choice-name'].classList.toggle('mat-choice__name--empty', empty);
    els['mat-choice-slot'].innerHTML = empty
      ? '<span class="slot__letter">?</span>'
      : slotInnerHtml(name, false);
    wireIconFallbacks(els['mat-choice-slot']);
  }

  function setMaterialChoice(name) {
    els['mat-item'].value = name || '';
    renderMaterialChoice();
  }

  /**
   * Vanilla icon PNGs are generated locally and git-ignored, so a fresh clone has none.
   * When an icon is missing, fall back to the lettered slot instead of a broken image.
   */
  function wireIconFallbacks(scope) {
    var root = scope || document;
    Array.prototype.forEach.call(root.querySelectorAll('.slot img, .avatar img, .ctile__icon img'), function (img) {
      if (img.dataset.wired === '1') return;
      img.dataset.wired = '1';
      img.addEventListener('error', function () {
        var isAvatar = !!img.closest('.avatar');
        var span = document.createElement('span');
        span.className = isAvatar ? 'avatar__letter' : 'slot__letter';
        span.textContent = img.getAttribute('data-letter') || '?';
        img.replaceWith(span);
      });
    });
  }

  /* ------------------------------------------------------------- identity */

  /** Avatar markup for an icon ({kind:'item'|'image'}), with a lettered fallback. */
  function avatarHtml(icon, size, label) {
    var letter = String(label == null ? '' : label).trim().charAt(0).toUpperCase() || '?';
    var inner;
    if (icon && icon.kind === 'item') {
      inner = '<img src="assets/icons/' + escapeHtml(icon.slug) + '.png" alt="" data-letter="' + escapeHtml(letter) + '">';
    } else if (icon && icon.kind === 'image') {
      inner = '<img src="' + escapeHtml(icon.dataUrl) + '" alt="" data-letter="' + escapeHtml(letter) + '">';
    } else {
      inner = '<span class="avatar__letter">' + escapeHtml(letter) + '</span>';
    }
    return '<span class="avatar avatar--' + size + '" aria-hidden="true">' + inner + '</span>';
  }

  /** Decode an uploaded file, centre-crop to square, downscale to 128px, encode small. */
  function processImageFile(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve({ error: 'No file selected.' }); return; }
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
        resolve({ error: 'Use a PNG, JPEG or WebP image.' });
        return;
      }
      if (file.size > 8 * 1024 * 1024) { resolve({ error: 'Image is larger than 8 MB.' }); return; }
      var url = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        try {
          var size = 128;
          var canvas = document.createElement('canvas');
          canvas.width = size;
          canvas.height = size;
          var context = canvas.getContext('2d');
          var scale = Math.max(size / image.width, size / image.height);
          var width = Math.round(image.width * scale);
          var height = Math.round(image.height * scale);
          context.drawImage(image, Math.round((size - width) / 2), Math.round((size - height) / 2), width, height);
          var dataUrl = canvas.toDataURL('image/webp', 0.82);
          if (dataUrl.indexOf('data:image/webp') !== 0) dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          if (dataUrl.length > M.ICON_DATA_URL_MAX) {
            resolve({ error: 'Image is too detailed to store; try a smaller picture.' });
            return;
          }
          resolve({ icon: { kind: 'image', dataUrl: dataUrl } });
        } catch (error) {
          URL.revokeObjectURL(url);
          resolve({ error: 'Could not process that image.' });
        }
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        resolve({ error: 'That file is not an image.' });
      };
      image.src = url;
    });
  }

  function renderIconPreview(scope) {
    var icon = dialogIcon[scope];
    var label = scope === 'world' ? els['world-name'].value : els['build-dlg-name'].value;
    var preview = scope === 'world' ? els['world-icon'] : els['build-dlg-icon'];
    var remove = scope === 'world' ? els['world-icon-remove'] : els['build-dlg-icon-remove'];
    preview.innerHTML = avatarHtml(icon, 40, label || '?');
    wireIconFallbacks(preview);
    remove.disabled = !icon;
  }

  /* -------------------------------------------------- EDICT-0014 picker support */
  /* D2: the whole catalog pages into the grid in batches instead of being sliced. D11: recent
     picks are browser-local and never travel in the exported document. */
  var PICKER_BATCH = 120;
  var RECENT_KEY = 'mc-build-tracker:recent';
  var MAX_RECENT = 8;
  var pickerObserver = null;

  /** The model's catalog shape: { names: { slug: displayName }, order: [slug, ...] }. */
  var CATALOG_DATA = null;
  function catalogData() {
    if (CATALOG_DATA) return CATALOG_DATA;
    var names = {};
    var order = [];
    ICON_SET.forEach(function (slug) {
      var entry = catalogEntry(slug);
      names[slug] = entry ? entry.name : titleSlug(slug);
      order.push(slug);
    });
    CATALOG_DATA = { names: names, order: order };
    return CATALOG_DATA;
  }

  /** EDICT-0014 §8: the model decides the suggestion; the view only displays it. */
  function suggestionFor(build) {
    var world = activeWorld();
    if (!build || !world) return null;
    return M.suggestIcon(build, world, catalogData());
  }

  function readRecents() {
    var parsed;
    try {
      parsed = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
    } catch (error) {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < parsed.length && out.length < MAX_RECENT; i += 1) {
      var slug = parsed[i];
      if (typeof slug !== 'string' || seen[slug] || ICON_SET.indexOf(slug) < 0) continue;
      seen[slug] = true;
      out.push(slug);
    }
    return out;
  }

  function rememberRecent(slug) {
    if (typeof slug !== 'string' || ICON_SET.indexOf(slug) < 0) return;
    var list = readRecents().filter(function (item) { return item !== slug; });
    list.unshift(slug);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    } catch (error) {
      /* Recents are a convenience; a blocked localStorage must not break the picker. */
    }
  }

  /** Recents lead the unfiltered grid (contract §7); a search still scans the whole catalog. */
  function pickerEntries(query) {
    var needle = (query || '').trim().toLowerCase();
    var slugNeedle = needle.replace(/\s+/g, '_');
    if (!needle) {
      var seen = {};
      var recent = [];
      (ui.pickerRecents || []).forEach(function (slug) {
        var entry = catalogEntry(slug);
        if (!entry || seen[entry.slug]) return;
        seen[entry.slug] = true;
        recent.push(entry);
      });
      return recent.concat(ICON_CATALOG.filter(function (entry) { return !seen[entry.slug]; }));
    }
    return ICON_CATALOG.filter(function (entry) {
      return entry.name.toLowerCase().indexOf(needle) >= 0 || entry.slug.indexOf(slugNeedle) >= 0;
    });
  }

  /** EDICT-0015 §4/F10: the three custom registries, nearest scope first, one entry per name. */
  function customRegistryLists() {
    var world = activeWorld();
    var build = selectedBuild();
    var lists = [];
    if (build && build.customItems) lists.push(build.customItems);
    if (world && world.customItems) lists.push(world.customItems);
    if (state && state.customItems) lists.push(state.customItems);
    return lists;
  }

  /** Custom tiles are appended AFTER every catalogue match (F10) and never seeded unfiltered. */
  function pickerCustomEntries(query) {
    var needle = String(query || '').trim().toLowerCase();
    var slugNeedle = needle.replace(/\s+/g, '_');
    var seen = {};
    var out = [];
    customRegistryLists().forEach(function (list) {
      list.forEach(function (entry) {
        if (!entry || !entry.name) return;
        var slug = slugifyItem(entry.name);
        if (!slug || seen[slug]) return;
        if (needle && entry.name.toLowerCase().indexOf(needle) < 0 && slug.indexOf(slugNeedle) < 0) return;
        seen[slug] = true;
        out.push({
          slug: slug,
          name: entry.name,
          custom: true,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        });
      });
    });
    return out;
  }

  function customPickerName(slug) {
    var found = pickerCustomEntries('').filter(function (entry) { return entry.slug === slug; })[0];
    return found ? found.name : '';
  }

  function loadMorePicker() {
    var matches = pickerEntries(els['icon-search'].value);
    if (ui.pickerShown >= matches.length) return;
    var grid = els['icon-grid'];
    var scroll = grid ? grid.scrollTop : 0;
    ui.pickerShown = Math.min(matches.length, (ui.pickerShown || PICKER_BATCH) + PICKER_BATCH);
    renderIconPicker();
    if (grid) grid.scrollTop = scroll;
  }

  /** D2: IntersectionObserver drives paging; the scroll listener is the documented fallback. */
  function watchPickerSentinel() {
    if (pickerObserver) { pickerObserver.disconnect(); pickerObserver = null; }
    if (typeof window.IntersectionObserver !== 'function') return;
    var sentinel = document.getElementById('icon-sentinel');
    if (!sentinel) return;
    pickerObserver = new window.IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) loadMorePicker();
      });
    }, { root: els['icon-grid'], rootMargin: '96px' });
    pickerObserver.observe(sentinel);
  }

  function openIconPicker(target) {
    iconTarget = target;
    /* Case 32: remember the invoking control explicitly. A programmatic .click() does not move
       focus, so document.activeElement is not a reliable trigger. */
    lastIconTrigger = target.trigger || document.activeElement;
    /* Three picker surfaces: the material chooser picks an item, the custom-material icon
       field commits on the tile click (contract §4), everything else is the icon draft. */
    if (target.scope === 'material') ui.pickerMode = 'item';
    else if (target.scope === 'custom-icon') ui.pickerMode = 'custom-icon';
    else ui.pickerMode = 'icon';
    if (target.scope === 'world') draftIcon = dialogIcon.world;
    else if (target.scope === 'build') draftIcon = dialogIcon.build;
    else if (target.scope === 'build-detail') {
      var build = selectedBuild();
      draftIcon = (build && build.icon) || null;
    } else if (target.scope === 'custom-icon') {
      draftIcon = ui.customIcon || null;
    } else {
      draftIcon = null;
    }
    els['icon-search'].value = '';
    els['icon-file'].value = '';
    els['icon-error'].hidden = true;
    ui.pickerShown = PICKER_BATCH;
    ui.pickerRecents = readRecents();
    ui.pickerSuggestion = target.scope === 'build-detail' ? suggestionFor(selectedBuild()) : null;
    syncPickerChrome();
    syncCustomButton();
    renderIconPicker();
    els['icon-dialog'].showModal();
    els['icon-search'].focus();
  }

  /** EDICT-0013 D7/D8: one dialog, two modes — choose an icon, or choose an item for a material. */
  function syncPickerChrome() {
    var picking = ui.pickerMode === 'item';
    var customIcon = ui.pickerMode === 'custom-icon';
    els['icon-dialog-title'].textContent = picking ? 'Choose an item' : 'Choose an icon';
    els['icon-use'].textContent = picking ? 'Use item' : 'Use icon';
    els['icon-use'].hidden = picking || customIcon;
    els['icon-upload-block'].hidden = picking || customIcon;
    els['icon-error'].hidden = true;
  }

  function renderIconPicker() {
    hideTooltip();
    var picking = ui.pickerMode === 'item';
    var query = els['icon-search'].value;
    var matches = pickerEntries(query);
    var total = matches.length;
    var shown = Math.max(PICKER_BATCH, Math.min(ui.pickerShown || PICKER_BATCH, total));
    var visible = matches.slice(0, shown);
    var suggestion = picking ? null : ui.pickerSuggestion;
    var recentSet = {};
    (ui.pickerRecents || []).forEach(function (slug) { recentSet[slug] = true; });
    var tiles = [];
    if (!picking) {
      tiles.push('<button type="button" class="icon-tile" role="option" data-icon-none="1" aria-selected="' +
        (!draftIcon && !suggestion ? 'true' : 'false') + '"><span class="slot" aria-hidden="true"><span class="slot__letter">–</span></span>' +
        '<span class="icon-tile__name">None</span></button>');
    }
    visible.forEach(function (entry) {
      var selected = !picking && draftIcon && draftIcon.kind === 'item' && draftIcon.slug === entry.slug;
      if (!picking && !draftIcon && suggestion && suggestion.slug === entry.slug) selected = true;
      var attrs = 'data-icon-slug="' + escapeHtml(entry.slug) + '"';
      if (recentSet[entry.slug]) attrs += ' data-icon-recent="true"';
      if (suggestion && suggestion.slug === entry.slug) attrs += ' data-icon-suggested="true"';
      tiles.push('<button type="button" class="icon-tile" role="option" ' + attrs +
        ' data-tip="' + escapeHtml(entry.name) + '" aria-selected="' + (selected ? 'true' : 'false') + '">' +
        slotHtml(entry.name, { lazy: true }) +
        '<span class="icon-tile__name">' + escapeHtml(entry.name) + '</span></button>');
    });
    if (total > shown) {
      tiles.push('<div class="icon-sentinel" id="icon-sentinel" data-icon-sentinel="1" aria-hidden="true"></div>');
    }
    /* F10: custom tiles come after every catalogue match; the unfiltered first batch has none. */
    if (picking && query.trim()) {
      pickerCustomEntries(query).forEach(function (entry) {
        tiles.push('<button type="button" class="icon-tile" role="option" data-icon-slug="' +
          escapeHtml(entry.slug) + '" data-icon-custom="1" data-tip="' + escapeHtml(entry.name) +
          '" aria-selected="false">' + slotHtml(entry.name, { lazy: true }) +
          '<span class="icon-tile__name">' + escapeHtml(entry.name) + '</span>' +
          '<span class="tile__badge">custom</span>' +
          '<span class="tile__stamp">' + stampHtml(entry) + '</span></button>');
      });
    }
    els['icon-grid'].innerHTML = tiles.join('');
    wireIconFallbacks(els['icon-grid']);

    var hint = els['icon-count-hint'];
    var needle = query.trim();
    if (needle) {
      hint.textContent = 'showing ' + visible.length + ' of ' + total + ' for "' + needle + '"';
    } else if (total > shown) {
      hint.textContent = 'showing ' + visible.length + ' of ' + total + ' — scroll for more';
    } else {
      hint.textContent = 'showing ' + visible.length + ' of ' + total;
    }
    hint.hidden = false;

    var note = els['icon-suggest-note'];
    if (suggestion && !draftIcon) {
      var quoted = /"([^"]+)"/.exec(suggestion.reason || '');
      note.textContent = 'Suggested from "' + (quoted ? quoted[1] : suggestion.name) + '"';
      note.hidden = false;
    } else {
      note.textContent = '';
      note.hidden = true;
    }

    els['icon-preview'].innerHTML = avatarHtml(draftIcon, 48, '?');
    wireIconFallbacks(els['icon-preview']);
    watchPickerSentinel();
  }

  function useIconDraft() {
    var notice;
    if (!iconTarget) {
      /* No trigger recorded (a dialog opened without openIconPicker, or a caller that only
         marks the draft): the choice must still land on the selected build instead of being
         dropped silently — the build-detail avatar is the dialog's primary owner. */
      var fallbackWorld = activeWorld();
      var fallbackBuild = selectedBuild();
      if (fallbackWorld && fallbackBuild && draftIcon !== undefined) {
        var applied = M.setBuildIcon(state, fallbackWorld.id, fallbackBuild.id, draftIcon);
        if (applied.error) { toast(applied.error, true); els['icon-dialog'].close(); return; }
        ui.selectedBuildId = fallbackBuild.id;
        commit(applied.state);
        toast(draftIcon ? 'Icon updated.' : 'Icon removed.');
      }
      els['icon-dialog'].close();
      return;
    }
    if (iconTarget.scope === 'world') {
      dialogIcon.world = draftIcon;
      renderIconPreview('world');
    } else if (iconTarget.scope === 'build') {
      dialogIcon.build = draftIcon;
      renderIconPreview('build');
    } else if (iconTarget.scope === 'custom-icon') {
      /* #custom-icon-pick is a programmatic-only entry point (kept hidden per contract §4), so a
         picked tile lands on the pending custom material instead of any build. */
      ui.customIcon = draftIcon;
      clearFormError('custom-error');
      paintCustomIconPreview();
      els['icon-dialog'].close();
      return;
    } else {
      var world = activeWorld();
      var build = selectedBuild();
      if (!world || !build) { els['icon-dialog'].close(); return; }
      /* Contract §5: the detail avatar commits straight through the model, image icons included
         (M.setBuildIcon normalises the data URL), and commit() persists + repaints the avatar.
         EDICT-0014 §8: an empty draft falls back to the suggestion as an automatic icon; a picked
         tile is a manual choice and is stored with iconAuto false. */
      var chosen = draftIcon;
      var auto;
      if (!chosen && ui.pickerSuggestion) {
        chosen = { kind: 'item', slug: ui.pickerSuggestion.slug };
        auto = true;
      } else if (chosen) {
        auto = false;
      }
      var result = M.setBuildIcon(state, world.id, build.id, chosen, auto);
      if (result.error) { toast(result.error, true); return; }
      if (chosen && chosen.kind === 'item') rememberRecent(chosen.slug);
      notice = chosen ? (draftIcon ? 'Icon updated.' : 'Suggested icon applied.') : 'Icon removed.';
      ui.selectedBuildId = build.id;
      commit(result.state);
    }
    els['icon-dialog'].close();
    toast(notice || (draftIcon ? 'Icon updated.' : 'Icon removed.'));
  }

  /** Reveal the locally generated panorama when it exists; dirt stays otherwise. */
  function probeBackdrop() {
    try {
      var probe = new Image();
      probe.onload = function () {
        document.documentElement.classList.add('has-panorama');
        document.documentElement.style.setProperty('--panorama-image', 'url("assets/panorama/backdrop.webp")');
        window.__backdrop = 'panorama';
      };
      probe.onerror = function () { window.__backdrop = 'dirt'; };
      probe.src = 'assets/panorama/backdrop.webp';
    } catch (error) {
      window.__backdrop = 'dirt';
    }
  }

  function toast(message, isError, action) {
    if (!els.toast) return;
    window.clearTimeout(toast._timer);
    els.toast.textContent = message;
    if (action && action.run) {
      var button = document.createElement('button');
      button.type = 'button';
      button.id = 'toast-action';
      button.className = 'toast__action';
      button.textContent = action.label || 'Undo';
      button.addEventListener('click', function () {
        window.clearTimeout(toast._timer);
        els.toast.hidden = true;
        els.toast.textContent = '';
        action.run();
      });
      els.toast.appendChild(button);
    }
    els.toast.hidden = false;
    els.toast.style.background = isError ? '#7a201a' : '';
    els.toast.style.borderColor = isError ? '#ff5555' : '';
    /* EDICT-0014 §6: an undo offer stays live for six seconds; a plain notice is shorter. */
    toast._timer = window.setTimeout(function () {
      els.toast.hidden = true;
      els.toast.textContent = '';
    }, action ? 6000 : 3200);
  }

  function snapshotState() {
    return JSON.parse(JSON.stringify(state));
  }

  /* EDICT-0014 §6: destructive actions offer one Undo that restores the exact pre-action state. */
  function offerUndo(before, message, buildId) {
    toast(message, false, {
      label: 'Undo',
      run: function () {
        if (buildId) ui.selectedBuildId = buildId;
        ui.titleEditing = false;
        ui.notesEditing = false;
        ui.editingBuildId = null;
        commit(before);
        toast('Restored.');
      }
    });
  }

  /* EDICT-0014 §3: one delegated tooltip instead of per-element pseudo-tooltips. The node lives
     inside the open dialog when the target does, otherwise at the end of the body, and it stays
     hit testable (no pointer-events: none) so elementFromPoint agrees it is the visible tooltip. */
  var tooltipEl = null;
  var tooltipOwner = null;

  function tooltipNode() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'mc-tooltip';
      tooltipEl.className = 'mc-tooltip';
      tooltipEl.setAttribute('role', 'tooltip');
      tooltipEl.hidden = true;
    }
    return tooltipEl;
  }

  function hideTooltip() {
    tooltipOwner = null;
    if (tooltipEl) tooltipEl.hidden = true;
  }

  function positionTooltip(owner, node) {
    var rect = owner.getBoundingClientRect();
    var width = node.offsetWidth;
    var height = node.offsetHeight;
    var left = rect.left + rect.width / 2 - width / 2;
    var top = rect.top - height - 8;
    if (top < 44) top = rect.bottom + 8;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - height - 8));
    node.style.left = left + 'px';
    node.style.top = top + 'px';
  }

  function showTooltip(owner) {
    var text = owner.getAttribute('data-tip');
    if (!text) return;
    var node = tooltipNode();
    var host = owner.closest('dialog[open]') || document.body;
    node.textContent = text;
    node.hidden = false;
    node.style.position = 'fixed';
    node.style.pointerEvents = 'auto';
    node.style.zIndex = '60';
    if (node.parentNode !== host) host.appendChild(node);
    tooltipOwner = owner;
    positionTooltip(owner, node);
  }

  function setStatus(message) {
    var node = els['status-line'];
    if (node) node.textContent = message;
  }

  /* -------------------------------------------------------------- lifecycle */

  /** Every id is addressable as `els[id]`; a handful of aliases the render code expects. */
  function collectEls() {
    Array.prototype.forEach.call(document.querySelectorAll('[id]'), function (node) {
      if (node.id && !els[node.id]) els[node.id] = node;
    });
    els.main = $('main');
    els.tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
    els.viewswitch = document.querySelector('.viewswitch');
    els.buildsCanvas = document.querySelector('#view-builds .builds');
    els.views = { builds: $('view-builds'), materials: $('view-materials'), worlds: $('view-worlds') };
    els.unitButtons = Array.prototype.slice.call(document.querySelectorAll('#unit-toggle [data-unit]'));
  }

  /* EDICT-0017 §3.8: preferences survive a reload but a stored value wins only when it is one of
     the frozen choices — a stale or hand-edited key must never wedge the UI. */
  function readPref(key, fallback, allowed) {
    var raw = null;
    try { raw = window.localStorage.getItem(key); } catch (error) { raw = null; }
    if (raw !== null && allowed.indexOf(raw) >= 0) return raw;
    return fallback;
  }

  function writePref(key, value) {
    try { window.localStorage.setItem(key, String(value)); } catch (error) { /* storage unavailable */ }
  }

  function readPrefs() {
    ui.units = readPref(PREF_KEY.units, 'items', ['items', 'stacks', 'shulkers']);
    ui.sort = readPref(PREF_KEY.sort, 'remaining', ['remaining', 'name', 'category']);
    ui.hideDone = readPref(PREF_KEY.hideDone, 'off', ['on', 'off']) === 'on';
    ui.sidebarCollapsed = readPref(PREF_KEY.sidebar, 'open', ['open', 'closed']) === 'closed';
    ui.inactiveMode = readPref(PREF_KEY.inactive, 'priority', ['priority', 'end', 'hide']);
  }

  function init() {
    collectEls();
    readPrefs();
    ui.buildsView = readBuildsView();
    var loaded = M.load(window.localStorage);
    var seeded = false;
    if (loaded.error) setStatus(loaded.error);
    state = loaded.state;
    if (!state) {
      /* EDICT-0009 onboarding: an empty browser shows the honest empty states; only an explicit
         `?demo` request seeds the sample world. EDICT-0017 §5.9 then adds the v1 write-back. */
      state = M.emptyState();
      if (/[?&]demo\b/.test(window.location.search)) {
        state = M.seedState();
        M.save(window.localStorage, state);
        seeded = true;
      }
    } else if (state.migratedFrom === 1) {
      /* contract §5.9: a v1 document loads, migrates and is written back under the v2 key
         (the v1 key is untouched; save() drops the one-session flag from the payload). */
      var migratedWrite = M.save(window.localStorage, state);
      if (migratedWrite.error) setStatus(migratedWrite.error);
    }
    ui.selectedBuildId = null;
    selectInitialBuild();
    applySidebarCollapsed();
    applyUnits();
    applyInactiveMode();
    bind();
    bindExtras();
    var tabParam = /[?&]tab=(builds|materials|worlds)\b/.exec(window.location.search);
    if (tabParam) setView(tabParam[1]);
    renderMigratedNotice();
    renderAll();
    probeBackdrop();
    initMotion();
    setStatus(seeded ? 'Loaded sample data.' : 'Loaded from this browser.');
  }
  function commit(next) {
    state = next;
    var saved = M.save(window.localStorage, state);
    if (saved.error) toast(saved.error, true);
    renderAll();
  }

  function activeWorld() {
    return M.activeWorld(state);
  }

  /**
   * The explicitly selected build only. There is deliberately no `|| world.builds[0]` fallback:
   * a null or stale selection must render the empty detail panel (case 11), so the first paint
   * is seeded exactly once by selectInitialBuild() at boot and after a world activation.
   */
  function selectedBuild() {
    var world = activeWorld();
    if (!world) return null;
    return M.findBuild(world, ui.selectedBuildId);
  }

  /** The active world plus the selected build, or null — every detail action needs both. */
  function currentBuild() {
    var world = activeWorld();
    var build = selectedBuild();
    return world && build ? { world: world, build: build } : null;
  }

  /** Seed the detail panel with a build once per world activation. Never called from a render path. */
  function selectInitialBuild() {
    var world = activeWorld();
    if (!world) { ui.selectedBuildId = null; return; }
    var current = M.findBuild(world, ui.selectedBuildId);
    ui.selectedBuildId = current ? current.id : (world.builds.length ? world.builds[0].id : null);
  }

  /* ------------------------------------------------------------------ bind */

  function bind() {
    els.tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { setView(tab.dataset.view); });
      tab.addEventListener('keydown', function (event) {
        var index = els.tabs.indexOf(tab);
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          var next = event.key === 'ArrowRight'
            ? els.tabs[(index + 1) % els.tabs.length]
            : els.tabs[(index - 1 + els.tabs.length) % els.tabs.length];
          next.focus();
          setView(next.dataset.view);
        }
      });
    });

    els['world-select'].addEventListener('change', function () {
      var result = M.setActiveWorld(state, els['world-select'].value);
      if (result.error) { toast(result.error, true); return; }
      state = result.state;
      ui.selectedBuildId = null;
      selectInitialBuild();
      commit(state);
    });

    els['btn-new-world'].addEventListener('click', function () { openWorldDialog(null); });
    els['btn-new-world-2'].addEventListener('click', function () { openWorldDialog(null); });
    els['btn-sample'].addEventListener('click', function () {
      state = M.seedState();
      M.save(window.localStorage, state);
      ui.selectedBuildId = null;
      selectInitialBuild();
      renderAll();
      toast('Sample worlds loaded.');
    });

    els['backdrop-pause'].addEventListener('click', function () { toggleMotion(); });
    bindViewSwitch();
    bindEdict0017();
    els['btn-new-build'].addEventListener('click', function () { openBuildDialog(null); });
    els['btn-first-build'].addEventListener('click', function () { openBuildDialog(null); });

    /* Built entries are divs with their own buttons (§4), so one delegated listener covers
       select, activate and remove; the row itself stays the drag handle owner. */
    els['build-list'].addEventListener('click', function (event) {
      var activate = event.target.closest ? event.target.closest('[data-build-activate]') : null;
      if (activate) { toggleBuildActive(activate.getAttribute('data-build-activate')); return; }
      var edit = event.target.closest ? event.target.closest('[data-build-edit]') : null;
      if (edit) { openBuildDialog(edit.getAttribute('data-build-edit')); return; }
      var remove = event.target.closest ? event.target.closest('[data-build-remove]') : null;
      if (remove) { confirmDeleteBuild(remove.getAttribute('data-build-remove')); return; }
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      if (!entry) return;
      selectBuild(entry.getAttribute('data-build'));
    });

    els['status-group'].addEventListener('click', function (event) {
      var button = event.target.closest('[data-status]');
      if (!button) return;
      var world = activeWorld();
      var build = selectedBuild();
      if (!world || !build) return;
      var result = M.updateBuild(state, world.id, build.id, { status: button.dataset.status });
      if (result.error) { toast(result.error, true); return; }
      commit(result.state);
    });

    /* EDICT-0013 D2: the name is renamed in place from the section head, never from a form row. */
    function startTitleEdit() {
      var context = currentBuild();
      if (!context) return;
      ui.titleEditing = true;
      renderDetail();
      els['build-name'].value = context.build.name;
      els['build-name'].focus();
      els['build-name'].select();
    }

    function cancelTitleEdit() {
      ui.titleEditing = false;
      renderDetail();
      // Case 33 / contract §1: focus returns to the trigger that opened the editor.
      els['build-rename'].focus();
    }

    function saveTitleEdit() {
      var context = currentBuild();
      if (!context) return;
      var result = M.updateBuild(state, context.world.id, context.build.id, { name: els['build-name'].value });
      if (result.error) {
        toast(result.error, true);
        els['build-name'].focus();
        return;
      }
      ui.titleEditing = false;
      commit(result.state);
      els['build-rename'].focus();
    }

    els['build-rename'].addEventListener('click', startTitleEdit);
    els['build-name-save'].addEventListener('click', saveTitleEdit);
    els['build-name-cancel'].addEventListener('click', cancelTitleEdit);
    els['build-name'].addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); saveTitleEdit(); }
      else if (event.key === 'Escape') { event.preventDefault(); cancelTitleEdit(); }
    });
    // No commit on blur: Escape and Cancel must be able to leave the name untouched (contract §1).
    els['build-coords'].addEventListener('change', function () {
      var context = currentBuild();
      if (!context) return;
      var typed = String(els['build-coords'].value || '').trim();
      var parts = parseCoords(typed);
      var stored = parts ? machineCoords(parts) : typed;
      commit(M.updateBuild(state, context.world.id, context.build.id, { coords: stored }).state);
    });
    els['copy-coords'].addEventListener('click', function () {
      var context = currentBuild();
      var coords = context ? String(context.build.coords).trim() : '';
      if (!coords) { toast('This build has no coordinates yet.', true); return; }
      var mine = parseCoords(coords);
      copyText(mine ? formatCoords(mine) : coords, 'Coordinates copied');
    });

    /* EDICT-0013 D4: notes read as text; the textarea only exists while editing. */
    function startNotesEdit() {
      var context = currentBuild();
      if (!context) return;
      ui.notesEditing = true;
      renderDetail();
      els['build-notes'].value = context.build.notes;
      els['build-notes'].focus();
    }

    function cancelNotesEdit() {
      ui.notesEditing = false;
      renderDetail();
      els['notes-edit'].focus();
    }

    function saveNotesEdit() {
      var context = currentBuild();
      if (!context) return;
      var result = M.updateBuild(state, context.world.id, context.build.id, { notes: els['build-notes'].value });
      if (result.error) { toast(result.error, true); return; }
      ui.notesEditing = false;
      commit(result.state);
      els['notes-edit'].focus();
    }

    els['notes-edit'].addEventListener('click', startNotesEdit);
    els['notes-save'].addEventListener('click', saveNotesEdit);
    els['notes-cancel'].addEventListener('click', cancelNotesEdit);
    els['build-notes'].addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        saveNotesEdit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelNotesEdit();
      }
    });

    els['build-delete'].addEventListener('click', function () {
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      askConfirm('Delete build?', 'Delete "' + build.name + '" and its material list? You can undo this from the notice.', 'Delete', function () {
        // Clear the selection BEFORE committing: renderAll() runs inside commit() and would
        // otherwise fall back to the next build, hiding the empty state the last delete leaves.
        var before = snapshotState();
        var deletedId = build.id;
        ui.selectedBuildId = null;
        ui.titleEditing = false;
        ui.notesEditing = false;
        commit(M.deleteBuild(state, world.id, build.id).state);
        offerUndo(before, 'Build deleted.', deletedId);
      });
    });

    /* EDICT-0017 §3: the Needed cell is a plain text input — select-all on focus, commit on
       blur/Enter, Escape reverts. No per-row copy of stock lives here: it belongs to the world. */
    els['material-body'].addEventListener('change', function (event) {
      var input = event.target.closest ? event.target.closest('[data-mat-field="needed"]') : null;
      if (input) commitNeeded(input);
    });

    els['material-body'].addEventListener('focusout', function (event) {
      var input = event.target.closest ? event.target.closest('[data-mat-field="needed"]') : null;
      if (!input) return;
      if (input.getAttribute('data-reverted') === '1') {
        input.removeAttribute('data-reverted');
        return;
      }
      /* Item 24: leaving the field commits the typed count. */
      commitNeeded(input);
    });

    els['material-body'].addEventListener('focusin', function (event) {
      if (event.target.matches && event.target.matches('[data-mat-field="needed"]')) {
        /* §4: the display may be stacks/shulkers; editing is always a plain item count. */
        if (ui.units !== 'items') event.target.value = String(event.target.getAttribute('data-prev'));
        selectAll(event.target);
      }
    });

    els['material-body'].addEventListener('keydown', function (event) {
      var input = event.target.closest ? event.target.closest('[data-mat-field="needed"]') : null;
      if (input) {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (commitNeeded(input)) input.blur();
          return;
        }
        if (event.key === 'Escape') {
          input.setAttribute('data-reverted', '1');
          revertNeeded(input);
          input.blur();
          return;
        }
        return;
      }
      var row = event.target.closest ? event.target.closest('.mat-row') : null;
      if (!row || event.target !== row) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openRowInventory(row);
      }
    });

    els['material-body'].addEventListener('click', function (event) {
      var update = event.target.closest ? event.target.closest('[data-mat-update]') : null;
      if (update) { openRowInventory(update); return; }
      /* EDICT-0018 item 24: the Needed cell reads as plain text and becomes an input on click. */
      /* EDICT-0018 item 24: the Needed cell is a plain text input; nothing to swap in. */
      var menu = event.target.closest ? event.target.closest('[data-mat-menu]') : null;
      if (menu) { toggleRowMenu(menu); return; }
      var remove = event.target.closest ? event.target.closest('[data-mat-remove]') : null;
      if (remove) { removeRowMaterial(remove.getAttribute('data-mat-remove')); return; }
      var row = event.target.closest ? event.target.closest('.mat-row') : null;
      if (row && !event.target.closest('input, button, .mat-menu')) openRowInventory(row);
    });

    /* The grid is the same data: a chip opens the same inventory dialog. */
    els['material-grid'].addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('[data-mat]') : null;
      if (!chip) return;
      openRowInventory(chip);
    });

    /* The world Materials tab is a second entry point into the same inventory editor. */
    if (els['world-material-body']) {
      els['world-material-body'].addEventListener('click', function (event) {
        var row = event.target.closest ? event.target.closest('.mat-row') : null;
        if (row) openWorldMaterialInventory(row.getAttribute('data-mat'), row);
      });
      els['world-material-body'].addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        var row = event.target.closest ? event.target.closest('.mat-row') : null;
        if (!row) return;
        event.preventDefault();
        openWorldMaterialInventory(row.getAttribute('data-mat'), row);
      });
    }

    /* AC7/AC12: the chips are buttons, and a keyboard user must be able to open the dialog with
       Enter or Space. The CDP harness (and some assistive tech) dispatches the key without the
       synthetic click a real browser would add, so wire the activation explicitly. */
    els['material-grid'].addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      var chip = event.target.closest ? event.target.closest('[data-mat]') : null;
      if (!chip) return;
      event.preventDefault();
      openRowInventory(chip);
    });

    els['mat-choice'].addEventListener('click', function () {
      els['mat-error'].hidden = true;
      openIconPicker({ scope: 'material', trigger: els['mat-choice'] });
    });

    els['add-material-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      var context = currentBuild();
      if (!context) return;
      var result = M.addMaterial(state, context.world.id, context.build.id, {
        item: els['mat-item'].value,
        needed: els['mat-needed'].value
      });
      if (result.error) {
        els['mat-error'].textContent = result.error;
        els['mat-error'].hidden = false;
        return;
      }
      els['mat-error'].hidden = true;
      setMaterialChoice('');
      els['mat-needed'].value = '1';
      commit(result.state);
      els['mat-choice'].focus();
    });
    els['mat-search'].addEventListener('input', function () {
      ui.query = els['mat-search'].value;
      renderWorldMaterials();
    });
    els['mat-filter'].addEventListener('change', function () {
      ui.filter = els['mat-filter'].value;
      renderWorldMaterials();
    });

    els['btn-copy-list'].addEventListener('click', copyList);

    els['btn-export'].addEventListener('click', exportData);
    els['file-import'].addEventListener('change', importData);

    els['world-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      if (event.submitter && event.submitter.value === 'cancel') {
        els['world-dialog'].close();
        return;
      }
      var input = {
        name: els['world-name'].value,
        edition: els['world-edition'].value,
        version: els['world-version'].value,
        notes: els['world-notes'].value,
        icon: dialogIcon.world
      };
      var result = editingWorldId
        ? M.updateWorld(state, editingWorldId, input)
        : M.createWorld(state, input);
      if (result.error) {
        els['world-error'].textContent = result.error;
        els['world-error'].hidden = false;
        return;
      }
      if (!editingWorldId) {
        state = M.setActiveWorld(result.state, result.world.id).state || result.state;
        ui.selectedBuildId = null;
        selectInitialBuild();
      } else {
        state = result.state;
      }
      M.save(window.localStorage, state);
      els['world-dialog'].close();
      renderAll();
      toast(editingWorldId ? 'World updated.' : 'World created.');
    });

    els['build-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      if (event.submitter && event.submitter.value === 'cancel') {
        els['build-dialog'].close();
        return;
      }
      var world = activeWorld();
      if (!world) {
        /* EDICT-0014 §4: a missing world is a routing problem, not a validation error — take the
           user to the place that fixes it instead of printing an error in the dialog. */
        els['build-dialog'].close();
        setView('worlds');
        openWorldDialog(null);
        toast('Create a world, then add builds to it.', true);
        return;
      }
      var patch = {
        name: els['build-dlg-name'].value,
        status: els['build-dlg-status'].value,
        coords: els['build-dlg-coords'].value
      };
      var editing = ui.dialogBuildId ? M.findBuild(world, ui.dialogBuildId) : null;
      if (editing) {
        /* Only send an icon when the picker changed it: an absent `icon` key keeps `iconAuto`. */
        if (editing.icon !== dialogIcon.build) patch.icon = dialogIcon.build;
        var updated = M.updateBuild(state, world.id, editing.id, patch);
        if (updated.error) {
          els['build-error'].textContent = updated.error;
          els['build-error'].hidden = false;
          return;
        }
        state = updated.state;
        ui.selectedBuildId = editing.id;
        M.save(window.localStorage, state);
        els['build-dialog'].close();
        renderAll();
        toast('Build updated.');
        return;
      }
      var result = M.createBuild(state, world.id, {
        name: patch.name,
        status: patch.status,
        coords: patch.coords,
        icon: dialogIcon.build
      });
      if (result.error) {
        els['build-error'].textContent = result.error;
        els['build-error'].hidden = false;
        return;
      }
      state = result.state;
      ui.selectedBuildId = result.build.id;
      M.save(window.localStorage, state);
      els['build-dialog'].close();
      renderAll();
      toast('Build created.');
    });

    els['confirm-dialog'].addEventListener('close', function () {
      var action = pendingConfirm;
      pendingConfirm = null;
      if (els['confirm-dialog'].returnValue === 'confirm' && typeof action === 'function') action();
    });

    els['world-icon-change'].addEventListener('click', function () { openIconPicker({ scope: 'world', trigger: els['world-icon-change'] }); });
    els['world-icon-remove'].addEventListener('click', function () { dialogIcon.world = null; renderIconPreview('world'); });
    els['build-dlg-icon-change'].addEventListener('click', function () { openIconPicker({ scope: 'build', trigger: els['build-dlg-icon-change'] }); });
    els['build-dlg-icon-remove'].addEventListener('click', function () { dialogIcon.build = null; renderIconPreview('build'); });
    els['detail-avatar'].addEventListener('click', function () {
      if (selectedBuild()) openIconPicker({ scope: 'build-detail', trigger: els['detail-avatar'] });
    });

    els['icon-search'].addEventListener('input', function () {
      /* A new query starts the batch over; otherwise a narrowed search would inherit the paging
         offset of the previous one (case 51). */
      ui.pickerShown = PICKER_BATCH;
      renderIconPicker();
    });
    /* #icon-cancel is the form's first submit button, so an implicit Enter submission would
       count as Cancel. Enter in the search field confirms the draft instead (never in item
       mode, where a click on a tile is the only way to choose). */
    els['icon-search'].addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (ui.pickerMode === 'item') return;
      useIconDraft();
    });
    els['icon-grid'].addEventListener('click', function (event) {
      var tile = event.target.closest('.icon-tile');
      if (!tile) return;
      /* Pick-item mode: one click chooses the item and closes (contract §5). */
      if (ui.pickerMode === 'item') {
        var chosen = tile.dataset.iconSlug;
        if (!chosen) return;
        var entry = catalogEntry(chosen);
        var picked = tile.dataset.iconCustom
          ? customPickerName(chosen)
          : (entry ? entry.name : '');
        setMaterialChoice(picked || customPickerName(chosen) || titleSlug(chosen));
        els['icon-dialog'].close();
        els['mat-choice'].focus();
        return;
      }
      if (tile.dataset.iconNone) {
        draftIcon = null;
      } else {
        var slug = tile.dataset.iconSlug;
        if (!slug || ICON_SET.indexOf(slug) < 0) return;
        draftIcon = { kind: 'item', slug: slug };
      }
      /* The custom-material icon field commits on the tile click and leaves the form open. */
      if (ui.pickerMode === 'custom-icon') { useIconDraft(); return; }
      renderIconPicker();
    });
    els['icon-upload'].addEventListener('click', function () { els['icon-file'].click(); });
    els['icon-file'].addEventListener('change', function () {
      var file = els['icon-file'].files && els['icon-file'].files[0];
      if (!file) return;
      els['icon-error'].hidden = true;
      processImageFile(file).then(function (result) {
        els['icon-file'].value = '';
        if (result.error) {
          els['icon-error'].textContent = result.error;
          els['icon-error'].hidden = false;
          toast(result.error, true);
          return;
        }
        draftIcon = result.icon;
        renderIconPicker();
      });
    });
    els['icon-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      if (event.submitter && event.submitter.value === 'cancel') {
        els['icon-dialog'].close();
        return;
      }
      useIconDraft();
    });
    els['icon-dialog'].addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      // A focused <input type="search"> swallows Escape to clear itself, which would trap
      // the user inside the dialog. First Escape clears the query, the next one closes.
      if (document.activeElement === els['icon-search'] && els['icon-search'].value) {
        event.preventDefault();
        els['icon-search'].value = '';
        ui.pickerShown = PICKER_BATCH;
        renderIconPicker();
        return;
      }
      event.preventDefault();
      els['icon-dialog'].close();
    });
    els['icon-dialog'].addEventListener('close', function () {
      iconTarget = null;
      if (pickerObserver) { pickerObserver.disconnect(); pickerObserver = null; }
      hideTooltip();
      var trigger = lastIconTrigger;
      lastIconTrigger = null;
      if (!trigger || typeof trigger.focus !== 'function') return;
      /* Case 32: the browser resets focus right after a dialog closes, which wipes a synchronous
         .focus() — restore the invoking control from the close event, deferred to the next frame
         and re-checked once focus has actually been dropped (never steals a live focus target). */
      function restore() {
        if (!document.activeElement || document.activeElement === document.body) trigger.focus();
      }
      window.requestAnimationFrame(function () { trigger.focus(); });
      window.setTimeout(restore, 0);
      window.setTimeout(restore, 48);
    });

    /* EDICT-0014 §4: every zero state offers the action that ends it, in place. */
    els['btn-empty-create-world'].addEventListener('click', function () { openWorldDialog(null); });
    els['detail-empty-action'].addEventListener('click', function () { openBuildDialog(); });
    els['btn-empty-pick-material'].addEventListener('click', function () {
      if (!currentBuild()) { openBuildDialog(); return; }
      els['mat-choice'].focus();
      if (els['mat-choice'].scrollIntoView) els['mat-choice'].scrollIntoView({ block: 'nearest' });
    });
    els['btn-empty-reset-filter'].addEventListener('click', function () {
      ui.query = '';
      els['mat-search'].value = '';
      ui.filter = 'all';
      els['mat-filter'].value = 'all';
      renderWorldMaterials();
      els['mat-search'].focus();
    });

    /* EDICT-0017 §6.2: paste is parsed before it is imported — the preview dialog is the review;
       nothing is committed until #paste-ok is pressed. */
    els['bulk-paste'].addEventListener('click', function () {
      if (!currentBuild()) {
        els['mat-error'].textContent = 'Add a build before pasting materials.';
        els['mat-error'].hidden = false;
        return;
      }
      openPastePreview();
    });
    /* EDICT-0014 §3: one delegated tooltip pair for every [data-tip] surface in the document. */
    document.addEventListener('pointerover', function (event) {
      var owner = event.target && event.target.closest ? event.target.closest('[data-tip]') : null;
      if (!owner) return;
      if (tooltipOwner && (tooltipOwner === owner || tooltipOwner.contains(event.target))) return;
      showTooltip(owner);
    });
    document.addEventListener('pointerout', function (event) {
      if (!tooltipOwner) return;
      var next = event.relatedTarget;
      if (next && (tooltipOwner === next || tooltipOwner.contains(next))) return;
      hideTooltip();
    });
    window.addEventListener('scroll', hideTooltip, true);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') hideTooltip();
    }, true);

    /* EDICT-0014 §2: the scroll fallback for paging when IntersectionObserver is unavailable. */
    els['icon-grid'].addEventListener('scroll', function () {
      var grid = els['icon-grid'];
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 48) loadMorePicker();
    });
    document.addEventListener('keydown', function (event) {
      if (document.querySelector('dialog[open]')) return;
      if (ui.titleEditing) {
        if (event.key === 'Enter') { event.preventDefault(); saveTitleEdit(); return; }
        if (event.key === 'Escape') { event.preventDefault(); cancelTitleEdit(); return; }
      }
      if (ui.notesEditing) {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          saveNotesEdit();
          return;
        }
        if (event.key === 'Escape') { event.preventDefault(); cancelNotesEdit(); }
      }
    });
  }

  function setView(view) {
    ui.view = view;
    els.tabs.forEach(function (tab) {
      var selected = tab.dataset.view === view;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
    Object.keys(els.views).forEach(function (key) {
      els.views[key].hidden = key !== view;
    });
    applyViewMode();
  }

  /* ---------------------------------------------------------------- dialogs */

  function openWorldDialog(worldId) {
    editingWorldId = worldId;
    var world = worldId ? M.findWorld(state, worldId) : null;
    els['world-dialog-title'].textContent = world ? 'Edit World' : 'New World';
    els['world-save'].textContent = world ? 'Save' : 'Create';
    els['world-name'].value = world ? world.name : '';
    els['world-edition'].value = world ? world.edition : 'java';
    els['world-version'].value = world ? world.version : '';
    els['world-notes'].value = world ? world.notes : '';
    dialogIcon.world = world ? world.icon || null : null;
    renderIconPreview('world');
    els['world-error'].hidden = true;
    els['world-dialog'].showModal();
    els['world-name'].focus();
  }

  function openBuildDialog(buildId) {
    if (!state.worlds.length) {
      /* EDICT-0014 §4: the empty build list sends the user straight to world creation. */
      setView('worlds');
      openWorldDialog(null);
      return;
    }
    var world = activeWorld();
    var build = buildId && world ? M.findBuild(world, buildId) : null;
    ui.dialogBuildId = build ? build.id : null;
    els['build-dialog-title'].textContent = build ? 'Edit Build' : 'New Build';
    els['build-dialog-save'].textContent = build ? 'Save build' : 'Create build';
    els['build-dlg-name'].value = build ? build.name : '';
    els['build-dlg-status'].value = build ? build.status : 'planned';
    els['build-dlg-coords'].value = build ? build.coords : '';
    dialogIcon.build = build ? build.icon || null : null;
    renderIconPreview('build');
    els['build-error'].hidden = true;
    els['build-dialog'].showModal();
    els['build-dlg-name'].focus();
    if (build) els['build-dlg-name'].select();
  }

  function askConfirm(title, text, label, action) {
    els['confirm-title'].textContent = title;
    els['confirm-text'].textContent = text;
    els['confirm-ok'].textContent = label;
    pendingConfirm = action;
    els['confirm-dialog'].showModal();
  }

  /* ---------------------------------------------------------------- render */

  /**
   * EDICT-0017 §3: one render pass per state change. Order matters only for the things that read
   * `state`; every panel paints from `M.allocate()`/`worldSummary()` so no two surfaces disagree.
   */
  function renderAll() {
    renderWorldPicker();
    renderBuilds();
    renderWorldStats();
    renderDetail();
    renderCompact();
    renderWorldMaterials();
    renderWorlds();
    renderMaterialChoice();
    applySidebarCollapsed();
    applyUnits();
    applyInactiveMode();
    setView(ui.view);
  }
  function formatCount(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function countLabel(value, singular) {
    var count = Number(value) || 0;
    return count + ' ' + singular + (count === 1 ? '' : 's');
  }

  /* -------------------------------------------------------------- timestamps */

  /**
   * EDICT-0017 §3: every timestamp is a `.stamp[data-iso]` — visible text is the UTC
   * `YYYY-MM-DD HH:MM` from `M.formatStamp`, the raw ISO rides `title` (and `datetime`), so the
   * frozen cases can assert both the human line and the machine value.
   */
  /* §3: `.stamp` carries only the UTC slice; the human label ("Updated …") is a sibling text
     node so the element's own text matches `YYYY-MM-DD HH:MM` exactly. */
  function stampNode(iso, label) {
    var node = document.createElement('time');
    node.className = 'stamp';
    var text = M.formatStamp(iso);
    if (text !== '\u2014') {
      node.setAttribute('datetime', String(iso));
      node.setAttribute('title', String(iso));
      node.setAttribute('data-iso', String(iso));
    }
    node.textContent = text;
    var fragment = document.createDocumentFragment();
    if (label) fragment.appendChild(document.createTextNode(label + ' '));
    fragment.appendChild(node);
    return fragment;
  }

  function stampFragment(entity) {
    var stamps = M.timestamps(entity);
    var updated = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    var fragment = document.createDocumentFragment();
    fragment.appendChild(stampNode(stamps.createdAt, 'Created'));
    fragment.appendChild(document.createTextNode(' \u00b7 '));
    fragment.appendChild(stampNode(updated, 'Updated'));
    return fragment;
  }

  /**
   * EDICT-0018 item 22: "Updated 5 min ago" with the exact UTC slice on the tooltip. One helper so
   * the detail meta and the world meta can never drift apart.
   */
  function updatedFragment(iso) {
    var fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode('Updated '));
    var node = document.createElement('time');
    node.className = 'stamp';
    var text = M.formatStamp(iso);
    if (text === '\u2014') {
      node.textContent = '\u2014';
      node.title = 'No timestamp recorded';
    } else {
      node.textContent = relativeTime(iso);
      node.setAttribute('datetime', String(iso));
      node.setAttribute('title', 'Updated ' + text + ' (' + String(iso) + ')');
      node.setAttribute('data-iso', String(iso));
    }
    node.setAttribute('data-relative', '');
    fragment.appendChild(node);
    return fragment;
  }

  function timeHtml(iso, label) {
    var text = M.formatStamp(iso);
    var attrs = text === '\u2014'
      ? ' class="stamp"'
      : ' class="stamp" datetime="' + escapeHtml(iso) + '" title="' + escapeHtml(iso) + '"' +
        ' data-iso="' + escapeHtml(iso) + '"';
    return escapeHtml(label) + ' <time' + attrs + '>' + escapeHtml(text) + '</time>';
  }

  function stampHtml(entity) {
    var stamps = M.timestamps(entity);
    var updated = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    return timeHtml(stamps.createdAt, 'Created') + ' \u00b7 ' + timeHtml(updated, 'Updated');
  }
  /* ------------------------------------------------------------ builds view */

  function readBuildsView() {
    try {
      return window.localStorage.getItem(BUILDS_VIEW_KEY) === 'compact' ? 'compact' : 'standard';
    } catch (error) {
      return 'standard';
    }
  }

  function writeBuildsView(value) {
    try {
      window.localStorage.setItem(BUILDS_VIEW_KEY, value === 'compact' ? 'compact' : 'standard');
    } catch (error) {
      /* A blocked localStorage must not break the switcher. */
    }
  }

  /** The one place that decides which canvas, which sidebar and which switcher is visible. */
  function applyViewMode() {
    var compact = ui.view === 'builds' && ui.buildsView === 'compact';
    if (els.viewswitch) els.viewswitch.hidden = ui.view !== 'builds';
    if (els['view-standard']) {
      els['view-standard'].setAttribute('aria-pressed', ui.buildsView === 'standard' ? 'true' : 'false');
    }
    if (els['view-compact']) {
      els['view-compact'].setAttribute('aria-pressed', ui.buildsView === 'compact' ? 'true' : 'false');
    }
    /* `hidden` is not enough on its own: a class-keyed rule (`#main.is-compact …`) keeps the
       sidebar and the standard canvas collapsed even where a display rule beats [hidden]. */
    var main = els.main || document.getElementById('main');
    if (main) main.classList.toggle('is-compact', compact);
    if (main) main.classList.toggle('is-sidebar-hidden', compact || ui.view === 'worlds');
    if (els.views && els.views.builds) els.views.builds.classList.toggle('is-compact', compact);
    if (els['world-panel']) els['world-panel'].hidden = ui.view === 'worlds' || compact;
    if (els.buildsCanvas) els.buildsCanvas.hidden = compact;
    if (els['compact-view']) els['compact-view'].hidden = !compact;
  }

  /** One delegated listener on the switcher: survives re-renders and needs no per-button binding. */
  function bindViewSwitch() {
    if (!els.viewswitch) return;
    els.viewswitch.addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('.viewswitch__btn') : null;
      if (!button || !els.viewswitch.contains(button)) return;
      var want = button.id === 'view-compact' ? 'compact' : 'standard';
      if (ui.buildsView === want) return;
      ui.buildsView = want;
      writeBuildsView(want);
      renderAll();
    });
  }

  /* ------------------------------------------------------------- compact view */

  function renderCompact() {
    var world = activeWorld();
    if (!els['compact-grid']) return;
    if (els['compact-hide-done']) els['compact-hide-done'].checked = !!ui.hideDone;
    renderCompactWorldLine(world);
    var alloc = world ? M.allocate(world) : null;
    els['compact-grid'].innerHTML = world
      ? buildsForList(world).map(function (build) {
          return compactCardHtml(world, build, alloc, world.builds.indexOf(build) + 1);
        }).join('')
      : '';
    wireIconFallbacks(els['compact-grid']);
  }

  /** Identity only: the gathered sentence belongs to the sidebar, once per panel (§1 AC1). */
  function renderCompactWorldLine(world) {
    var node = els['compact-world'];
    if (!node) return;
    node.textContent = '';
    if (!world) {
      node.textContent = 'No world selected';
      return;
    }
    var identity = world.name + ' \u00b7 ' + (world.edition === 'bedrock' ? 'Bedrock' : 'Java');
    if (world.version) identity += ' ' + world.version;
    node.textContent = identity;
  }

  function compactCardHtml(world, build, alloc, rank) {
    var progress = (alloc.perBuild[build.id]) || { covered: 0, needed: 0 };
    var pct = pctOf(progress.covered, progress.needed);
    var materials = (build.materials || []).filter(function (material) {
      if (!ui.hideDone) return true;
      return build.status !== 'done' && (alloc.perMaterial[material.id] || 0) < Math.max(1, Math.floor(Number(material.needed) || 1));
    });
    var classes = 'ccard' +
      (build.status === 'done' ? ' ccard--done' : '') +
      (build.active === false ? ' ccard--inactive' : '') +
      (build.id === ui.selectedBuildId ? ' ccard--selected' : '');
    return '<article class="' + classes + '" data-build="' + escapeHtml(build.id) + '">' +
      '<div class="ccard__head">' +
        '<span class="ccard__rank" aria-label="Priority ' + rank + '" title="Priority ' + rank + '">' + rank + '</span>' +
        '<span class="ccard__avatar">' + avatarHtml(build.icon, 24, build.name) + '</span>' +
        '<span class="ccard__name" id="ccard-name-' + escapeHtml(build.id) + '">' + escapeHtml(build.name) + '</span>' +
        '<span class="chip chip--' + escapeHtml(build.status) + '">' +
          escapeHtml(STATUS_LABEL[build.status] || build.status) + '</span>' +
        '<span class="ccard__actions">' +
          '<button class="mc-btn mc-btn--xs" type="button" data-ccard-edit="' + escapeHtml(build.id) + '"' +
            ' aria-label="Edit ' + escapeHtml(build.name) + '">' + PENCIL_ICON + '</button>' +
          '<button class="mc-btn mc-btn--xs" type="button" data-ccard-delete="' + escapeHtml(build.id) + '"' +
            ' aria-label="Delete ' + escapeHtml(build.name) + '">' + TRASH_ICON + '</button>' +
        '</span>' +
      '</div>' +
      '<div class="ccard__progress">' +
        '<div class="ccard__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
          '<div class="ccard__fill" style="width:' + pct + '%"></div>' +
        '</div>' +
        '<p class="ccard__pct">' + pct + '%</p>' +
      '</div>' +
      '<div class="ccard__matrix">' +
        /* EDICT-0018 item 3: completed chips dim and sink to the end of the card. */
        materials.slice().sort(function (left, right) {
          var leftDone = build.status === 'done' || (alloc.perMaterial[left.id] || 0) >= left.needed ? 1 : 0;
          var rightDone = build.status === 'done' || (alloc.perMaterial[right.id] || 0) >= right.needed ? 1 : 0;
          return leftDone - rightDone;
        }).map(function (material) {
          return compactTileHtml(world, build, material, alloc);
        }).join('') +
      '</div>' +
      '</article>';
  }

  /** A tile is a shortcut to `#inventory-dialog` for that material (§3), not the retired tile form. */
  function compactTileHtml(world, build, material, alloc) {
    var slug = slugifyItem(material.item);
    var needed = Math.max(1, Math.floor(Number(material.needed) || 1));
    var covered = build.status === 'done'
      ? needed
      : Math.max(0, Math.floor(Number(alloc.perMaterial[material.id]) || 0));
    var remaining = Math.max(0, needed - covered);
    var stack = stackSizeFor(material.item) || M.DEFAULT_STACK;
    var stacks = stackMapFor(slug, stack);
    var shown = remaining > 0 ? remaining : needed;
    var notation = M.stackNotation(shown, slug, stacks, 'stacks');
    var tip = material.item + ' \u00b7 need ' + M.formatUnits(needed, slug, ui.units, stacks) +
      ' \u00b7 have ' + M.formatUnits(covered, slug, ui.units, stacks) +
      ' \u00b7 ' + (remaining === 0 ? 'done' : M.formatUnits(remaining, slug, ui.units, stacks) + ' left') +
      ' \u00b7 exact ' + shown + ' items \u00b7 ' + notation;
    return '<button class="ctile' + (remaining === 0 ? ' ctile--done' : '') + '" type="button"' +
      ' data-build="' + escapeHtml(build.id) + '" data-mat="' + escapeHtml(material.id) + '"' +
      ' data-tip="' + escapeHtml(tip) + '" aria-label="' + escapeHtml(tip) + '" title="' + escapeHtml(tip) + '">' +
      '<span class="ctile__count" aria-hidden="true">' + escapeHtml(M.formatUnits(shown, slug, ui.units, stacks)) + '</span>' +
      '<span class="slot" aria-hidden="true">' + slotInnerHtml(material.item, true) + '</span>' +
      (remaining === 0 ? '<span class="ctile__done" aria-hidden="true">' + CHECK_ICON + '</span>' : '') +
      '</button>';
  }
  function confirmDeleteBuild(buildId) {
    var world = activeWorld();
    if (!world) return;
    var build = M.findBuild(world, buildId);
    if (!build) return;
    askConfirm('Delete build?', 'Delete "' + build.name + '" and its material list? You can undo this from the notice.', 'Delete', function () {
      var before = snapshotState();
      var deletedId = build.id;
      if (ui.selectedBuildId === build.id) {
        ui.selectedBuildId = null;
        ui.titleEditing = false;
        ui.notesEditing = false;
      }
      commit(M.deleteBuild(state, world.id, build.id).state);
      offerUndo(before, 'Build deleted.', deletedId);
    });
  }

  function bindCompactView() {
    if (!els['compact-grid']) return;
    els['compact-grid'].addEventListener('click', function (event) {
      var button = event.target.closest ? event.target.closest('button') : null;
      if (!button) return;
      var editId = button.getAttribute('data-ccard-edit');
      if (editId) { openBuildDialog(editId); return; }
      var deleteId = button.getAttribute('data-ccard-delete');
      if (deleteId) { confirmDeleteBuild(deleteId); return; }
      var tile = button.closest('.ctile');
      if (!tile) return;
      openInventoryFor(tile.getAttribute('data-build'), tile.getAttribute('data-mat'), tile);
    });
  }
  /* ============================================================== EDICT-0017 */

  /** Replace one world inside a cloned state — world-scoped mutators return `{ state, world }`. */
  function adoptWorld(nextWorld) {
    if (!state || !nextWorld) return;
    var next = JSON.parse(JSON.stringify(state));
    for (var i = 0; i < next.worlds.length; i += 1) {
      if (next.worlds[i].id === nextWorld.id) { next.worlds[i] = nextWorld; break; }
    }
    commit(next);
  }

  function toggleBuildActive(buildId) {
    var world = activeWorld();
    if (!world) return;
    var build = M.findBuild(world, buildId);
    if (!build) return;
    var result = M.setBuildActive(world, buildId, build.active === false);
    if (result.error) { toast(result.error, true); return; }
    adoptWorld(result.world);
  }

  function removeRowMaterial(materialId) {
    var context = currentBuild();
    if (!context) return;
    closeRowMenus();
    var before = snapshotState();
    var buildId = context.build.id;
    commit(M.deleteMaterial(state, context.world.id, context.build.id, materialId).state);
    offerUndo(before, 'Material removed.', buildId);
  }

  /* ---- the Needed cell: commit on blur/Enter, revert on Escape ---- */

  /** §4: the unit toggle shapes every visible quantity, Needed included. Editing is always in
      items, so focus converts the formatted display back to a plain integer. */
  function neededDisplay(input, value) {
    var matId = input.getAttribute('data-mat');
    var context = currentBuild();
    if (!context) return String(value);
    var material = null;
    (context.build.materials || []).forEach(function (row) {
      if (row.id === matId) material = row;
    });
    var slug = material ? slugifyItem(material.item) : '';
    var stack = material ? (stackSizeFor(material.item) || M.DEFAULT_STACK) : M.DEFAULT_STACK;
    return rowUnits(value, slug, stack);
  }

  function commitNeeded(input) {
    var context = currentBuild();
    if (!context) return false;
    var matId = input.getAttribute('data-mat');
    var previous = Math.max(1, Math.floor(Number(input.getAttribute('data-prev')) || 1));
    var raw = String(input.value || '').trim();
    var next = Number(raw);
    if (raw === '' || !isFinite(next)) {
      input.value = neededDisplay(input, previous);
      return false;
    }
    var clamped = Math.max(1, Math.floor(next));
    input.setAttribute('data-prev', String(clamped));
    if (clamped === previous) {
      input.value = neededDisplay(input, clamped);
      return true;
    }
    commit(M.updateMaterial(state, context.world.id, context.build.id, matId, { needed: clamped }).state);
    return true;
  }

  /** EDICT-0018 item 24: the Needed cell is always a text input, styled like plain text until it
   * is focused; editing it therefore needs no swap step and this helper only normalises the value. */
  function startNeededEdit(input) {
    if (!input) return;
    /* Editing is always a plain item count, even when the display unit is stacks or shulkers. */
    input.value = String(Math.max(1, Math.floor(Number(input.getAttribute('data-prev')) || 1)));
    input.focus();
    if (input.select) input.select();
  }

  function finishNeededEdit(input) {
    if (input && input.blur) input.blur();
  }

  function revertNeeded(input) {
    var previous = Math.max(1, Math.floor(Number(input.getAttribute('data-prev')) || 1));
    input.value = neededDisplay(input, previous);
  }

  function selectAll(input) {
    try { input.select(); } catch (error) { /* readonly inputs just keep the caret */ }
  }

  /* ---- #inventory-dialog: absolute stock and ±relative amounts (§3.7) ---- */

  function currentInvTarget() {
    return ui.invTarget;
  }

  function showInvError(message) {
    if (!els['inv-error']) return;
    els['inv-error'].textContent = message || '';
    els['inv-error'].hidden = !message;
  }

  /** Open the shared dialog for one material; `build` may differ from the selected build. */
  function openInventoryFor(buildId, materialId, trigger) {
    var world = activeWorld();
    if (!world) return;
    var build = M.findBuild(world, buildId);
    if (!build) return;
    var material = null;
    (build.materials || []).forEach(function (row) {
      if (row.id === materialId) material = row;
    });
    if (!material) return;
    var slug = slugifyItem(material.item);
    var alloc = M.allocate(world);
    var inventory = M.inventoryOf(world);
    var stack = resolvedStackFor(material.item, build);
    var stacks = stackMapFor(slug, stack);
    var covered = Math.max(0, Math.floor(Number(alloc.perMaterial[material.id]) || 0));
    var needed = Math.max(1, Math.floor(Number(material.needed) || 1));
    var stock = Math.max(0, Math.floor(Number(inventory[slug]) || 0));
    ui.invTarget = { buildId: build.id, materialId: material.id, slug: slug, item: material.item, stack: stack };
    /* EDICT-0018 item 27: the dialog shows the item itself and every build using it, with the
       same In world / Allocated numbers as the table (item 6). */
    if (els['inv-title']) els['inv-title'].textContent = 'Update inventory';
    if (els['inv-icon']) {
      els['inv-icon'].innerHTML = slotInnerHtml(material.item, true);
      wireIconFallbacks(els['inv-icon']);
    }
    if (els['inv-item']) els['inv-item'].textContent = material.item;
    if (els['inv-context']) {
      els['inv-context'].textContent = (build && build.name ? build.name + ' · ' : '') +
        M.formatUnits(covered, slug, ui.units, stacks) + ' allocated of ' +
        M.formatUnits(needed, slug, ui.units, stacks) + ' needed · ' +
        M.formatUnits(stock, slug, ui.units, stacks) + ' in world';
    }
    renderInventoryBuilds(world, slug, alloc);
    ui.invTrigger = trigger && trigger.focus ? trigger : null;
    if (els['inv-absolute']) els['inv-absolute'].value = String(stock);
    if (els['inv-delta']) els['inv-delta'].value = '';
    showInvError('');
    if (els['inventory-dialog']) {
      if (typeof els['inventory-dialog'].showModal === 'function') els['inventory-dialog'].showModal();
    }
    refreshInvPreview();
    if (els['inv-absolute']) { els['inv-absolute'].focus(); selectAll(els['inv-absolute']); }
    return trigger || null;
  }

  function openWorldMaterialInventory(slug, trigger) {
    var world = activeWorld();
    if (!world) return;
    for (var i = 0; i < world.builds.length; i += 1) {
      var build = world.builds[i];
      if (build.active === false) continue;
      for (var j = 0; j < (build.materials || []).length; j += 1) {
        var material = build.materials[j];
        if (slugifyItem(material.item) === slug) {
          openInventoryFor(build.id, material.id, trigger);
          return;
        }
      }
    }
  }

  /** Item 27: every build that needs the item, with its need and the allocated part. */
  function renderInventoryBuilds(world, slug, alloc) {
    if (!els['inv-builds']) return;
    var rows = [];
    (world.builds || []).forEach(function (build) {
      (build.materials || []).forEach(function (material) {
        if (slugifyItem(material.item) !== slug) return;
        var need = Math.max(1, Math.floor(Number(material.needed) || 1));
        var gave = Math.max(0, Math.floor(Number(alloc.perMaterial[material.id]) || 0));
        var stacks = stackMapFor(slug, resolvedStackFor(material.item, build));
        rows.push('<div class="inv-build" role="listitem" data-inv-build="' + escapeHtml(build.id) + '">' +
          '<span class="inv-build__name">' + escapeHtml(build.name) +
            (build.active === false ? ' <em>(paused)</em>' : '') + '</span>' +
          '<span class="inv-build__need">need ' + escapeHtml(M.formatUnits(need, slug, ui.units, stacks)) + '</span>' +
          '<span class="inv-build__gave">allocated ' + escapeHtml(M.formatUnits(gave, slug, ui.units, stacks)) + '</span>' +
          '</div>');
      });
    });
    els['inv-builds'].innerHTML = rows.join('') ||
      '<p class="inv-builds__empty">No build needs this item yet.</p>';
  }

  /** Item 28: the "200 -> 264" preview as the fields change; the rule is in the hint. */
  function refreshInvPreview() {
    if (!els['inv-preview']) return;
    var target = ui.invTarget;
    var world = activeWorld();
    if (!target || !world) { els['inv-preview'].textContent = ''; return; }
    var stacks = stackMapFor(target.slug, target.stack || resolvedStackFor(target.item));
    var current = Math.max(0, Math.floor(Number(M.inventoryOf(world)[target.slug]) || 0));
    var next = current;
    var absolute = String(els['inv-absolute'] ? els['inv-absolute'].value : '').trim();
    var delta = String(els['inv-delta'] ? els['inv-delta'].value : '').trim();
    if (absolute !== '') {
      var absValue = Number(absolute);
      if (!isFinite(absValue) || Math.floor(absValue) !== absValue) {
        els['inv-preview'].textContent = M.formatUnits(current, target.slug, ui.units, stacks) + ' → ?';
        return;
      }
      next = Math.max(0, absValue);
    }
    if (delta !== '') {
      var parsed = M.parseRelative(delta, target.stack);
      if (parsed.error) {
        els['inv-preview'].textContent = M.formatUnits(next, target.slug, ui.units, stacks) + ' → ?';
        return;
      }
      next += parsed.value;
    }
    next = Math.max(0, Math.floor(next));
    els['inv-preview'].textContent = M.formatUnits(current, target.slug, ui.units, stacks) + ' → ' +
      M.formatUnits(next, target.slug, ui.units, stacks);
  }
  function openRowInventory(node) {
    var row = node && node.closest ? node.closest('[data-mat]') : null;
    if (!row) return;
    var context = currentBuild();
    if (!context) return;
    closeRowMenus();
    openInventoryFor(context.build.id, row.getAttribute('data-mat'), row);
  }

  function commitInventory() {
    var target = currentInvTarget();
    var world = activeWorld();
    if (!target || !world) return;
    var before = snapshotState();
    var buildId = target.buildId;
    var absoluteRaw = String((els['inv-absolute'] && els['inv-absolute'].value) || '').trim();
    var deltaRaw = String((els['inv-delta'] && els['inv-delta'].value) || '').trim();
    /* EDICT-0018 item 29: both fields may be filled — the absolute value applies first, then the
       relative amount is added on top. Empty fields simply do not participate. */
    if (absoluteRaw === '' && deltaRaw === '') { showInvError('Enter a number of items.'); return; }
    var nextValue = Math.max(0, Math.floor(Number(M.inventoryOf(world)[target.slug]) || 0));
    if (absoluteRaw !== '') {
      var absolute = Number(absoluteRaw);
      if (!isFinite(absolute) || Math.floor(absolute) !== absolute) {
        showInvError('Enter a whole number of items.');
        return;
      }
      nextValue = Math.max(0, absolute);
    }
    if (deltaRaw !== '') {
      var parsed = M.parseRelative(deltaRaw, resolvedStackFor(target.item, M.findBuild(world, target.buildId)));
      if (parsed.error) { showInvError(parsed.error); return; }
      nextValue = Math.max(0, nextValue + parsed.value);
    }
    var result = M.setInventory(world, target.slug, nextValue);
    if (!result || result.error) { showInvError((result && result.error) || 'Could not update the inventory.'); return; }
    ui.invTarget = null;
    if (els['inventory-dialog']) els['inventory-dialog'].close();
    adoptWorld(result.world || result.state);
    offerUndo(before, 'Inventory updated.', buildId);
  }

  /* ---- row overflow menu ---- */

  function closeRowMenus() {
    if (ui.openMenu) {
      ui.openMenu.setAttribute('aria-expanded', 'false');
      var panel = ui.openMenu.parentNode ? ui.openMenu.parentNode.querySelector('.mat-menu') : null;
      if (panel) panel.hidden = true;
    }
    ui.openMenu = null;
  }

  function toggleRowMenu(button) {
    var panel = button.parentNode ? button.parentNode.querySelector('.mat-menu') : null;
    if (!panel) return;
    var willOpen = panel.hidden;
    closeRowMenus();
    if (willOpen) {
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      ui.openMenu = button;
    }
  }

  /* ---- #paste-preview: parse before import (§6.2) ---- */

  function openPastePreview() {
    if (!els['paste-preview']) return;
    if (els['paste-text']) els['paste-text'].value = '';
    if (els['paste-ok']) els['paste-ok'].disabled = true;
    renderPastePreview();
    if (typeof els['paste-preview'].showModal === 'function') els['paste-preview'].showModal();
    if (els['paste-text']) els['paste-text'].focus();
  }

  /** Rendered from `M.parseBulk`: matched rows are the import, everything else is explained. */
  /** AC19/D12: the preview shows one row per item — repeated lines are summed, not repeated. */
  function mergePasteRows(rows) {
    var order = [];
    var bySlug = {};
    rows.forEach(function (row) {
      var key = String(row.slug || '').toLowerCase();
      if (!key) return;
      if (!bySlug[key]) {
        bySlug[key] = { slug: row.slug, name: row.name || row.raw, qty: 0 };
        order.push(key);
      }
      bySlug[key].qty += Math.max(1, Math.floor(Number(row.qty) || 1));
    });
    return order.map(function (key) { return bySlug[key]; });
  }

  function renderPastePreview() {
    var context = currentBuild();
    if (!context) return;
    var text = els['paste-text'] ? els['paste-text'].value : '';
    var parsed = text.trim() ? M.parseBulk(text, catalogData()) : { rows: [] };
    var rows = parsed.rows || parsed;
    var matched = [];
    var rejected = [];
    rows.forEach(function (row) {
      if (row.state === 'matched' && row.slug) matched.push(row);
      else rejected.push(row);
    });
    var merged = mergePasteRows(matched);
    if (els['paste-rows']) {
      els['paste-rows'].innerHTML = merged.map(function (row) {
        var stack = resolvedStackFor(row.name || row.slug, context.build);
        return '<div class="paste-row" role="listitem" data-slug="' + escapeHtml(row.slug) + '">' +
          '<span class="paste-row__name">' + escapeHtml(row.name || row.slug) + '</span>' +
          '<span class="paste-row__qty">' + escapeHtml(M.formatUnits(row.qty, row.slug, ui.units, stackMapFor(row.slug, stack))) + '</span>' +
          '</div>';
      }).join('');
      els['paste-rows'].setAttribute('data-count', String(merged.length));
    }
    if (els['paste-errors']) {
      if (rejected.length) {
        els['paste-errors'].textContent = rejected.length +
          (rejected.length === 1 ? ' line was not understood: ' : ' lines were not understood: ') +
          rejected.map(function (row) { return row.raw || row.name || ''; }).join(', ');
        els['paste-errors'].hidden = false;
      } else {
        els['paste-errors'].textContent = '';
        els['paste-errors'].hidden = true;
      }
    }
    if (els['paste-context']) {
      els['paste-context'].textContent = context.build.name + ' \u00b7 ' +
        (merged.length ? merged.length + (merged.length === 1 ? ' line ready to import' : ' lines ready to import') : 'Nothing parsed yet');
    }
    if (els['paste-ok']) els['paste-ok'].disabled = merged.length === 0;
  }

  function applyPaste() {
    var context = currentBuild();
    if (!context) return;
    var text = els['paste-text'] ? els['paste-text'].value : '';
    var parsed = text.trim() ? M.parseBulk(text, catalogData()) : { rows: [] };
    var rows = mergePasteRows((parsed.rows || parsed).filter(function (row) {
      return row.state === 'matched' && row.slug;
    }));
    if (!rows.length) return;
    var next = state;
    var added = 0;
    rows.forEach(function (row) {
      var result = M.addMaterial(next, context.world.id, context.build.id, { item: row.name || row.slug, needed: row.qty || 1 });
      if (!result.error) { next = result.state; added += 1; }
    });
    if (!added) return;
    if (els['paste-preview']) els['paste-preview'].close();
    commit(next);
    toast(added + (added === 1 ? ' material added.' : ' materials added.'));
  }

  /* ---- #shopping-dialog: what is still missing, from `M.shoppingList()` ---- */

  function renderShopping() {
    var world = activeWorld();
    if (!els['shopping-body']) return;
    var rows = world ? M.shoppingList(world) : [];
    els['shopping-body'].innerHTML = rows.map(function (row) {
      var stack = resolvedStackFor(row.item, null);
      var builds = (row.builds || []).map(function (buildId) {
        var build = world ? M.findBuild(world, buildId) : null;
        return build ? build.name : '';
      }).filter(Boolean).join(', ');
      return '<div class="mat-row" role="row" data-mat="' + escapeHtml(row.slug) + '">' +
        '<span class="mat-row__item">' + slotHtml(row.item) +
          '<span class="mat-row__name">' + escapeHtml(row.item) + '</span></span>' +
        '<span class="num" data-shopping-count>' + escapeHtml(M.formatUnits(row.remaining, row.slug, ui.units, stackMapFor(row.slug, stack))) + '</span>' +
        '<span class="mat-row__builds builds-col">' + escapeHtml(builds) + '</span>' +
        '</div>';
    }).join('');
    wireIconFallbacks(els['shopping-body']);
    if (els['shopping-close']) els['shopping-close'].disabled = false;
  }

  function openShoppingDialog() {
    if (!els['shopping-dialog']) return;
    renderShopping();
    if (typeof els['shopping-dialog'].showModal === 'function') els['shopping-dialog'].showModal();
  }

  /* ---- preferences: units, sidebar, inactive builds, sort, view ---- */

  function applyUnits() {
    (els.unitButtons || []).forEach(function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-unit') === ui.units ? 'true' : 'false');
    });
  }

  function setUnits(unit) {
    if (['items', 'stacks', 'shulkers'].indexOf(unit) < 0 || unit === ui.units) return;
    ui.units = unit;
    writePref(PREF_KEY.units, unit);
    renderAll();
  }

  function applySidebarCollapsed() {
    var collapsed = !!ui.sidebarCollapsed;
    document.body.classList.toggle('is-sidebar-collapsed', collapsed);
    if (els['sidebar-toggle']) {
      els['sidebar-toggle'].setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      els['sidebar-toggle'].setAttribute('aria-label', collapsed ? 'Expand world panel' : 'Collapse world panel');
      els['sidebar-toggle'].setAttribute('title', collapsed ? 'Expand world panel' : 'Collapse world panel');
      els['sidebar-toggle'].textContent = collapsed ? '\u00bb' : '\u00ab';
    }
  }

  function setSidebarCollapsed(collapsed) {
    ui.sidebarCollapsed = !!collapsed;
    writePref(PREF_KEY.sidebar, ui.sidebarCollapsed ? 'closed' : 'open');
    applySidebarCollapsed();
  }

  function applyInactiveMode() {
    if (els['inactive-mode'] && els['inactive-mode'].value !== ui.inactiveMode) {
      els['inactive-mode'].value = ui.inactiveMode;
    }
  }

  function setInactiveMode(mode) {
    if (['priority', 'end', 'hide'].indexOf(mode) < 0) return;
    ui.inactiveMode = mode;
    writePref(PREF_KEY.inactive, mode);
    renderBuilds();
  }

  function setSortMode(mode) {
    if (['remaining', 'name', 'category'].indexOf(mode) < 0) return;
    ui.sort = mode;
    writePref(PREF_KEY.sort, mode);
    renderDetail();
  }

  function setHideDone(value) {
    ui.hideDone = !!value;
    writePref(PREF_KEY.hideDone, ui.hideDone ? 'on' : 'off');
    renderDetail();
    renderCompact();
  }

  function setMaterialView(mode) {
    ui.matView = mode === 'grid' ? 'grid' : 'table';
    renderDetail();
  }

  /* ---- drag to reorder (§4): whole row draggable, drop on the target slot ---- */

  function bindBuildListDnD() {
    if (!els['build-list']) return;
    els['build-list'].addEventListener('dragstart', function (event) {
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      if (!entry) return;
      ui.dragBuildId = entry.getAttribute('data-build');
      entry.classList.add('is-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try { event.dataTransfer.setData('text/plain', ui.dragBuildId); } catch (error) { /* ok */ }
      }
    });
    els['build-list'].addEventListener('dragend', function (event) {
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      Array.prototype.forEach.call(els['build-list'].querySelectorAll('.is-dragging, .is-drop, .is-drop-before, .is-drop-after'), function (node) {
        node.classList.remove('is-dragging', 'is-drop', 'is-drop-before', 'is-drop-after');
      });
      if (entry) entry.classList.remove('is-dragging');
      ui.dragBuildId = null;
    });
    els['build-list'].addEventListener('dragover', function (event) {
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      if (!entry || !ui.dragBuildId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      var rect = entry.getBoundingClientRect();
      var after = event.clientY > rect.top + rect.height / 2;
      Array.prototype.forEach.call(els['build-list'].querySelectorAll('.is-drop, .is-drop-before, .is-drop-after'), function (node) {
        if (node !== entry) node.classList.remove('is-drop', 'is-drop-before', 'is-drop-after');
      });
      /* EDICT-0018 item 1: an unambiguous insertion line above or below the hovered row. */
      entry.classList.add('is-drop');
      entry.classList.toggle('is-drop-after', after);
      entry.classList.toggle('is-drop-before', !after);
    });
    /* EDICT-0018 item 1: Alt+ArrowUp/Down reorders the same priority list with the keyboard. */
    els['build-list'].addEventListener('keydown', function (event) {
      if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      if (!entry) return;
      event.preventDefault();
      var world = activeWorld();
      if (!world) return;
      var id = entry.getAttribute('data-build');
      var from = -1;
      world.builds.forEach(function (build, index) { if (build.id === id) from = index; });
      if (from < 0) return;
      var to = event.key === 'ArrowUp' ? from - 1 : from + 1;
      if (to < 0 || to >= world.builds.length) return;
      var result = M.moveBuild(world, id, to);
      if (result.error) { toast(result.error, true); return; }
      adoptWorld(result.world || result.state);
      var moved = document.querySelector('.build-entry[data-build="' + id + '"]');
      if (moved && moved.focus) moved.focus();
    });
    els['build-list'].addEventListener('drop', function (event) {
      var entry = event.target.closest ? event.target.closest('.build-entry') : null;
      var world = activeWorld();
      if (!entry || !ui.dragBuildId || !world) return;
      event.preventDefault();
      var targetId = entry.getAttribute('data-build');
      var afterDrop = entry.classList.contains('is-drop-after');
      var from = -1;
      var to = -1;
      world.builds.forEach(function (build, index) {
        if (build.id === ui.dragBuildId) from = index;
        if (build.id === targetId) to = index;
      });
      if (from < 0 || to < 0) return;
      if (afterDrop) to += 1;
      if (from < to) to -= 1;
      if (from === to) return;
      var result = M.moveBuild(world, ui.dragBuildId, to);
      entry.classList.remove('is-drop', 'is-drop-before', 'is-drop-after');
      if (result.error) { toast(result.error, true); return; }
      adoptWorld(result.world || result.state);
    });
  }

  /** One place that attaches every EDICT-0017 surface, called once from bind(). */
  function bindEdict0017() {
    if (els['inventory-form']) {
      els['inventory-form'].addEventListener('submit', function (event) {
        event.preventDefault();
        if (event.submitter && event.submitter.value === 'cancel') {
          ui.invTarget = null;
          showInvError('');
          if (els['inventory-dialog']) els['inventory-dialog'].close();
          return;
        }
        commitInventory();
      });
      /* A07/AC7: Enter in either field is a commit. Native implicit submission is not
         synthesized by CDP or by some assistive tech, so commit on the keystroke itself. */
      els['inventory-form'].addEventListener('keydown', function (event) {
        if (event.key !== 'Enter') return;
        if (!event.target || event.target.tagName === 'TEXTAREA') return;
        if (event.target === els['inv-cancel'] || event.target === els['inv-ok']) return;
        event.preventDefault();
        commitInventory();
      });
    }
    if (els['inv-absolute']) els['inv-absolute'].addEventListener('input', refreshInvPreview);
    if (els['inv-delta']) els['inv-delta'].addEventListener('input', refreshInvPreview);
    if (els['inv-cancel']) {
      /* Cases 110/111: Cancel is a plain button so Enter inside the fields implicitly submits
         through #inv-ok (the only submit button left in the form) and actually commits. */
      els['inv-cancel'].addEventListener('click', function () {
        ui.invTarget = null;
        showInvError('');
        if (els['inventory-dialog']) els['inventory-dialog'].close();
      });
    }
    if (els['inventory-dialog']) {
      /* EDICT-0018 item 30: Escape cancels the dialog (no commit) and returns focus. */
      els['inventory-dialog'].addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        ui.invTarget = null;
        showInvError('');
        els['inventory-dialog'].close();
      });
      /* Escape and the X both close natively; a stale target could otherwise commit next time.
         D14: the close also returns focus to the row/chip that opened the dialog. */
      els['inventory-dialog'].addEventListener('close', function () {
        ui.invTarget = null;
        showInvError('');
        var trigger = ui.invTrigger;
        ui.invTrigger = null;
        if (trigger && trigger.focus && document.contains(trigger)) { trigger.focus(); return; }
        /* A committed edit re-renders the rows, so the original node is detached. Re-focus the
           row that now represents the same material (D14: the keyboard path must not dead-end). */
        var matId = trigger && trigger.getAttribute
          ? (trigger.getAttribute('data-mat') || trigger.getAttribute('data-mat-update'))
          : null;
        if (!matId) return;
        var row = document.querySelector('#material-body [data-mat="' + matId + '"]');
        if (row && row.focus) row.focus();
      });
    }
    if (els['paste-form']) {
      els['paste-form'].addEventListener('submit', function (event) {
        event.preventDefault();
        if (event.submitter && event.submitter.value === 'cancel') {
          if (els['paste-preview']) els['paste-preview'].close();
          return;
        }
        applyPaste();
      });
    }
    if (els['paste-text']) els['paste-text'].addEventListener('input', renderPastePreview);

    if (els['btn-shopping-list']) els['btn-shopping-list'].addEventListener('click', openShoppingDialog);

    if (els['sidebar-toggle']) {
      els['sidebar-toggle'].addEventListener('click', function () {
        setSidebarCollapsed(!ui.sidebarCollapsed);
      });
    }

    (els.unitButtons || []).forEach(function (button) {
      button.addEventListener('click', function () { setUnits(button.getAttribute('data-unit')); });
    });

    if (els['inactive-mode']) {
      els['inactive-mode'].addEventListener('change', function () { setInactiveMode(els['inactive-mode'].value); });
    }
    if (els['mat-sort']) {
      els['mat-sort'].addEventListener('change', function () { setSortMode(els['mat-sort'].value); });
    }
    if (els['mat-hide-done']) {
      /* EDICT-0018 item 25: a real checkbox, applied to Table and Compact alike. */
      els['mat-hide-done'].addEventListener('change', function () { setHideDone(els['mat-hide-done'].checked); });
    }
    if (els['compact-hide-done']) {
      els['compact-hide-done'].addEventListener('change', function () { setHideDone(els['compact-hide-done'].checked); });
    }
    if (els['mat-view-table']) {
      els['mat-view-table'].addEventListener('click', function () { setMaterialView('table'); });
    }
    if (els['mat-view-grid']) {
      els['mat-view-grid'].addEventListener('click', function () { setMaterialView('grid'); });
    }
    bindBuildListDnD();
    bindCompactView();
    closedRowMenuOnOutsideClick();
  }

  /** A click anywhere else closes an open row menu; Escape closes it too. */
  function closedRowMenuOnOutsideClick() {
    document.addEventListener('click', function (event) {
      if (!ui.openMenu) return;
      if (event.target.closest && event.target.closest('.mat-row__menu')) return;
      closeRowMenus();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeRowMenus();
    });
  }
  function renderWorldStats() {
    var world = activeWorld();
    var node = els['world-progress-text'];
    var bar = els['world-bar'];
    var fill = els['world-fill'];
    if (els['world-progress']) els['world-progress'].hidden = false;
    if (bar) bar.hidden = !world;
    if (!world) {
      if (node) node.textContent = '';
      if (bar) bar.setAttribute('aria-valuenow', '0');
      if (fill) fill.style.width = '0%';
      return;
    }
    var summary = M.worldSummary(world);
    if (node) node.textContent = M.progressText(summary.covered, summary.needed);
    var pct = summary.needed ? Math.min(100, Math.round((summary.covered / summary.needed) * 100)) : 0;
    if (bar) bar.setAttribute('aria-valuenow', String(pct));
    if (fill) fill.style.width = pct + '%';
  }
  function renderWorldPicker() {
    var world = activeWorld();
    var options = state.worlds.map(function (item) {
      return '<option value="' + escapeHtml(item.id) + '"' + (world && item.id === world.id ? ' selected' : '') + '>' +
        escapeHtml(item.name) + '</option>';
    });
    els['world-select'].innerHTML = options.join('') || '<option value="">No worlds yet</option>';
    els['world-select'].disabled = !state.worlds.length;
    els['world-avatar'].innerHTML = avatarHtml(world ? world.icon : null, 32, world ? world.name : 'World');
    wireIconFallbacks(els['world-avatar']);

    if (!world) {
      if (els['world-panel-name']) els['world-panel-name'].textContent = '';
      els['world-meta'].textContent = 'No world selected';
      return;
    }
    if (els['world-panel-name']) els['world-panel-name'].textContent = world.name;
    /* EDICT-0018 item 22: the world meta says when it was last touched in relative words, with
       the exact timestamp on the tooltip. The "Created" half is gone on purpose. */
    els['world-meta'].textContent =
      (world.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' ' + world.version +
      ' · ' + countLabel(world.builds.length, 'build');
    els['world-meta'].appendChild(document.createTextNode(' · '));
    els['world-meta'].appendChild(updatedFragment(world.updatedAt));
  }

  /** The list order: inactive builds in place, at the end, or hidden — the frozen three modes. */
  function buildsForList(world) {
    /* EDICT-0018 items 5/16: the rendered order *is* the allocation order — world.builds is the
       priority list, so dragging a build changes which build the shared stock covers first. The
       inactive preference only re-orders or hides what follows; it never invents a status order. */
    var rows = world && Array.isArray(world.builds) ? world.builds.slice() : [];
    if (ui.inactiveMode === 'hide') {
      rows = rows.filter(function (build) { return build.active !== false; });
    } else if (ui.inactiveMode === 'end') {
      var paused = rows.filter(function (build) { return build.active === false; });
      var live = rows.filter(function (build) { return build.active !== false; });
      rows = live.concat(paused);
    }
    return rows;
  }

  function selectBuild(buildId) {
    var world = activeWorld();
    if (!world || !M.findBuild(world, buildId)) return;
    ui.selectedBuildId = buildId;
    ui.titleEditing = false;
    ui.notesEditing = false;
    renderAll();
  }

  function renderBuilds() {
    var world = activeWorld();
    var build = selectedBuild();
    if (build) ui.selectedBuildId = build.id;
    if (!els['build-list']) return;
    var alloc = world ? M.allocate(world) : null;
    var items = [];
    if (world) {
      buildsForList(world).forEach(function (entry) {
        var progress = (alloc.perBuild[entry.id]) || { covered: 0, needed: 0 };
        var pct = pctOf(progress.covered, progress.needed);
        var rank = world.builds.indexOf(entry) + 1;
        var selected = build && build.id === entry.id;
        var classes = 'build-entry' +
          (rank === 1 ? ' build-entry--top' : '') +
          (entry.active === false ? ' build-entry--inactive' : '') +
          (selected ? ' is-selected' : '');
        items.push(
          '<li role="listitem">' +
            '<div class="' + classes + '" data-build="' + escapeHtml(entry.id) + '"' +
            ' data-order="' + (rank - 1) + '" data-rank="' + rank + '" draggable="true" tabindex="0"' +
            (selected ? ' aria-current="true"' : '') + '>' +
              '<span class="build-entry__grab" title="Drag to change priority" aria-hidden="true">' +
                '<svg viewBox="0 0 8 14" width="8" height="14" focusable="false"><path d="M0 1h2v2H0zM0 6h2v2H0zM0 11h2v2H0zM6 1h2v2H6zM6 6h2v2H6zM6 11h2v2H6z"/></svg>' +
              '</span>' +
              '<span class="build-entry__rank" aria-label="Priority ' + rank + '" title="Priority ' + rank + '">' + rank + '</span>' +
              '<span class="build-entry__slot" aria-hidden="true">' + avatarHtml(entry.icon, 24, entry.name) + '</span>' +
              '<span class="build-entry__name" title="' + escapeHtml(entry.name) + '">' + escapeHtml(entry.name) + '</span>' +
              '<span class="build-entry__badge">' + escapeHtml(STATUS_LABEL[entry.status] || entry.status) + '</span>' +
              '<span class="build-entry__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" title="' + pct + '% gathered">' +
                '<span class="build-entry__fill" style="width:' + pct + '%"></span>' +
              '</span>' +
              '<span class="build-entry__actions">' +
                '<button class="mc-btn mc-btn--xs mc-btn--icon" type="button" data-build-edit="' + escapeHtml(entry.id) + '"' +
                  ' aria-label="Edit ' + escapeHtml(entry.name) + '" title="Edit build">' + PENCIL_ICON + '</button>' +
                '<button class="mc-btn mc-btn--xs mc-btn--icon" type="button" data-build-activate="' + escapeHtml(entry.id) + '"' +
                  ' aria-pressed="' + (entry.active === false ? 'false' : 'true') + '"' +
                  ' aria-label="' + escapeHtml((entry.active === false ? 'Resume ' : 'Pause ') + entry.name) + '"' +
                  ' title="' + escapeHtml(entry.active === false ? 'Resume this build' : 'Pause this build') + '">' +
                  (entry.active === false ? '\u25b6' : '\u23f8') + '</button>' +
                '<button class="mc-btn mc-btn--xs mc-btn--icon" type="button" data-build-remove="' + escapeHtml(entry.id) + '"' +
                  ' aria-label="Delete ' + escapeHtml(entry.name) + '" title="Delete build">' + TRASH_ICON + '</button>' +
              '</span>' +
            '</div>' +
          '</li>'
        );
      });
    }
    els['build-list'].innerHTML = items.join('');
    wireIconFallbacks(els['build-list']);
    if (els['build-empty']) els['build-empty'].hidden = !!(world && world.builds.length);
  }
  /* Paste and shopping rendering live in the EDICT-0017 block above; this range used to hold the
     retired free-form paste helpers. */
  function renderDetail() {
    var world = activeWorld();
    var build = selectedBuild();
    var hasBuild = !!(world && build);
    if (els['detail-empty']) els['detail-empty'].hidden = hasBuild;
    if (els['detail-body']) els['detail-body'].hidden = !hasBuild;
    renderMigratedNotice();
    if (!hasBuild) {
      ui.titleEditing = false;
      ui.notesEditing = false;
      ui.editingBuildId = null;
      renderDetailProgress(0, 0);
      if (els['build-delete']) els['build-delete'].disabled = true;
      return;
    }
    if (ui.editingBuildId !== build.id) {
      ui.editingBuildId = build.id;
      ui.titleEditing = false;
      ui.notesEditing = false;
    }

    /* ---- header ---- */
    if (els['detail-avatar']) {
      /* EDICT-0014 D8: a stored icon wins; otherwise the view shows the model's suggestion and
         marks it (never storing it on the build). */
      var avatarIcon = build.icon;
      var avatarSuggestion = avatarIcon ? null : suggestionFor(build);
      if (!avatarIcon && avatarSuggestion) avatarIcon = { kind: 'item', slug: avatarSuggestion.slug };
      els['detail-avatar'].innerHTML = avatarHtml(avatarIcon, 40, build.name);
      if (avatarSuggestion) {
        els['detail-avatar'].dataset.iconAuto = 'true';
        els['detail-avatar'].title = avatarSuggestion.reason || '';
      } else {
        if (els['detail-avatar'].dataset.iconAuto) delete els['detail-avatar'].dataset.iconAuto;
        els['detail-avatar'].title = '';
      }
      wireIconFallbacks(els['detail-avatar']);
    }
    if (els['build-name']) {
      if (!ui.titleEditing) els['build-name'].value = build.name;
      els['build-name'].hidden = !ui.titleEditing;
    }
    if (els['build-name-save']) els['build-name-save'].hidden = !ui.titleEditing;
    if (els['build-name-cancel']) els['build-name-cancel'].hidden = !ui.titleEditing;
    if (els['build-rename']) {
      els['build-rename'].hidden = ui.titleEditing;
      els['build-rename'].setAttribute('aria-pressed', ui.titleEditing ? 'true' : 'false');
    }
    if (els['build-delete']) els['build-delete'].disabled = false;

    Array.prototype.forEach.call(document.querySelectorAll('#status-group [data-status]'), function (button) {
      button.setAttribute('aria-pressed', button.getAttribute('data-status') === build.status ? 'true' : 'false');
    });

    if (els['build-coords']) {
      /* EDICT-0018 item 21: coordinates read as "X 120  Y 64  Z -40"; the machine string keeps the
         old "x / y / z" shape on the way back into the model. */
      els['build-coords'].value = formatCoords(build.coords) || (build.coords || '');
      els['build-coords'].placeholder = 'X 120  Y 64  Z -40';
      els['build-coords'].title = 'Coordinates (X / Y / Z)';
    }
    if (els['copy-coords']) els['copy-coords'].disabled = !build.coords;
    if (els['detail-heading']) {
      els['detail-heading'].textContent = build.name;
      /* Renaming swaps the heading for the inline input (case 09: the heading steps aside). */
      els['detail-heading'].hidden = ui.titleEditing;
    }

    /* ---- notes ---- */
    if (els['notes-text']) {
      var hasNotes = !!(build.notes && String(build.notes).trim());
      els['notes-text'].textContent = hasNotes ? build.notes : 'No notes yet.';
      els['notes-text'].classList.toggle('notes__text--empty', !hasNotes);
      els['notes-text'].hidden = ui.notesEditing;
    }
    if (els['notes-editor']) els['notes-editor'].hidden = !ui.notesEditing;
    if (els['notes-save']) els['notes-save'].hidden = !ui.notesEditing;
    if (els['notes-cancel']) els['notes-cancel'].hidden = !ui.notesEditing;
    if (els['notes-edit']) els['notes-edit'].hidden = false;
    if (els['notes-hint']) els['notes-hint'].hidden = !ui.notesEditing;

    /* ---- overall progress: exactly one sentence, from the model ---- */
    var alloc = M.allocate(world);
    var progress = alloc.perBuild[build.id] || { covered: 0, needed: 0 };
    renderDetailProgress(progress.covered, progress.needed);
    renderDetailMeta(build);

    /* ---- rows and chips ---- */
    var rows = rowsFor(world, build, alloc);
    if (ui.hideDone) rows = rows.filter(function (row) { return row.remaining > 0; });
    var sorted = sortRows(rows);
    if (els['material-body']) {
      els['material-body'].innerHTML = sorted.map(rowHtml).join('');
      wireIconFallbacks(els['material-body']);
    }
    if (els['material-grid']) {
      /* Item 3: finished chips sink to the end of the strip, whatever the sort order. */
      var chips = sorted.slice().sort(function (a, b) {
        if (a.complete !== b.complete) return a.complete ? 1 : -1;
        return 0;
      });
      els['material-grid'].innerHTML = chips.map(chipHtml).join('');
      wireIconFallbacks(els['material-grid']);
    }
    if (els['material-empty']) els['material-empty'].hidden = build.materials.length > 0;
    renderMaterialsViewMode();
  }

  /** The detail sentence and bar. `covered`/`needed` come straight from `allocate()`. */
  function renderDetailProgress(covered, needed) {
    var safeCovered = Math.max(0, Math.floor(Number(covered) || 0));
    var safeNeeded = Math.max(0, Math.floor(Number(needed) || 0));
    if (els['detail-progress-text']) {
      els['detail-progress-text'].textContent = M.progressText(safeCovered, safeNeeded);
    }
    var pct = safeNeeded ? Math.min(100, Math.round((safeCovered / safeNeeded) * 100)) : 0;
    if (els['detail-bar']) els['detail-bar'].setAttribute('aria-valuenow', String(pct));
    if (els['detail-fill']) els['detail-fill'].style.width = pct + '%';
  }

  function renderMigratedNotice() {
    var node = els['migrated-from'];
    if (!node) return;
    var migrated = !!(state && state.migratedFrom === 1);
    node.hidden = !migrated;
    node.textContent = migrated
      ? 'Upgraded from an older backup: collected counts moved into the world inventory.'
      : '';
  }
  function renderDetailMeta(build) {
    if (!els['detail-meta']) return;
    els['detail-meta'].textContent = '';
    els['detail-meta'].removeAttribute('title');
    if (!build) return;
    var stamps = M.timestamps(build);
    var updatedIso = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    /* EDICT-0018 item 22: relative label, exact timestamp and raw ISO in the tooltip. */
    els['detail-meta'].appendChild(updatedFragment(updatedIso));
  }

  /* --------------------------------------------------------- material rows */
  /* EDICT-0017 §3: one row per material, eight cells, values straight from `allocate()`. */

  function stackForMaterial(material, build) {
    return resolvedStackFor(material.item, build) || M.DEFAULT_STACK;
  }

  /**
   * §1: `2s` means two stacks *of that item*, so the size must be resolved through the custom-item
   * chain (build → world → account) before the catalogue, exactly like `M.resolveItem` does.
   */
  function resolvedStackFor(name, build) {
    var world = activeWorld();
    var entry = world ? M.resolveItem(state, world, build || currentBuild(), name) : null;
    var stack = entry && Number(entry.stack);
    if (isFinite(stack) && stack > 0) return Math.floor(stack);
    return stackSizeFor(name) || M.DEFAULT_STACK;
  }

  function rowUnits(value, slug, stack) {
    /* `formatUnits` expects the stack map keyed by slug, not a bare size — a number there fell
       back to the 64 default and mis-rendered every non-64 item (§1, cases 42/64). */
    return M.formatUnits(Math.max(0, Math.floor(Number(value) || 0)), slug, ui.units, stackMapFor(slug, stack));
  }

  function stackMapFor(slug, size) {
    var stacks = {};
    var n = Math.floor(Number(size) || 0);
    if (n > 0) stacks[String(slug).toLowerCase()] = n;
    return stacks;
  }

  /** EDICT-0018 items 5/7: one percentage helper so every bar and sentence agrees with the totals. */
  function pctOf(covered, needed) {
    var want = Math.max(0, Math.floor(Number(needed) || 0));
    var have = Math.max(0, Math.floor(Number(covered) || 0));
    return want ? Math.min(100, Math.round((have / want) * 100)) : 0;
  }

  /** EDICT-0018 item 22: "5 min ago" for the stamp; the exact ISO lives in the title. */
  function relativeTime(iso) {
    var then = Date.parse(iso);
    if (!isFinite(then)) return '—';
    var seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
    if (seconds < 45) return 'just now';
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + ' h ago';
    var days = Math.round(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  /** EDICT-0018 item 21: coordinates read as "X 120  Y 64  Z -40". */
  function parseCoords(raw) {
    var text = String(raw || '').trim();
    if (!text) return null;
    var values = text.match(/-?\d+(?:\.\d+)?/g);
    if (!values || values.length < 3) return null;
    return { x: Number(values[0]), y: Number(values[1]), z: Number(values[2]) };
  }

  function formatCoords(raw) {
    var coords = (raw && typeof raw === 'object') ? raw : parseCoords(raw);
    return coords ? 'X ' + coords.x + '  Y ' + coords.y + '  Z ' + coords.z : '';
  }

  function machineCoords(raw) {
    var coords = parseCoords(raw);
    return coords ? coords.x + ' / ' + coords.y + ' / ' + coords.z : String(raw || '').trim();
  }

  /**
   * One row per material of `build`, with the numbers allocation already decided:
   * `got` is the world's stock, `covered` is what `allocate()` gave this row, `left` is what is
   * still open and never goes negative. A `done` build consumes nothing (§2) but displays as
   * complete, so its rows report `covered === needed` and zero surplus.
   */
  function rowsFor(world, build, alloc) {
    var inventory = M.inventoryOf(world);
    var shared = alloc.slugs || {};
    var doneBuild = build.status === 'done';
    return build.materials.map(function (material) {
      var slug = slugifyItem(material.item);
      var needed = Math.max(1, Math.floor(Number(material.needed) || 1));
      var got = Math.max(0, Math.floor(Number(inventory[slug]) || 0));
      var covered = doneBuild
        ? needed
        : Math.min(Math.max(0, Math.floor(Number(alloc.perMaterial[material.id]) || 0)), needed);
      var remaining = Math.max(0, needed - covered);
      /* §2: surplus is stock the *world* holds beyond what every active build needs, so it is a
         slug-level number from the allocation — never `covered - needed` of one row. */
      var entry = shared[slug];
      var surplus = doneBuild || !entry ? 0 : Math.max(0, Math.floor(Number(entry.surplus) || 0));
      return {
        material: material,
        slug: slug,
        stack: stackForMaterial(material, build),
        needed: needed,
        got: got,
        covered: covered,
        remaining: remaining,
        surplus: surplus,
        complete: remaining === 0,
        shared: (shared[slug] && shared[slug].shared) || 0
      };
    });
  }

  function categoryFor(slug) {
    var table = window.MC_ICON_CATEGORIES || {};
    return table[slug] || 'Misc';
  }

  function byNameThenSlug(left, right) {
    var byName = left.material.item.localeCompare(right.material.item);
    if (byName !== 0) return byName;
    return left.slug < right.slug ? -1 : left.slug > right.slug ? 1 : 0;
  }

  /** §3: remaining desc (default), name, or category — every mode breaks ties deterministically. */
  function sortRows(rows) {
    var list = rows.slice();
    list.sort(function (left, right) {
      if (ui.sort === 'name') return byNameThenSlug(left, right);
      if (ui.sort === 'category') {
        var byCategory = categoryFor(left.slug).localeCompare(categoryFor(right.slug));
        if (byCategory !== 0) return byCategory;
        return byNameThenSlug(left, right);
      }
      if (right.remaining !== left.remaining) return right.remaining - left.remaining;
      return byNameThenSlug(left, right);
    });
    return list;
  }

  function rowHtml(row) {
    var material = row.material;
    var matId = escapeHtml(material.id);
    var name = escapeHtml(material.item);
    /* EDICT-0018 item 8: surplus only when the world holds more than every build needs; a dash
       otherwise, so the column always says what it means. */
    var surplusText = row.surplus > 0
      ? '+' + rowUnits(row.surplus, row.slug, row.stack) + ' surplus'
      : '\u2013';
    var neededText = rowUnits(row.needed, row.slug, row.stack);
    return '<div class="mat-row' + (row.complete ? ' mat-row--done' : '') + '" role="row"' +
      ' data-mat="' + matId + '" tabindex="0">' +
      '<span class="mat-row__item">' +
        '<span class="mat-row__slot slot" data-tip="' + escapeHtml(material.item) + '" aria-hidden="true">' + slotInnerHtml(material.item, true) + '</span>' +
        '<span class="mat-row__name" title="' + name + '">' + name + '</span>' +
        (row.shared > 1
          ? '<span class="mat-shared" data-mat-shared>shared with ' + countLabel(row.shared, 'build') + '</span>'
          : '') +
        (row.complete ? '<span class="mat-row__check" aria-hidden="true">' + CHECK_ICON + '</span>' : '') +
      '</span>' +
      '<span class="mat-row__needed">' +
        '<input class="mc-input num mat-row__needed-input" type="text" inputmode="numeric" value="' + escapeHtml(neededText) + '"' +
        ' data-mat-field="needed" data-mat="' + matId + '" data-prev="' + row.needed + '"' +
        ' title="Click to edit the needed count" aria-label="Needed ' + name + '">' +
      '</span>' +
      '<span class="num" data-mat-got title="World inventory for ' + escapeHtml(material.item) + '" aria-label="' + escapeHtml('In world: ' + rowUnits(row.got, row.slug, row.stack)) + '">' +
        escapeHtml(rowUnits(row.got, row.slug, row.stack)) + '</span>' +
      '<span class="num" data-mat-covered title="Allocated to this build">' +
        escapeHtml(rowUnits(row.covered, row.slug, row.stack)) + '</span>' +
      '<span class="num" data-mat-remaining title="Still to gather">' +
        escapeHtml(rowUnits(row.remaining, row.slug, row.stack)) + '</span>' +
      '<span class="num' + (row.surplus > 0 ? ' is-surplus' : '') + '" data-mat-surplus title="Stock beyond every build">' +
        escapeHtml(surplusText) + '</span>' +
      '<button class="mc-btn mc-btn--xs mc-btn--icon" type="button" data-mat-update="' + matId + '"' +
        ' aria-label="Update inventory for ' + name + '" title="Update inventory">' + PLUS_ICON + '</button>' +
      '<span class="mat-row__menu">' +
        '<button type="button" data-mat-menu aria-haspopup="true" aria-expanded="false"' +
          ' aria-label="Row actions for ' + name + '">\u22ef</button>' +
        '<div class="mat-menu" hidden>' +
          '<button class="mc-btn mc-btn--sm" type="button" data-mat-remove="' + matId + '">Remove</button>' +
        '</div>' +
      '</span>' +
      '</div>';
  }

  function chipHtml(row) {
    var count = row.remaining > 0 ? row.remaining : row.needed;
    /* EDICT-0018 item 26: the chip tooltip carries the item name and its stack notation. */
    var stacks = stackMapFor(row.slug, row.stack);
    var shown = row.remaining > 0 ? row.remaining : row.needed;
    var notation = M.stackNotation(shown, row.slug, stacks, 'stacks');
    var tip = row.material.item + ' \u00b7 ' + rowUnits(row.covered, row.slug, row.stack) + ' of ' +
      rowUnits(row.needed, row.slug, row.stack) + ' allocated \u00b7 ' +
      (row.remaining === 0 ? 'done' : rowUnits(row.remaining, row.slug, row.stack) + ' left') +
      ' \u00b7 exact ' + shown + ' items \u00b7 ' + notation;
    return '<button class="mat-chip' + (row.complete ? ' is-done' : '') + '" type="button" role="listitem"' +
      ' data-mat="' + escapeHtml(row.material.id) + '" data-tip="' + escapeHtml(tip) + '"' +
      ' aria-label="' + escapeHtml(row.material.item + ': ' + row.remaining + ' left of ' + row.needed) + '">' +
      '<span class="mat-chip__count" data-mat-chip-count>' + escapeHtml(rowUnits(count, row.slug, row.stack)) + '</span>' +
      '<span class="slot" aria-hidden="true">' + slotInnerHtml(row.material.item, true) + '</span>' +
      '</button>';
  }

  /** Table/grid are the same data; only one container is visible, and both buttons report state. */
  function renderMaterialsViewMode() {
    var grid = ui.matView === 'grid';
    if (els['material-table']) els['material-table'].hidden = grid;
    if (els['material-grid']) els['material-grid'].hidden = !grid;
    if (els['mat-view-table']) els['mat-view-table'].setAttribute('aria-pressed', grid ? 'false' : 'true');
    if (els['mat-view-grid']) els['mat-view-grid'].setAttribute('aria-pressed', grid ? 'true' : 'false');
    if (els['mat-hide-done']) els['mat-hide-done'].checked = !!ui.hideDone;
    if (els['mat-sort'] && els['mat-sort'].value !== ui.sort) els['mat-sort'].value = ui.sort;
  }
  /**
   * EDICT-0017 §4: the Materials tab shows world-level sums from `aggregateWorld()` — needed,
   * covered and left per item, each row naming the builds that need it. `covered` (allocation),
   * never the retired `material.collected`.
   */
  function renderWorldMaterials() {
    var world = activeWorld();
    var rows = world ? M.aggregateWorld(world) : [];
    var inventory = world ? M.inventoryOf(world) : {};
    var summary = world ? M.worldSummary(world) : { covered: 0, needed: 0 };
    if (els['materials-lede']) {
      els['materials-lede'].textContent = world
        ? 'Every block needed across "' + world.name + '", summed by item.'
        : 'Create a world to start a shopping list.';
      if (world) {
        var stamps = M.timestamps(world);
        var updated = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
        if (updated !== undefined) {
          els['materials-lede'].appendChild(document.createTextNode(' \u00b7 '));
          els['materials-lede'].appendChild(updatedFragment(updated));
        }
      }
    }
    var query = String(ui.query || '').trim().toLowerCase();
    var filtered = rows.filter(function (row) {
      if (ui.filter === 'remaining' && row.done) return false;
      if (ui.filter === 'done' && !row.done) return false;
      if (query && row.item.toLowerCase().indexOf(query) < 0) return false;
      return true;
    });
    if (els['world-material-body']) {
      els['world-material-body'].innerHTML = filtered.map(function (row) {
        var slug = slugifyItem(row.item);
        var stack = stackSizeFor(row.item) || M.DEFAULT_STACK;
        var covered = row.covered !== undefined ? row.covered : 0;
        return '<div class="mat-row mtable--wide' + (row.done ? ' mat-row--done' : '') + '" role="row"' +
          ' data-mat="' + escapeHtml(slug) + '" tabindex="0" title="Open inventory for ' + escapeHtml(row.item) + '">' +
          '<span class="mat-row__item">' +
            '<span class="mat-row__slot" aria-hidden="true">' + slotInnerHtml(row.item, true) + '</span>' +
            '<span class="mat-row__name">' + escapeHtml(row.item) + '</span>' +
          '</span>' +
          '<span class="num">' + escapeHtml(rowUnits(row.needed, slug, stack)) + '</span>' +
          '<span class="num got-col">' + escapeHtml(rowUnits(inventory[slug] || 0, slug, stack)) + '</span>' +
          '<span class="num">' + escapeHtml(rowUnits(row.remaining, slug, stack)) + '</span>' +
          '<span class="num">' + escapeHtml(rowUnits(covered, slug, stack)) + '</span>' +
          '<span class="progress-col"><span class="mat-row__bar"><span style="width: ' + row.pct + '%"></span></span></span>' +
          '<span class="mat-row__builds builds-col">' + escapeHtml((row.builds || []).join(', ')) + '</span>' +
          '</div>';
      }).join('');
      wireIconFallbacks(els['world-material-body']);
    }
    if (els['world-material-empty']) els['world-material-empty'].hidden = filtered.length > 0;
    if (els['mat-totals']) {
      els['mat-totals'].textContent = filtered.length + (filtered.length === 1 ? ' item \u00b7 ' : ' items \u00b7 ') +
        M.progressText(summary.covered, summary.needed);
    }
  }
  function renderWorlds() {
    els['world-cards'].innerHTML = state.worlds.map(function (world) {
      var summary = M.worldSummary(world);
      var active = state.activeWorldId === world.id;
      return '<article class="world-card' + (active ? ' world-card--active' : '') + '">' +
        '<div class="world-card__head">' + avatarHtml(world.icon, 40, world.name) +
          '<h3 class="world-card__name">' + escapeHtml(world.name) + (active ? ' <span class="chip chip--done">Active</span>' : '') + '</h3>' +
        '</div>' +
        '<p class="world-card__meta">' + (world.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' ' + escapeHtml(world.version) +
          ' · ' + countLabel(summary.builds, 'build') + ' · ' + countLabel(summary.materials, 'material') + '</p>' +
        '<p class="world-card__meta">' + summary.pct + '% complete · ' + summary.remaining + ' items to go</p>' +
        (world.notes ? '<p class="world-card__meta">' + escapeHtml(world.notes) + '</p>' : '') +
        '<div class="world-card__actions">' +
          (active ? '' : '<button class="mc-btn mc-btn--sm" type="button" data-world-select="' + escapeHtml(world.id) + '">Select</button>') +
          '<button class="mc-btn mc-btn--sm" type="button" data-world-edit="' + escapeHtml(world.id) + '">Edit</button>' +
          '<button class="mc-btn mc-btn--sm mc-btn--danger" type="button" data-world-delete="' + escapeHtml(world.id) + '">Delete</button>' +
        '</div>' +
        '</article>';
    }).join('');

    wireIconFallbacks(els['world-cards']);
    els['world-empty'].hidden = state.worlds.length > 0;
    els['worlds-lede'].textContent = state.worlds.length
      ? state.worlds.length + (state.worlds.length === 1 ? ' world' : ' worlds') + ' in this browser. Click Select to make one active.'
      : 'Each world keeps its own builds and shopping list.';

    els['world-cards'].onclick = function (event) {
      var button = event.target.closest('button');
      if (!button) return;
      var selectId = button.dataset.worldSelect;
      var editId = button.dataset.worldEdit;
      var deleteId = button.dataset.worldDelete;
      if (selectId) {
        var activated = M.setActiveWorld(state, selectId);
        if (activated.error) { toast(activated.error, true); return; }
        state = activated.state;
        ui.selectedBuildId = null;
        selectInitialBuild();
        commit(state);
        setView('builds');
        toast('World selected.');
      } else if (editId) {
        openWorldDialog(editId);
      } else if (deleteId) {
        var world = M.findWorld(state, deleteId);
        askConfirm('Delete world?', 'Delete "' + (world ? world.name : 'this world') + '" with all its builds? You can undo this from the notice.', 'Delete', function () {
          var before = snapshotState();
          var deleted = M.deleteWorld(state, deleteId);
          if (deleted.error) { toast(deleted.error, true); return; }
          state = deleted.state;
          ui.selectedBuildId = null;
          selectInitialBuild();
          commit(state);
          offerUndo(before, 'World deleted.');
        });
      }
    };
  }

  /* ------------------------------------------------------------- export/io */

  function exportData() {
    var blob = new Blob([M.exportJSON(state)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    var stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = 'minecraft-build-tracker-' + stamp + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Backup downloaded.');
  }

  function bindExtras() {
    els['btn-import'].addEventListener('click', function (event) {
      event.preventDefault();
      openImportDialog();
    });
    els['import-file'].addEventListener('click', function () { els['file-import'].click(); });
    els['import-drop'].addEventListener('click', function () { els['file-import'].click(); });
    els['import-dialog'].addEventListener('dragover', function (event) {
      event.preventDefault();
      els['import-drop'].classList.add('is-over');
    });
    els['import-dialog'].addEventListener('dragleave', function () { els['import-drop'].classList.remove('is-over'); });
    els['import-dialog'].addEventListener('drop', function (event) {
      event.preventDefault();
      els['import-drop'].classList.remove('is-over');
      var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { restoreBackup(String(reader.result)); };
      reader.readAsText(file);
    });
    els['import-form'].addEventListener('submit', function (event) {
      /* Same submitter rule as the custom dialog: returnValue is not readable during submit. */
      if (event.submitter && event.submitter.value !== 'restore') return;
      event.preventDefault();
      restoreBackup(els['import-text'].value);
    });
    els['custom-form'].addEventListener('submit', function (event) {
      /* method="dialog" only assigns dialog.returnValue when the dialog CLOSES, so the submit
         handler must branch on the submitter instead (measured defect: save never ran). */
      if (event.submitter && event.submitter.value !== 'save') return;
      event.preventDefault();
      var world = activeWorld();
      var build = selectedBuild();
      var result = M.createCustomItem(state, world, build, els['custom-scope'].value, {
        name: els['custom-name'].value,
        stack: els['custom-stack'].value,
        icon: ui.customIcon || null
      });
      if (result.error) {
        els['custom-error'].textContent = result.error;
        els['custom-error'].hidden = false;
        return;
      }
      clearFormError('custom-error');
      state = result.state;
      M.save(window.localStorage, state);
      els['custom-dialog'].close();
      renderAll();
      setMaterialChoice(result.entry.name);
      els['mat-choice'].focus();
      toast('Custom material created.');
    });
    els['btn-new-custom'].addEventListener('click', function () {
      if (els['icon-dialog'].open) els['icon-dialog'].close();
      els['icon-dialog'].classList.remove('picker--material');
      openCustomDialog();
    });
    els['custom-icon-upload'].addEventListener('click', function () { els['custom-icon-file'].click(); });
    /* Contract §4 keeps #custom-icon-pick in the DOM; it stays hidden for users but the frozen
       browser case still drives it programmatically, so it opens the picker in custom-icon scope. */
    els['custom-icon-pick'].addEventListener('click', function () {
      openIconPicker({ scope: 'custom-icon', trigger: els['custom-name'] });
    });
    els['custom-icon-file'].addEventListener('change', function () {
      var file = els['custom-icon-file'].files && els['custom-icon-file'].files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        ui.customIcon = { kind: 'image', dataUrl: String(reader.result) };
        paintCustomIconPreview();
      };
      reader.readAsDataURL(file);
    });
    /* S4c: an edit invalidates the last validation message — the dialog stays open after a
       refusal, so the message must not outlive the input (or the icon) that caused it. */
    els['custom-form'].addEventListener('input', function () { clearFormError('custom-error'); });
    els['custom-form'].addEventListener('change', function () { clearFormError('custom-error'); });
    els['import-text'].addEventListener('input', function () { clearFormError('import-error'); });
  }

  function paintCustomIconPreview() {
    els['custom-icon-preview'].innerHTML = ui.customIcon ? avatarHtml(ui.customIcon, 30, 'Custom material') : '';
    wireIconFallbacks(els['custom-icon-preview']);
  }

  /* A stale validation message must never survive a reopen, an edit or a later success. */
  function clearFormError(id) {
    if (!els[id]) return;
    els[id].textContent = '';
    els[id].hidden = true;
  }

  function syncCustomButton() {
    var material = ui.pickerMode === 'item';
    els['icon-dialog'].classList.toggle('picker--material', material);
    els['btn-new-custom'].hidden = !material;
  }

  function openCustomDialog() {
    ui.customIcon = null;
    els['custom-name'].value = '';
    els['custom-stack'].value = '64';
    els['custom-scope'].value = 'build';
    clearFormError('custom-error');
    paintCustomIconPreview();
    els['custom-dialog'].showModal();
    els['custom-name'].focus();
  }

  function openImportDialog() {
    els['import-text'].value = '';
    clearFormError('import-error');
    els['import-dialog'].showModal();
    els['import-text'].focus();
  }

  function restoreBackup(text) {
    var result = M.importJSON(String(text || ''));
    if (result.error) {
      els['import-error'].textContent = result.error;
      els['import-error'].hidden = false;
      return false;
    }
    clearFormError('import-error');
    state = result.state;
    M.save(window.localStorage, state);
    ui.selectedBuildId = null;
    selectInitialBuild();
    if (els['import-dialog'].open) els['import-dialog'].close();
    renderAll();
    toast('Backup restored.');
    return true;
  }

  var PAUSE_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><rect x="2" y="1" width="3" height="10"/><rect x="7" y="1" width="3" height="10"/></svg>';
  var PLAY_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2 1 L2 11 L11 6 Z"/></svg>';
  var MOTION_KEY = 'mc-build-tracker:motion';

  function motionIsPaused() {
    return document.documentElement.classList.contains('motion-paused');
  }

  function applyMotion(paused) {
    document.documentElement.classList.toggle('motion-paused', paused);
    document.documentElement.classList.toggle('motion-play', !paused);
    els['backdrop-pause'].setAttribute('aria-pressed', paused ? 'true' : 'false');
    els['backdrop-pause'].setAttribute('aria-label', paused ? 'Play scenery' : 'Pause scenery');
    els['backdrop-pause'].innerHTML = paused ? PLAY_ICON : PAUSE_ICON;
  }

  /* R7: with no stored choice a reduce user starts paused (the frame stays painted); a stored
     "play" is an explicit opt-in and always wins, and a runtime media flip is reflected. */
  var motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function storedMotionChoice() {
    try { return window.localStorage.getItem(MOTION_KEY); } catch (err) { return null; }
  }

  function prefersReducedMotion() {
    return !!(motionQuery && motionQuery.matches);
  }

  function initMotion() {
    var stored = storedMotionChoice();
    applyMotion(stored === 'paused' || (stored !== 'play' && prefersReducedMotion()));
    if (!motionQuery || !motionQuery.addEventListener) return;
    motionQuery.addEventListener('change', function () {
      var choice = storedMotionChoice();
      if (choice === 'paused') { applyMotion(true); return; }
      if (choice === 'play') { applyMotion(false); return; }
      applyMotion(prefersReducedMotion());
    });
  }

  function toggleMotion() {
    var paused = !motionIsPaused();
    applyMotion(paused);
    try { window.localStorage.setItem(MOTION_KEY, paused ? 'paused' : 'play'); } catch (err) { /* storage unavailable */ }
  }

  function resolvedPendingItem() {
    var world = activeWorld();
    var build = selectedBuild();
    var name = els['mat-item'] && els['mat-item'].value;
    if (!world || !build || !name) return null;
    return M.resolveItem(state, world, build, name);
  }

  function importData() {
    var file = els['file-import'].files && els['file-import'].files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var result = M.importJSON(String(reader.result));
      if (result.error) {
        toast(result.error, true);
        els['file-import'].value = '';
        return;
      }
      state = result.state;
      M.save(window.localStorage, state);
      ui.selectedBuildId = null;
      selectInitialBuild();
      els['file-import'].value = '';
      renderAll();
      toast('Backup restored.');
    };
    reader.readAsText(file);
  }

  function copyList() {
    var world = activeWorld();
    var rows = world ? M.aggregateWorld(world) : [];
    if (!rows.length) { toast('Nothing to copy yet.', true); return; }
    var text = rows.map(function (row) {
      return row.item + ' x' + row.needed + (row.remaining ? ' (' + row.remaining + ' left)' : ' (done)');
    }).join('\n');
    copyText(text, 'Shopping list copied.');
  }

  /**
   * EDICT-0013 D3: one clipboard helper for the shopping list and the coords button.
   * navigator.clipboard is unavailable on some file:// documents, so fall back to
   * the hidden-textarea + execCommand path that the list already used.
   */
  function copyText(text, okMessage) {
    function done() { toast(okMessage); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  function fallbackCopy(text, done) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
      done();
    } catch (err) {
      toast('Copy failed — select the list manually.', true);
    }
    document.body.removeChild(area);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

