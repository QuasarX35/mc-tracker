/**
 * Core library for the LLM Wiki instance (EDICT-0003).
 * Zero dependencies. Pure functions over the filesystem so tests can run in-process.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TYPE_DIRS = {
  concepts: 'concept',
  entities: 'entity',
  sources: 'source',
  synthesis: 'synthesis',
};
export const PAGE_TYPES = ['overview', 'concept', 'entity', 'source', 'synthesis'];
export const REQUIRED_KEYS = ['title', 'type', 'summary', 'updated', 'sources', 'tags'];
export const LOG_VERBS = ['ingest', 'query', 'lint', 'edit'];
const SPECIAL = new Set(['index.md', 'log.md']);
const SUMMARY_MAX = 160;

/* ------------------------------------------------------------------ */
/* filesystem helpers                                                   */
/* ------------------------------------------------------------------ */

export function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

export function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/* ------------------------------------------------------------------ */
/* frontmatter                                                          */
/* ------------------------------------------------------------------ */

function stripQuotes(value) {
  const v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseScalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v
      .slice(1, -1)
      .split(',')
      .map((s) => stripQuotes(s))
      .filter((s) => s !== '');
  }
  return stripQuotes(v);
}

/** Parse the simple YAML subset used by wiki pages. Returns {data, body, error}. */
export function parseFrontmatter(text) {
  const normalized = String(text).replace(/^\uFEFF/, '');
  if (!/^---\r?\n/.test(normalized)) {
    return { data: null, body: normalized, error: 'no frontmatter block' };
  }
  const lines = normalized.split(/\r?\n/);
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (/^---\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  if (end < 0) return { data: null, body: normalized, error: 'unterminated frontmatter' };

  const data = {};
  let i = 1;
  while (i < end) {
    const line = lines[i];
    if (/^\s*$/.test(line) || /^\s*#/.test(line)) {
      i += 1;
      // eslint-disable-next-line no-continue
      continue;
    }
    const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      return {
        data,
        body: lines.slice(end + 1).join('\n'),
        error: `bad frontmatter line: ${line.trim()}`,
      };
    }
    const [, key, rest] = m;
    if (rest.trim() !== '') {
      data[key] = parseScalar(rest);
      i += 1;
    } else {
      const list = [];
      let j = i + 1;
      while (j < end && /^\s*-\s+/.test(lines[j])) {
        list.push(stripQuotes(lines[j].replace(/^\s*-\s+/, '')));
        j += 1;
      }
      data[key] = list.length ? list : '';
      i = j;
    }
  }
  return {
    data,
    body: lines
      .slice(end + 1)
      .join('\n')
      .replace(/^\n+/, ''),
    error: null,
  };
}

/* ------------------------------------------------------------------ */
/* pages                                                                */
/* ------------------------------------------------------------------ */

/** Load every wiki page (excluding index.md / log.md). */
export function listPages(root = '.') {
  const wikiDir = path.join(root, 'wiki');
  return walk(wikiDir)
    .filter((abs) => abs.endsWith('.md'))
    .map((abs) => {
      const rel = path.relative(wikiDir, abs).split(path.sep).join('/');
      if (SPECIAL.has(rel)) return null;
      const text = fs.readFileSync(abs, 'utf8');
      const { data, body, error } = parseFrontmatter(text);
      const dir = path.posix.dirname(rel);
      return {
        abs,
        rel,
        dir: dir === '.' ? '' : dir,
        slug: path.posix.basename(rel, '.md'),
        text,
        body,
        data: data || {},
        error,
        title: (data && data.title) || path.posix.basename(rel, '.md'),
        type: (data && data.type) || null,
      };
    })
    .filter(Boolean);
}

/** Remove fenced blocks and inline code before link extraction. */
export function stripCode(text) {
  return String(text)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
}

