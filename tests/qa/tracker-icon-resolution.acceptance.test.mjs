/**
 * Independent acceptance checks for high-resolution item icons (测试部, EDICT-0011).
 * Authored from the edict requirement, before the implementation was finished, and frozen
 * for QA-B: the 53 inventory icons are 256×256 renders exported from the owner's own
 * Minecraft Java 1.21.4 client with the IconExporter mod, displayed smoothly downscaled while
 * tile textures remain pixelated. Static contract checks only — browser behaviour lives in
 * ui.e2e.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const ICONS = path.join(ROOT, 'src', 'assets', 'icons');
const MANIFEST_PATH = path.join(ICONS, 'manifest.json');
const CSS_PATH = path.join(ROOT, 'src', 'styles.css');
const PROVENANCE_PATH = path.join(ICONS, 'PROVENANCE.md');
const ICONS_JS_PATH = path.join(ICONS, 'icons.js');
const GITIGNORE_PATH = path.join(ROOT, '.gitignore');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const iconsJs = fs.readFileSync(ICONS_JS_PATH, 'utf8');
const provenance = fs.readFileSync(PROVENANCE_PATH, 'utf8');
const css = fs.readFileSync(CSS_PATH, 'utf8');
const gitignore = fs.readFileSync(GITIGNORE_PATH, 'utf8');

const ICON_COUNT = 53;
const PIXELS = 256;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const normalizeSource = (value) => String(value == null ? '' : value).replace(/\\/g, '/');

/* ------------------------------------------------- CSS rule parsing helpers */

/**
 * Strip comments and return every style rule as { selectors, declarations }.
 * Grouped selector lists are split, and rules nested in @media are included, so the
 * checks cannot be fooled by how the declarations are grouped.
 */
function cssRules(source) {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const scan = (start, end) => {
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
        if (selector.startsWith('@')) scan(i + 1, j - 1);
        else rules.push({ selectors: selector.split(',').map((part) => part.trim()), declarations: text.slice(i + 1, j - 1) });
        i = j;
        prelude = '';
        continue;
      }
      if (char === '}') break;
      prelude += char;
      i += 1;
    }
  };
  scan(0, text.length);
  return rules;
}

const RULES = cssRules(css);

function declarationsFor(selector) {
  return RULES.filter((rule) => rule.selectors.includes(selector))
    .map((rule) => rule.declarations)
    .join('\n');
}

/** Every `image-rendering` value declared on rules whose selector list contains `selector`. */
function imageRenderingValues(selector) {
  return [...declarationsFor(selector).matchAll(/image-rendering\s*:\s*([^;}]+)/g)]
    .map((match) => match[1].trim().toLowerCase());
}

/* ---------------------------------------------------------------- manifest */

test('AC-R1 the committed manifest declares the 256px IconExporter pipeline', () => {
  assert.ok(manifest.source && typeof manifest.source === 'object', 'manifest.source is required');
  assert.equal(manifest.source.mode, 'hires-exports', 'source.mode must be the high-resolution exports mode');
  assert.equal(manifest.source.version, '1.21.4', 'the renders come from Minecraft Java Edition 1.21.4');
  assert.equal(manifest.pixels, PIXELS, 'the committed icon set is 256px');
  assert.equal(manifest.count, ICON_COUNT, 'the edict covers exactly the 53 item icons');
  assert.equal(manifest.icons.length, ICON_COUNT, 'manifest.icons must list all 53 icons');
  assert.match(normalizeSource(manifest.source.jar), /\.minecraft/i, 'source.jar must point at the local game install');
  assert.match(normalizeSource(manifest.source.jar), /1\.21\.4/, 'source.jar must be the 1.21.4 client');
  assert.match(normalizeSource(manifest.source.exports), /\.minecraft/i, 'source.exports must point at the local game install');
  assert.match(normalizeSource(manifest.source.exports), /icon-exports-x256/i, 'source.exports must be the IconExporter x256 directory');
  const renderer = [manifest.source.renderer, manifest.source.method]
    .filter((value) => typeof value === 'string')
    .join(' ');
  assert.match(renderer, /iconexporter|icon[ _-]?exports?/i, 'renderer/method must name IconExporter (or the exported icon renders)');
  assert.match(renderer, /inventory render|high[ -]resolution|256/i, 'renderer/method must describe high-resolution inventory renders');
});

test('AC-R2 every manifest icon is a 256×256 render of its own slug', () => {
  const expectedImage = (slug) => `${slug}.png`;
  const expectedSource = (slug) => `icon-exports-x256/minecraft__${slug}.png`;
  const slugs = new Set();
  const images = new Set();
  const sources = new Set();
  for (const icon of manifest.icons) {
    assert.match(icon.slug, /^[a-z0-9_]+$/, `invalid icon slug: ${icon.slug}`);
    assert.ok(!slugs.has(icon.slug), `duplicate icon slug: ${icon.slug}`);
    slugs.add(icon.slug);
    assert.equal(typeof icon.name, 'string', `${icon.slug}: name must be a string`);
    assert.ok(icon.name.trim().length > 0, `${icon.slug}: name must not be empty`);
    assert.equal(typeof icon.kind, 'string', `${icon.slug}: kind must be a string`);
    assert.ok(icon.kind.trim().length > 0, `${icon.slug}: kind must not be empty`);
    assert.equal(icon.image, expectedImage(icon.slug), `${icon.slug}: image must be <slug>.png`);
    assert.equal(icon.pixels, PIXELS, `${icon.slug}: icon.pixels must be 256`);
    assert.equal(normalizeSource(icon.source), expectedSource(icon.slug), `${icon.slug}: source must be the exported 256px render`);
    assert.match(icon.sha256, /^[0-9a-f]{64}$/, `${icon.slug}: sha256 must be a lowercase hex digest`);
    assert.ok(!images.has(icon.image), `duplicate image filename: ${icon.image}`);
    images.add(icon.image);
    assert.ok(!sources.has(icon.source), `duplicate export source: ${icon.source}`);
    sources.add(icon.source);
  }
  assert.equal(slugs.size, ICON_COUNT, 'every icon slug is declared once');
});

