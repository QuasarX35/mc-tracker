/**
 * Minecraft Build Tracker — UI layer (EDICT-0005).
 * Classic script: the app must run from file:// (no bundler, no modules).
 * All state transitions go through TrackerModel; this file only renders and binds.
 */
(function () {
  'use strict';

  var M = window.TrackerModel;

  /**
   * Icons are the real Minecraft textures, generated from the owner's own Java Edition
   * client by scripts/mc-icons.py. `assets/icons/icons.js` lists the available slugs; items
   * without one fall back to a lettered slot instead of a misleading picture.
   */
  var ICON_SET = window.MC_ICON_SET || [];
  var FALLBACK_ITEMS = ['Stone', 'Cobblestone', 'Stone Bricks', 'Dirt', 'Sand', 'Oak Planks',
    'Oak Log', 'Glass', 'Torch', 'Chest', 'Iron Ingot', 'Coal'];
  var COMMON_ITEMS = (window.MC_ICON_NAMES && window.MC_ICON_NAMES.length)
    ? window.MC_ICON_NAMES.slice()
    : FALLBACK_ITEMS.slice();

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

  var STATUS_LABEL = { planned: 'Planned', building: 'Building', done: 'Done' };

  var els = {};
  var state = null;
  var ui = { view: 'builds', selectedBuildId: null, filter: 'remaining', query: '' };
  var editingWorldId = null;
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

  function slotHtml(item) {
    var icon = iconFor(item);
    var letter = String(item).trim().charAt(0).toUpperCase() || '?';
    var inner = icon
      ? '<img src="assets/icons/' + icon + '.png" alt="" width="22" height="22" data-letter="' + escapeHtml(letter) + '">'
      : '<span class="slot__letter">' + escapeHtml(letter) + '</span>';
    return '<span class="slot" data-tip="' + escapeHtml(item) + '" aria-hidden="true">' + inner + '</span>';
  }

  /**
   * Vanilla icon PNGs are generated locally and git-ignored, so a fresh clone has none.
   * When an icon is missing, fall back to the lettered slot instead of a broken image.
   */
  function wireIconFallbacks(scope) {
    var root = scope || document;
    Array.prototype.forEach.call(root.querySelectorAll('.slot img'), function (img) {
      if (img.dataset.wired === '1') return;
      img.dataset.wired = '1';
      img.addEventListener('error', function () {
        var span = document.createElement('span');
        span.className = 'slot__letter';
        span.textContent = img.getAttribute('data-letter') || '?';
        img.replaceWith(span);
      });
    });
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
      'build-name', 'build-coords', 'build-notes', 'status-group', 'build-pct', 'build-bar',
      'build-fill', 'build-summary', 'material-body', 'material-empty', 'add-material-form',
      'mat-item', 'mat-needed', 'mat-collected', 'item-options',
      'materials-lede', 'mat-search', 'mat-filter', 'world-material-body', 'world-material-empty',
      'mat-totals', 'btn-copy-list', 'worlds-lede', 'world-cards', 'world-empty', 'btn-sample',
      'status-line', 'toast',
      'world-dialog', 'world-form', 'world-dialog-title', 'world-name', 'world-edition',
      'world-version', 'world-notes', 'world-error', 'world-save',
      'build-dialog', 'build-form', 'build-dlg-name', 'build-dlg-status', 'build-dlg-coords',
      'build-error', 'confirm-dialog', 'confirm-title', 'confirm-text', 'confirm-ok'
    ];
    ids.forEach(function (id) { els[id] = $(id); });
    // map dashed ids to camelCase keys for readability below
    els.tabs = [els['tab-builds'], els['tab-materials'], els['tab-worlds']];
    els.views = {
      builds: els['view-builds'],
      materials: els['view-materials'],
      worlds: els['view-worlds']
    };

    var loaded = M.load(window.localStorage);
    state = loaded.state || M.emptyState();
    if (!loaded.state && /[?&]demo\b/.test(window.location.search)) {
      state = M.seedState();
      M.save(window.localStorage, state);
    }
    if (loaded.error) toast(loaded.error, true);

    bind();
    var tabParam = (window.location.search.match(/[?&]tab=([a-z]+)/) || [])[1];
    if (tabParam && els.views[tabParam]) ui.view = tabParam;
    renderAll();
    setStatus(state.worlds.length ? 'Loaded from this browser.' : 'Start by creating a world.');
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

  function selectedBuild() {
    var world = activeWorld();
    if (!world) return null;
    return M.findBuild(world, ui.selectedBuildId) || world.builds[0] || null;
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
      ui.selectedBuildId = null;
      commit(result.state);
    });

    els['btn-new-world'].addEventListener('click', function () { openWorldDialog(null); });
    els['btn-new-world-2'].addEventListener('click', function () { openWorldDialog(null); });
    els['btn-sample'].addEventListener('click', function () {
      state = M.seedState();
      M.save(window.localStorage, state);
      ui.selectedBuildId = null;
      renderAll();
      toast('Sample worlds loaded.');
    });

    els['btn-new-build'].addEventListener('click', function () { openBuildDialog(); });
    els['btn-first-build'].addEventListener('click', function () { openBuildDialog(); });

    els['build-list'].addEventListener('click', function (event) {
      var button = event.target.closest('.build-entry');
      if (!button) return;
      ui.selectedBuildId = button.dataset.build;
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

    function renameBuild() {
      var world = activeWorld();
      var build = selectedBuild();
      if (!world || !build) return;
      var result = M.updateBuild(state, world.id, build.id, { name: els['build-name'].value });
      if (result.error) { toast(result.error, true); renderAll(); return; }
      commit(result.state);
    }
    els['build-name'].addEventListener('change', renameBuild);
    els['build-coords'].addEventListener('change', function () {
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      commit(M.updateBuild(state, world.id, build.id, { coords: els['build-coords'].value }).state);
    });
    els['build-notes'].addEventListener('change', function () {
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      commit(M.updateBuild(state, world.id, build.id, { notes: els['build-notes'].value }).state);
    });

    els['build-delete'].addEventListener('click', function () {
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      askConfirm('Delete build?', 'Delete "' + build.name + '" and its material list? This cannot be undone.', 'Delete', function () {
        commit(M.deleteBuild(state, world.id, build.id).state);
        ui.selectedBuildId = null;
        toast('Build deleted.');
      });
    });

    els['material-body'].addEventListener('change', function (event) {
      var input = event.target.closest('[data-mat-field]');
      if (!input) return;
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      var patch = {};
      patch[input.dataset.matField] = input.value;
      commit(M.updateMaterial(state, world.id, build.id, input.dataset.mat, patch).state);
    });

    els['material-body'].addEventListener('click', function (event) {
      var button = event.target.closest('[data-remove-mat]');
      if (!button) return;
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      commit(M.deleteMaterial(state, world.id, build.id, button.dataset.removeMat).state);
    });

    els['add-material-form'].addEventListener('submit', function (event) {
      event.preventDefault();
      var world = activeWorld(); var build = selectedBuild();
      if (!world || !build) return;
      var result = M.addMaterial(state, world.id, build.id, {
        item: els['mat-item'].value,
        needed: els['mat-needed'].value,
        collected: els['mat-collected'].value
      });
      if (result.error) { toast(result.error, true); return; }
      commit(result.state);
      els['mat-item'].value = '';
      els['mat-needed'].value = '1';
      els['mat-collected'].value = '0';
      els['mat-item'].focus();
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
        notes: els['world-notes'].value
      };
      var result = editingWorldId
        ? M.updateWorld(state, editingWorldId, input)
        : M.createWorld(state, input);
      if (result.error) {
        els['world-error'].textContent = result.error;
        els['world-error'].hidden = false;
        return;
      }
      if (!editingWorldId) state = M.setActiveWorld(result.state, result.world.id).state || result.state;
      else state = result.state;
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
        coords: els['build-dlg-coords'].value
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

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') return;
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
    renderItemOptions();
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
            '<span class="build-entry__name">' + escapeHtml(entry.name) + '</span>' +
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

  function renderDetail() {
    var world = activeWorld();
    var build = selectedBuild();
    var hasBuild = !!(world && build);
    els['detail-empty'].hidden = hasBuild;
    els['detail-body'].hidden = !hasBuild;
    if (!hasBuild) return;

    els['detail-heading'].textContent = build.name;
    els['build-name'].value = build.name;
    els['build-coords'].value = build.coords;
    els['build-notes'].value = build.notes;
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
    var pct = totals.needed ? Math.round((totals.collected / totals.needed) * 100) : 0;
    els['build-pct'].textContent = pct + '%';
    els['build-fill'].style.width = pct + '%';
    els['build-bar'].setAttribute('aria-valuenow', String(pct));
    els['build-summary'].textContent = build.materials.length
      ? totals.collected + ' of ' + totals.needed + ' items gathered · ' + (totals.needed - totals.collected) + ' to go'
      : 'No materials listed yet. Add the blocks this build needs.';

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
        '</div>';
    });
    els['material-body'].innerHTML = rows.join('');
    wireIconFallbacks(els['material-body']);
    els['material-empty'].hidden = build.materials.length > 0;
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
        '<h3 class="world-card__name">' + escapeHtml(world.name) + (active ? ' <span class="chip chip--done">Active</span>' : '') + '</h3>' +
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
        commit(M.setActiveWorld(state, selectId).state);
        ui.selectedBuildId = null;
        setView('builds');
        toast('World selected.');
      } else if (editId) {
        openWorldDialog(editId);
      } else if (deleteId) {
        var world = M.findWorld(state, deleteId);
        askConfirm('Delete world?', 'Delete "' + (world ? world.name : 'this world') + '" with all its builds? This cannot be undone.', 'Delete', function () {
          commit(M.deleteWorld(state, deleteId).state);
          ui.selectedBuildId = null;
          toast('World deleted.');
        });
      }
    };
  }

  function renderItemOptions() {
    var items = COMMON_ITEMS.slice();
    state.worlds.forEach(function (world) {
      world.builds.forEach(function (build) {
        build.materials.forEach(function (material) {
          if (items.indexOf(material.item) < 0) items.push(material.item);
        });
      });
    });
    els['item-options'].innerHTML = items.map(function (item) {
      return '<option value="' + escapeHtml(item) + '"></option>';
    }).join('');
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
    function done() { toast('Shopping list copied.'); }
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

