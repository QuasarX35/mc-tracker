---
title: Testing a UI like a user
type: synthesis
summary: Driving real Chrome through the DevTools Protocol with zero dependencies, and gating app changes on a hash stamp that only a passing run can refresh.
updated: 2026-10-25
sources: []
tags: [testing, browser, quality]
---

# Testing a UI like a user

How the [[Minecraft Build Tracker]] is verified, written after the QA ministry was asked to
test "every little detail, always on update".

## The constraint shaped the design

No npm dependencies, no network. Playwright and Puppeteer are unavailable, and asserting on
source strings is not UI testing. Node 22 ships a global `WebSocket`, and Chrome ships a
DevTools Protocol — together that is a complete browser driver with nothing to install:

- launch Chrome headless with a throwaway profile and a debugging port;
- connect to the page target, then `Runtime.evaluate` / `Input.dispatchKeyEvent` /
  `DOM.setFileInputFiles` / `Emulation.setDeviceMetricsOverride` / `Page.captureScreenshot`;
- every interaction is a real DOM interaction in a real engine.

`file://` works, which matters: the app is a double-clickable page, so the tests load it the
same way a player does.

## What "comprehensive" was taken to mean

Not line coverage — **task coverage**. Empty states and guidance, sample data, tabs by click
and keyboard, world create/edit/delete with cancel, build create/edit/status/delete, material
validation, duplicate merge, inline quantities with over-farming, removal and empty states,
the cross-build shopping list with attribution, four filters plus search, copy, export, valid
and refused imports, persistence across reload, deep links, accessibility (labels, skip link,
dialog modality, live regions, visible focus), a 390 px layout with no horizontal overflow, the
visual contract (panel grey, square corners, pixel font, 256 px item renders downscaled
smoothly, tiled textures pixelated) and a global "no console errors" case.

## The "always" half: a stamp, not a reminder

A rule that says "remember to test" is the same failure mode the wiki had before
`edict-sync`. So the app has the same shape of mechanism:

1. `scripts/app-qa.mjs run` executes the suite; **failure writes nothing**.
2. On success it writes `docs/governance/app-qa.json`: per-file SHA-256 of the app sources, a
   combined hash, timestamp, case count.
3. `lint`'s `app-qa-stamp` rule fails when current hashes differ from the stamp — so the next
   clean pass is impossible without re-running the suite.

Proven on the repository itself: lint refused the build until a stamp existed, then went
green; a modified source file turns it red again and names the file.

## Tensions

- **Independence is structural by default, organisational when delegated.** The same ministry
  normally writes and runs the suite. Expectations are recomputed from the DOM (e.g. the XP
  percentage is derived from the inputs, not read from the app) and only persisted state is
  inspected, but suite quality is what needs reviewing. EDICT-0011 exercised the delegated
  mode: a separate 测试部 teammate authored the high-resolution icon acceptance cases from the
  requirement before the implementation finished and held the QA verdict — author ≠ verifier.
- **Headless only.** Real devices, touch and OS file pickers are out of scope; the 390 px case
  is viewport emulation.
- **The stamp says "the suite passed", not "the suite is good".** A weak test suite stamps just
  as happily as a strong one; the gate guarantees freshness, not judgement.
- **One browser, sequential cases.** A hang fails the file; there is no sharding.
- **Chrome is a prerequisite in a sandbox that blocks it by default.** The gate fails closed
  (exit 2, no stamp) rather than pretending — which is correct, and means CI would need to run
  it unconfined.

## Relations

- Verifies [[Minecraft Build Tracker]]; complements [[Vanilla assets without redistribution]]
  (which is why icon files may be absent and the suite tolerates lettered fallbacks).
- Same mechanisation pattern as [[Wiki schema]]'s `edict-sync` rule: state a rule, then make a
  tool fail when it is skipped.
