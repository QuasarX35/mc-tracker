# EDICT-0005 — Minecraft Build Tracker (worlds → builds → materials)

- **Issued by:** 皇帝
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 礼部 (design system v2, icon/UX conventions), 兵部 (model, UI, tooling),
  工部 (asset generator, legacy archive), 吏部-HR (scopes)
- **Verified by:** 测试部 (`S5Q`, two cycles)
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `ENACTED` — `S6`

## 1. Edict as received

> the UI/UX chat is done. This project is for users to list down, plan, and track the
> materials for their planned builds in their different worlds in Minecraft. I also want
> the UI to look as close to Minecraft's in-game UI as possible

*Sanitised title:* "Build the Minecraft build-planner and material tracker, styled as
Minecraft's in-game GUI."
*Stripped:* nothing (no paths or metadata). *Flagged:* the two sentences are two
requirements — a **product** (worlds → builds → materials) and a **visual direction** — and
the second one **contradicted the design system on disk**, which had to be resolved before
any code was written.

## 2. The contradiction that shaped the plan

The UI/UX session delivered `design-system/minecraft-tracker/MASTER.md` v1: neon purple
`#7C3AED`, rose `#F43F5E`, near-black `#0F0F23`, Russo One / Chakra Petch, "3D &
Hyperrealism", glassy cards. That is a modern esports dashboard — the opposite of an in-game
Minecraft GUI. The edict is explicit, so **the design system was superseded by v2**, and the
prior dashboard SPA was archived under `legacy/superseded-dashboard/` rather than deleted
(it was never committed).

## 3. Review record

**Round 1 — 🚫 Reject.**

| # | Finding | Gate |
|---|---------|------|
| F1 | The plan followed the v1 design system, contradicting the edict's visual requirement. Direction must win over an inherited document. | R1 |
| F2 | No write scope covered `legacy/**`, and `src/**` was already claimed by 兵部 while another session had authored files there. Scope and ownership had to be settled. | R5 |
| F3 | The obvious implementation (ES modules) **cannot run from `file://`** — a double-clicked `index.html` is how the user will open this. | R6 |
| F4 | "Implement the following" had no acceptance criteria and no artifacts a verifier could grade; pixel appearance is not a unit test. | R3 |
| F5 | Persistence was unplanned: silently corrupting or replacing saved data on import is the one irreversible failure mode in a tracker. | R5, R7 |
| F6 | No asset plan: "Minecraft look" needs a bitmap font and tileable textures, and the sandbox is offline. | R6 |

**Round 2 — ✅ Pass**, conditional on: visual direction verified with real screenshots (not
asserted), an independent three-way verification (model unit tests, acceptance contract
tests, contrast/structure audit), destructive actions gated by confirmation, import
validated before replacing state, and every asset generated locally.

## 4. What was built

| Layer | Artifact |
|-------|----------|
| Product | `src/index.html`, `src/app.js` — three tabs: Builds, Materials (shopping list), Worlds; inline quantity editing, status, coords, notes, search/filter, copy-list, JSON export/import |
| Model | `src/tracker/model.js` — pure, immutable-update domain model (worlds → builds → materials), aggregation, validation, storage adapter, sample seed |
| Visual system | `design-system/minecraft-tracker/MASTER.md` **v2** + `pages/tracker.md` — GUI grey `#c6c6c6`, 2px black outlines, 2px bevels, square corners, XP bars, item slots, vanilla tooltips |
| Assets | `scripts/gen-assets.py` → 9 tiling textures + 18 item icons + favicon, drawn at 16×16 and scaled with `image-rendering: pixelated`; Pixelify Sans (OFL) bundled locally |
| Tests | `tests/unit/tracker-model.test.mjs` (15), `tests/qa/tracker.acceptance.test.mjs` (16, independent + static contract), `tests/qa/mc_ui_audit.py` (30 cases: contrast, structure, offline, pixel rules) |
| Archive | `legacy/superseded-dashboard/` — v1 dashboard SPA, preserved in this commit (superseded, not deleted) |

## 5. Verification (`S5Q`) — two cycles

| Cycle | Verdict | Findings |
|-------|---------|----------|
| 1 | **QA_FAIL** | `D1` seed silently dropped Stone Bricks (a forgotten `state =` on an immutable update); `D2` muted text 4.07:1 below AA; `D3` glass icon invisible on a slot; `T1` unit tests compared cross-realm arrays; `E1` Chrome cannot run confined, and its minimum window width forced an iframe harness for 390px verification |
| 2 | **QA_PASS** | 15/15 unit, 16/16 acceptance, 30/30 audit; screenshots at 1280px and 390px reviewed; no horizontal overflow; every fix carries a regression test |

Evidence: [cycle 1](../../reports/qa/EDICT-0005-cycle-1.md) ·
[cycle 2](../../reports/qa/EDICT-0005-cycle-2.md).

## 6. Deliberate omissions

- **No backend / accounts.** It is a local tool: `localStorage` plus JSON export. The footer
  says so. Sync would need a server and a privacy decision the edict did not authorise.
- **18 item icons, not 1 800.** Unmapped items fall back to a lettered slot. Extending the
  generator is a one-line-per-icon change.
- **No build screenshots/blueprints field.** Text notes and coords only.
- **No Obsidian/Marp/dataview extras.** Those belong to the wiki track, not this app.

## 7. Environment findings

1. Headless Chrome is blocked inside the DSH sandbox (mojo IPC denied); screenshots required
   an approved unconfined run. The session is now in full-access policy.
2. Chrome headless on Windows enforces a minimum window width (~500px), so a 390px
   screenshot is not a 390px layout. Verified mobile through an iframe harness instead.
3. `.tmp/` remains outside the tracked tree (chrome profiles, screenshots, harness).
4. The workspace hosts two projects: this app and the LLM Wiki (EDICT-0003). Git tracks
   both; `legacy/` and `.tmp/` are excluded from the commit by design.

## 8. State

`S6`. The app opens from `src/index.html` with a double click, seeds two sample worlds on
first run, and stores everything in the browser. `?tab=materials` deep-links the shopping
list.
