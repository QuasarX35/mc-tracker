/**
 * Independent acceptance checks for the EDICT-0013 asset-level contracts (测试部).
 *
 * Covers what only the shipped artefacts can prove, without a browser:
 *   * the committed font is the byte-for-byte file the sealed DaFont intake evidence names,
 *     and the app's token puts it first with the Pixelify fallback retained (AC1, R9);
 *   * the regenerated panorama declares a real blur reduction and the committed WebP is the
 *     file its manifest hashes (AC10, F7);
 *   * the full catalog reconciles its own accounting, carries the frozen per-icon fields and
 *     the frozen stack samples (AC6, F3);
 *   * every rendered asset predates the app-qa stamp it is claimed to be verified by (AC11, F8).
 *
 * Frozen at S2 against `.tmp/plan/contract.md`; browser behaviour lives in ui.e2e.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'src');
const ICONS = path.join(SRC, 'assets', 'icons');
const PANORAMA = path.join(SRC, 'assets', 'panorama');
const FONTS = path.join(SRC, 'assets', 'fonts');
const CSS_PATH = path.join(SRC, 'styles.css');
const RAW_MANIFEST_PATH = path.join(ROOT, 'raw', 'manifest.json');
const FONT_EVIDENCE = path.join(ROOT, 'raw', 'sources', '2026-10-25-minecraft-font-licence.md');
const STAMP_PATH = path.join(ROOT, 'docs', 'governance', 'app-qa.json');

const FLOOR = 1363; // F3: addressable icons on the owner's install
const STACK_SAMPLES = { stone: 64, egg: 16, bucket: 16, water_bucket: 1, diamond_sword: 1, potion: 1, slime_ball: 64 };
const LIGHTING = new Set(['block', 'flat', '3d-other']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const normalize = (value) => String(value == null ? '' : value).replace(/\\/g, '/');
const read = (file) => fs.readFileSync(file, 'utf8');

/* ------------------------------------------------------------------ css helpers */

/** Strip comments and return every style rule as { selectors, declarations, media }. */
function cssRules(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const scan = (start, end, media) => {
    let prelude = '';
    let i = start;
    while (i < end) {
      const char = text[i];
      if (char === '{') {
        const selector = prelude.trim();
        let depth = 1;
        let j = i + 1;
        while (j < end && depth > 0) {
          if (text[j] === '{') depth += 1;
          else if (text[j] === '}') depth -= 1;
          j += 1;
        }
        if (selector.startsWith('@')) scan(i + 1, j - 1, media ? `${media} ${selector}` : selector);
        else rules.push({ selectors: selector.split(',').map((part) => part.trim()), declarations: text.slice(i + 1, j - 1), media });
        i = j;
        prelude = '';
        continue;
      }
      if (char === '}') break;
      prelude += char;
      i += 1;
    }
  };
  scan(0, text.length, '');
  return rules;
}

/** Every declaration block whose selector list contains `selector`, filtered by media. */
function blocks(selector, { mobile = null } = {}) {
  return cssRules(css()).filter((rule) => {
    if (!rule.selectors.includes(selector)) return false;
    if (mobile === true) return /max-width:\s*640px/.test(rule.media);
    if (mobile === false) return !/max-width:\s*640px/.test(rule.media);
    return true;
  });
}

let cssCache = null;
function css() {
  if (cssCache == null) cssCache = read(CSS_PATH);
  return cssCache;
}

function blurPx(declarations) {
  const match = /filter\s*:([^;}]+)/.exec(declarations);
  if (!match) return null;
  const blur = /blur\(\s*([\d.]+)px\s*\)/.exec(match[1]);
  return blur ? Number(blur[1]) : null;
}

/* --------------------------------------------------------------- webp parsing */

/** Width/height of a WebP file from its RIFF headers (VP8X, VP8 lossy or VP8L lossless). */
function webpSize(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF', 'WEBP must start with RIFF');
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP', 'RIFF container must be WEBP');
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    const width = 1 + buffer.readUIntLE(24, 3);
    const height = 1 + buffer.readUIntLE(27, 3);
    return { width, height, chunk };
  }
  if (chunk === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff, chunk };
  }
  if (chunk === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), chunk };
  }
  throw new Error(`unknown WEBP chunk ${chunk}`);
}

/* --------------------------------------------------------------------- font */

