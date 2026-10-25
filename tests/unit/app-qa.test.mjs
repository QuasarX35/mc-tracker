/**
 * Unit tests for the app QA stamp (兵部, EDICT-0009).
 * Covers hashing, stamp comparison and every refusal path.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  APP_SOURCE_FILES,
  appHash,
  checkAppQaStamp,
  stampPath,
} from '../../src/wiki/lib.mjs';

function fixture({ contents = {}, stamp = undefined } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-qa-'));
  for (const relative of APP_SOURCE_FILES) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents[relative] ?? `// ${relative}\n`, 'utf8');
  }
  if (stamp !== undefined) {
    fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
    fs.writeFileSync(stampPath(root), typeof stamp === 'string' ? stamp : JSON.stringify(stamp), 'utf8');
  }
  return root;
}

function stampFor(root) {
  const current = appHash(root);
  return { verified_at: '2026-10-25T12:00:00+08:00', artifact_hash: current.hash, files: current.files, cases: 27 };
}

test('appHash is stable and covers every declared app source', () => {
  const root = fixture();
  const first = appHash(root);
  const second = appHash(root);
  assert.equal(first.missing, null);
  assert.deepEqual(Object.keys(first.files).sort(), [...APP_SOURCE_FILES].sort());
  assert.equal(first.hash, second.hash, 'hash must be deterministic');
});

test('appHash changes when a single source file changes', () => {
  const root = fixture();
  const before = appHash(root).hash;
  fs.writeFileSync(path.join(root, 'src/app.js'), '// changed\n', 'utf8');
  const after = appHash(root);
  assert.notEqual(after.hash, before);
  assert.equal(after.files['src/index.html'], appHash(root).files['src/index.html'], 'unrelated files keep their hash');
});

test('appHash reports a missing source instead of hashing a partial set', () => {
  const root = fixture();
  fs.rmSync(path.join(root, 'src/styles.css'));
  const result = appHash(root);
  assert.equal(result.missing, 'src/styles.css');
  assert.equal(result.hash, null);
});

test('checkAppQaStamp skips repositories that have no app sources', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-qa-empty-'));
  const result = checkAppQaStamp(root);
  assert.equal(result.skipped, true);
  assert.equal(result.ok, true);
});

test('checkAppQaStamp fails when app sources exist without a stamp', () => {
  const root = fixture();
  const result = checkAppQaStamp(root);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no UI QA stamp/);
  assert.deepEqual(result.changed.sort(), [...APP_SOURCE_FILES].sort());
});

test('checkAppQaStamp passes for a matching stamp', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
  fs.writeFileSync(stampPath(root), JSON.stringify(stampFor(root)), 'utf8');
  const result = checkAppQaStamp(root);
  assert.equal(result.ok, true, result.reason);
  assert.deepEqual(result.changed, []);
});

test('checkAppQaStamp names only the files that drifted', () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
  fs.writeFileSync(stampPath(root), JSON.stringify(stampFor(root)), 'utf8');
  fs.writeFileSync(path.join(root, 'src/tracker/model.js'), '// new behaviour\n', 'utf8');
  const result = checkAppQaStamp(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.changed, ['src/tracker/model.js']);
  assert.match(result.reason, /changed since the last verified UI test run/);
});

test('checkAppQaStamp refuses a corrupt stamp file', () => {
  const root = fixture({ stamp: '{ not json' });
  const result = checkAppQaStamp(root);
  assert.equal(result.ok, false);
  assert.match(result.reason, /not valid JSON/);
});

test('a stamp without per-file hashes cannot verify anything', () => {
  const root = fixture({ stamp: { verified_at: '2026-10-25T12:00:00+08:00' } });
  const result = checkAppQaStamp(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.changed.sort(), [...APP_SOURCE_FILES].sort());
});
