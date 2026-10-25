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
    selectedBuildId: null,
    filter: 'remaining',
    query: '',
    pickerMode: 'icon',
    titleEditing: false,
    notesEditing: false,
    editingBuildId: null
  };
  var editingWorldId = null;
  var dialogIcon = { world: null, build: null };
  var draftIcon = null;
  var iconTarget = null;
  var lastIconTrigger = null;
  var ICON_CATALOG = buildIconCatalog();
  var pendingConfirm = null;

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
    Array.prototype.forEach.call(root.querySelectorAll('.slot img, .avatar img'), function (img) {
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

  function openIconPicker(target) {
    iconTarget = target;
    /* Case 32: remember the invoking control explicitly. A programmatic .click() does not move
       focus, so document.activeElement is not a reliable trigger. */
    lastIconTrigger = target.trigger || document.activeElement;
    ui.pickerMode = target.scope === 'material' ? 'item' : 'icon';
    if (target.scope === 'world') draftIcon = dialogIcon.world;
    else if (target.scope === 'build') draftIcon = dialogIcon.build;
    else if (target.scope === 'build-detail') {
      var build = selectedBuild();
      draftIcon = (build && build.icon) || null;
    } else {
      draftIcon = null;
    }
    els['icon-search'].value = '';
    els['icon-file'].value = '';
    els['icon-error'].hidden = true;
    syncPickerChrome();
    renderIconPicker();
    els['icon-dialog'].showModal();
    els['icon-search'].focus();
  }

  /** EDICT-0013 D7/D8: one dialog, two modes — choose an icon, or choose an item for a material. */
  function syncPickerChrome() {
    var picking = ui.pickerMode === 'item';
    els['icon-dialog-title'].textContent = picking ? 'Choose an item' : 'Choose an icon';
    els['icon-use'].textContent = picking ? 'Use item' : 'Use icon';
    els['icon-use'].hidden = picking;
    els['icon-upload-block'].hidden = picking;
    els['icon-error'].hidden = true;
  }

  function renderIconPicker() {
    var picking = ui.pickerMode === 'item';
    var query = els['icon-search'].value.trim().toLowerCase();
    var slugQuery = query.replace(/\s+/g, '_');
    var matches = ICON_CATALOG.filter(function (entry) {
      if (!query) return true;
      return entry.name.toLowerCase().indexOf(query) >= 0 || entry.slug.indexOf(slugQuery) >= 0;
    });
    /* EDICT-0013 D6: the catalog is 1,600+ renders. 150 tiles fill the 280px-tall grid several
       times over and keep typing instant; the hint tells the user a search narrows the rest. */
    var limit = 150;
    var visible = matches.slice(0, limit);
    var tiles = [];
    if (!picking) {
      tiles.push('<button type="button" class="icon-tile" role="option" data-icon-none="1" aria-selected="' +
        (!draftIcon ? 'true' : 'false') + '"><span class="slot" aria-hidden="true"><span class="slot__letter">–</span></span>' +
        '<span class="icon-tile__name">None</span></button>');
    }
    visible.forEach(function (entry) {
      var selected = !picking && draftIcon && draftIcon.kind === 'item' && draftIcon.slug === entry.slug;
      tiles.push('<button type="button" class="icon-tile" role="option" data-icon-slug="' + escapeHtml(entry.slug) +
        '" aria-selected="' + (selected ? 'true' : 'false') + '">' + slotHtml(entry.name, { lazy: true }) +
        '<span class="icon-tile__name">' + escapeHtml(entry.name) + '</span></button>');
    });
    els['icon-grid'].innerHTML = tiles.join('');
    wireIconFallbacks(els['icon-grid']);

    var hint = els['icon-count-hint'];
    if (matches.length > limit) {
      hint.textContent = 'showing ' + visible.length + ' of ' + matches.length + ' — refine your search';
      hint.hidden = false;
    } else {
      hint.textContent = '';
      hint.hidden = true;
    }

    els['icon-preview'].innerHTML = avatarHtml(draftIcon, 48, '?');
    wireIconFallbacks(els['icon-preview']);
  }

  function useIconDraft() {
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
    } else {
      var world = activeWorld();
      var build = selectedBuild();
      if (!world || !build) { els['icon-dialog'].close(); return; }
      /* Contract §5: the detail avatar commits straight through the model, image icons included
         (M.setBuildIcon normalises the data URL), and commit() persists + repaints the avatar. */
      var result = M.setBuildIcon(state, world.id, build.id, draftIcon);
      if (result.error) { toast(result.error, true); return; }
      ui.selectedBuildId = build.id;
      commit(result.state);
    }
    els['icon-dialog'].close();
    toast(draftIcon ? 'Icon updated.' : 'Icon removed.');
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

  function toast(message, isError) {
    if (!els.toast) return;
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.style.background = isError ? '#7a201a' : '';
    els.toast.style.borderColor = isError ? '#ff5555' : '';
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () { els.toast.hidden = true; }, 3200);
  }

  function setStatus(message) {
    if (els.statusLine) els.statusLine.textContent = message;
  }

  /* -------------------------------------------------------------- lifecycle */

  function init() {
    var ids = [
      'tab-builds', 'tab-materials', 'tab-worlds',
      'view-builds', 'view-materials', 'view-worlds',
      'world-select', 'world-meta', 'btn-new-world', 'btn-new-world-2', 'btn-import', 'btn-export',
      'file-import', 'build-list', 'build-empty', 'btn-new-build', 'btn-first-build',
      'world-summary', 'summary-name', 'summary-line', 'summary-bar', 'summary-fill', 'summary-totals',
      'build-detail', 'detail-empty', 'detail-body', 'detail-heading', 'build-delete',
      'build-rename', 'build-name', 'build-name-save', 'build-name-cancel',
      'build-coords', 'copy-coords', 'status-group', 'build-pct', 'build-bar',
      'build-fill', 'build-summary', 'notes-text', 'notes-edit', 'notes-editor',
      'build-notes', 'notes-save', 'notes-cancel',
      'material-body', 'material-empty', 'add-material-form',
      'mat-item', 'mat-needed', 'mat-collected', 'mat-choice', 'mat-choice-slot',
      'mat-choice-name', 'mat-error',
      'materials-lede', 'mat-search', 'mat-filter', 'world-material-body', 'world-material-empty',
      'mat-totals', 'btn-copy-list', 'worlds-lede', 'world-cards', 'world-empty', 'btn-sample',
      'status-line', 'toast',
      'world-dialog', 'world-form', 'world-dialog-title', 'world-name', 'world-edition',
      'world-version', 'world-notes', 'world-error', 'world-save',
      'build-dialog', 'build-form', 'build-dlg-name', 'build-dlg-status', 'build-dlg-coords',
      'build-error', 'confirm-dialog', 'confirm-title', 'confirm-text', 'confirm-ok',
      'world-avatar', 'world-icon', 'world-icon-change', 'world-icon-remove',
      'build-dlg-icon', 'build-dlg-icon-change', 'build-dlg-icon-remove', 'detail-avatar',
      'icon-dialog', 'icon-form', 'icon-dialog-title', 'icon-search', 'icon-grid',
      'icon-count-hint', 'icon-file', 'icon-upload', 'icon-upload-block',
      'icon-preview', 'icon-hint', 'icon-error', 'icon-use', 'icon-cancel'
    ];
    ids.forEach(function (id) { els[id] = $(id); });
    // map dashed ids to camelCase keys for readability below
    els.statusLine = els['status-line'];
    els.toast = els['toast'];
    els.tabs = [els['tab-builds'], els['tab-materials'], els['tab-worlds']];
    els.views = {
      builds: els['view-builds'],
      materials: els['view-materials'],
      worlds: els['view-worlds']
    };

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
    var tabParam = (window.location.search.match(/[?&]tab=([a-z]+)/) || [])[1];
    if (tabParam && els.views[tabParam]) ui.view = tabParam;
    renderAll();
    probeBackdrop();
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

    els['btn-new-build'].addEventListener('click', function () { openBuildDialog(); });
    els['btn-first-build'].addEventListener('click', function () { openBuildDialog(); });

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

    /** The active world plus the selected build, or null — every detail action needs both. */
    function currentBuild() {
      var world = activeWorld();
      var build = selectedBuild();
      return world && build ? { world: world, build: build } : null;
    }

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
      askConfirm('Delete build?', 'Delete "' + build.name + '" and its material list? This cannot be undone.', 'Delete', function () {
        // Clear the selection BEFORE committing: renderAll() runs inside commit() and would
        // otherwise fall back to the next build, hiding the empty state the last delete leaves.
        ui.selectedBuildId = null;
        ui.titleEditing = false;
        ui.notesEditing = false;
        commit(M.deleteBuild(state, world.id, build.id).state);
        toast('Build deleted.');
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
      var step = event.target.closest('.mat-step');
      if (step) { adjustNeeded(step); return; }
      var button = event.target.closest('[data-remove-mat]');
      if (!button) return;
      var context = currentBuild();
      if (!context) return;
      commit(M.deleteMaterial(state, context.world.id, context.build.id, button.dataset.removeMat).state);
    });

    /**
     * EDICT-0013 D5: +/-1, +/-10 and +/-one stack on the Needed amount. The model clamps at 1
     * (M.stepNeeded), so "remove a stack" on a material that needs 1 leaves it at 1, not 0.
     */
    function adjustNeeded(button) {
      var context = currentBuild();
      if (!context) return;
      var matId = button.dataset.mat;
      var material = null;
      context.build.materials.forEach(function (entry) {
        if (entry.id === matId) material = entry;
      });
      if (!material) return;
      var spec = String(button.dataset.step || '');
      var sign = spec.charAt(0) === '-' ? -1 : 1;
      var amount = spec.slice(1);
      var delta = amount === 'stack'
        ? sign * stackSizeFor(material.item)
        : sign * (parseInt(amount, 10) || 0);
      var next = M.stepNeeded(material.needed, delta);
      if (next === material.needed) return;
      commit(M.updateMaterial(state, context.world.id, context.build.id, matId, { needed: next }).state);
      // Rendering replaces the buttons; give focus back to the same control so a keyboard user
      // can press it again without tabbing through the whole row.
      var buttons = document.querySelectorAll('.mat-step');
      for (var i = 0; i < buttons.length; i += 1) {
        if (buttons[i].dataset.mat === matId && buttons[i].dataset.step === spec) {
          buttons[i].focus();
          break;
        }
      }
    }

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
    els['btn-import'].addEventListener('click', function () { els['file-import'].click(); });
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
        els['build-error'].textContent = 'Create a world first.';
        els['build-error'].hidden = false;
        return;
      }
      var result = M.createBuild(state, world.id, {
        name: els['build-dlg-name'].value,
        status: els['build-dlg-status'].value,
        coords: els['build-dlg-coords'].value,
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

    els['icon-search'].addEventListener('input', renderIconPicker);
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
        setMaterialChoice(entry ? entry.name : titleSlug(chosen));
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
        renderIconPicker();
        return;
      }
      event.preventDefault();
      els['icon-dialog'].close();
    });
    els['icon-dialog'].addEventListener('close', function () {
      iconTarget = null;
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

    /**
     * Keyboard support that does not depend on where focus sits. Enter / Ctrl+Enter / Escape are
     * handled on the document too, so a probe (or a user tabbing away) still commits the editor;
     * the per-input handlers run first and clear the flag, so nothing commits twice.
     */
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

  function openBuildDialog() {
    if (!state.worlds.length) {
      toast('Create a world first.', true);
      setView('worlds');
      return;
    }
    els['build-dlg-name'].value = '';
    els['build-dlg-status'].value = 'planned';
    els['build-dlg-coords'].value = '';
    dialogIcon.build = null;
    renderIconPreview('build');
    els['build-error'].hidden = true;
    els['build-dialog'].showModal();
    els['build-dlg-name'].focus();
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
    renderWorldSummary();
    renderDetail();
    renderWorldMaterials();
    renderWorlds();
    renderMaterialChoice();
    setView(ui.view);
  }

  function renderWorldSummary() {
    var world = activeWorld();
    els['world-summary'].hidden = !world;
    if (!world) return;
    var summary = M.worldSummary(world);
    els['summary-name'].textContent = world.name;
    els['summary-line'].textContent =
      (world.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' ' + world.version + ' · ' +
      summary.builds + (summary.builds === 1 ? ' build' : ' builds') + ' · ' +
      summary.materials + ' materials';
    els['summary-fill'].style.width = summary.pct + '%';
    els['summary-bar'].setAttribute('aria-valuenow', String(summary.pct));
    els['summary-totals'].textContent =
      summary.pct + '% gathered · ' + summary.remaining + ' of ' + summary.needed + ' items still to collect';
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
      els['world-meta'].textContent = 'No world selected';
      return;
    }
    var summary = M.worldSummary(world);
    els['world-meta'].textContent =
      (world.edition === 'bedrock' ? 'Bedrock' : 'Java') + ' ' + world.version +
      ' · ' + summary.builds + (summary.builds === 1 ? ' build' : ' builds') +
      ' · ' + summary.pct + '% gathered';
  }

  function renderBuilds() {
    var world = activeWorld();
    var build = selectedBuild();
    if (build) ui.selectedBuildId = build.id;

    var items = [];
    if (world) {
      world.builds.forEach(function (entry) {
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
    els['detail-avatar'].innerHTML = avatarHtml(build.icon, 40, build.name);
    els['detail-avatar'].setAttribute('aria-label', 'Change icon for ' + build.name);
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
    if (!ui.notesEditing) {
      els['notes-text'].textContent = build.notes || 'No notes yet.';
      els['notes-text'].classList.toggle('notes__text--empty', !build.notes);
    }

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
        '<input class="mc-input num" type="number" min="1" step="1" value="' + material.needed + '" ' +
          'data-mat-field="needed" data-mat="' + escapeHtml(material.id) + '" aria-label="Needed ' + escapeHtml(material.item) + '">' +
        '<input class="mc-input num got-col" type="number" min="0" step="1" value="' + material.collected + '" ' +
          'data-mat-field="collected" data-mat="' + escapeHtml(material.id) + '" aria-label="Collected ' + escapeHtml(material.item) + '">' +
        '<span class="num">' + progress.remaining + '</span>' +
        '<button type="button" class="row-delete" data-remove-mat="' + escapeHtml(material.id) + '" ' +
          'aria-label="Remove ' + escapeHtml(material.item) + '">×</button>' +
        materialStepsHtml(material, stackSizeFor(material.item)) +
        '</div>';
    });
    els['material-body'].innerHTML = rows.join('');
    wireIconFallbacks(els['material-body']);
    els['material-empty'].hidden = build.materials.length > 0;
  }

  /**
   * EDICT-0013 D5 / contract §4: exactly six step buttons per material row. data-step keeps the
   * contract's literal "+stack"/"-stack", data-mat-step mirrors the resolved amount and
   * data-stack carries the item's stack size, so the visible label reads "+64" on stone and
   * "+16" on an egg. The cluster sits on the row's second grid line (CSS .mat-steps).
   */
  function materialStepsHtml(material, stack) {
    var specs = [
      { kind: '+', amount: '1' },
      { kind: '+', amount: '10' },
      { kind: '+', amount: 'stack' },
      { kind: '-', amount: '1' },
      { kind: '-', amount: '10' },
      { kind: '-', amount: 'stack' }
    ];
    var id = escapeHtml(material.id);
    var buttons = specs.map(function (spec) {
      /* Contract §4: the frozen visible label is the literal "+stack"/"-stack"; the resolved
         size travels in data-stack / data-mat-step and in the accessible name, so stone reads
         "Add a full stack of 64 to needed" while every row looks identical. */
      var value = spec.amount === 'stack' ? String(stack) : spec.amount;
      var verb = spec.kind === '+' ? 'Add ' : 'Remove ';
      var what = spec.amount === 'stack' ? 'a full stack of ' + stack : value;
      var where = spec.kind === '+' ? ' to needed' : ' from needed';
      return '<button type="button" class="mat-step" ' +
        'data-mat="' + id + '" data-step="' + spec.kind + spec.amount + '" ' +
        'data-mat-step="' + spec.kind + value + '" data-stack="' + stack + '" ' +
        'title="' + verb + what + '" aria-label="' + verb + what + where + '">' +
        spec.kind + spec.amount + '</button>';
    });
    return '<div class="mat-steps" role="group" aria-label="Adjust needed for ' +
      escapeHtml(material.item) + '">' + buttons.join('') + '</div>';
  }

  function renderWorldMaterials() {
    var world = activeWorld();
    var rows = world ? M.aggregateWorld(world) : [];
    els['materials-lede'].textContent = world
      ? 'Every block needed across "' + world.name + '", summed by item.'
      : 'Create a world to start a shopping list.';

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
    els['world-material-empty'].hidden = filtered.length > 0;
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
        askConfirm('Delete world?', 'Delete "' + (world ? world.name : 'this world') + '" with all its builds? This cannot be undone.', 'Delete', function () {
          var deleted = M.deleteWorld(state, deleteId);
          if (deleted.error) { toast(deleted.error, true); return; }
          state = deleted.state;
          ui.selectedBuildId = null;
          selectInitialBuild();
          commit(state);
          toast('World deleted.');
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

