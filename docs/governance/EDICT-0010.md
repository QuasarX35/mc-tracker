# EDICT-0010 — World/build identity + menu-style panorama backdrop

- **Issued by:** 皇帝 — *"a way for users to identify their builds/worlds more easily, maybe via a custom uploaded image or an icon of a Minecraft item set by the user. I'd also like the background to not be just dirt textures, but actual scenery in Minecraft, just like the starting menu screen in-game, with a blur filter"*
- **Drafted by:** 中书省 · **Audited by:** 门下省 · **Dispatched by:** 尚书省
- **Executed by:** 兵部 (model + UI), 工部 (backdrop extractor), 礼部 (design system, docs, wiki), 测试部 (`S5Q`)
- **Recorded:** 2026-10-25 (Asia/Singapore) · **Status:** `ENACTED` — `S6`
- **Amends:** [EDICT-0005](EDICT-0005.md) (identity + atmosphere), [EDICT-0009](EDICT-0009.md) (coverage grows to 36 flows)

## 1. Two features

**A. Identity.** Worlds and builds now carry an avatar: a Minecraft item icon chosen from the
locally extracted 53-item set, or an uploaded picture. Shown in the world bar, world cards,
build rows and the build detail header; clearing restores the lettered placeholder.

**B. Atmosphere.** The dirt texture is now the fallback. When the locally generated menu
panorama exists, the backdrop is the real Minecraft title-screen scenery — heavily blurred,
slowly panning, behind a dark scrim — exactly the in-game menu treatment.

## 2. The discovery that shaped the extractor

The plan assumed the six `panorama_*.png` faces live in the client jar. **They do not**: in
1.21.4 the jar files are **1×1 placeholders**. The genuine 1024×1024 faces live in the
content-addressed asset store and are reached through
`versions/<v>/<v>.json` → `assetIndex.id` → `assets/indexes/<id>.json` →
`assets/objects/<sha>`. `scripts/mc-backdrop.py` resolves that chain and **refuses any face
smaller than 512 px**, turning the decoy into a clear error instead of a broken background.
It can also compose the strip from the player's own screenshots (`--source screenshots`).

## 3. Schema and API (additive, no version bump)

```js
world.icon? / build.icon? =
  { kind: 'item',  slug: 'stone_bricks' }
| { kind: 'image', dataUrl: 'data:image/webp;base64,…' }   // ≤ 120 000 chars, png|jpeg|webp only
```

New/changed model exports: `ICON_KINDS`, `ICON_DATA_URL_MAX`, `normalizeIcon`,
`setWorldIcon`, `setBuildIcon`; `createWorld`/`createBuild`/`updateWorld`/`updateBuild` accept
icons; `validate` rejects malformed/slug-invalid/oversize icons with the entity name; older
icon-less backups keep importing unchanged. Uploads are centre-cropped to 128×128 on a canvas,
encoded WebP (PNG fallback), and stored inside the saved state so Backup stays self-contained.

## 4. Review record (the real risks)

| Id | Risk | Resolution |
|----|------|------------|
| R1 | Committing panorama/uploaded game pixels would be redistribution. | Extractor + manifest + provenance committed; the image is git-ignored; dirt fallback when absent. |
| R2 | Jar panorama files are 1×1 decoys → a naive extractor ships a blank background. | Asset-index resolution + `MIN_FACE_PX = 512` guard. |
| R5 | Inline images can exhaust `localStorage` and bloat exports. | Square 128×128, WebP q0.82, 120 000-char cap enforced in both the app and `validate`; quota errors already surface as toasts. |
| R6 | Text over imagery can fail contrast. | Baked darkening, scrim token `--backdrop-scrim-alpha`, vignette; reviewed on real screenshots. |
| R7 | A missing/corrupt backdrop must never break the UI. | Runtime feature probe; absence is a normal state, tested by blocking the URL. |
| R3 | "Just like the menu" is unmeasurable. | Converted into testable properties: blurred layer, pan animation name, reduced-motion off switch, fallback texture, no console errors. |
| R4 | Images are user content; XSS via data URLs. | MIME whitelist excludes SVG/HTML; regex-validated base64 data URL; attribute-escaped on render. |

## 5. Verification

| Check | Result |
|-------|--------|
| Model unit (existing + icons) | 15/15 + **9/9** |
| Acceptance (existing + icons/backdrop) | 16/16 + **8/8** |
| Browser UI suite | **36/36** (9 new identity/backdrop cases; 27 previously) |
| UI audit (contrast/structure/pixel/identity) | **65/65** |
| Wiki suite + sync + app-qa gate tests | 10/10, 13/13, 10/10, 8/8, 9/9, 7/7 |
| `lint` / `sync` / `app-qa` | clean / all edicts ingested / verified (36 cases, fresh stamp) |
| Evidence | 5 screenshots in `reports/qa/evidence/edict-0010/` |

## 6. Limits

- Headless-only verification: 390 px is emulated, not a phone; `prefers-reduced-motion` is
  emulated too (headless defaults to *reduce*).
- One avatar per entity; no galleries, GIFs or SVG uploads.
- Panorama uses the four side faces and a ping-pong pan, not a true rotating cubemap.
- Uploads live in browser storage: clearing site data deletes them unless exported.
- Item set remains the 53 locally extracted icons; extending it is one line per item in
  `scripts/mc-icons.py` plus a regenerate.
