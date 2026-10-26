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
    tileTarget: null
  };
  var editingWorldId = null;
  var dialogIcon = { world: null, build: null };
  var draftIcon = null;
  var iconTarget = null;
  var lastIconTrigger = null;
  var ICON_CATALOG = buildIconCatalog();
  var pendingConfirm = null;
  var BUILDS_VIEW_KEY = 'mbt.buildsView';
  var PENCIL_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M9 0h3v2L2 12H0V9L9 0Z"/></svg>';
  var TRASH_ICON = '<svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M4 0h4v1h3v2H1V1h3V0Zm-2 4h8l-.6 8H2.6L2 4Zm2 1v6h1V5H4Zm3 0v6h1V5H7Z"/></svg>';
  /* Contract §5: the one 14-unit check. Never a text glyph — U+2713 is in neither Minecraft.ttf
     nor Pixelify Sans, so a `✓` character renders as a tofu box. It scales to its container
     (100%/100%) because `.ctile__done` is a border-box 14px badge whose content box is 10px;
     `.mc-btn--icon svg` still wins at 14×14 wherever that rule applies. */
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
    if (els.statusLine) els.statusLine.textContent = message;
  }

  /* -------------------------------------------------------------- lifecycle */

  function init() {
    var ids = [
      'tab-builds', 'tab-materials', 'tab-worlds', 'main',
      'view-builds', 'view-materials', 'view-worlds',
      'world-select', 'world-meta', 'btn-new-world', 'btn-new-world-2', 'btn-import', 'btn-export',
      'file-import', 'build-list', 'build-empty', 'btn-new-build', 'btn-first-build',
      'world-stats', 'world-progress', 'world-remaining', 'world-bar', 'world-fill', 'backdrop-pause',
      'btn-new-custom',
      'custom-dialog', 'custom-form', 'custom-name', 'custom-stack', 'custom-scope',
      'custom-icon-pick', 'custom-icon-upload', 'custom-icon-file', 'custom-icon-preview', 'custom-error', 'custom-save', 'custom-cancel',
      'import-dialog', 'import-form', 'import-file', 'import-drop', 'import-text', 'import-restore',
      'import-cancel', 'import-error',
      'build-detail', 'detail-empty', 'detail-empty-action', 'detail-body', 'detail-heading', 'build-delete',
      'detail-meta', 'detail-avatar',
      'build-rename', 'build-name', 'build-name-save', 'build-name-cancel',
      'build-coords', 'copy-coords', 'status-group', 'build-pct', 'build-bar',
      'build-fill', 'build-summary', 'notes-text', 'notes-edit', 'notes-editor',
      'notes-hint', 'build-notes', 'notes-save', 'notes-cancel',
      'material-body', 'material-empty', 'btn-empty-pick-material', 'add-material-form', 'bulk-paste',
      'bulk-dialog', 'bulk-form', 'bulk-input', 'bulk-review', 'bulk-add', 'bulk-cancel', 'bulk-error',
      'mat-item', 'mat-needed', 'mat-collected', 'mat-choice', 'mat-choice-slot',
      'mat-choice-name', 'mat-error',
      'materials-lede', 'mat-search', 'mat-filter', 'world-material-body', 'world-material-empty',
      'btn-empty-reset-filter',
      'mat-totals', 'btn-copy-list', 'worlds-lede', 'world-cards', 'world-empty', 'btn-sample',
      'btn-empty-create-world',
      'status-line', 'toast',
      'world-panel', 'world-panel-name', 'view-standard', 'view-compact',
      'compact-view', 'compact-grid', 'compact-world',
      'tile-dialog', 'tile-form', 'tile-title', 'tile-absolute', 'tile-relative', 'tile-error',
      'tile-cancel', 'tile-save',
      'world-dialog', 'world-form', 'world-dialog-title', 'world-name', 'world-edition',
      'world-version', 'world-notes', 'world-error', 'world-save',
      'build-dialog', 'build-form', 'build-dialog-title', 'build-dialog-save',
      'build-dlg-name', 'build-dlg-status', 'build-dlg-coords',
      'build-error', 'confirm-dialog', 'confirm-title', 'confirm-text', 'confirm-ok',
      'world-avatar', 'world-icon', 'world-icon-change', 'world-icon-remove',
      'build-dlg-icon', 'build-dlg-icon-change', 'build-dlg-icon-remove',
      'icon-dialog', 'icon-form', 'icon-dialog-title', 'icon-search', 'icon-grid',
      'icon-count-hint', 'icon-suggest-note', 'icon-file', 'icon-upload', 'icon-upload-block',
      'icon-preview', 'icon-hint', 'icon-error', 'icon-use', 'icon-cancel'
    ];
    ids.forEach(function (id) { els[id] = $(id); });
    // map dashed ids to camelCase keys for readability below
    els.statusLine = els['status-line'];
    els.toast = els['toast'];
    els.viewswitch = document.querySelector('.viewswitch');
    els.buildsCanvas = document.querySelector('#view-builds > .builds');
    els.tabs = [els['tab-builds'], els['tab-materials'], els['tab-worlds']];
    els.views = {
      builds: els['view-builds'],
      materials: els['view-materials'],
      worlds: els['view-worlds']
    };

    ui.buildsView = readBuildsView();
    var loaded = M.load(window.localStorage);
    state = loaded.state || M.emptyState();
    var seeded = false;
    if (!loaded.state && /[?&]demo\b/.test(window.location.search)) {
      state = M.seedState();
      seeded = true;
      M.save(window.localStorage, state);
    }
    if (loaded.error) toast(loaded.error, true);
    // Seed the first paint once; selectedBuild() itself must stay fallback-free (case 11).
    selectInitialBuild();

    bind();
    bindExtras();
    var tabParam = (window.location.search.match(/[?&]tab=([a-z]+)/) || [])[1];
    if (tabParam && els.views[tabParam]) ui.view = tabParam;
    renderAll();
    probeBackdrop();
    initMotion();
    setStatus(!state.worlds.length
      ? 'Start by creating a world.'
      : seeded ? 'Loaded sample data.' : 'Loaded from this browser.');
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
    bindSteppers();
    bindCompactView();
    bindTileDialog();
    els['btn-new-build'].addEventListener('click', function () { openBuildDialog(null); });
    els['btn-first-build'].addEventListener('click', function () { openBuildDialog(null); });

    els['build-list'].addEventListener('click', function (event) {
      var button = event.target.closest('.build-entry');
      if (!button) return;
      ui.selectedBuildId = button.dataset.build;
      ui.titleEditing = false;
      ui.notesEditing = false;
      renderAll();
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
      commit(M.updateBuild(state, context.world.id, context.build.id, { coords: els['build-coords'].value }).state);
    });
    els['copy-coords'].addEventListener('click', function () {
      var context = currentBuild();
      var coords = context ? String(context.build.coords).trim() : '';
      if (!coords) { toast('This build has no coordinates yet.', true); return; }
      copyText(coords, 'Coordinates copied');
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

    els['material-body'].addEventListener('change', function (event) {
      var input = event.target.closest('[data-mat-field]');
      if (!input) return;
      var context = currentBuild();
      if (!context) return;
      var patch = {};
      patch[input.dataset.matField] = input.value;
      commit(M.updateMaterial(state, context.world.id, context.build.id, input.dataset.mat, patch).state);
    });

    /* Live progress: the bar and figures must not look stale while a number is still being
       typed. Persistence still waits for the change event above. */
    els['material-body'].addEventListener('input', function (event) {
      if (!event.target.closest || !event.target.closest('[data-mat-field]')) return;
      var live = readRowProgress();
      paintBuildProgress(live.totals, live.count);
    });

    els['material-body'].addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-mat]');
      if (!button) return;
      var context = currentBuild();
      if (!context) return;
      var before = snapshotState();
      var buildId = context.build.id;
      commit(M.deleteMaterial(state, context.world.id, context.build.id, button.dataset.removeMat).state);
      offerUndo(before, 'Material removed.', buildId);
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
        needed: els['mat-needed'].value,
        collected: els['mat-collected'].value
      });
      if (result.error) {
        els['mat-error'].textContent = result.error;
        els['mat-error'].hidden = false;
        return;
      }
      els['mat-error'].hidden = true;
      // Reset the picker and the number fields first, then commit: the render that follows shows
      // the new row and the empty "Choose item…" chip in the same pass.
      setMaterialChoice('');
      els['mat-needed'].value = '1';
      els['mat-collected'].value = '0';
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

    /* EDICT-0014 §5: paste a shopping list, review the match, then add it in one commit. */
    els['bulk-paste'].addEventListener('click', function () {
      if (!currentBuild()) {
        els['mat-error'].textContent = 'Add a build before pasting materials.';
        els['mat-error'].hidden = false;
        return;
      }
      els['bulk-input'].value = '';
      els['bulk-error'].hidden = true;
      renderBulkReview();
      els['bulk-dialog'].showModal();
      els['bulk-input'].focus();
    });
    els['bulk-input'].addEventListener('input', renderBulkReview);
    els['bulk-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      if (event.submitter && event.submitter.value === 'cancel') { els['bulk-dialog'].close(); return; }
      applyBulk();
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

  function renderAll() {
    renderWorldPicker();
    renderBuilds();
    renderWorldStats();
    renderDetail();
    renderCompact();
    renderWorldMaterials();
    renderWorlds();
    renderMaterialChoice();
    setView(ui.view);
  }

  function formatCount(value) {
    return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /* -------------------------------------------------------------- timestamps */

  /**
   * EDICT-0016 §7: one display helper for every surface — `Created <date> · Updated <date time>`
   * in <time datetime title=ISO> nodes, falling back `updatedAt → createdAt → —`.
   */
  function stampNode(iso, label) {
    var node = document.createElement('time');
    var text = M.formatStamp(iso);
    if (text !== '\u2014') {
      node.setAttribute('datetime', String(iso));
      node.setAttribute('title', String(iso));
    }
    node.textContent = label + ' ' + text;
    return node;
  }

  function stampFragment(entity) {
    var stamps = M.timestamps(entity);
    var updated = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    var fragment = document.createDocumentFragment();
    fragment.appendChild(stampNode(stamps.createdAt, 'Created'));
    fragment.appendChild(document.createTextNode(' · '));
    fragment.appendChild(stampNode(updated, 'Updated'));
    return fragment;
  }

  function timeHtml(iso, label) {
    var text = M.formatStamp(iso);
    var attrs = text === '\u2014' ? '' : ' datetime="' + escapeHtml(iso) + '" title="' + escapeHtml(iso) + '"';
    return '<time' + attrs + '>' + escapeHtml(label + ' ' + text) + '</time>';
  }

  function stampHtml(entity) {
    var stamps = M.timestamps(entity);
    var updated = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    return timeHtml(stamps.createdAt, 'Created') + ' · ' + timeHtml(updated, 'Updated');
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
    renderCompactWorldLine(world);
    els['compact-grid'].innerHTML = world
      ? M.sortBuilds(world.builds).map(compactCardHtml).join('')
      : '';
    wireIconFallbacks(els['compact-grid']);
  }

  function renderCompactWorldLine(world) {
    var node = els['compact-world'];
    if (!node) return;
    node.textContent = '';
    if (!world) {
      node.textContent = 'No world selected';
      return;
    }
    var identity = world.name + ' · ' + (world.edition === 'bedrock' ? 'Bedrock' : 'Java');
    if (world.version) identity += ' ' + world.version;
    node.textContent = identity;
    var summary = M.worldSummary(world);
    if (summary.needed > 0) {
      node.textContent = identity + ' · ' + summary.pct + '% gathered · ' +
        formatCount(summary.remaining) + ' of ' + formatCount(summary.needed) + ' items still to collect';
    }
  }

  function stackText(amount, stack) {
    var size = stack && stack > 0 ? stack : M.DEFAULT_STACK;
    var count = Math.max(0, Math.floor(Number(amount) || 0));
    var stacks = Math.floor(count / size);
    return stacks + (stacks === 1 ? ' stack' : ' stacks') + ' + ' + (count % size);
  }

  function compactTileHtml(build, material) {
    var progress = M.materialProgress(material);
    var done = progress.done;
    var count = done ? material.needed : progress.remaining;
    var stack = rowStack(material, build);
    var stamps = M.timestamps(build);
    var updatedIso = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    var tip = material.item + ': ' + material.collected + ' / ' + material.needed +
      ' (' + stackText(material.collected, stack) + ' / ' + stackText(material.needed, stack) + ')' +
      ' · Updated ' + M.formatStamp(updatedIso);
    return '<button class="ctile" type="button" data-build-id="' + escapeHtml(build.id) +
      '" data-mat-id="' + escapeHtml(material.id) + '" data-state="' + (done ? 'done' : 'open') +
      '" data-tip="' + escapeHtml(tip) + '" aria-label="' + escapeHtml(material.item + ': ' +
        material.collected + ' of ' + material.needed + ' collected') + '">' +
      '<span class="ctile__count">' + formatCount(count) + '</span>' +
      '<span class="ctile__icon" aria-hidden="true">' + slotInnerHtml(material.item, true) + '</span>' +
      '<span class="ctile__name">' + escapeHtml(material.item) + '</span>' +
      (done ? '<span class="ctile__done" aria-hidden="true">' + CHECK_ICON + '</span>' : '') +
      '</button>';
  }

  function compactCardHtml(build) {
    var totals = build.materials.reduce(function (acc, material) {
      acc.needed += material.needed;
      acc.gathered += Math.min(material.collected, material.needed);
      return acc;
    }, { needed: 0, gathered: 0 });
    var pct = totals.needed ? Math.min(100, Math.round((totals.gathered / totals.needed) * 100)) : 0;
    var meta = build.materials.length + (build.materials.length === 1 ? ' material' : ' materials');
    if (String(build.coords || '').trim()) meta += ' · ' + escapeHtml(build.coords);
    var id = escapeHtml(build.id);
    var name = escapeHtml(build.name);
    return '<article class="ccard" data-build-id="' + id + '" data-status="' + escapeHtml(build.status) + '">' +
      '<div class="ccard__head">' +
        '<h3 class="ccard__title">' + name + '</h3>' +
        '<span class="chip chip--' + escapeHtml(build.status) + ' ccard__chip">' +
          escapeHtml(STATUS_LABEL[build.status] || build.status) + '</span>' +
        '<span class="ccard__pct">' + pct + '%</span>' +
        '<div class="ccard__actions">' +
          '<button class="mc-btn mc-btn--sm mc-btn--icon" type="button" id="ccard-edit-' + id +
            '" data-ccard-edit="' + id + '" aria-label="Edit ' + name + '" title="Edit build">' +
            PENCIL_ICON + '</button>' +
          '<button class="mc-btn mc-btn--sm mc-btn--icon mc-btn--danger" type="button" id="ccard-delete-' + id +
            '" data-ccard-delete="' + id + '" aria-label="Delete ' + name + '" title="Delete build">' +
            TRASH_ICON + '</button>' +
        '</div>' +
      '</div>' +
      '<p class="ccard__meta">' + meta + '</p>' +
      '<p class="ccard__time">' + stampHtml(build) + '</p>' +
      '<div class="ccard__bar" id="ccard-bar-' + id + '" role="progressbar" aria-valuemin="0" ' +
        'aria-valuemax="100" aria-valuenow="' + pct + '">' +
        '<div class="ccard__fill" id="ccard-fill-' + id + '" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<p class="ccard__progress">' + pct + '% (' + formatCount(totals.gathered) + ' / ' +
        formatCount(totals.needed) + ')</p>' +
      '<div class="ccard__matrix">' +
        build.materials.map(function (material) { return compactTileHtml(build, material); }).join('') +
      '</div>' +
      '</article>';
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
      openTileDialog(tile.getAttribute('data-build-id'), tile.getAttribute('data-mat-id'));
    });
  }

  /* ------------------------------------------------------------ quick update */

  function showTileError(message) {
    if (!els['tile-error']) return;
    els['tile-error'].textContent = message;
    els['tile-error'].hidden = false;
  }

  function tileMaterial() {
    var target = ui.tileTarget;
    if (!target) return null;
    var world = activeWorld();
    if (!world) return null;
    var build = M.findBuild(world, target.buildId);
    if (!build) return null;
    var material = null;
    build.materials.forEach(function (entry) { if (entry.id === target.matId) material = entry; });
    return material ? { world: world, build: build, material: material } : null;
  }

  function openTileDialog(buildId, matId) {
    var world = activeWorld();
    if (!world) return;
    var build = M.findBuild(world, buildId);
    if (!build) return;
    var material = null;
    build.materials.forEach(function (entry) { if (entry.id === matId) material = entry; });
    if (!material) return;
    ui.tileTarget = { buildId: buildId, matId: matId };
    els['tile-title'].textContent = 'Update inventory: ' + material.item;
    els['tile-absolute'].value = String(Math.max(0, Math.floor(Number(material.collected) || 0)));
    els['tile-relative'].value = '0';
    clearFormError('tile-error');
    els['tile-dialog'].showModal();
    els['tile-absolute'].focus();
    safeSelect(els['tile-absolute']);
  }

  /** One model commit: absolute + the signed relative delta, clamped at zero. */
  function commitTileDialog() {
    var context = tileMaterial();
    if (!context) { els['tile-dialog'].close(); return; }
    var absoluteRaw = String(els['tile-absolute'].value).trim();
    var absolute = /^\d+$/.test(absoluteRaw) ? Number(absoluteRaw) : NaN;
    if (!isFinite(absolute)) {
      showTileError('Current inventory must be a whole number.');
      return;
    }
    if (absolute > 1e9) { showTileError('That count is too large.'); return; }
    var relative = M.parseRelative(els['tile-relative'].value, rowStack(context.material, context.build));
    if (relative.error) { showTileError(relative.error); return; }
    var collected = absolute + relative.value;
    if (!isFinite(collected) || Math.abs(collected) > 1e9) {
      showTileError('That count is too large.');
      return;
    }
    collected = Math.max(0, Math.floor(collected));
    /* A commit that changes nothing closes quietly instead of inventing a second notification. */
    if (collected === Math.max(0, Math.floor(Number(context.material.collected) || 0))) {
      els['tile-dialog'].close();
      toast('Inventory updated.');
      return;
    }
    /* EDICT-0014 §6 applies to this surface too (case 95): one commit per Enter, and the quick
       update offers the same six-second Undo as every other material mutation. */
    var before = snapshotState();
    var result = M.updateMaterial(state, context.world.id, context.build.id, context.material.id, {
      collected: collected
    });
    if (result.error) { showTileError(result.error); return; }
    els['tile-dialog'].close();
    commit(result.state);
    offerUndo(before, 'Inventory updated.', context.build.id);
  }

  function bindTileDialog() {
    if (!els['tile-form']) return;
    els['tile-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      if (event.submitter && event.submitter.value === 'cancel') {
        els['tile-dialog'].close();
        return;
      }
      commitTileDialog();
    });
    els['tile-dialog'].addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        els['tile-dialog'].close();
        return;
      }
      if (event.key !== 'Enter') return;
      /* Enter anywhere in the dialog commits; Enter on Cancel keeps its native meaning. */
      if (event.target === els['tile-cancel']) return;
      event.preventDefault();
      commitTileDialog();
    });
    els['tile-dialog'].addEventListener('close', function () {
      ui.tileTarget = null;
      clearFormError('tile-error');
    });
  }

  /* ---------------------------------------------------------------- steppers */

  /**
   * EDICT-0016 §2/§8/§9: one delegated implementation. Plain ±1, Shift ± the item's stack,
   * Ctrl/⌘ ±16; Shift wins when both are held.
   */
  function bindSteppers() {
    document.addEventListener('click', onStepperClick);
    document.addEventListener('wheel', onStepperWheel, { capture: true, passive: false });
    document.addEventListener('keydown', onStepperKeydown, { capture: true });
    document.addEventListener('focusin', onNumberFocus);
    document.addEventListener('click', onNumberClick);
  }

  function isStepperInput(node) {
    return !!(node && node.tagName === 'INPUT' && node.closest && node.closest('[data-stepper]'));
  }

  /**
   * AC8: a single click (or a keyboard focus with nothing selected) selects the whole value.
   * `selectionStart` is unreportable on some `type=number` implementations, so every probe is
   * guarded and `select()` is attempted for both shapes.
   */
  function safeSelect(input) {
    if (!input) return;
    try { input.select(); } catch (error) { /* number inputs may refuse select() */ }
    try {
      if (typeof input.setSelectionRange === 'function' && input.type !== 'number') {
        input.setSelectionRange(0, String(input.value).length);
      }
    } catch (error) { /* selection APIs are optional for non-text inputs */ }
    try {
      if (typeof input.setSelectionRange === 'function' && input.type === 'number' && String(input.value)) {
        input.setSelectionRange(String(input.value).length, String(input.value).length);
      }
    } catch (error) { /* caret control is best-effort on number inputs */ }
  }

  function selectionCollapsed(input) {
    var start = null;
    var end = null;
    try { start = input.selectionStart; end = input.selectionEnd; } catch (error) { start = null; end = null; }
    if (start === null || end === null) return true;
    return start === end;
  }

  function onNumberFocus(event) {
    if (!isStepperInput(event.target)) return;
    if (!selectionCollapsed(event.target)) return;
    safeSelect(event.target);
  }

  function onNumberClick(event) {
    if (!isStepperInput(event.target)) return;
    if (!selectionCollapsed(event.target)) return;
    safeSelect(event.target);
  }

  function onStepperClick(event) {
    var button = event.target.closest ? event.target.closest('[data-stepper-step]') : null;
    if (!button) return;
    var container = button.closest('[data-stepper]');
    if (!container) return;
    var input = container.querySelector('input');
    if (!input) return;
    event.preventDefault();
    var sign = button.getAttribute('data-stepper-step') === '-1' ? -1 : 1;
    var field = input.getAttribute('data-mat-field');
    var matId = input.getAttribute('data-mat');
    if (!applyInputStep(input, sign * stepAmount(input, event))) {
      if (field && matId) focusStepperButton(field, matId, sign > 0 ? '1' : '-1');
      return;
    }
    /* A row step committed and re-rendered the table; hand focus back to the same button. */
    if (field && matId) focusStepperButton(field, matId, sign > 0 ? '1' : '-1');
  }

  function onStepperWheel(event) {
    var input = event.target;
    if (!isStepperInput(input)) return;
    if (document.activeElement !== input) return;
    if (!event.deltaY) return;
    /* Focused wheel must never scroll the page or the material list (AC9). */
    event.preventDefault();
    var field = input.getAttribute('data-mat-field');
    var matId = input.getAttribute('data-mat');
    var amount = (event.deltaY > 0 ? -1 : 1) * stepAmount(input, event);
    if (!applyInputStep(input, amount)) return;
    if (field && matId) focusStepperInput(field, matId);
  }

  function commitDirtyRow(input) {
    var field = input.getAttribute('data-mat-field');
    var material = findRowMaterial(input.getAttribute('data-mat'));
    if (!material || !field) return;
    var stored = field === 'needed' ? material.needed : material.collected;
    var typed = Math.floor(Number(input.value));
    if (!isFinite(typed)) return;
    if (typed === stored) return;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function onStepperKeydown(event) {
    if (event.key !== 'Enter') return;
    var input = event.target;
    if (!isStepperInput(input)) return;
    /* Add form: Needed walks to Got and must not submit the form. */
    if (input.id === 'mat-needed') {
      event.preventDefault();
      if (els['mat-collected']) {
        els['mat-collected'].focus();
        safeSelect(els['mat-collected']);
      }
      return;
    }
    var field = input.getAttribute('data-mat-field');
    var matId = input.getAttribute('data-mat');
    if (!field || !matId) return;
    var inputs = Array.prototype.slice.call(
      els['material-body'].querySelectorAll('[data-mat-field="' + field + '"]'));
    var index = inputs.indexOf(input);
    if (index < 0) return;
    event.preventDefault();
    if (index === inputs.length - 1) {
      /* Last field: commit, then keep focus here — never blur, never wrap. */
      commitDirtyRow(input);
      focusStepperInput(field, matId);
      return;
    }
    var nextId = inputs[index + 1].getAttribute('data-mat');
    commitDirtyRow(input);
    focusStepperInput(field, nextId);
  }

  function renderWorldStats() {
    var world = activeWorld();
    var summary = world ? M.worldSummary(world) : null;
    var show = !!(world && summary && summary.needed > 0);
    /* Contract §3: the three stat nodes carry `hidden` themselves, not only their wrapper,
       so a probe that reads the children sees the same truth as the paint. */
    els['world-stats'].hidden = !show;
    els['world-progress'].hidden = !show;
    els['world-remaining'].hidden = !show;
    els['world-bar'].hidden = !show;
    if (!show) {
      els['world-progress'].textContent = '';
      els['world-remaining'].textContent = '';
      els['world-bar'].setAttribute('aria-valuenow', '0');
      els['world-fill'].style.width = '0%';
      return;
    }
    els['world-progress'].textContent = summary.pct + '% gathered';
    els['world-remaining'].textContent =
      formatCount(summary.remaining) + ' of ' + formatCount(summary.needed) + ' items still to collect';
    els['world-bar'].setAttribute('aria-valuenow', String(summary.pct));
    els['world-fill'].style.width = summary.pct + '%';
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
    /* EDICT-0016 §7/§8: identity stays identity; the two stamps are appended as <time> nodes. */
    els['world-meta'].textContent =
      (world.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' ' + world.version +
      ' · ' + world.builds.length + (world.builds.length === 1 ? ' build' : ' builds');
    els['world-meta'].appendChild(document.createTextNode(' · '));
    els['world-meta'].appendChild(stampFragment(world));
  }

  function renderBuilds() {
    var world = activeWorld();
    var build = selectedBuild();
    if (build) ui.selectedBuildId = build.id;

    var items = [];
    if (world) {
      M.sortBuilds(world.builds).forEach(function (entry) {
        var totals = entry.materials.reduce(function (acc, material) {
          acc.needed += material.needed;
          acc.collected += Math.min(material.collected, material.needed);
          return acc;
        }, { needed: 0, collected: 0 });
        var pct = totals.needed ? Math.round((totals.collected / totals.needed) * 100) : 0;
        var selected = build && build.id === entry.id;
        items.push(
          '<li><button type="button" class="build-entry" data-build="' + escapeHtml(entry.id) + '"' +
          (selected ? ' aria-current="true"' : '') + '>' +
          '<span class="build-entry__top">' +
            '<span class="build-entry__identity">' +
              avatarHtml(entry.icon, 28, entry.name) +
              '<span class="build-entry__name">' + escapeHtml(entry.name) + '</span>' +
            '</span>' +
            '<span class="chip chip--' + escapeHtml(entry.status) + '">' + escapeHtml(STATUS_LABEL[entry.status] || entry.status) + '</span>' +
          '</span>' +
          '<span class="build-entry__meta">' +
            '<span>' + pct + '% gathered</span>' +
            '<span aria-hidden="true">·</span>' +
            '<span>' + entry.materials.length + (entry.materials.length === 1 ? ' material' : ' materials') + '</span>' +
            (entry.coords ? '<span aria-hidden="true">·</span><span>' + escapeHtml(entry.coords) + '</span>' : '') +
          '</span>' +
          '</button></li>'
        );
      });
    }
    els['build-list'].innerHTML = items.join('');
    wireIconFallbacks(els['build-list']);
    var empty = !world || !world.builds.length;
    els['build-empty'].hidden = !empty;
    els['build-list'].hidden = empty;
  }

  /** Paint the gathered/total figures; shared by the model render and by live typing. */
  function paintBuildProgress(totals, materialCount) {
    var needed = Math.max(0, totals.needed);
    var collected = Math.min(Math.max(0, totals.collected), needed);
    var pct = needed ? Math.min(100, Math.round((collected / needed) * 100)) : 0;
    els['build-pct'].textContent = pct + '%';
    els['build-fill'].style.width = pct + '%';
    els['build-bar'].setAttribute('aria-valuenow', String(pct));
    els['build-summary'].textContent = materialCount
      ? collected + ' of ' + needed + ' items gathered · ' + (needed - collected) + ' to go'
      : 'No materials listed yet. Add the blocks this build needs.';
  }

  /** The same figures read from the row inputs, so the bar is not stale while typing (D5). */
  function readRowProgress() {
    var totals = { needed: 0, collected: 0 };
    var rows = els['material-body'].querySelectorAll('.mat-row');
    Array.prototype.forEach.call(rows, function (row) {
      var needInput = row.querySelector('[data-mat-field="needed"]');
      var gotInput = row.querySelector('[data-mat-field="collected"]');
      var need = Math.max(1, Math.floor(Number(needInput && needInput.value) || 1));
      var got = Math.max(0, Math.floor(Number(gotInput && gotInput.value) || 0));
      totals.needed += need;
      totals.collected += Math.min(got, need);
    });
    return { totals: totals, count: rows.length };
  }

  /* EDICT-0014 §5: bulk paste. The review list comes from the model's parser, repeated matches
     merge into one row, and only matched rows are committed — unknown names stay visible in the
     review so the user can see what was not understood. */
  function bulkRows() {
    var rows = M.parseBulk(els['bulk-input'].value, catalogData()).rows;
    var seen = {};
    var merged = [];
    rows.forEach(function (row) {
      if (row.state !== 'matched') {
        merged.push({ raw: row.raw, qty: row.qty, name: row.name, slug: row.slug, state: row.state });
        return;
      }
      if (seen[row.slug]) { seen[row.slug].qty += row.qty; return; }
      var copy = { raw: row.raw, qty: row.qty, name: row.name, slug: row.slug, state: row.state };
      seen[row.slug] = copy;
      merged.push(copy);
    });
    return merged;
  }

  function renderBulkReview() {
    var rows = bulkRows();
    els['bulk-review'].innerHTML = rows.map(function (row) {
      var matched = row.state === 'matched';
      return '<div class="bulk-row" data-bulk-state="' + (matched ? 'matched' : 'unknown') + '">' +
        '<span class="slot" aria-hidden="true" data-tip="' + escapeHtml(row.name) + '">' +
        slotInnerHtml(row.name) + '</span>' +
        '<span class="bulk-row__name">' + escapeHtml(row.name) + '</span>' +
        (matched
          ? '<input class="mc-input bulk-row__qty" type="number" min="1" step="1" value="' + row.qty + '" ' +
            'data-bulk-qty="' + escapeHtml(row.slug) + '" aria-label="Quantity for ' + escapeHtml(row.name) + '">'
          : '<span class="bulk-row__note">not in the catalogue</span>') +
        '</div>';
    }).join('');
    wireIconFallbacks(els['bulk-review']);
  }

  function applyBulk() {
    var context = currentBuild();
    if (!context) return;
    var inputs = els['bulk-review'].querySelectorAll('.bulk-row[data-bulk-state="matched"] [data-bulk-qty]');
    var next = state;
    var added = 0;
    Array.prototype.forEach.call(inputs, function (input) {
      var entry = catalogEntry(input.dataset.bulkQty);
      if (!entry) return;
      var result = M.addMaterial(next, context.world.id, context.build.id, {
        item: entry.name,
        needed: input.value,
        collected: 0
      });
      if (result.error) return;
      next = result.state;
      added += 1;
    });
    if (!added) {
      els['bulk-error'].textContent = 'No lines matched a catalogue item.';
      els['bulk-error'].hidden = false;
      return;
    }
    els['bulk-error'].hidden = true;
    els['bulk-dialog'].close();
    commit(next);
    toast(added + (added === 1 ? ' material added.' : ' materials added.'));
  }

  function renderDetail() {
    var world = activeWorld();
    var build = selectedBuild();
    var hasBuild = !!(world && build);
    els['detail-empty'].hidden = hasBuild;
    els['detail-body'].hidden = !hasBuild;
    if (!hasBuild) {
      ui.titleEditing = false;
      ui.notesEditing = false;
      ui.editingBuildId = null;
      return;
    }
    /* Selecting another build abandons an in-progress inline edit (Escape semantics). */
    if (ui.editingBuildId !== build.id) {
      ui.editingBuildId = build.id;
      ui.titleEditing = false;
      ui.notesEditing = false;
    }

    els['detail-heading'].textContent = build.name;
    els['detail-heading'].hidden = ui.titleEditing;
    /* EDICT-0014 §8: a suggestion is shown on the avatar but never written into the build, so a
       rename can never silently overwrite a stored icon. */
    var suggestion = build.icon ? null : suggestionFor(build);
    var shownIcon = build.icon || (suggestion ? { kind: 'item', slug: suggestion.slug } : null);
    els['detail-avatar'].innerHTML = avatarHtml(shownIcon, 40, build.name);
    els['detail-avatar'].setAttribute('aria-label', 'Change icon for ' + build.name);
    if (suggestion) {
      els['detail-avatar'].setAttribute('data-icon-auto', 'true');
      els['detail-avatar'].setAttribute('title', suggestion.reason);
    } else {
      els['detail-avatar'].removeAttribute('data-icon-auto');
      els['detail-avatar'].removeAttribute('title');
    }
    wireIconFallbacks(els['detail-avatar']);

    els['build-name'].hidden = !ui.titleEditing;
    els['build-name-save'].hidden = !ui.titleEditing;
    els['build-name-cancel'].hidden = !ui.titleEditing;
    els['build-rename'].hidden = ui.titleEditing;
    if (!ui.titleEditing) els['build-name'].value = build.name;

    els['build-coords'].value = build.coords;
    els['copy-coords'].disabled = !String(build.coords).trim();

    els['notes-text'].hidden = ui.notesEditing;
    els['notes-editor'].hidden = !ui.notesEditing;
    /* EDICT-0016 §3/§4: the actions live in the label row and replace #notes-edit while editing. */
    els['notes-hint'].hidden = !ui.notesEditing;
    els['notes-save'].hidden = !ui.notesEditing;
    els['notes-cancel'].hidden = !ui.notesEditing;
    els['notes-edit'].hidden = ui.notesEditing;
    if (!ui.notesEditing) {
      els['notes-text'].textContent = build.notes || 'No notes yet.';
      els['notes-text'].classList.toggle('notes__text--empty', !build.notes);
    }
    renderDetailMeta(build);

    Array.prototype.forEach.call(els['status-group'].querySelectorAll('[data-status]'), function (button) {
      var active = button.dataset.status === build.status;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    var totals = build.materials.reduce(function (acc, material) {
      acc.needed += material.needed;
      acc.collected += Math.min(material.collected, material.needed);
      return acc;
    }, { needed: 0, collected: 0 });
    paintBuildProgress(totals, build.materials.length);

    var rows = build.materials.map(function (material) {
      var progress = M.materialProgress(material);
      return '<div class="mat-row" role="row" data-mat="' + escapeHtml(material.id) + '">' +
        '<span class="mat-row__item">' + slotHtml(material.item) +
          '<span class="mat-row__name">' + escapeHtml(material.item) + '</span></span>' +
        rowStepperHtml(material, 'needed', 'needed for') +
        rowStepperHtml(material, 'collected', 'collected for') +
        '<span class="num">' + progress.remaining + '</span>' +
        '<button type="button" class="row-delete" data-remove-mat="' + escapeHtml(material.id) + '" ' +
          'aria-label="Remove ' + escapeHtml(material.item) + '">×</button>' +
        '</div>';
    });
    els['material-body'].innerHTML = rows.join('');
    wireIconFallbacks(els['material-body']);
    els['material-empty'].hidden = build.materials.length > 0;
  }

  /** The build's detail meta line: `Updated …` in a <time>, with created carried on the title. */
  function renderDetailMeta(build) {
    if (!els['detail-meta']) return;
    els['detail-meta'].textContent = '';
    els['detail-meta'].removeAttribute('title');
    if (!build) return;
    var stamps = M.timestamps(build);
    var updatedIso = stamps.updatedAt !== undefined ? stamps.updatedAt : stamps.createdAt;
    var node = stampNode(updatedIso, 'Updated');
    els['detail-meta'].appendChild(node);
    if (stamps.createdAt !== undefined) {
      els['detail-meta'].setAttribute('title', 'Created ' + M.formatStamp(stamps.createdAt) +
        ' (' + stamps.createdAt + ')');
    }
  }

  /**
   * EDICT-0016 §2: one stepper for every editable number — `+` button, the input, `−` button, in
   * that literal order. `field`/`matId` are only for material rows; the container carries them so
   * a re-render can hand focus back to the same control.
   */
  function stepperHtml(options) {
    var opts = options || {};
    var field = opts.field || '';
    var matId = opts.matId || '';
    var type = opts.type === 'text' ? 'text' : 'number';
    var value = opts.value === undefined || opts.value === null ? '' : String(opts.value);
    var attrs = ' class="mc-input num' + (opts.gotCol ? ' got-col' : '') + '" type="' + type + '" inputmode="numeric"';
    if (opts.min !== undefined) attrs += ' min="' + opts.min + '"';
    if (opts.max !== undefined) attrs += ' max="' + opts.max + '"';
    if (type === 'number') attrs += ' step="1"';
    attrs += ' value="' + escapeHtml(value) + '"';
    if (opts.id) attrs += ' id="' + escapeHtml(opts.id) + '"';
    if (field) attrs += ' data-mat-field="' + escapeHtml(field) + '"';
    if (matId) attrs += ' data-mat="' + escapeHtml(matId) + '"';
    if (opts.required) attrs += ' required';
    attrs += ' aria-label="' + escapeHtml(opts.inputLabel || opts.name || 'Value') + '">';
    var wrapper = ' class="stepper" data-stepper';
    if (field && matId) {
      wrapper += ' data-stepper-field="' + escapeHtml(field) + '" data-stepper-mat="' + escapeHtml(matId) + '"';
    }
    var name = escapeHtml(opts.name || 'value');
    return '<div' + wrapper + '>' +
      '<button class="stepper__btn" type="button" data-stepper-step="1" aria-label="Increase ' + name + '">+</button>' +
      '<input' + attrs +
      '<button class="stepper__btn" type="button" data-stepper-step="-1" aria-label="Decrease ' + name + '">−</button>' +
      '</div>';
  }

  /** One material row's Needed or Got stepper, with the item named in the accessible labels. */
  function rowStepperHtml(material, field, verb) {
    var isNeeded = field === 'needed';
    return stepperHtml({
      field: field,
      matId: material.id,
      min: isNeeded ? 1 : 0,
      gotCol: !isNeeded,
      value: isNeeded ? material.needed : material.collected,
      name: verb + ' ' + material.item,
      inputLabel: (isNeeded ? 'Needed ' : 'Collected ') + material.item
    });
  }

  /** Resolve an item's stack exactly as the retired renderer did (registry first, then catalogue). */
  function rowStack(material, build) {
    var owner = build || selectedBuild();
    var resolved = M.resolveItem(state, activeWorld(), owner, material.item);
    return (resolved && resolved.stack) || stackSizeFor(material.item) || M.DEFAULT_STACK;
  }

  function findRowMaterial(matId) {
    var build = selectedBuild();
    if (!build) return null;
    var found = null;
    build.materials.forEach(function (entry) { if (entry.id === matId) found = entry; });
    return found;
  }

  function stackForInput(input) {
    if (!input) return M.DEFAULT_STACK;
    if (input.getAttribute('data-mat')) return rowStack(findRowMaterial(input.getAttribute('data-mat')));
    if (input.id === 'mat-needed' || input.id === 'mat-collected') {
      var resolved = resolvedPendingItem();
      return resolved && resolved.stack ? resolved.stack : M.DEFAULT_STACK;
    }
    if (input.id === 'custom-stack') {
      var world = activeWorld();
      var build = selectedBuild();
      var named = M.resolveItem(state, world, build, els['custom-name'] ? els['custom-name'].value : '');
      return named && named.stack ? named.stack : M.DEFAULT_STACK;
    }
    return M.DEFAULT_STACK;
  }

  /** Shift = one stack of this item, Ctrl/⌘ = 16, plain = 1; Shift wins when both are held. */
  function stepAmount(input, event) {
    if (!event) return 1;
    if (event.shiftKey) return stackForInput(input);
    if (event.ctrlKey || event.metaKey) return 16;
    return 1;
  }

  function inputHasMin(input) {
    var min = input.getAttribute('min');
    return min !== null && min !== '' && isFinite(Number(min));
  }

  function inputHasMax(input) {
    var max = input.getAttribute('max');
    return max !== null && max !== '' && isFinite(Number(max));
  }

  function clampInput(input, value) {
    var next = Math.round(value);
    if (!isFinite(next)) next = 0;
    if (inputHasMin(input)) next = Math.max(Number(input.getAttribute('min')), next);
    if (inputHasMax(input)) next = Math.min(Number(input.getAttribute('max')), next);
    return next;
  }

  /** Current numeric value of a stepper input; `#tile-relative` is text and parsed as a delta. */
  function inputNumber(input) {
    if (input.type === 'text') {
      var parsed = M.parseRelative(input.value, stackForInput(input));
      return parsed && parsed.error === undefined ? parsed.value : null;
    }
    var value = Number(input.value);
    return isFinite(value) ? Math.floor(value) : null;
  }

  /** Apply one step and let the shipped commit path run: `input` first, then `change`. */
  function applyInputStep(input, amount) {
    if (!input) return false;
    var current = inputNumber(input);
    var base = current === null ? 0 : current;
    var next = clampInput(input, base + Math.round(amount));
    if (current !== null && next === current) return false;
    input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function focusStepperButton(field, matId, step) {
    var container = document.querySelector(
      '[data-stepper-field="' + field + '"][data-stepper-mat="' + matId + '"]');
    if (!container) return false;
    var button = container.querySelector('[data-stepper-step="' + step + '"]');
    if (!button) return false;
    button.focus();
    return true;
  }

  function focusStepperInput(field, matId) {
    var input = document.querySelector(
      '#material-body [data-mat-field="' + field + '"][data-mat="' + matId + '"]');
    if (!input) return false;
    input.focus();
    return true;
  }

  function renderWorldMaterials() {
    var world = activeWorld();
    var rows = world ? M.aggregateWorld(world) : [];
    els['materials-lede'].textContent = world
      ? 'Every block needed across "' + world.name + '", summed by item.'
      : 'Create a world to start a shopping list.';
    /* B5: the world's Updated <time> rides the lede; its textContent stays the same sentence. */
    if (world) {
      var worldStamps = M.timestamps(world);
      var worldUpdated = worldStamps.updatedAt !== undefined ? worldStamps.updatedAt : worldStamps.createdAt;
      els['materials-lede'].appendChild(document.createTextNode(' · '));
      els['materials-lede'].appendChild(stampNode(worldUpdated, 'Updated'));
    }

    var query = ui.query.trim().toLowerCase();
    var filtered = rows.filter(function (row) {
      if (query && row.item.toLowerCase().indexOf(query) < 0) return false;
      if (ui.filter === 'remaining' && row.done) return false;
      if (ui.filter === 'done' && !row.done) return false;
      return true;
    });

    els['world-material-body'].innerHTML = filtered.map(function (row) {
      return '<div class="mat-row' + (row.done ? ' mat-row--done' : '') + '" role="row">' +
        '<span class="mat-row__item">' + slotHtml(row.item) +
          '<span class="mat-row__name">' + escapeHtml(row.item) + '</span></span>' +
        '<span class="num">' + row.needed + '</span>' +
        '<span class="num got-col">' + row.collected + '</span>' +
        '<span class="num">' + row.remaining + '</span>' +
        '<span class="progress-col"><span class="mat-row__bar"><span style="width:' + row.pct + '%"></span></span></span>' +
        '<span class="mat-row__builds builds-col">' + escapeHtml(row.builds.join(', ')) + '</span>' +
        '</div>';
    }).join('');

    wireIconFallbacks(els['world-material-body']);
    /* EDICT-0014 §4: the filter notice only speaks when a search or filter is what hid the
       rows; a world with no materials yet keeps the page quiet (its own lede explains it). */
    els['world-material-empty'].hidden = !(filtered.length === 0 && (ui.query.trim() || ui.filter !== 'all'));
    var summary = M.worldSummary(world);
    els['mat-totals'].textContent = world
      ? rows.length + (rows.length === 1 ? ' item' : ' items') + ' · ' + summary.collected + ' / ' + summary.needed +
        ' gathered · ' + summary.remaining + ' to go · ' + summary.pct + '%'
      : '';
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
          ' · ' + summary.builds + ' builds · ' + summary.materials + ' materials</p>' +
        '<p class="world-card__meta">' + summary.pct + '% gathered · ' + summary.remaining + ' items to go</p>' +
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