/* ----------------------------------------------------------------- icons.js */

test('AC-R3 icons.js lists exactly the manifest slugs with their display names', () => {
  const setMatch = /window\.MC_ICON_SET\s*=\s*(\[[^\]]*\])/.exec(iconsJs);
  assert.ok(setMatch, 'icons.js must declare window.MC_ICON_SET');
  const setSlugs = JSON.parse(setMatch[1]);
  const namesMatch = /window\.MC_ICON_NAMES\s*=\s*(\[[^\]]*\])/.exec(iconsJs);
  assert.ok(namesMatch, 'icons.js must declare window.MC_ICON_NAMES');
  const setNames = JSON.parse(namesMatch[1]);

  assert.equal(setSlugs.length, ICON_COUNT, `MC_ICON_SET must list the ${ICON_COUNT} icons`);
  assert.equal(setNames.length, setSlugs.length, 'one display name per icon');
  assert.deepEqual([...setSlugs].sort(), manifest.icons.map((icon) => icon.slug).sort(), 'icons.js slugs must agree with the manifest');

  const nameBySlug = new Map(manifest.icons.map((icon) => [icon.slug, icon.name]));
  for (const [index, slug] of setSlugs.entries()) {
    assert.equal(setNames[index], nameBySlug.get(slug), `icons.js display name for "${slug}"`);
  }
});

/* -------------------------------------------------------------- PNG pixels */

test('AC-R4 every generated icon is a 256×256 PNG whose sha256 matches the manifest', () => {
  const pngs = fs.readdirSync(ICONS).filter((file) => file.toLowerCase().endsWith('.png')).sort();
  if (!pngs.length) return; // fresh clone: the pixels are never committed, only the manifest is
  assert.deepEqual(pngs, manifest.icons.map((icon) => icon.image).sort(),
    'exactly one generated PNG per manifest icon and no stale files');

  for (const icon of manifest.icons) {
    const buffer = fs.readFileSync(path.join(ICONS, icon.image));
    assert.ok(buffer.length >= 24, `${icon.slug}: truncated PNG`);
    assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), `${icon.slug}: PNG signature`);
    assert.equal(buffer.readUInt32BE(16), PIXELS, `${icon.slug}: width`);
    assert.equal(buffer.readUInt32BE(20), PIXELS, `${icon.slug}: height`);
    const digest = createHash('sha256').update(buffer).digest('hex');
    assert.equal(digest, icon.sha256, `${icon.slug}: sha256 must match the manifest`);
  }
});

/* --------------------------------------------------------------------- CSS */

test('AC-R5 item icons downscale smoothly while tiled textures stay pixelated', () => {
  for (const selector of ['.slot img', '.avatar img']) {
    const values = imageRenderingValues(selector);
    assert.ok(values.length > 0, `${selector} must own its image-rendering rule`);
    assert.ok(values.includes('auto'),
      `${selector} must set image-rendering: auto so the 256px renders downscale smoothly (found ${JSON.stringify(values)})`);
  }
  assert.ok(imageRenderingValues('body').includes('pixelated'),
    'the body keeps the pixel-art contract for tiled world textures');
  assert.ok(imageRenderingValues('img').includes('pixelated'),
    'the global img rule keeps pixel-art textures pixelated');
});

test('AC-R6 provenance and gitignore keep the licensing contract', () => {
  assert.match(provenance, /iconexporter|icon[ _-]?export renders?/i,
    'PROVENANCE.md must name IconExporter (or the icon-export renders)');
  assert.match(provenance, /256\s*[×x]\s*256|\b256\b/i, 'PROVENANCE.md must state the renders are 256px');
  assert.match(provenance, /owner[’']?s own|own (installed )?(game )?(client|copy|installation)|purchased copy/i,
    'PROVENANCE.md must state the renders come from the owner\'s own installation');
  assert.match(provenance, /Mojang/, 'the licensing notice must name the rights holder');
  assert.match(provenance, /not[\s\S]{0,120}redistribut/i, 'the notice must state the pixels are not redistributed');
  assert.match(provenance, /NOT AN OFFICIAL MINECRAFT PRODUCT/, 'the official Minecraft product notice is mandatory');
  assert.match(gitignore, /src\/assets\/icons\/\*\.png/, 'generated vanilla PNGs must stay git-ignored');
  assert.ok(!/^!.*src\/assets\/icons\/.*\.png/m.test(gitignore), 'the ignore rule must not be re-included');
});

test('AC-R7 the old 16×16 app-side icon contract is retired', () => {
  for (const selector of ['.slot img', '.avatar img']) {
    const values = imageRenderingValues(selector);
    assert.ok(!values.includes('pixelated'), `${selector} must not force pixelated upscaling of the 256px renders`);
    assert.ok(!values.includes('crisp-edges'), `${selector} must not force nearest-neighbour scaling`);
  }
  assert.notEqual(manifest.pixels, 16, 'the icon set is no longer the 16px composited set');
  for (const icon of manifest.icons) {
    assert.notEqual(icon.pixels, 16, `${icon.slug} still declares a 16px raster instead of a 256px render`);
  }
});
