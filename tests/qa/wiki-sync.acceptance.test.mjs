/**
 * Independent acceptance tests for the edict↔log sync rule (测试部, EDICT-0008).
 * Driven through the CLI (`run`) against synthetic repositories, so the gate is
 * tested the same way a session experiences it: exit codes and messages.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../../src/wiki/cli.mjs';
import { writeIndex, sealRaw } from '../../src/wiki/lib.mjs';

const REPO = path.resolve(import.meta.dirname, '..', '..');
const invoke = (args, root) => run(args, { root });

const COMPLETION = {
  seq: 50, ts: '2026-10-25T12:00:00+08:00', edict: 'EDICT-0099',
  from: 'S5Q', to: 'S6', office: '测试部', verdict: 'QA_PASS', artifacts: [], note: 'done',
};

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/** A minimal but fully valid wiki, so lint findings are only the ones under test. */
function fixture({ ledger = [], config = { enforced_from_seq: 0 }, log, extraLog = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-sync-qa-'));
  write(root, 'raw/sources/s1.md', 'source\n');
  write(root, 'wiki/overview.md', '---\ntitle: Home\ntype: overview\nsummary: Root page.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Home\n\nSee [[Alpha]].\n');
  write(root, 'wiki/concepts/alpha.md', '---\ntitle: Alpha\ntype: concept\nsummary: A concept.\nupdated: 2026-10-25\nsources: [s1]\ntags: []\n---\n\n# Alpha\n\nBack to [[Home]].\n');
  write(root, 'wiki/log.md', (log ?? '## [2026-10-25] ingest | base fixture\n\n- created [[Alpha]]\n') + extraLog);
  sealRaw(root);
  writeIndex(root);

  fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
  if (ledger !== null) {
    fs.writeFileSync(path.join(root, 'docs', 'governance', 'ledger.jsonl'),
      ledger.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  }
  if (config !== null) {
    fs.writeFileSync(path.join(root, 'docs', 'governance', 'wiki-sync.json'), JSON.stringify(config), 'utf8');
  }
  return root;
}

test('AC-S1 a completed edict without a wiki log entry fails lint', () => {
  const root = fixture({ ledger: [COMPLETION] });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /edict-sync/);
  assert.match(output, /EDICT-0099 reached S6 at ledger seq 50 but no wiki log entry/);
});

test('AC-S2 citing the edict in an ingest entry dated on completion passes', () => {
  const root = fixture({
    ledger: [COMPLETION],
    extraLog: '\n## [2026-10-25] ingest | shipped EDICT-0099\n\n- pages updated\n',
  });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 0, output);
});

test('AC-S3 a citation that predates the completion does not satisfy the rule', () => {
  const root = fixture({
    ledger: [COMPLETION],
    extraLog: '\n## [2026-10-20] ingest | old EDICT-0099 entry\n',
  });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 1, output);
  assert.match(output, /EDICT-0099/);
});

test('AC-S4 a query or lint entry cannot substitute for an ingest', () => {
  const root = fixture({
    ledger: [COMPLETION],
    extraLog: '\n## [2026-10-25] query | EDICT-0099\n\n## [2026-10-25] lint | EDICT-0099\n',
  });
  assert.equal(invoke(['lint'], root).code, 1, 'only ingest/edit entries count');
});

test('AC-S5 the baseline grandfathers earlier edicts', () => {
  const old = { ...COMPLETION, seq: 10 };
  const root = fixture({ ledger: [old], config: { enforced_from_seq: 10 } });
  const { code, output } = invoke(['lint'], root);
  assert.equal(code, 0, output);
});

test('AC-S6 a repository without a governance ledger still lints cleanly', () => {
  const root = fixture({ ledger: null });
  const lintResult = invoke(['lint'], root);
  assert.equal(lintResult.code, 0, lintResult.output);
  const sync = invoke(['sync'], root);
  assert.equal(sync.code, 0, sync.output);
  assert.match(sync.output, /skipped — no governance ledger/);
});

test('AC-S7 the sync command explains each completion and exits 1 when one is missing', () => {
  const missing = fixture({ ledger: [COMPLETION] });
  const fail = invoke(['sync'], missing);
  assert.equal(fail.code, 1, fail.output);
  assert.match(fail.output, /MISS\s+EDICT-0099\s+seq 50/);
  assert.match(fail.output, /0\/1 completed edicts ingested/);

  const ok = fixture({ ledger: [COMPLETION], extraLog: '\n## [2026-10-25] edit | EDICT-0099 ingested\n' });
  const pass = invoke(['sync'], ok);
  assert.equal(pass.code, 0, pass.output);
  assert.match(pass.output, /OK\s+EDICT-0099\s+seq 50/);
  assert.match(pass.output, /1\/1 completed edicts ingested/);
});

test('AC-S8 the live repository satisfies its own rule', () => {
  const { code, output } = invoke(['sync'], REPO);
  assert.equal(code, 0, output);
  assert.doesNotMatch(output, /MISS/);
});
