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
visual contract (panel grey, square corners, the Minecraft bitmap face, 256 px item renders
downscaled smoothly, tiled textures pixelated) and a global "no console errors" case. EDICT-0013
added the interaction set: title rename (save, cancel, Escape, blank refusal, focus return),
coords copy with its disabled empty state, notes view/edit and `Ctrl`/`Cmd`+`Enter`, the six
steppers with stack sizes and the clamp at 1, the single picker (search, 150-tile render cap,
footer upload, pick-item mode), the material chooser, the themed-select probe and the sharper
backdrop — 49 cases in total.

## The "always" half: a stamp, not a reminder

A rule that says "remember to test" is the same failure mode the wiki had before
`edict-sync`. So the app has the same shape of mechanism:

1. `scripts/app-qa.mjs run` executes the suite; **failure writes nothing**.
2. On success it writes `docs/governance/app-qa.json`: per-file SHA-256 of the five app sources
   plus the font, the panorama WebP and the panorama manifest (8 files), a combined hash, a
   timestamp and the case count.
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
- **Headless by default, not by principle.** Real devices, touch and OS file pickers are out of
  scope; the 390 px case is viewport emulation. EDICT-0013's `::picker(select)` probe needed a
  headed Chrome because the popup is an OS-level window.
- **Browser hands are not the verifier's.** In EDICT-0013 the verifier's sandbox could not start
  Chrome (`FATAL:mojo platform_channel.cc:112 ... Access is denied. (0x5)`); the Lead seat ran
  every browser launch under `danger-full-access`, while 测试部 authored the frozen cases,
  analysed the artefacts and judged. Independence moved from "same agent runs and grades" to
  "author and grader are separate from the hands"; the stamp remains the execution trace.
- **A native popup is not a page.** Chrome's `<select>` popup is an OS-level window that
  `Page.captureScreenshot` cannot capture; the themed-dropdown claim therefore rests on
  `CSS.supports` + computed `::picker(select)` styles plus the `:open` observation and a
  screenshot of the closed control, not on a picture of the open menu. That is a weaker artefact
  than a screenshot, and it is labelled as such.
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
- EDICT-0013 pushed the mechanism to 49 flows and made the browser-hand split explicit; the
  stamp now covers the baked font/panorama assets as well as the app sources.
