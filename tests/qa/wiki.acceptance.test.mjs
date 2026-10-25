/**
 * Independent acceptance tests for the LLM Wiki CLI (测试部).
 * Written against the CLI contract in AGENTS.md §7, driven through run() so the
 * verifier exercises the same entry point an agent uses. Fixtures are synthetic
 * and built per test — no child processes (the sandbox denies piped grandchild stdio).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/wiki/cli.mjs';
import { writeIndex, sealRaw, listPages } from '../../src/wiki/lib.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const invoke = (args, root) => run(args, { root });

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-qa-'));
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/** Minimal valid wiki: 2 pages, 1 sealed source, valid log, current index. */
function fixture() {
  const root = tmp();
  write(root, 'raw/sources/s1.md', 'source text\n');
  write(root, 'wiki/overview.md', '---\ntitle: Home\ntype: overview\nsummary: Root page.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Home\n\nSee [[Alpha]].\n');
  write(root, 'wiki/concepts/alpha.md', '---\ntitle: Alpha\ntype: concept\nsummary: A concept.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Alpha\n\nBack to [[Home]].\n');
  write(root, 'wiki/log.md', '## [2026-10-25] ingest | s1\n\n- created [[Alpha]]\n');
  sealRaw(root);
  writeIndex(root);
  return root;
}

/* ---------------- live repository ---------------- */

test('AC-1: the repository wiki passes its own lint', () => {
  const { code, output } = invoke(['lint'], REPO);
  assert.equal(code, 0, output);
  assert.match(output, /clean/);
});

test('AC-2: the checked-in index is current, not hand-edited', () => {
  const { code, output } = invoke(['index', '--check'], REPO);
  assert.equal(code, 0, output);
});

test('AC-3: index.md lists every wiki page exactly once', () => {
  // Count-agnostic on purpose: a hard-coded page count turns every legitimate ingest
  // into a test failure. (It did, at 15 pages, when EDICT-0006 grew the wiki to 19.)
  const pages = listPages(REPO);
  assert.ok(pages.length > 0, 'the wiki should not be empty');
  const index = fs.readFileSync(path.join(REPO, 'wiki', 'index.md'), 'utf8');
  for (const page of pages) {
    const hits = index.split(`[[${page.title}]]`).length - 1;
    assert.equal(hits, 1, `page "${page.title}" should appear once in index.md, found ${hits}`);
  }
  const rows = [...index.matchAll(/^\| \[\[(.+?)\]\] \|/gm)].map((match) => match[1]);
  assert.equal(rows.length, pages.length, 'exactly one catalogue row per page');
  assert.equal(new Set(rows).size, pages.length, 'no duplicate catalogue rows');
});

test('AC-4: every raw source is sealed and the wiki cites only known sources', () => {
  const { code, output } = invoke(['raw'], REPO);
  assert.equal(code, 0, output);
  assert.match(output, /match the manifest/);
});

test('AC-5: search finds an existing concept and reports no match for nonsense', () => {
  const hit = invoke(['search', 'compiled knowledge'], REPO);
  assert.equal(hit.code, 0);
  assert.match(hit.output, /Compiled knowledge/);
  const miss = invoke(['search', 'zzz-no-such-term-zzz'], REPO);
  assert.equal(miss.code, 0);
  assert.match(miss.output, /no matches/);
});

/* ---------------- contract violations ---------------- */

test('AC-6: a broken wikilink fails lint', () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, 'wiki', 'concepts', 'alpha.md'), '\nSee [[Ghost Page]].\n');
  writeIndex(root);
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /unresolved wikilink \[\[Ghost Page\]\]/);
});

test('AC-7: an orphan page fails lint', () => {
  const root = fixture();
  write(root, 'wiki/synthesis/lonely.md', '---\ntitle: Lonely\ntype: synthesis\nsummary: Unlinked page.\nupdated: 2026-10-25\nsources: []\ntags: []\n---\n\n# Lonely\n\nNo one links here.\n');
  writeIndex(root);
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /orphan/);
  assert.match(output, /lonely\.md/);
});

test('AC-8: missing frontmatter key fails lint', () => {
  const root = fixture();
  write(root, 'wiki/concepts/alpha.md', '---\ntitle: Alpha\ntype: concept\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Alpha\n\nBack to [[Home]].\n');
  writeIndex(root);
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /missing required key "summary"/);
});

test('AC-9: a modified raw source fails verification and sealing refuses without --force', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'raw', 'sources', 's1.md'), 'silently edited\n');
  const verify = invoke(['raw'], root);
  assert.equal(verify.code, 1, verify.output);
  assert.match(verify.output, /immutable/);
  const seal = invoke(['raw', '--seal'], root);
  assert.equal(seal.code, 1, seal.output);
  assert.match(seal.output, /refusing to re-seal/);
});

test('AC-10: a hand-edited index is caught, and --write repairs it', () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, 'wiki', 'index.md'), '\nhand-added line\n');
  const stale = invoke(['index', '--check'], root);
  assert.equal(stale.code, 1, stale.output);
  assert.equal(invoke(['index', '--write'], root).code, 0);
  assert.equal(invoke(['index', '--check'], root).code, 0);
});

test('AC-11: a malformed log entry fails lint', () => {
  const root = fixture();
  fs.appendFileSync(path.join(root, 'wiki', 'log.md'), '\n## 2026-10-25 ingest without prefix\n');
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /malformed entry/);
});

test('AC-12: type/directory mismatch fails lint', () => {
  const root = fixture();
  write(root, 'wiki/entities/alpha.md', '---\ntitle: Alpha2\ntype: concept\nsummary: Wrong bucket.\nupdated: 2026-10-25\nsources: []\ntags: []\n---\n\n# Alpha2\n\nSee [[Home]].\n');
  writeIndex(root);
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /does not match directory/);
});

test('AC-13: usage errors exit 2', () => {
  const root = fixture();
  assert.equal(invoke(['unknown-command'], root).code, 2);
  assert.equal(invoke(['search'], root).code, 2);
});