export function extractWikilinks(text) {
  const out = [];
  for (const m of stripCode(text).matchAll(/\[\[([^\]|#\n]+?)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g)) {
    out.push(m[1].trim());
  }
  return out;
}

export function extractMdLinks(text) {
  const out = [];
  for (const m of stripCode(text).matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    out.push(href);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* index generation                                                     */
/* ------------------------------------------------------------------ */

const SECTION_ORDER = [
  ['overview', 'Overview'],
  ['concept', 'Concepts'],
  ['entity', 'Entities'],
  ['source', 'Sources'],
  ['synthesis', 'Synthesis'],
];

const byTitle = (a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);

export function buildIndex(pages, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const lines = [
    '<!-- GENERATED by `node src/wiki/cli.mjs index --write`. Do not edit by hand. -->',
    '',
    '# Index',
    '',
    `Catalogue of ${pages.length} pages, regenerated ${date}. Read this first when answering a`,
    'query; it is the map, the pages are the territory.',
    '',
  ];
  for (const [type, heading] of SECTION_ORDER) {
    const group = pages.filter((p) => p.type === type).sort(byTitle);
    if (!group.length) continue;
    lines.push(`## ${heading} (${group.length})`, '', '| Page | Summary | Updated |', '|------|---------|---------|');
    for (const p of group) {
      const summary = String(p.data.summary || '').replace(/\|/g, '\\|');
      lines.push(`| [[${p.title}]] | ${summary} | ${p.data.updated || ''} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function indexPath(root = '.') {
  return path.join(root, 'wiki', 'index.md');
}

/** Independent staleness check: compare on disk with what generation would produce. */
export function checkIndex(root = '.') {
  const pages = listPages(root);
  const expected = buildIndex(pages);
  const file = indexPath(root);
  if (!fs.existsSync(file)) return { ok: false, expected, reason: 'wiki/index.md is missing' };
  const actual = fs.readFileSync(file, 'utf8');
  if (actual !== expected) return { ok: false, expected, reason: 'wiki/index.md is stale — regenerate with index --write' };
  return { ok: true, expected, reason: null };
}

export function writeIndex(root = '.') {
  const pages = listPages(root);
  const content = buildIndex(pages);
  fs.mkdirSync(path.dirname(indexPath(root)), { recursive: true });
  fs.writeFileSync(indexPath(root), content, 'utf8');
  return content;
}

/* ------------------------------------------------------------------ */
/* raw source sealing                                                   */
/* ------------------------------------------------------------------ */

export function rawFiles(root = '.') {
  return walk(path.join(root, 'raw'))
    .filter((abs) => !abs.endsWith('manifest.json'))
    .map((abs) => path.relative(path.join(root, 'raw'), abs).split(path.sep).join('/'));
}

export function manifestPath(root = '.') {
  return path.join(root, 'raw', 'manifest.json');
}

export function readManifest(root = '.') {
  const file = manifestPath(root);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Seal raw sources. Existing entries are never rewritten silently: a changed hash is
 * reported as a violation unless `force` is set.
 */
export function sealRaw(root = '.', { force = false, now = new Date().toISOString() } = {}) {
  const previous = readManifest(root) || { files: {} };
  const files = {};
  const added = [];
  const changed = [];
  for (const rel of rawFiles(root)) {
    const hash = sha256(path.join(root, 'raw', rel));
    if (previous.files[rel] && previous.files[rel] !== hash) {
      changed.push(rel);
      files[rel] = force ? hash : previous.files[rel];
    } else {
      if (!previous.files[rel]) added.push(rel);
      files[rel] = hash;
    }
  }
  const removed = Object.keys(previous.files || {}).filter((rel) => !(rel in files));
  const manifest = { sealed_at: now, files };
  const sorted = { sealed_at: manifest.sealed_at, files: Object.fromEntries(Object.keys(files).sort().map((k) => [k, files[k]])) };
  fs.mkdirSync(path.join(root, 'raw'), { recursive: true });
  fs.writeFileSync(manifestPath(root), `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  return { added, changed, removed, forced: changed.length > 0 && force, manifest: sorted };
}

export function verifyRaw(root = '.') {
  const manifest = readManifest(root);
  if (!manifest) return { ok: false, findings: [{ severity: 'error', rule: 'raw', file: 'raw/manifest.json', message: 'manifest missing — run raw --seal' }] };
  const findings = [];
  const present = new Set(rawFiles(root));
  for (const rel of Object.keys(manifest.files || {})) {
    if (!present.has(rel)) {
      findings.push({ severity: 'error', rule: 'raw', file: `raw/${rel}`, message: 'sealed source is missing (deleted or renamed)' });
      continue;
    }
    const actual = sha256(path.join(root, 'raw', rel));
    if (actual !== manifest.files[rel]) {
      findings.push({ severity: 'error', rule: 'raw', file: `raw/${rel}`, message: 'raw source modified after sealing — raw sources are immutable' });
    }
  }
  for (const rel of present) {
    if (!(rel in (manifest.files || {}))) {
      findings.push({ severity: 'error', rule: 'raw', file: `raw/${rel}`, message: 'new raw source is not sealed — run raw --seal' });
    }
  }
  return { ok: findings.length === 0, findings };
}

/* ------------------------------------------------------------------ */
/* log                                                                  */
/* ------------------------------------------------------------------ */

const LOG_HEADING = /^## \[(\d{4}-\d{2}-\d{2})\] (ingest|query|lint|edit) \| (.+)$/;

export function logEntries(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    // Any H2 in the log is a candidate entry: a heading that does not match the
    // prefix format is a malformed entry, not prose.
    if (!line.startsWith('## ')) continue;
    const m = LOG_HEADING.exec(line);
    entries.push(m ? { date: m[1], verb: m[2], subject: m[3], ok: true } : { date: null, verb: null, subject: null, ok: false, line });
  }
  return entries;
}


/* ------------------------- governance sync (EDICT-0008) ------------------ */
/* The wiki is a required output of every edict (AGENTS.md §6.5). This check
   reads the governance ledger, finds every edict that reached S6 after the
   rule's baseline, and requires a wiki log entry (verb ingest|edit, dated
   on/after completion) that cites the edict id. */

export function governancePaths(root = '.') {
  return {
    ledger: path.join(root, 'docs', 'governance', 'ledger.jsonl'),
    config: path.join(root, 'docs', 'governance', 'wiki-sync.json'),
    log: path.join(root, 'wiki', 'log.md'),
  };
}

export function readLedger(root = '.') {
  const file = governancePaths(root).ledger;
  if (!fs.existsSync(file)) return { records: [], error: null, missing: true };
  const records = [];
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      return { records: [], error: `malformed ledger line: ${line.trim().slice(0, 60)}`, missing: false };
    }
  }
  return { records, error: null, missing: false };
}

/** Latest completion (state S6, verdict DONE or QA_PASS) per edict. */
export function edictCompletions(records) {
  const completed = new Map();
  for (const record of records) {
    if (!record || !record.edict) continue;
    if (record.to !== 'S6') continue;
    if (!['DONE', 'QA_PASS'].includes(record.verdict)) continue;
    const previous = completed.get(record.edict);
    if (!previous || Number(record.seq) > Number(previous.seq)) {
      completed.set(record.edict, {
        edict: record.edict,
        seq: Number(record.seq),
        ts: record.ts,
        office: record.office,
      });
    }
  }
  return [...completed.values()].sort((a, b) => a.seq - b.seq);
}

/** Parse log.md into entries with their date, verb, subject and body lines. */
export function logBlocks(text) {
  const blocks = [];
  let current = null;
  for (const line of String(text).split(/\r?\n/)) {
    const match = /^## \[(\d{4}-\d{2}-\d{2})\] (ingest|query|lint|edit) \| (.+)$/.exec(line);
    if (match) {
      if (current) blocks.push(current);
      current = { date: match[1], verb: match[2], subject: match[3], lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) blocks.push(current);
  return blocks;
}

export function blockText(block) {
  return [block.subject, ...block.lines].join('\n');
}

/**
 * Returns { ok, skipped, from, pending, checked, reason }.
 * `skipped` is true when the repository has no governance ledger at all, so a
 * standalone wiki keeps working outside this repo.
 */
export function checkEdictSync(root = '.') {
  const paths = governancePaths(root);
  if (!fs.existsSync(paths.ledger)) {
    return { ok: true, skipped: true, from: 0, pending: [], checked: [], reason: 'no governance ledger in this repository' };
  }
  let config = { enforced_from_seq: 0 };
  if (fs.existsSync(paths.config)) {
    try {
      config = JSON.parse(fs.readFileSync(paths.config, 'utf8'));
    } catch {
      return { ok: false, skipped: false, from: 0, pending: [], checked: [], reason: 'docs/governance/wiki-sync.json is not valid JSON' };
    }
  }
  const { records, error } = readLedger(root);
  if (error) return { ok: false, skipped: false, from: 0, pending: [], checked: [], reason: error };

  const from = Number(config.enforced_from_seq || 0);
  const logFile = paths.log;
  const blocks = fs.existsSync(logFile) ? logBlocks(fs.readFileSync(logFile, 'utf8')) : [];
  const checked = [];
  const pending = [];

  for (const completion of edictCompletions(records)) {
    if (completion.seq <= from) continue;
    const day = String(completion.ts || '').slice(0, 10);
    const hit = blocks.find(
      (block) => (block.verb === 'ingest' || block.verb === 'edit')
        && block.date >= day
        && blockText(block).includes(completion.edict),
    );
    checked.push({
      edict: completion.edict,
      seq: completion.seq,
      logEntry: hit ? `${hit.date} ${hit.verb} | ${hit.subject}` : null,
    });
    if (!hit) pending.push(completion);
  }

  return {
    ok: pending.length === 0,
    skipped: false,
    from,
    pending,
    checked,
    reason: pending.length ? 'completed edicts with no wiki log entry' : null,
  };
}


/* --------------------------- app QA stamp (EDICT-0009) ------------------- */
/* Any change to the app's sources invalidates the last verified UI run. The
   stamp is written only by `node scripts/app-qa.mjs run` after the suite exits 0,
   so a clean lint cannot be claimed for an untested build. */

export const APP_SOURCE_FILES = [
  'src/index.html',
  'src/styles.css',
  'src/app.js',
  'src/tracker/model.js',
  'src/assets/icons/icons.js',
  // EDICT-0013 F8: rendered assets are part of the shipped UI too. Without these
  // a green stamp could predate a regenerated backdrop or font pack.
  'src/assets/fonts/Minecraft.ttf',
  'src/assets/panorama/backdrop.webp',
  'src/assets/panorama/manifest.json',
];

export function stampPath(root = '.') {
  return path.join(root, 'docs', 'governance', 'app-qa.json');
}

/** SHA-256 per app source file plus a combined hash over (path, hash) pairs. */
export function appHash(root = '.') {
  const files = {};
  for (const relative of APP_SOURCE_FILES) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return { hash: null, files: {}, missing: relative };
    files[relative] = sha256(absolute);
  }
  const combined = Object.keys(files)
    .sort()
    .map((key) => `${key}:${files[key]}`)
    .join('\n');
  return { hash: crypto.createHash('sha256').update(combined).digest('hex'), files, missing: null };
}

export function checkAppQaStamp(root = '.') {
  const current = appHash(root);
  if (current.missing) {
    return { ok: true, skipped: true, reason: 'no app sources in this repository', changed: [], current };
  }
  const file = stampPath(root);
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      skipped: false,
      reason: 'app sources exist but no UI QA stamp',
      changed: Object.keys(current.files),
      current,
      stamp: null,
    };
  }
  let stamp;
  try {
    stamp = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { ok: false, skipped: false, reason: 'docs/governance/app-qa.json is not valid JSON', changed: [], current };
  }
  const changed = Object.keys(current.files).filter((key) => (stamp.files || {})[key] !== current.files[key]);
  return {
    ok: changed.length === 0,
    skipped: false,
    reason: changed.length ? 'app changed since the last verified UI test run' : null,
    changed,
    current,
    stamp,
  };
}

/* ------------------------------------------------------------------ */
/* lint                                                                 */
/* ------------------------------------------------------------------ */

const finding = (severity, rule, file, message) => ({ severity, rule, file, message });

export function lint(root = '.') {
  const findings = [];
  const pages = listPages(root);
  const titleIndex = new Map();

  for (const page of pages) {
    if (page.error) {
      findings.push(finding('error', 'frontmatter', page.rel, page.error));
      continue;
    }
    for (const key of REQUIRED_KEYS) {
      const value = page.data[key];
      if (value === undefined || value === null || (value === '' && key !== 'tags' && key !== 'sources')) {
        findings.push(finding('error', 'frontmatter', page.rel, `missing required key "${key}"`));
      }
    }
    if (page.data.type && !PAGE_TYPES.includes(page.data.type)) {
      findings.push(finding('error', 'type', page.rel, `unknown type "${page.data.type}"`));
    }
    const expectedType = page.rel === 'overview.md' ? 'overview' : TYPE_DIRS[page.dir] || null;
    if (expectedType && page.data.type && page.data.type !== expectedType) {
      findings.push(finding('error', 'type', page.rel, `type "${page.data.type}" does not match directory "${page.dir || '.'}" (expected "${expectedType}")`));
    }
    if (page.data.summary && String(page.data.summary).length > SUMMARY_MAX) {
      findings.push(finding('error', 'summary', page.rel, `summary is ${String(page.data.summary).length} chars (max ${SUMMARY_MAX})`));
    }
    if (page.data.updated && !/^\d{4}-\d{2}-\d{2}$/.test(String(page.data.updated))) {
      findings.push(finding('error', 'frontmatter', page.rel, `updated "${page.data.updated}" is not YYYY-MM-DD`));
    }
    if (page.data.tags !== undefined && !Array.isArray(page.data.tags)) {
      findings.push(finding('error', 'frontmatter', page.rel, 'tags must be an array'));
    }
    if (page.data.sources !== undefined) {
      const list = Array.isArray(page.data.sources) ? page.data.sources : [];
      for (const slug of list) {
        if (!fs.existsSync(path.join(root, 'raw', 'sources', `${slug}.md`))) {
          findings.push(finding('error', 'sources', page.rel, `sources[] references unknown raw source "${slug}"`));
        }
      }
    }
    if (titleIndex.has(page.title)) {
      findings.push(finding('error', 'duplicate-title', page.rel, `duplicate title "${page.title}" (also ${titleIndex.get(page.title)})`));
    } else {
      titleIndex.set(page.title, page.rel);
    }
  }

  const titles = new Set(pages.map((p) => p.title));
  const inbound = new Map(pages.map((p) => [p.title, 0]));
  for (const page of pages) {
    for (const target of extractWikilinks(page.body)) {
      if (!titles.has(target)) {
        findings.push(finding('error', 'wikilink', page.rel, `unresolved wikilink [[${target}]]`));
      } else if (target !== page.title) {
        inbound.set(target, (inbound.get(target) || 0) + 1);
      }
    }
    for (const href of extractMdLinks(page.body)) {
      const resolved = path.resolve(path.dirname(page.abs), href.split('#')[0]);
      if (!fs.existsSync(resolved)) {
        findings.push(finding('error', 'md-link', page.rel, `relative link does not resolve: ${href}`));
      }
    }
  }
  for (const page of pages) {
    if ((inbound.get(page.title) || 0) === 0) {
      findings.push(finding('error', 'orphan', page.rel, 'no inbound wikilink from any other page — integrate it or delete it'));
    }
  }

  const indexCheck = checkIndex(root);
  if (!indexCheck.ok) findings.push(finding('error', 'index', 'wiki/index.md', indexCheck.reason));

  const logFile = path.join(root, 'wiki', 'log.md');
  if (!fs.existsSync(logFile)) {
    findings.push(finding('error', 'log', 'wiki/log.md', 'missing chronological log'));
  } else {
    const entries = logEntries(fs.readFileSync(logFile, 'utf8'));
    if (!entries.length) findings.push(finding('error', 'log', 'wiki/log.md', 'no entries — expected "## [YYYY-MM-DD] verb | subject"'));
    entries.filter((e) => !e.ok).forEach((e) => {
      findings.push(finding('error', 'log', 'wiki/log.md', `malformed entry: ${e.line}`));
    });
  }

  findings.push(...verifyRaw(root).findings);

  // EDICT-0008: an edict that reached S6 without a wiki log entry fails lint.
  const appQa = checkAppQaStamp(root);
  if (!appQa.skipped && !appQa.ok) {
    findings.push(finding(
      'error',
      'app-qa-stamp',
      'docs/governance/app-qa.json',
      `${appQa.reason}: ${appQa.changed.join(', ')} — run node scripts/app-qa.mjs run`,
    ));
  }

  const sync = checkEdictSync(root);
  if (!sync.skipped) {
    if (!sync.ok && !sync.pending.length && sync.reason) {
      findings.push(finding('error', 'edict-sync', 'docs/governance/ledger.jsonl', sync.reason));
    }
    for (const entry of sync.pending) {
      findings.push(finding(
        'error',
        'edict-sync',
        'wiki/log.md',
        `${entry.edict} reached S6 at ledger seq ${entry.seq} but no wiki log entry on/after ${String(entry.ts).slice(0, 10)} cites it — ingest it (AGENTS.md §6.5)`,
      ));
    }
  }
  const errors = findings.filter((f) => f.severity === 'error').length;
  const warnings = findings.filter((f) => f.severity === 'warning').length;
  return { findings, errors, warnings, pages };
}

/* ------------------------------------------------------------------ */
/* search and stats                                                     */
/* ------------------------------------------------------------------ */

export function search(pages, query, { limit = 5 } = {}) {
  const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored = [];
  for (const page of pages) {
    const title = page.title.toLowerCase();
    const summary = String(page.data.summary || '').toLowerCase();
    const body = page.body.toLowerCase();
    let score = 0;
    for (const term of terms) {
      const count = (haystack) => haystack.split(term).length - 1;
      if (title.includes(term)) score += 6;
      score += 3 * count(summary);
      score += count(body);
    }
    if (score > 0) scored.push({ page, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.page.title < b.page.title ? -1 : 1));
  return scored.slice(0, limit).map(({ page, score }) => ({ page, score, snippet: snippetFor(page.body, terms) }));
}

export function snippetFor(body, terms, width = 110) {
  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (terms.some((t) => lower.includes(t)) && line.trim().length > 0) {
      return line.trim().length > width ? `${line.trim().slice(0, width)}…` : line.trim();
    }
  }
  return lines.find((l) => l.trim().length > 0)?.trim().slice(0, width) || '';
}

export function stats(root = '.') {
  const pages = listPages(root);
  const byType = {};
  for (const page of pages) byType[page.type || 'none'] = (byType[page.type || 'none'] || 0) + 1;
  let wikilinks = 0;
  for (const page of pages) wikilinks += extractWikilinks(page.body).length;
  const titles = new Set(pages.map((p) => p.title));
  const inbound = new Map(pages.map((p) => [p.title, 0]));
  for (const page of pages) {
    for (const target of extractWikilinks(page.body)) {
      if (titles.has(target) && target !== page.title) inbound.set(target, (inbound.get(target) || 0) + 1);
    }
  }
  const orphans = pages.filter((p) => (inbound.get(p.title) || 0) === 0).map((p) => p.rel);
  const logFile = path.join(root, 'wiki', 'log.md');
  const entries = fs.existsSync(logFile) ? logEntries(fs.readFileSync(logFile, 'utf8')) : [];
  return { pages: pages.length, byType, wikilinks, orphans, rawSources: rawFiles(root).length, logEntries: entries.length };
}
