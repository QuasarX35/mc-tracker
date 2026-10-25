#!/usr/bin/env node
/**
 * App QA gate (EDICT-0009): run the comprehensive UI suite and stamp the app's source
 * hashes, or check whether the current app has been tested.
 *
 *   node scripts/app-qa.mjs run       # run the UI suite; stamp only on success
 *   node scripts/app-qa.mjs status    # compare the stamp with the current sources
 *   node scripts/app-qa.mjs where     # print Chrome and stamp paths
 *
 * The stamp (`docs/governance/app-qa.json`) is what `lint`'s `app-qa-stamp` rule trusts:
 * any change to the app sources invalidates it, so the UI suite must be re-run and pass
 * before the next S5Q can claim a clean lint.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appHash, checkAppQaStamp, stampPath } from '../src/wiki/lib.mjs';
import { chromePath } from '../tests/qa/ui/harness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = path.join(ROOT, 'tests', 'qa', 'ui.e2e.test.mjs');

function runSuite() {
  return new Promise((resolve) => {
    // stdio inherit: the sandbox denies piped child stdio, and this output is for humans
    const child = spawn(process.execPath, [SUITE], { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });
}

export function writeStamp({ cases }) {
  const current = appHash(ROOT);
  if (current.missing) throw new Error(`missing app source: ${current.missing}`);
  const stamp = {
    verified_at: new Date().toISOString(),
    artifact_hash: current.hash,
    files: current.files,
    suite: 'tests/qa/ui.e2e.test.mjs',
    cases,
    note: 'Written only by `node scripts/app-qa.mjs run` after the UI suite exits 0. Do not hand-edit: a stamp that does not match the sources fails lint (rule app-qa-stamp).',
  };
  fs.mkdirSync(path.dirname(stampPath(ROOT)), { recursive: true });
  fs.writeFileSync(stampPath(ROOT), `${JSON.stringify(stamp, null, 2)}\n`, 'utf8');
  return stamp;
}

export function status(root = ROOT) {
  return checkAppQaStamp(root);
}

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'status';

  if (command === 'where') {
    console.log(`app sources: ${Object.keys(appHash(ROOT).files).join(', ')}`);
    console.log(`stamp:       ${stampPath(ROOT)}`);
    console.log(`suite:       ${SUITE}`);
    try {
      console.log(`chrome:      ${chromePath()}`);
      return 0;
    } catch (error) {
      console.log(`chrome:      NOT FOUND (${error.message})`);
      return 1;
    }
  }

  if (command === 'status') {
    const result = status();
    if (result.skipped) {
      console.log(`app-qa: skipped — ${result.reason}`);
      return 0;
    }
    if (result.ok) {
      console.log(`app-qa: verified — ${result.stamp.verified_at} (${result.stamp.cases} UI cases)`);
      return 0;
    }
    console.log(`app-qa: STALE — ${result.reason}`);
    for (const file of result.changed) console.log(`  changed: ${file}`);
    console.log('  run: node scripts/app-qa.mjs run');
    return 1;
  }

  if (command === 'run') {
    try {
      chromePath();
    } catch (error) {
      console.error(`app-qa: cannot run the UI suite — ${error.message}`);
      return 2;
    }
    console.log('app-qa: running the comprehensive UI suite (tests/qa/ui.e2e.test.mjs)');
    const code = await runSuite();
    if (code !== 0) {
      console.error(`app-qa: UI suite failed (exit ${code}) — stamp NOT written`);
      return code;
    }
    const cases = countCases();
    const stamp = writeStamp({ cases });
    console.log(`app-qa: PASS — stamped ${cases} UI cases at ${stamp.verified_at}`);
    console.log(`app-qa: artifact hash ${stamp.artifact_hash.slice(0, 16)}…`);
    return 0;
  }

  console.error('usage: node scripts/app-qa.mjs [run|status|where]');
  return 2;
}

function countCases() {
  const source = fs.readFileSync(SUITE, 'utf8');
  return (source.match(/^test\('/gm) || []).length;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  process.exitCode = await main();
}