test('AC-A1 the committed font is the byte-for-byte file the sealed DaFont evidence names', () => {
  const fontPath = path.join(FONTS, 'Minecraft.ttf');
  assert.ok(fs.existsSync(fontPath), 'src/assets/fonts/Minecraft.ttf must be committed');
  const buffer = fs.readFileSync(fontPath);
  assert.equal(buffer.length, 14488, 'the committed font is the 14,488-byte DaFont file');
  assert.equal(buffer.toString('ascii', 0, 4), '\u0000\u0001\u0000\u0000', 'Minecraft.ttf must be a TrueType/OpenType sfnt');

  const evidence = read(FONT_EVIDENCE);
  const digest = sha256(buffer);
  assert.ok(evidence.includes(digest), `the intake snapshot must pin sha256 ${digest}`);
  assert.match(evidence, /https:\/\/www\.dafont\.com\/minecraft\.font/, 'the snapshot must name the DaFont listing');
  assert.match(evidence, /Craftron Gaming/, 'the snapshot must name the author');
  assert.match(evidence, /100% Free/, 'the snapshot must quote the licence badge');
  assert.match(evidence, /fsType/, 'the snapshot must record the embedding bits');
  assert.match(evidence, /glyph/i, 'the snapshot must record the glyph coverage (110 in maxp, 107 mapped)');

  // The seal: raw/manifest.json hashes the snapshot, and the hash still matches.
  const sealed = JSON.parse(read(RAW_MANIFEST_PATH)).files;
  assert.equal(sealed['sources/2026-10-25-minecraft-font-licence.md'], sha256(Buffer.from(evidence)),
    'raw/manifest.json must seal the intake snapshot');

  const licence = path.join(FONTS, 'Minecraft-LICENCE.md');
  assert.ok(fs.existsSync(licence), 'the font licence must ship beside the binary (F6)');
  const licenceText = read(licence);
  assert.ok(licenceText.includes(digest), 'the shipped licence note must pin the same sha256');
  assert.match(licenceText, /dafont\.com\/minecraft\.font/, 'the shipped licence note must link the listing');
  assert.match(licenceText, /Craftron Gaming/);
  assert.match(licenceText, /100% Free/);
});

