#!/usr/bin/env node
/**
 * CLI for the LLM Wiki instance (EDICT-0003).
 * Usage: node src/wiki/cli.mjs <index|lint|search|raw|stats> [args]
 * Exported `run()` lets tests drive the CLI in-process (no child processes).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as lib from './lib.mjs';

const USAGE = `llm-wiki CLI

  node src/wiki/cli.mjs index --write     regenerate wiki/index.md
  node src/wiki/cli.mjs index --check     fail if the index is stale
  node src/wiki/cli.mjs lint              structural checks; exit 1 on any error
  node src/wiki/cli.mjs search "<query>"  ranked search over wiki pages
  node src/wiki/cli.mjs raw --seal        seal raw sources into raw/manifest.json
  node src/wiki/cli.mjs raw               verify raw sources against the manifest
  node src/wiki/cli.mjs stats             page/link/source counts

Exit codes: 0 clean · 1 findings · 2 usage error`;

export function run(argv, { root = process.cwd(), log = () => {} } = {}) {
  const out = [];
  const say = (line = '') => {
    out.push(line);
    log(line);
  };
  const [command, ...args] = argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    say(USAGE);
    return { code: 0, output: out.join('\n') };
  }

  if (command === 'index') {
    if (args.includes('--write')) {
      const pages = lib.listPages(root);
      lib.writeIndex(root);
      say(`index: regenerated wiki/index.md from ${pages.length} pages`);
      return { code: 0, output: out.join('\n') };
    }
    const check = lib.checkIndex(root);
    if (check.ok) {
      say('index: up to date');
      return { code: 0, output: out.join('\n') };
    }
    say(`index: ${check.reason}`);
    return { code: 1, output: out.join('\n') };
  }

  if (command === 'lint') {
    const { findings, errors, warnings, pages } = lib.lint(root);
    if (!findings.length) {
      say(`lint: clean — ${pages.length} pages, 0 errors, 0 warnings`);
      return { code: 0, output: out.join('\n') };
    }
    for (const f of findings) {
      say(`${f.severity === 'error' ? 'ERROR' : 'WARN '} [${f.rule}] ${f.file}: ${f.message}`);
    }
    say('');
    say(`lint: ${errors} error(s), ${warnings} warning(s) across ${pages.length} pages`);
    return { code: errors > 0 ? 1 : 0, output: out.join('\n') };
  }

  if (command === 'search') {
    const query = args.join(' ').trim();
    if (!query) {
      say('usage: node src/wiki/cli.mjs search "<query>"');
      return { code: 2, output: out.join('\n') };
    }
    const results = lib.search(lib.listPages(root), query);
    if (!results.length) {
      say(`search: no matches for "${query}"`);
      return { code: 0, output: out.join('\n') };
    }
    say(`search: ${results.length} result(s) for "${query}"`);
    for (const { page, score, snippet } of results) {
      say(`  ${String(score).padStart(4)}  ${page.rel}  — ${page.title}`);
      say(`        ${snippet}`);
    }
    return { code: 0, output: out.join('\n') };
  }

  if (command === 'raw') {
    if (args.includes('--seal')) {
      const force = args.includes('--force');
      const result = lib.sealRaw(root, { force });
      if (result.changed.length && !force) {
        say('raw: refusing to re-seal modified sources — raw sources are immutable');
        for (const rel of result.changed) say(`  ERROR raw/${rel} changed since it was sealed`);
        say('  pass --force only with the Emperor\'s approval, and record why in wiki/log.md');
        return { code: 1, output: out.join('\n') };
      }
      say(`raw: sealed ${Object.keys(result.manifest.files).length} source(s); added ${result.added.length}, forced ${result.forced ? result.changed.length : 0}`);
      for (const rel of result.added) say(`  + raw/${rel}`);
      return { code: 0, output: out.join('\n') };
    }
    const { ok, findings } = lib.verifyRaw(root);
    if (ok) {
      say(`raw: ${lib.rawFiles(root).length} source(s) match the manifest`);
      return { code: 0, output: out.join('\n') };
    }
    for (const f of findings) say(`ERROR [${f.rule}] ${f.file}: ${f.message}`);
    return { code: 1, output: out.join('\n') };
  }

  if (command === 'stats') {
    const s = lib.stats(root);
    say(`pages: ${s.pages}`);
    for (const [type, count] of Object.entries(s.byType).sort()) say(`  ${type}: ${count}`);
    say(`wikilinks: ${s.wikilinks}`);
    say(`orphans: ${s.orphans.length}${s.orphans.length ? ` (${s.orphans.join(', ')})` : ''}`);
    say(`raw sources: ${s.rawSources}`);
    say(`log entries: ${s.logEntries}`);
    return { code: 0, output: out.join('\n') };
  }

  say(`unknown command "${command}"\n\n${USAGE}`);
  return { code: 2, output: out.join('\n') };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { code } = run(process.argv.slice(2), { log: (line) => console.log(line) });
  process.exitCode = code;
}
