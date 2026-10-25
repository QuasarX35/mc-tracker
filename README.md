# LLM Wiki

A working instance of the [LLM Wiki](wiki/overview.md) pattern: an agent-compiled,
persistent knowledge base that sits between the Emperor and an immutable collection of raw
sources. Markdown only; no database, no embeddings, no build step.

## Where things are

| Path | What it is |
|------|------------|
| [`AGENTS.md`](AGENTS.md) | The **schema** — layout, frontmatter contract, ingest/query/lint workflows. Read this first. |
| `raw/sources/` | Raw sources. Immutable, sealed by `raw/manifest.json` (SHA-256). Never edited. |
| `wiki/` | The wiki itself — agent-owned pages, `index.md`, `log.md`. |
| `src/wiki/` | Zero-dependency tooling: lint, index generation, search, raw sealing. |
| `tests/unit/` | Unit tests (兵部). |
| `tests/qa/` | Independent acceptance tests (测试部). |
| `docs/governance/` | The 三省六部 pipeline that governs this workspace. |

## Commands

```bash
node src/wiki/cli.mjs lint              # structural checks, exit 1 on findings
node src/wiki/cli.mjs index --write     # regenerate wiki/index.md
node src/wiki/cli.mjs index --check     # fail if the index is stale
node src/wiki/cli.mjs search "compiled" # ranked search over wiki pages
node src/wiki/cli.mjs raw --seal        # seal new raw sources
node src/wiki/cli.mjs stats             # counts
node tests/unit/wiki-core.test.mjs && node tests/qa/wiki.acceptance.test.mjs   # tests
```

## First read

1. [`wiki/index.md`](wiki/index.md) — the catalogue.
2. [`wiki/overview.md`](wiki/overview.md) — the standing synthesis.
3. [`wiki/log.md`](wiki/log.md) — what has happened, newest last.

## Current state

- 1 raw source: the pattern document that defines this wiki.
- 15 wiki pages (1 overview, 6 concepts, 4 entities, 1 source summary, 3 synthesis).
- The wiki documents its own pattern; the first external domain is not yet chosen
  ([open questions](wiki/synthesis/open-questions.md)).
