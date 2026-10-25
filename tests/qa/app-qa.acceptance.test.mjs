/**
 * Independent acceptance tests for the app-qa gate (测试部, EDICT-0009).
 * Proves that `lint` refuses an untested or changed app, through the same CLI the
 * pipeline uses, and that the live repository currently passes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/wiki/cli.mjs';
import { writeIndex, sealRaw, APP_SOURCE_FILES, appHash, stampPath } from '../../src/wiki/lib.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const invoke = (args, root) => run(args, { root });

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/** A valid wiki plus app sources, optionally stamped. */
function fixture({ stamp = 'auto', appFiles = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-qa-qa-'));
  write(root, 'raw/sources/s1.md', 'source\n');
  write(root, 'wiki/overview.md', '---\ntitle: Home\ntype: overview\nsummary: Root page.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Home\n\nSee [[Alpha]].\n');
  write(root, 'wiki/concepts/alpha.md', '---\ntitle: Alpha\ntype: concept\nsummary: A concept.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Alpha\n\nBack to [[Home]].\n');
  write(root, 'wiki/log.md', '## [2026-10-25] ingest | base fixture\n\n- created [[Alpha]]\n');
  sealRaw(root);
  writeIndex(root);

  if (appFiles) {
    for (const relative of APP_SOURCE_FILES) write(root, relative, `// ${relative}\n`);
  }
  if (stamp === 'auto' && appFiles) {
    const current = appHash(root);
    fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
    fs.writeFileSync(stampPath(root), JSON.stringify({
      verified_at: '2026-10-25T12:00:00+08:00',
      artifact_hash: current.hash,
      files: current.files,
      suite: 'tests/qa/ui.e2e.test.mjs',
      cases: 27,
    }), 'utf8');
  } else if (typeof stamp === 'string') {
    fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
    fs.writeFileSync(stampPath(root), stamp, 'utf8');
  } else if (stamp === null) {
    fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
  }
  return root;
}

test('AC-Q1 a stamped app lints cleanly', () => {
  const root = fixture();
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 0, output);
});

test('AC-Q2 an app change invalidates the stamp and fails lint with instructions', () => {
  const root = fixture();
  write(root, 'src/tracker/model.js', '// behaviour changed after the last UI run\n');
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /app-qa-stamp/);
  assert.match(output, /src\/tracker\/model\.js/);
  assert.match(output, /node scripts\/app-qa\.mjs run/);
});

test('AC-Q3 a missing stamp fails lint', () => {
  const root = fixture({ stamp: null });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /no UI QA stamp/);
});

test('AC-Q4 a corrupt stamp fails lint rather than being ignored', () => {
  const root = fixture({ stamp: '{ nope' });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /not valid JSON/);
});

test('AC-Q5 a wiki-only repository is skipped (the gate is opt-in by presence of app sources)', () => {
  const root = fixture({ appFiles: false });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 0, output);
  const appQa = invoke(['app-qa'], root);
  assert.equal(appQa.code, 0, appQa.output);
  assert.match(appQa.output, /skipped/);
});

test('AC-Q6 the app-qa command reports verification and drift separately', () => {
  const ok = fixture();
  const verified = invoke(['app-qa'], ok);
  assert.equal(verified.code, 0, verified.output);
  assert.match(verified.output, /verified — 2026-10-25T12:00:00\+08:00 \(27 UI cases\)/);

  const stale = fixture();
  write(stale, 'src/styles.css', '/* restyled */\n');
  const drifted = invoke(['app-qa'], stale);
  assert.equal(drifted.code, 1, drifted.output);
  assert.match(drifted.output, /STALE/);
  assert.match(drifted.output, /changed: src\/styles\.css/);
});

test('AC-Q7 the live repository passes the app-qa gate', () => {
  const { code, output } = invoke(['app-qa'], REPO);
  assert.equal(code, 0, output);
  assert.match(output, /verified/);
});
