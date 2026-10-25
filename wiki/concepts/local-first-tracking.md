---
title: Local-first tracking
type: concept
summary: Browser-local persistence (localStorage plus JSON export/import): no server, offline, private — but no sync and no durability guarantee.
updated: 2026-10-25
sources:
  - 2026-10-25-minecraft-build-tracker-spec
tags: [architecture, persistence, privacy]
---

# Local-first tracking

The [[Minecraft Build Tracker]] stores its entire dataset in `localStorage` and offers JSON
export/import as the backup path. There is no account system, no server and no network call at
runtime — the page is a folder of files that works from `file://`.

## Why this shape

- **Zero install, zero friction.** A player mid-session should not create an account to count
  cobblestone.
- **Offline by construction.** No font CDN, no analytics, no API: the app cannot fail because
  the network did.
- **Privacy by default.** Build plans stay on the machine; there is nothing to leak because
  nothing is uploaded.
- **Portable honesty.** Export/Import doubles as backup and as transfer to another browser.

## Failure modes, stated plainly

| Failure | Consequence | Mitigation shipped |
|---------|-------------|--------------------|
| Browser storage cleared / private window | Data gone | Footer says "saved in this browser only"; Export is one click |
| Storage quota exceeded | Write fails | `save()` returns an error, UI shows a toast, never throws |
| Two tabs editing | Last write wins | Not mitigated — documented limitation |
| Machine dies | Data gone unless exported | Export is manual and user-remembered, not scheduled |
| Import a wrong file | Would overwrite real data | Import validates the schema and refuses anything malformed **before** replacing state; the EDICT-0015 dialog adds file/drop/paste paths and inline errors, while a restore summary is still deferred |

## Tensions

- **Durability is discipline, not design.** Everything "just works" until the user forgets to
  export. A scheduled/auto-export or a File System Access handle would be the next step; both
  add permissions prompts and complexity the edict did not ask for.
- **Single-writer assumption.** The model returns new immutable states and the UI persists
  after each mutation, which is enough for one tab but not for concurrent editing.
- **No sharing.** Two players comparing plans must exchange JSON files. Cloud sync is the
  obvious product need and the obvious scope creep; it was refused deliberately rather than
  half-built ([[Minecraft Build Tracker]]).
- **Testability is good though:** because persistence is an injected storage adapter, failures
  such as quota exhaustion are unit-testable without a browser.
- **Custom registries are create-only and travel with backups.** Editing, deletion and per-build
  stack overrides are unowned follow-ups, and an exported file carries whichever custom items the
  exporter wrote — the recipient cannot tell a shared vocabulary from someone's private labels
  ([[Material registry]]).
- **Import still replaces, not merges.** The dialog makes a backup cheap to submit from a paste
  box, but there is no restore summary or size guard yet; the only protection remains validation
  before replacement.

## Running it

- **Double-click `src/index.html`**, or paste `file:///D:/minecraft-tracker/src/index.html`
  into the address bar. No install, no build, no server.
- `file://` persistence was **verified on 2026-10-25**: seed in one run, re-open in another,
  the data is read back with no storage error. Data belongs to the browser profile, keyed by
  origin.
- If a browser refuses local storage for `file://` (private windows, managed policies), serve
  the folder instead: `python -m http.server 8000` from `src/`, then
  `http://localhost:8000/`. Nothing in the app requires it.
- **Recovery:** delete worlds in-app or clear the site's storage — export first. There is no
  server-side copy to restore from.

## Icons are local too

The bundled bitmap font and tiling textures keep the UI offline; the item icons are
different in kind — they are the game's assets, generated on the owner's machine by
`scripts/mc-icons.py` and git-ignored ([[Vanilla assets without redistribution]]). A clone
without that step runs fine with lettered slots: absence is a documented state, not a
broken image.

## Custom registries are additive

EDICT-0015 added custom items at build, world and account scope, stored in the same JSON document
and resolved nearest-first over the generated catalogue ([[Material registry]]). Three properties
matter for a local-first tool:

- **No schema bump.** Storage stays `SCHEMA = 1`; the registries are optional arrays, so an older
  build ignores them and a v1 backup imports with empty registries. Nothing migrates.
- **Nearest scope wins.** A build-level entry shadows a world-level one, which shadows the account
  registry, which shadows the catalogue — a deliberate reuse of a name, not an error.
- **Everything counts against one quota.** Custom icons may be data URLs, like avatars, so a large
  account registry competes with the rest of the state for `localStorage`; a failing write still
  surfaces the existing save error rather than throwing.

The "no server" promise is unchanged: custom items are local data, not shared vocabulary, and two
players exchanging JSON also exchange whichever scopes the exporter wrote.

## Uploaded identity images

An uploaded avatar is decoded, centre-cropped to 128×128, encoded WebP (PNG fallback) and stored
**inside the saved state** as a data URL capped at 120 000 characters. That keeps exports
self-contained — one file restores avatars too — but it moves storage into the quota that
`localStorage` gives the origin, so many uploads shrink the headroom left for the rest of the
tracker. The model validates the MIME prefix and the cap on load/import, so a hostile or broken
backup cannot smuggle a huge blob past validation.

## Relations

- Chosen for the [[Minecraft Build Tracker]].
- Influences what [[In-game GUI design]] must ship locally (fonts, textures) to stay offline.
- Extended by EDICT-0015 with additive custom-item registries and a chooser-free import path
  ([[Material registry]], [[Testing a UI like a user]]).
