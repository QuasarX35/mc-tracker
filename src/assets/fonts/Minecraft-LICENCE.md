# Minecraft font — provenance and licence record (EDICT-0013, F6)

The game's own bitmap-style face ships with the app at `src/assets/fonts/Minecraft.ttf`.
This file records where it came from, what its bytes are, and what licence claim exists for
it — so the claim can be audited later instead of living in a commit message.

## The file

| | |
| --- | --- |
| Path | `src/assets/fonts/Minecraft.ttf` |
| Size | 14,488 bytes |
| SHA-256 | `bd47314d301e50ff4d109bff28dfcf637cb7eb13945480259878b848875acc65` |
| Name table | family `Minecraft`, subfamily `Medium`, full name `Minecraft` |
| Embedding | `OS/2.fsType = 0` (installable embedding; the font restricts nothing) |
| Glyph coverage | 107 mapped codepoints |
| Licence records | none — no `nameID 13` (licence description), no `nameID 14` (licence URL) |

Glyph coverage is exactly: ASCII U+0020–U+007E (95 codepoints, complete) plus U+00A0–U+00A9,
U+20AC (Euro sign) and U+3000 (ideographic space). There are no accented letters, arrows,
dashes (em/en), ellipsis, multiplication sign, middle dot, or comparison symbols, so the app
keeps `Pixelify Sans` (`src/assets/fonts/PixelifySans-Medium.ttf`, OFL, see
`src/assets/fonts/PixelifySans-OFL.txt`) as the next face in the `--font-pixel` stack for any
glyph this TTF lacks.

## Where it came from

- Source: the DaFont listing <https://www.dafont.com/minecraft.font>, shown there as
  "Minecraft" by **Craftron Gaming** (Bitmap, 16 px, first seen 2015-07-12).
- Retrieved: 2026-10-25, from the listing's download endpoint
  `https://dl.dafont.com/dl/?f=minecraft`.
- Download archive SHA-256: `243246ad4b5cd0cdd3088220d29c1ee7f1bdced2251fe8d58a128ae234f79443`.
- The extracted `Minecraft.ttf` is byte-identical to the one above (same SHA-256), and its
  `numGlyphs` is 110 (107 mapped codepoints).
- The intake record with the listing text quoted verbatim is
  `raw/sources/2026-10-25-minecraft-font-licence.md`, sealed in `raw/manifest.json` by 太子.

## The licence claim, stated exactly

The DaFont listing displays the licence badge **"100% Free"** above the download button.
That badge is the only licence declaration shipped with this font: the archive contains no
licence file, the TTF carries no licence string, and no separate licence text was found.

DaFont's own FAQ, quoted in the intake record, says the licence mentioned above the download
button is *"just an indication"* and that the fonts are their authors' property — it is not a
signed agreement. This record therefore claims only this much:

- The author shown by the distributing site is **Craftron Gaming**.
- The distributing site labels the font **"100% Free"**.
- No further licence text, terms or author statement is available to quote.

The font is used as the game-flavoured display face for this non-commercial tracker; it is
not redistributed as a standalone font package. If the author or a formal licence statement
is found later, replace this record rather than guessing.

## Verification

```powershell
Get-FileHash src/assets/fonts/Minecraft.ttf -Algorithm SHA256
```

Expected `BD47314D301E50FF4D109BFF28DFCF637CB7EB13945480259878B848875ACC65`.
