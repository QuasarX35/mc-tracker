/**
 * Acceptance checks for entity identity + panorama backdrop (测试部, EDICT-0010).
 * Static contract checks plus a cross-check that every seeded icon slug exists in the
 * locally extracted icon manifest. Browser behaviour lives in ui.e2e.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const HTML = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');
const APP = fs.readFileSync(path.join(SRC, 'app.js'), 'utf8');
const MODEL = fs.readFileSync(path.join(SRC, 'tracker', 'model.js'), 'utf8');
const README = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(MODEL, sandbox, { filename: 'model.js' });
const M = sandbox.TrackerModel;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('AC-I1 the model exposes the identity API and the image caps', () => {
  for (const key of ['ICON_KINDS', 'ICON_DATA_URL_MAX', 'normalizeIcon', 'setWorldIcon', 'setBuildIcon']) {
    assert.ok(key in M, `model must export ${key}`);
  }
  assert.equal(M.ICON_DATA_URL_MAX, 120000);
  assert.deepEqual(plain(M.ICON_KINDS), ['item', 'image']);
  assert.deepEqual(plain(M.normalizeIcon({ kind: 'item', slug: 'stone' })), { icon: { kind: 'item', slug: 'stone' } });
  assert.equal(M.normalizeIcon(null).icon, null);
});

test('AC-I2 every seeded icon slug exists in the local icon manifest', () => {
  const manifestPath = path.join(SRC, 'assets', 'icons', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'icon manifest missing (run scripts/mc-icons.py)');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const slugs = new Set(manifest.icons.map((icon) => icon.slug));
  const state = M.seedState();
  const seeded = [];
  for (const world of state.worlds) {
    if (world.icon && world.icon.kind === 'item') seeded.push(world.icon.slug);
    for (const build of world.builds) {
      if (build.icon && build.icon.kind === 'item') seeded.push(build.icon.slug);
    }
  }
  assert.ok(seeded.length >= 6, `expected sample icons, found ${seeded.length}`);
  for (const slug of seeded) assert.ok(slugs.has(slug), `seed icon "${slug}" is not in the extracted icon set`);
});

test('AC-I3 picker, upload and avatar markup exist in the page', () => {
  for (const id of [
    'world-avatar', 'world-icon', 'world-icon-change', 'world-icon-remove',
    'build-dlg-icon', 'build-dlg-icon-change', 'build-dlg-icon-remove', 'detail-avatar',
    'icon-dialog', 'icon-form', 'icon-dialog-title', 'icon-search', 'icon-grid', 'icon-file',
    'icon-upload', 'icon-count-hint', 'icon-preview', 'icon-error', 'icon-use', 'icon-cancel',
  ]) {
    assert.match(HTML, new RegExp(`id="${id}"`), `missing #${id}`);
  }
  // D7: the Item/Image tab pair is gone; the picker is one dialog with a footer upload action.
  for (const gone of ['icon-tab-item', 'icon-tab-image', 'icon-pane-item', 'icon-pane-image', 'icon-img-choose', 'picker-tabs', 'picker-tab']) {
    assert.ok(!HTML.includes(`id="${gone}"`) && !HTML.includes(`class="${gone}"`) && !new RegExp(`class="[^"]*\\b${gone}\\b`).test(HTML),
      `#${gone} must be removed with the redundant picker tabs`);
  }
  assert.match(HTML, /accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(HTML, /role="listbox"/);
});

test('AC-I4 the app implements avatars, upload processing and the backdrop probe', () => {
  for (const symbol of ['avatarHtml', 'processImageFile', 'renderIconPicker', 'useIconDraft', 'probeBackdrop']) {
    assert.match(APP, new RegExp(`function ${symbol}\\b`), `missing ${symbol}()`);
  }
  assert.ok(!/function setIconMode/.test(APP), 'the retired icon-mode switcher must be deleted (D7)');
  assert.match(APP, /icon-upload/, 'the footer upload action must drive the hidden file input');
  assert.match(APP, /wireIconFallbacks/, 'missing icon fallback wiring');
  assert.match(APP, /querySelectorAll\('\.slot img, \.avatar img'\)/, 'fallback must cover avatars');
  assert.match(APP, /new Image\(\)/, 'backdrop must be feature-probed');
  assert.match(APP, /__backdrop/, 'probe must expose its result for QA');
  assert.match(APP, /128/, 'image downscale size');
});

test('AC-I5 the visual contract covers avatars, the picker and the panorama layer', () => {
  for (const selector of ['.avatar', '.avatar--40', '.icon-grid', '.icon-tile', '.detail__avatar', '.icon-field', '.notes__text', '.mat-steps']) {
    assert.ok(CSS.includes(selector), `missing ${selector}`);
  }
  assert.ok(!CSS.includes('.picker-tab'), 'the retired picker tab styles must be gone (D7)');
  assert.match(CSS, /:root\.has-panorama \.backdrop::before/);
  assert.match(CSS, /@keyframes panorama-drift/);
  assert.match(CSS, /--panorama-image/);
  assert.match(CSS, /--backdrop-scrim-alpha/);
  assert.match(CSS, /prefers-reduced-motion: reduce\)[\s\S]{0,200}animation: none/, 'reduced motion must stop the pan');
  assert.ok(!/border-radius/.test(CSS), 'square GUI contract still holds');
});

test('AC-I6 no game pixels are committed and provenance is shipped', () => {
  const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert.match(gitignore, /src\/assets\/icons\/\*\.png/);
  assert.match(gitignore, /src\/assets\/panorama\/\*\.webp/);
  const panorama = path.join(SRC, 'assets', 'panorama');
  assert.ok(fs.existsSync(path.join(panorama, 'manifest.json')), 'panorama manifest must be committed');
  const provenance = fs.readFileSync(path.join(panorama, 'PROVENANCE.md'), 'utf8');
  assert.match(provenance, /Mojang/);
  assert.match(provenance, /not[\s\S]{0,80}redistribut/i);
  assert.match(provenance, /NOT AN OFFICIAL MINECRAFT PRODUCT/);
  assert.match(provenance, /1x1 placeholders/, 'the decoy-jar discovery must be recorded');
});

test('AC-I7 the extractor refuses placeholder panorama faces and supports screenshots', () => {
  const script = fs.readFileSync(path.join(ROOT, 'scripts', 'mc-backdrop.py'), 'utf8');
  assert.match(script, /MIN_FACE_PX = 512/);
  assert.match(script, /assetIndex/);
  assert.match(script, /assets\/objects/);
  assert.match(script, /screenshots/);
  assert.match(script, /git-ignored/);
});

test('AC-I8 the README documents setup, fallback and licensing', () => {
  assert.match(README, /mc-backdrop\.py/);
  assert.match(README, /panorama/i);
  assert.match(README, /git-ignored|git ignored|not committed/i);
  assert.match(README, /fallback|falls back/i);
});
