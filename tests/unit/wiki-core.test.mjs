/**
 * Unit tests for the wiki core library (兵部).
 * Covered: frontmatter parsing, link extraction, index determinism/staleness,
 * raw sealing semantics, search ranking, log parsing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseFrontmatter,
  extractWikilinks,
  extractMdLinks,
  stripCode,
  buildIndex,
  checkIndex,
  writeIndex,
  sealRaw,
  verifyRaw,
  readManifest,
  search,
  logEntries,
  listPages,
} from '../../src/wiki/lib.mjs';

const PAGE = `---
title: Alpha
type: concept
summary: A test page.
updated: 2026-10-25
sources: [s1]
tags: [x, y]
---

# Alpha

Links to [[Home]].
`;

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-unit-'));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function baseWiki() {
  const root = tmp();
  write(path.join(root, 'raw', 'sources', 's1.md'), 'immutable source\n');
  write(path.join(root, 'wiki', 'overview.md'), `---
title: Home
type: overview
summary: The root page.
updated: 2026-10-25
sources: [s1]
tags: []
---

# Home

See [[Alpha]].
`);
  write(path.join(root, 'wiki', 'concepts', 'alpha.md'), PAGE);
  write(path.join(root, 'wiki', 'log.md'), '## [2026-10-25] ingest | s1\n\n- created [[Alpha]]\n');
  sealRaw(root);
  writeIndex(root);
  return root;
}

test('parseFrontmatter: scalar, inline arrays and body', () => {
  const { data, body, error } = parseFrontmatter(PAGE);
  assert.equal(error, null);
  assert.equal(data.title, 'Alpha');
  assert.equal(data.type, 'concept');
  assert.deepEqual(data.sources, ['s1']);
  assert.deepEqual(data.tags, ['x', 'y']);
  assert.match(body, /^# Alpha/);
});

test('parseFrontmatter: block list and missing block', () => {
  const { data } = parseFrontmatter('---\ntitle: T\nsources:\n  - a\n  - b\n---\nbody\n');
  assert.deepEqual(data.sources, ['a', 'b']);
  assert.equal(parseFrontmatter('# no frontmatter').error, 'no frontmatter block');
  assert.equal(parseFrontmatter('---\ntitle: x\n').error, 'unterminated frontmatter');
});

test('stripCode removes fenced and inline code so literals do not become links', () => {
  const text = 'Inline `[[Not A Link]]` and\n```\n[[Also Not]]\n```\nReal [[Alpha]]';
  assert.deepEqual(extractWikilinks(text), ['Alpha']);
});

test('extractWikilinks handles aliases and anchors; markdown links skip externals', () => {
  assert.deepEqual(extractWikilinks('[[Alpha|the first]] and [[Alpha#Key claims]]'), ['Alpha', 'Alpha']);
  const md = extractMdLinks('[a](https://x.test) [b](#anchor) [c](../raw/sources/s1.md)');
  assert.deepEqual(md, ['../raw/sources/s1.md']);
});

test('buildIndex is deterministic and lists every page', () => {
  const root = baseWiki();
  const pages = listPages(root);
  assert.equal(pages.length, 2);
  const a = buildIndex(pages, { date: '2026-10-25' });
  const b = buildIndex(pages, { date: '2026-10-25' });
  assert.equal(a, b);
  assert.match(a, /GENERATED/);
  assert.match(a, /\[\[Home\]\]/);
  assert.match(a, /\[\[Alpha\]\]/);
});

test('checkIndex detects edits to a page (independent staleness check)', () => {
  const root = baseWiki();
  assert.equal(checkIndex(root).ok, true);
  // The index is generated from frontmatter (title/summary/updated), so a body-only
  // edit is correctly not a staleness event. Mutate a field that the index renders.
  // (Test v1 asserted a body edit would make the index stale; that assumption was wrong.)
  const pageFile = path.join(root, 'wiki', 'concepts', 'alpha.md');
  fs.writeFileSync(
    pageFile,
    fs.readFileSync(pageFile, 'utf8').replace('summary: A test page.', 'summary: A revised summary.'),
  );
  const stale = checkIndex(root);
  assert.equal(stale.ok, false);
  assert.match(stale.reason, /stale/);
  writeIndex(root);
  assert.equal(checkIndex(root).ok, true);
});

test('sealRaw records hashes and refuses to re-seal a modified source', () => {
  const root = baseWiki();
  const manifest = readManifest(root);
  assert.ok(manifest.files['sources/s1.md']);
  assert.equal(verifyRaw(root).ok, true);

  fs.writeFileSync(path.join(root, 'raw', 'sources', 's1.md'), 'tampered\n');
  const refused = sealRaw(root);
  assert.deepEqual(refused.changed, ['sources/s1.md']);
  assert.equal(verifyRaw(root).ok, false, 'modified source must fail verification');

  const forced = sealRaw(root, { force: true });
  assert.equal(forced.forced, true);
  assert.equal(verifyRaw(root).ok, true);
});

test('sealRaw refuses to resurrect a deleted sealed source silently', () => {
  const root = baseWiki();
  fs.unlinkSync(path.join(root, 'raw', 'sources', 's1.md'));
  const result = sealRaw(root);
  assert.deepEqual(result.removed, ['sources/s1.md']);
});

test('search ranks a title hit above a body-only hit', () => {
  const root = baseWiki();
  const results = search(listPages(root), 'alpha');
  assert.equal(results[0].page.title, 'Alpha');
  assert.ok(results[0].score > 0);
  assert.equal(search(listPages(root), 'nonexistent-term-xyz').length, 0);
});

test('logEntries parses the prefix format and flags malformed entries', () => {
  const entries = logEntries('## [2026-10-25] ingest | A thing\n### not an entry\n## [bad] ingest | x\n');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].ok, true);
  assert.equal(entries[1].ok, false);
});
