/**
 * Unit tests for the edict↔log sync check (兵部, EDICT-0008).
 * Pure functions over fixture files: ledger parsing, completion extraction,
 * log block parsing, and the check itself (baseline, date, verb, citation).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readLedger,
  edictCompletions,
  logBlocks,
  blockText,
  checkEdictSync,
} from '../../src/wiki/lib.mjs';

function repo({ ledger = [], config = { enforced_from_seq: 0 }, log = '' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-sync-'));
  fs.mkdirSync(path.join(root, 'docs', 'governance'), { recursive: true });
  fs.mkdirSync(path.join(root, 'wiki'), { recursive: true });
  if (ledger !== null) {
    fs.writeFileSync(path.join(root, 'docs', 'governance', 'ledger.jsonl'),
      ledger.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf8');
  }
  if (config !== null) {
    fs.writeFileSync(path.join(root, 'docs', 'governance', 'wiki-sync.json'),
      JSON.stringify(config), 'utf8');
  }
  fs.writeFileSync(path.join(root, 'wiki', 'log.md'), log, 'utf8');
  return root;
}

const COMPLETION = {
  seq: 10, ts: '2026-10-25T12:00:00+08:00', edict: 'EDICT-0099',
  from: 'S5Q', to: 'S6', office: '测试部', verdict: 'QA_PASS', artifacts: [], note: 'done',
};

test('readLedger parses JSONL, tolerates blank lines, reports malformed lines', () => {
  const root = repo({ ledger: [COMPLETION, COMPLETION] });
  const ok = readLedger(root);
  assert.equal(ok.error, null);
  assert.equal(ok.records.length, 2);

  fs.appendFileSync(path.join(root, 'docs', 'governance', 'ledger.jsonl'), '{not json}\n');
  const bad = readLedger(root);
  assert.ok(bad.error);
  assert.match(bad.error, /malformed ledger line/);
});

test('readLedger reports a missing ledger rather than throwing', () => {
  const root = repo({ ledger: null });
  const result = readLedger(root);
  assert.equal(result.missing, true);
  assert.deepEqual(result.records, []);
});

test('edictCompletions keeps the latest S6 completion per edict only', () => {
  const records = [
    { seq: 1, edict: 'A', from: 'S5', to: 'S6', verdict: 'DONE', ts: '2026-01-01T00:00:00Z' },
    { seq: 2, edict: 'A', from: 'S6', to: 'S6', verdict: 'DONE', ts: '2026-01-02T00:00:00Z' },
    { seq: 3, edict: 'B', from: 'S5Q', to: 'S5', verdict: 'QA_FAIL', ts: '2026-01-03T00:00:00Z' },
    { seq: 4, edict: 'C', from: 'S5', to: 'S6', verdict: 'FAILED', ts: '2026-01-04T00:00:00Z' },
    { seq: 5, edict: 'D', from: 'S5Q', to: 'S6', verdict: 'QA_PASS', ts: '2026-01-05T00:00:00Z' },
  ];
  const completions = edictCompletions(records);
  assert.deepEqual(completions.map((c) => c.edict), ['A', 'D']);
  assert.equal(completions[0].seq, 2, 'latest completion wins');
});

test('logBlocks splits entries and preserves body text', () => {
  const blocks = logBlocks('## [2026-10-25] ingest | Thing\n\n- body mentions EDICT-0099\n## [2026-10-26] lint | pass\n');
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].verb, 'ingest');
  assert.match(blockText(blocks[0]), /EDICT-0099/);
  assert.equal(blocks[1].date, '2026-10-26');
});

test('checkEdictSync fails a completed edict with no log entry', () => {
  const root = repo({ ledger: [COMPLETION] });
  const result = checkEdictSync(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.pending.map((p) => p.edict), ['EDICT-0099']);
});

test('checkEdictSync passes when an ingest entry cites the edict on/after completion', () => {
  const root = repo({
    ledger: [COMPLETION],
    log: '## [2026-10-25] ingest | shipped EDICT-0099\n\n- pages updated\n',
  });
  const result = checkEdictSync(root);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.checked.map((c) => c.edict), ['EDICT-0099']);
});

test('checkEdictSync rejects a citation dated before the completion', () => {
  const root = repo({
    ledger: [COMPLETION],
    log: '## [2026-10-20] ingest | shipped EDICT-0099\n',
  });
  assert.equal(checkEdictSync(root).ok, false, 'an earlier mention cannot satisfy the rule');
});

test('checkEdictSync requires ingest or edit, not query or lint', () => {
  const root = repo({
    ledger: [COMPLETION],
    log: '## [2026-10-25] query | EDICT-0099 question\n\n## [2026-10-25] lint | EDICT-0099 sweep\n',
  });
  assert.equal(checkEdictSync(root).ok, false, 'only ingest/edit count as an ingest');
});

test('checkEdictSync honours the baseline and grandfathers older edicts', () => {
  const old = { ...COMPLETION, seq: 5 };
  const fresh = { ...COMPLETION, seq: 20, edict: 'EDICT-0100' };
  const root = repo({ ledger: [old, fresh], config: { enforced_from_seq: 10 } });
  const result = checkEdictSync(root);
  assert.deepEqual(result.checked.map((c) => c.edict), ['EDICT-0100'], 'EDICT-0099 (seq 10) sits at the baseline');
  assert.equal(result.ok, false);
});

test('checkEdictSync is skipped when the repository has no governance ledger', () => {
  const root = repo({ ledger: null });
  const result = checkEdictSync(root);
  assert.equal(result.skipped, true);
  assert.equal(result.ok, true);
});
