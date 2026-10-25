# Minecraft font — DaFont licence intake snapshot

Retrieved **2026-10-25 17:09:56 +08:00 (Asia/Singapore)** from
<https://www.dafont.com/minecraft.font> (HTTP 200, `text/html`, 13,934 bytes;
`finalUrl` unchanged after redirects). This is a write-once intake record: it is the
licence evidence for the font binary committed at `src/assets/fonts/Minecraft.ttf`, and it
is not edited after sealing.

## What the page states, verbatim

The listing details block, as rendered:

| Field | Value on the page |
|-------|-------------------|
| Title | `Minecraft` (`<h1>Minecraft</h1>`) |
| Author | `Craftron Gaming` — `by <a href="craftron-gaming.d6128">Craftron Gaming</a>` |
| Category | `Bitmap`, at `16 px` — `in <a href="bitmap.php">Bitmap</a><span title="Use at 16 px (or multiple of 16), anti-alias off"> (16 px)</span>` |
| Downloads | `5,204,307 downloads (5,642 yesterday)` |
| Glyphs | `View all glyphs (110)` |
| First seen on DaFont | `July 12, 2015` |
| File | `Minecraft.ttf` (download button `title="5 K"`) |
| Comments | `25 comments` |

Colour/character badges beside the title: `€` (`<span title="Euro" class="contain">&euro;</span>`),
i.e. the page claims **Euro** coverage for this font.

Download endpoint as marked up:
`<a class="dl" title="5 K" href="//dl.dafont.com/dl/?f=minecraft" rel="nofollow">` — a
protocol-relative URL; resolved over HTTPS it is
<https://dl.dafont.com/dl/?f=minecraft>.

## Licence badge, verbatim

The licence badge is the only licence text on the font page itself:

> **100% Free**

marked up as
`<a class="tdn help black" style="cursor:help" target="_blank" href="./faq.php#copyright">100% Free</a>`
— it carries no `title` tooltip and links to DaFont's FAQ, section
`<a name="copyright"></a>Are all the fonts free of charge?`. The font page has no separate
licence/sentence block: the label alone is the licence declaration.

## Licence statement, verbatim (DaFont FAQ, the section the badge links to)

Retrieved from <https://www.dafont.com/faq.php> the same day (anchor `#copyright`):

> **Are all the fonts free of charge?**
> The fonts presented on this website are their authors' property, and are either freeware,
> shareware, demo versions or public domain. The licence mentioned above the download button
> is just an indication. Please look at the readme-files in the archives or check the
> indicated author's website for details, and contact him/her if in doubt.
> If no author/licence is indicated that's because we don't have information, that doesn't
> mean it's free.

## Files and SHA-256

| File | Bytes | SHA-256 |
|------|-------|---------|
| `src/assets/fonts/Minecraft.ttf` (committed) | 14,488 | `bd47314d301e50ff4d109bff28dfcf637cb7eb13945480259878b848875acc65` |
| `.tmp/font/minecraft.zip` (downloaded via the endpoint above, 2026-10-25 16:37:35 +08:00) | 4,932 | `243246ad4b5cd0cdd3088220d29c1ee7f1bdced2251fe8d58a128ae234f79443` |

The zip is a plain `PK` archive with exactly one local entry, `Minecraft.ttf`; the TTF
extracted from it hashes to
`bd47314d301e50ff4d109bff28dfcf637cb7eb13945480259878b848875acc65` — identical to the
committed file. The committed font is therefore the byte-for-byte file this listing
distributes.

## Font internals (parsed from the committed TTF, not from the page)

OpenType/TrueType `name` table (Macintosh `1/0/0` and Windows `3/1/1033` records agree):

- `nameID 0` copyright: **`CraftronGaming`**
- `nameID 1` family: **`Minecraft`**
- `nameID 2` subfamily: `Medium`
- `nameID 4` full name: `Minecraft`
- `nameID 5` version: `Version 001.000 `
- `nameID 6` PostScript name: `Minecraft`
- `nameID 3` unique id: `CraftronGaming:Minecraft`
- `OS/2` version 1, `achVendID` `2ttf`, `usWeightClass` 500
- `head.unitsPerEm` 1,024; `maxp.numGlyphs` **110**
- `OS/2.fsType` = **0** (`0x0000`): no embedding, no subsetting, no
  bitmap-only and no redistribution restriction bits are set.

Character map (`cmap` format 4, Unicode `0/3` and Windows `3/1`; a format 0 Macintosh
subtable also exists):

- **107 codepoints are mapped** in total.
- ASCII `U+0020`–`U+007E` is **complete** (95/95).
- The 12 non-ASCII codepoints are `U+00A0` NO-BREAK SPACE, `U+00A1`–`U+00A9`
  (`¡ ¢ £ ¤ ¥ ¦ § ¨ ©`), `U+20AC` EURO SIGN and `U+3000` IDEOGRAPHIC SPACE. There are
  **no accented letters** (no `é`, `ñ`, `ü`, …): the "extra" characters are Latin-1
  punctuation/symbol codepoints plus a euro sign and a full-width space.
- **Euro is present** (`U+20AC` mapped), consistent with the page's `€` badge.
- Not mapped: arrows (`U+2190`–`U+2193`), em dash `U+2014`, en dash `U+2013`, ellipsis
  `U+2026`, multiplication sign `U+00D7`, middle dot `U+00B7`, `≥` `U+2265`, `≤` `U+2264`.

## Cross-checks against the page

- Glyph count: the page says **110** (`View all glyphs (110)`); `maxp.numGlyphs` is also
  **110**, of which **107** are reachable through `cmap` (the remainder are unmapped,
  including `.notdef`). Both numbers are consistent — they count different things.
- Category, author, badge and download endpoint match the page's own markup; the page's
  `€` badge matches the mapped `U+20AC`.
- First-seen date `July 12, 2015` and the download button size `5 K` agree with a
  14,488-byte single-file archive.

## Status of this evidence

This snapshot **is the licence evidence that the committed `src/assets/fonts/Minecraft.ttf`
rests on**. The licence is the author's declaration on DaFont — the `100% Free` badge on
the listing, given meaning by DaFont's FAQ — and it is **not a separate signed agreement**
(or any other independently executed instrument): there is no licence file inside the
download archive, no EULA shipped with the font, and no licence statement on the author's
own site recorded here. DaFont itself states that the label "is just an indication", so the
declaration is a public listing statement by the author, not a negotiated grant. The
committed binary's own copyright string (`CraftronGaming`) and its `fsType == 0` field are
consistent with redistribution being unrestricted, but neither is a licence text.

No contradiction between the page and the font internals was found. Page facts that the
plan's summary numbers should be reconciled against: **110** glyphs on the page (110
glyphs in `maxp`, 107 mapped), and the font **does** contain the euro sign (`U+20AC`).
