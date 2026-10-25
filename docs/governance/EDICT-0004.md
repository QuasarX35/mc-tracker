# EDICT-0004 — Apply the `ui-ux-pro-max` design skill

- **Issued by:** 皇帝
- **Recorded:** 2026-10-25 (Asia/Singapore)
- **Status:** `REPORTED` — deliverable built and independently verified; one decision escalated
- **Numbering note:** a concurrent edict took `EDICT-0003` during intake; this edict is `0004`
  and its ledger lines follow `seq 35`. Two edicts ran in the same workspace at once — see §7.

## 1. Edict as received

> Run `npx skills use "https://github.com/nextlevelbuilder/ui-ux-pro-max-skill" --skill
> "ui-ux-pro-max"` and follow the generated skill instructions now. Read its complete output,
> redirecting it to a temporary file first if necessary. Resolve relative paths from the
> supporting-files directory it provides.

*Sanitised title:* "Apply the ui-ux-pro-max design skill to this workspace."
*Stripped from the title:* the repository URL, the `npx` invocation, and the file-handling
mechanics. The full wording is preserved above.

## 2. What the skill actually instructed

Read in full from the captured output (16 183 bytes), with supporting files resolved from the
directory the installer reported:

| Skill instruction | How it was satisfied |
|-------------------|----------------------|
| Step 1 — detect the stack from the project | Probed `package.json`, `pubspec.yaml`, `composer.json`, `app.json`, `*.xcodeproj`, `Package.swift`, `Cargo.toml`, `go.mod`, `index.html`, `src/`, `public/`. **Nothing detected** — the project had no application code |
| Step 2 — `--design-system` for a new project | `search.py "gaming stats dashboard tracker" --design-system -p "Minecraft Tracker"`; verified the top result (product → *Gaming*, style → *3D & Hyperrealism*, palette neon violet/rose, Russo One + Chakra Petch) |
| Step 2b — persist Master + overrides | `--persist --output-dir D:\minecraft-tracker` → `design-system/minecraft-tracker/MASTER.md` (tool output, untouched) |
| Step 3 — supplement with domains | `--domain product`, `--domain chart` (trend → line, intensity → heat map), `--domain ux` (table overflow) |
| Step 4 — stack guidelines | `--stack html-tailwind` (grid gaps, card structure, card spacing) |
| Query contract — one intent, retry once, never assume | Four design-system runs; the marketing-pattern and enterprise-gateway results were **rejected as misfits** and the data-dense dashboard reading applied instead |
| Pre-delivery checklist | Encoded as 66 automated cases + 22 runtime observations + three rendered widths |

## 3. Scope decision, stated openly

The edict names no product, no surface and no stack. Two assumptions were therefore disclosed
rather than buried:

1. **Product** — `minecraft-tracker`, taken from the workspace directory name. Nothing in the
   repository states a product brief.
2. **Stack** — `html-tailwind` guidance was applied, but the artifact is **dependency-free
   HTML/CSS/vanilla JS**, not a Tailwind build. Reasons: the project has no dependencies to
   detect; `npm` cannot install under the session sandbox without an approval escalation; and a
   prototype that must be openable offline is worth more than a framework scaffold nobody asked
   for. The stack guidance was applied as principles (uniform grid gaps, one card radius/shadow/
   padding rhythm), not as a library import.

The skill's own rule is explicit — *"Never assume a stack"*. Since nothing was detectable, the
stack question is escalated in §6 rather than decided unilaterally for the next phase.

## 4. Delivered

| Artifact | What it is |
|----------|------------|
| `design-system/minecraft-tracker/MASTER.md` | Tool-generated global source of truth (colour roles, type, spacing, shadows, component specs, anti-patterns) |
| `design-system/minecraft-tracker/pages/dashboard.md` | Page override: landing pattern → data-dense dashboard; WebGL/parallax replaced with layered CSS depth (both deviations cite the verified search rows); semantic status tokens; chart and layout rules; `AC-1`–`AC-6` |
| `src/index.html`, `src/styles.css`, `src/dashboard.js` | The tracker dashboard: KPI strip, 14-day playtime/players line chart, 7×24 activity heat map, filterable/sortable/searchable player leaderboard, skeleton loading, empty state, offline alert, full token sheet |
| `tests/qa/contrast_audit.py` | 66-case harness: WCAG contrast for every pair the page uses, 25 HTML invariants, 12 CSS rules, 7 JS rules |
| `reports/qa/EDICT-0004-cycle-1.md`, `-cycle-2.md` | QA records: 6 defects raised, 6 fixed, cycle 2 `QA_PASS` |

## 5. Verification (measured, not asserted)

- Harness: **66/66** cases pass. Min text contrast **5.69:1**; min control-boundary **3.90:1**;
  focus ring **6.06:1** on cards. Zero raw hex outside `:root`.
- Runtime probe (headless Chrome, reduced-motion forced): 12 rows → filter 6 → search 0 with
  empty state → restore 12; `aria-sort` toggles; 36 skeleton cells; offline banner toggles;
  `animation-duration = 1e-06s`; `scrollWidth == clientWidth`.
- Rendered at **375 / 768 / 1440** px and inspected. Headless Chrome clamps to 500 px on
  Windows, so the 375 px pass used a 375 px iframe — a clamp, not an overflow, and it was
  checked before being reported.
- **Owed:** a full Tab traversal; a light theme (MASTER marks light conditional); real data
  instead of the demo dataset.

## 6. Escalation to 皇帝 (`X1`-class, decision only)

1. **Stack for the real build** — React/Next, Vue, Svelte, or keep vanilla? Nothing exists to
   inherit from, and the skill forbids guessing. This decides where the next edict starts.
2. **Product surface** — is this a server-operator dashboard, a public player profile page, or
   both? The delivered page is the dashboard reading of "tracker".
3. **Data source** — which server API/log format feeds the tracker? The demo dataset is
   labelled as demo everywhere and connected to nothing.

## 7. Governance observations for 吏部-HR and 工部

- **Concurrency.** Two edicts wrote to one workspace simultaneously (this one and the LLM Wiki
  edict). Write scopes stayed disjoint — `src/wiki/**` versus `src/*.html|css|js`, and separate
  QA record numbers — but the ledger now interleaves two edicts, and `EDICT-0003` was claimed
  while this edict was being triaged. The registry's dispatch rule assumes a single dispatcher;
  it does not define edict-number reservation.
- **Scope revision.** `design-system/**` was granted to 礼部 by revision 3, recorded after the
  first two files were written. Disclosed in the registry as a minor `R5` finding rather than
  back-dated.
- **Excluded tree.** `.tmp/` holds vendored third-party material (the cloned skill repository,
  an npm cache, a Chrome profile, render artefacts). QA excluded it by scope. Housekeeping is
  `工部`'s call.