test('AC-A2 the app font token puts Minecraft first and keeps the Pixelify fallback', () => {
  const source = css();
  const faces = [...source.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((match) => match[1]);
  const minecraftFace = faces.find((face) => /font-family\s*:\s*['"]?Minecraft['"]?/.test(face));
  assert.ok(minecraftFace, "styles.css must declare @font-face 'Minecraft'");
  assert.match(minecraftFace, /url\('assets\/fonts\/Minecraft\.ttf'\)/, 'the face must load the committed TTF');
  assert.ok(
    faces.some((face) => /font-family\s*:\s*['"]?Pixelify(?:\s*Sans)?['"]?/.test(face)
      && /PixelifySans-Medium\.ttf/.test(face)),
    'the Pixelify fallback face must remain for the 107-glyph coverage gap'
  );
  assert.match(source, /--font-pixel\s*:\s*'Minecraft'\s*,\s*'Pixelify'\s*,/,
    "--font-pixel must start with 'Minecraft' and keep 'Pixelify' next");
  const body = cssRules(source).find((rule) => rule.selectors.includes('body'));
  assert.ok(body, 'body rule');
  assert.match(body.declarations, /font-family\s*:\s*var\(--font-pixel\)/,
    'body copy must use the pixel font stack');
});

/* ----------------------------------------------------------------- panorama */

test('AC-A3 the panorama manifest declares the frozen 2.5px backdrop blur', () => {
  const manifest = JSON.parse(read(path.join(PANORAMA, 'manifest.json')));
  const compose = manifest.compose;
  assert.ok(compose, 'manifest.compose is required');
  assert.equal(compose.faces, 4, 'four faces');
  assert.equal(compose.width, 2560, 'the committed strip width');
  assert.equal(compose.height, 640, 'the committed strip height');
  assert.equal(compose.brightness, 0.95, 'baked brightness stays');
  assert.equal(compose.saturation, 0.92, 'baked saturation stays');
  // D10 / Lead correction: the generator blur drops from 8 to 3 or less (工部 shipped 2.5).
  assert.equal(compose.blur_radius, 2.5, `blur radius ${compose.blur_radius}px must be the frozen 2.5px (was 8)`);
  assert.ok(compose.blur_radius < 8, 'the pre-edict radius of 8 must not survive');
  assert.equal(manifest.output.file, 'backdrop.webp');
  assert.deepEqual(manifest.output.size, [2560, 640], 'output size matches the compose size');
  assert.match(normalize(manifest.install), /\.minecraft/, 'provenance points at the local install');
});

test('AC-A4 the committed backdrop is the WebP its manifest hashes', () => {
  const manifest = JSON.parse(read(path.join(PANORAMA, 'manifest.json')));
  const file = path.join(PANORAMA, 'backdrop.webp');
  assert.ok(fs.existsSync(file), 'generate the backdrop: python scripts/mc-backdrop.py');
  const buffer = fs.readFileSync(file);
  assert.equal(sha256(buffer), manifest.output.sha256, 'sha256 must match the regenerated manifest');
  assert.equal(buffer.length, manifest.output.bytes, 'byte size must match the manifest');
  const size = webpSize(buffer);
  assert.deepEqual(size, { width: 2560, height: 640, chunk: size.chunk }, 'the WebP itself is the 4:1 strip');
  assert.equal(size.width, manifest.output.size[0]);
  assert.equal(size.height, manifest.output.size[1]);
  const provenance = read(path.join(PANORAMA, 'PROVENANCE.md'));
  assert.match(provenance, /blur radius\s*[\d.]+/i, 'PROVENANCE.md must state the blur radius the strip was made with');
  assert.match(provenance, /Mojang/, 'the panorama provenance names the rights holder');
  assert.match(provenance, /NOT AN OFFICIAL MINECRAFT PRODUCT/, 'the official-product notice stays');
});

test('AC-A5 the panorama layer blurs at most 1px on desktop and 1.5px on mobile', () => {
  const desktop = blocks(':root.has-panorama .backdrop::before', { mobile: false })
    .map((rule) => blurPx(rule.declarations))
    .filter((value) => value != null);
  assert.ok(desktop.length > 0, 'the panorama layer must declare a blur filter');
  assert.ok(desktop.every((value) => value <= 1), `desktop blur must be <= 1px, found ${JSON.stringify(desktop)}`);

  const mobile = blocks(':root.has-panorama .backdrop::before', { mobile: true })
    .map((rule) => blurPx(rule.declarations))
    .filter((value) => value != null);
  if (mobile.length) assert.ok(mobile.every((value) => value <= 1.5), `mobile blur <= 1.5px, found ${JSON.stringify(mobile)}`);

  const scrim = /--backdrop-scrim-alpha\s*:\s*([\d.]+)/.exec(css());
  assert.ok(scrim, 'the scrim token must survive');
  assert.ok(Number(scrim[1]) >= 0.12, 'the scrim may only get stronger, never weaker');
  assert.match(css(), /prefers-reduced-motion: reduce\)[\s\S]{0,240}animation:\s*none/,
    'reduced motion still stops the pan');
});

/* ------------------------------------------------------------------ catalog */

const manifest = JSON.parse(read(path.join(ICONS, 'manifest.json')));
const iconsJs = read(path.join(ICONS, 'icons.js'));

/** Parse a `window.MC_ICON_* = ...` assignment; allows arrays (existing) and objects (contract §8). */
function iconGlobal(name) {
  const match = new RegExp(`window\\.${name}\\s*=\\s*([\\[{][\\s\\S]*?[\\]}]);`).exec(iconsJs);
  if (!match) throw new Error(`icons.js must declare window.${name}`);
  const literal = match[1];
  try {
    return JSON.parse(literal);
  } catch {
    // JSON-incompatible literals are not acceptable in a generated file.
    throw new Error(`window.${name} must be a JSON literal`);
  }
}

/** App-side name -> slug convention (`slugifyItem` in app.js): lowercase, non-alnum to underscore. */
const slugify = (name) => String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

test('AC-A6 the catalog reconciles its accounting and meets the 1,363 floor', () => {
  assert.equal(typeof manifest.count, 'number');
  assert.ok(manifest.count >= FLOOR, `catalog floor: ${manifest.count} >= ${FLOOR}`);
  assert.equal(manifest.icons.length, manifest.count, 'icons[] must list every declared icon');
  assert.ok(manifest.renders >= manifest.count, 'renders cannot be fewer than the addressable icons');
  assert.equal(manifest.renders - manifest.count, manifest.collapsed_variants,
    'the manifest must reconcile renders = count + collapsed_variants');
  assert.equal(manifest.curated, 53, 'the curated 53 stay declared');
  assert.equal(manifest.stack_default, 64, 'default stack size');

  const setSlugs = iconGlobal('MC_ICON_SET');
  assert.ok(Array.isArray(setSlugs), 'MC_ICON_SET stays a slug array');
  assert.equal(setSlugs.length, manifest.count, 'count === MC_ICON_SET.length');
  assert.deepEqual([...setSlugs].sort(), manifest.icons.map((icon) => icon.slug).sort(),
    'the emitted set and the manifest list the same slugs');

  const groups = Object.values(manifest.stack_groups ?? {});
  assert.equal(groups.reduce((sum, value) => sum + value, 0), manifest.count, 'stack groups partition the catalog');

  const slugSeen = new Set();
  for (const icon of manifest.icons) {
    assert.match(icon.slug, /^[a-z0-9_]+$/, `invalid slug: ${icon.slug}`);
    assert.ok(!slugSeen.has(icon.slug), `duplicate slug: ${icon.slug}`);
    slugSeen.add(icon.slug);
    assert.equal(typeof icon.name, 'string');
    assert.ok(icon.name.trim().length > 0, `${icon.slug}: empty display name`);
    assert.equal(slugify(icon.name), icon.slug, `${icon.slug}: display name must slugify back to the slug`);
    assert.equal(icon.image, `${icon.slug}.png`, `${icon.slug}: image must be <slug>.png`);
    assert.equal(icon.pixels, 256, `${icon.slug}: 256px renders`);
    assert.match(normalize(icon.source), /^icon-exports-x256\/minecraft__[^/]+\.png$/,
      `${icon.slug}: source must be an IconExporter render`);
    assert.match(icon.sha256, /^[0-9a-f]{64}$/, `${icon.slug}: sha256 digest`);
    assert.ok(Number.isInteger(icon.bytes) && icon.bytes > 0, `${icon.slug}: byte size`);
    assert.ok([1, 16, 64].includes(icon.stack), `${icon.slug}: stack ${icon.stack} must be 1, 16 or 64`);
    assert.ok(LIGHTING.has(icon.lighting), `${icon.slug}: lighting '${icon.lighting}' must be block, flat or 3d-other`);
  }
});

test('AC-A7 the catalog carries the frozen stack table and the curated 53 first', () => {
  const bySlug = new Map(manifest.icons.map((icon) => [icon.slug, icon]));
  for (const [slug, stack] of Object.entries(STACK_SAMPLES)) {
    assert.ok(bySlug.has(slug), `catalog must contain ${slug}`);
    assert.equal(bySlug.get(slug).stack, stack, `${slug} stacks to ${stack}`);
  }

  const stacks = iconGlobal('MC_ICON_STACKS');
  assert.equal(typeof stacks, 'object');
  assert.equal(Object.keys(stacks).length, manifest.count, 'MC_ICON_STACKS must cover every icon');
  for (const icon of manifest.icons) {
    assert.equal(stacks[icon.slug], icon.stack, `${icon.slug}: icons.js stack must match the manifest`);
  }

  const curatedSlugs = new Set(manifest.icons.slice(0, 53).map((icon) => icon.slug));
  assert.equal(curatedSlugs.size, 53, 'the first 53 entries are distinct');
  for (const slug of ['stone', 'oak_log', 'glass', 'iron_ingot', 'diamond', 'water_bucket', 'torch']) {
    assert.ok(curatedSlugs.has(slug), `curated icon ${slug} must stay in the first 53`);
  }
  const nonCurated = manifest.icons[60];
  assert.ok(nonCurated, 'catalog is longer than the curated block');
  assert.equal(curatedSlugs.has(nonCurated.slug), false, 'the curated block ends before position 60');
});

test('AC-A8 every icon has a lighting class and the 3D/flat split is disclosed', () => {
  const summary = manifest.lighting;
  assert.equal(typeof summary, 'object');
  const keys = Object.keys(summary);
  assert.ok(keys.every((key) => LIGHTING.has(key)), `lighting summary keys must be the contract enum: ${keys.join(',')}`);
  assert.equal(Object.values(summary).reduce((sum, value) => sum + value, 0), manifest.count,
    'the lighting summary covers every icon');
  assert.ok((summary.block ?? 0) > 0, '3D block icons must exist');
  assert.ok((summary.flat ?? 0) > 0, 'flat sprites must exist');

  const bySlug = new Map(manifest.icons.map((icon) => [icon.slug, icon]));
  for (const slug of ['stone', 'cobblestone', 'oak_log']) {
    assert.equal(bySlug.get(slug).lighting, 'block', `${slug}: a full cube must take the 3D gain`);
  }
  for (const slug of ['diamond', 'iron_ingot', 'apple']) {
    assert.ok(bySlug.has(slug), `${slug} in catalog`);
    assert.equal(bySlug.get(slug).lighting, 'flat', `${slug}: a flat sprite must not be gain-corrected`);
  }
  for (const slug of ['anvil', 'chest']) {
    assert.ok(bySlug.has(slug), `${slug} in catalog`);
    assert.equal(bySlug.get(slug).lighting, '3d-other', `${slug}: a 3D prop takes the 3d-other class`);
  }
  // Lead correction 1: 工部 verified the 1.21.4 jar — models/item/hopper.json is item/generated,
  // so the hopper render IS a flat sprite in this version and is classified (and disclosed) as flat.
  assert.equal(bySlug.get('hopper').lighting, 'flat', "hopper: item/generated is a flat sprite in 1.21.4 (disclosed)");
  assert.ok((summary['3d-other'] ?? 0) > 0, 'non-block 3D props are disclosed in the manifest');
});

test('AC-A9 MC_ICON_NAMES is complete and agrees with the manifest after the expansion', () => {
  const names = iconGlobal('MC_ICON_NAMES');
  const setSlugs = iconGlobal('MC_ICON_SET');
  const bySlug = new Map(manifest.icons.map((icon) => [icon.slug, icon.name]));
  if (Array.isArray(names)) {
    assert.equal(names.length, manifest.count, 'one display name per icon');
    for (const [index, slug] of setSlugs.entries()) {
      assert.equal(names[index], bySlug.get(slug), `name for ${slug} must match the manifest`);
    }
  } else {
    assert.equal(typeof names, 'object', 'MC_ICON_NAMES must be an array or a slug->name map');
    assert.equal(Object.keys(names).length, manifest.count, 'complete name map');
    for (const icon of manifest.icons) assert.equal(names[icon.slug], icon.name, `name for ${icon.slug}`);
  }
});

/* ---------------------------------------------------------------- freshness */

test('AC-A10 the app-qa stamp is newer than every rendered asset it speaks for', () => {
  assert.ok(fs.existsSync(STAMP_PATH), 'docs/governance/app-qa.json must exist');
  const stamp = JSON.parse(read(STAMP_PATH));
  assert.ok(Number.isFinite(Date.parse(stamp.verified_at)), 'stamp.verified_at must be a parseable timestamp');
  assert.ok(typeof stamp.cases === 'number' && stamp.cases >= 40, `stamp records ${stamp.cases} browser cases`);

  const verified = Date.parse(stamp.verified_at);
  const rendered = [
    path.join(SRC, 'index.html'),
    path.join(SRC, 'styles.css'),
    path.join(SRC, 'app.js'),
    path.join(SRC, 'tracker', 'model.js'),
    path.join(ICONS, 'icons.js'),
    path.join(ICONS, 'manifest.json'),
    path.join(FONTS, 'Minecraft.ttf'),
    path.join(PANORAMA, 'backdrop.webp'),
    path.join(PANORAMA, 'manifest.json'),
  ];
  for (const file of rendered) {
    assert.ok(fs.existsSync(file), `rendered asset missing: ${path.relative(ROOT, file)}`);
    const mtime = fs.statSync(file).mtimeMs;
    assert.ok(mtime < verified, `${path.relative(ROOT, file)} was modified after the stamp (${new Date(mtime).toISOString()} >= ${stamp.verified_at}); re-run app-qa`);
  }
});

test('AC-A11 the before/after backdrop evidence is in the repo', () => {
  const before = path.join(ROOT, 'reports', 'qa', 'evidence', 'edict-0012', '01-builds-view-corrected.png');
  assert.ok(fs.existsSync(before), 'the pre-change backdrop screenshot (F7) must stay in the repo');
  const buffer = fs.readFileSync(before);
  assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), 'the before screenshot is a PNG');
});
