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
| Import a wrong file | Would overwrite real data | Import validates the schema and refuses anything malformed **before** replacing state |

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

## Relations

- Chosen for the [[Minecraft Build Tracker]].
- Influences what [[In-game GUI design]] must ship locally (fonts, textures) to stay offline.
