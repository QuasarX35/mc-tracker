#!/usr/bin/env python3
"""UI audit for the Minecraft Build Tracker (测试部, EDICT-0005; extended in EDICT-0013).

Proves from source, without a browser, the parts a screenshot cannot:
  * WCAG 2.2 contrast for the token pairs the UI actually uses
  * structural accessibility invariants of src/index.html
  * the pixel/GUI contract (square, pixelated, offline)
  * the EDICT-0013 interaction contract: Minecraft font + sealed licence, the retired picker
    tabs, the needed steppers and their spinner-hiding CSS, the notes/title/coords controls,
    the material chooser, the themed base-select picker (plus the frozen probe artefact),
    the full-catalog accounting and the sharper panorama (D6/D7/D9/D10).

Run:  <dsh python> tests/qa/mc_ui_audit.py
Exit: 0 = all cases passed, 1 = at least one failure.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")
HTML = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
APP = (ROOT / "src" / "app.js").read_text(encoding="utf-8")
MODEL = (ROOT / "src" / "tracker" / "model.js").read_text(encoding="utf-8")

results: list[tuple[str, bool, str]] = []


def check(case: str, ok: bool, detail: str) -> None:
    results.append((case, ok, detail))


# ------------------------------------------------------------------ colour helpers
def srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4


def luminance(hexcolour: str) -> float:
    h = hexcolour.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return 0.2126 * srgb_to_linear(r) + 0.7152 * srgb_to_linear(g) + 0.0722 * srgb_to_linear(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def tokens() -> dict[str, str]:
    root = CSS.split(":root {", 1)[1].split("\n}", 1)[0]
    return {
        m.group(1): m.group(2).lower()
        for m in re.finditer(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", root)
    }


T = tokens()


def resolve_colour(value: str) -> str:
    """Resolve a single `var(--token)` reference to the hex declared in :root."""
    match = re.fullmatch(r"var\((--[a-z0-9-]+)\)", value.strip())
    return T.get(match.group(1), value.strip()) if match else value.strip()


def decl_value(declarations: str, prop: str) -> str | None:
    """Value of `prop` in a declaration block (last wins, like the cascade)."""
    found = re.findall(r"(?:^|[;{])\s*" + re.escape(prop) + r"\s*:\s*([^;}]+)", declarations)
    return found[-1].strip() if found else None

# (foreground token, background token, minimum ratio, kind, where)
PAIRS = [
    ("mc-text", "mc-panel", 4.5, "text", "labels and body copy on the GUI panel"),
    ("mc-text-muted", "mc-panel", 4.5, "text", "secondary copy (lede, meta, notes) on the panel"),
    ("mc-text", "mc-panel-dim", 4.5, "text", "table header cells"),
    ("mc-text-on-dark", "mc-row", 4.5, "text", "list rows and material rows"),
    ("mc-text-on-dark", "mc-row-alt", 4.5, "text", "alternating rows"),
    ("mc-text-on-dark", "mc-tip-bg", 4.5, "text", "tooltips and toasts"),
    ("mc-white", "mc-field", 4.5, "text", "text typed into a field"),
    ("mc-gold", "mc-bar-bg", 4.5, "text", "planned chip"),
    ("mc-aqua", "mc-bar-bg", 4.5, "text", "building chip"),
    ("mc-green", "mc-bar-bg", 4.5, "text", "done chip"),
    ("mc-white", "mc-lo-deep", 3.0, "boundary", "panel edge against the dirt backdrop"),
]


def audit_contrast() -> None:
    for fg, bg, minimum, kind, where in PAIRS:
        if fg not in T or bg not in T:
            check(f"contrast/{fg}-on-{bg}", False, f"token missing ({where})")
            continue
        ratio = contrast(T[fg], T[bg])
        check(
            f"contrast/{fg}-on-{bg}",
            ratio >= minimum,
            f"{ratio:.2f}:1 (min {minimum}, {kind}; {where})",
        )



def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def icon_globals(icons_js: str) -> dict[str, object]:
    """Parse the generated `window.MC_ICON_*` literals (array or object shapes)."""
    out: dict[str, object] = {}
    for name in ("MC_ICON_SET", "MC_ICON_NAMES", "MC_ICON_STACKS"):
        match = re.search(r"window\." + name + r"\s*=\s*([\[{][\s\S]*?[\]}]);", icons_js)
        out[name] = json.loads(match.group(1)) if match else None
    return out


# ------------------------------------------------------------------ icons
ICONS = ROOT / "src" / "assets" / "icons"
STACK_SAMPLES = {"stone": 64, "egg": 16, "bucket": 16, "water_bucket": 1, "diamond_sword": 1, "potion": 1, "slime_ball": 64}
LIGHTING_ENUM = ("block", "flat", "3d-other")


def audit_icons() -> None:
    manifest = json.loads((ICONS / "manifest.json").read_text(encoding="utf-8"))
    icons_js = (ICONS / "icons.js").read_text(encoding="utf-8")
    globals_ = icon_globals(icons_js)
    slugs = globals_["MC_ICON_SET"] or []
    names = globals_["MC_ICON_NAMES"] or {}
    stacks = globals_["MC_ICON_STACKS"] or {}
    source = manifest["source"]
    pixels = manifest.get("pixels", 0)
    by_slug = {icon["slug"]: icon for icon in manifest["icons"]}

    check("icons/count", len(slugs) >= 1363, f"{len(slugs)} icons declared (EDICT-0013 floor 1363)")
    check("icons/manifest", manifest["count"] == len(slugs) == len(manifest["icons"]),
          "manifest.count === MC_ICON_SET.length === icons.length")
    check(
        "icons/renders-accounting",
        manifest["renders"] - manifest["count"] == manifest["collapsed_variants"],
        f"{manifest['renders']} renders - {manifest['count']} icons = {manifest['collapsed_variants']} collapsed variants",
    )
    check("icons/curated-first", manifest.get("curated") == 53
          and len({icon["slug"] for icon in manifest["icons"][:53]}) == 53,
          "the curated 53 stay declared and first in ordering")
    check("icons/source-version", source["version"] == "1.21.4", "source game version recorded")
    check(
        "icons/high-resolution",
        pixels >= 128,
        f"icons are {pixels}px renders (EDICT-0011 needs >=128)",
    )
    check(
        "icons/render-mode",
        source.get("mode") == "hires-exports",
        "the high-resolution inventory-render mode is recorded",
    )
    check(
        "icons/renderer",
        "IconExporter" in source.get("renderer", ""),
        f"render provenance names the exporter ({source.get('renderer')})",
    )
    correction = source.get("lighting_correction") or {}
    target_factors = correction.get("target_vanilla_face_factors") or {}
    gains = correction.get("gains") or {}
    check(
        "icons/lighting-correction",
        correction.get("applied") is True
        and "IconExporter" in correction.get("reason", "")
        and "PR #41" in correction.get("reason", "")
        and abs(float(target_factors.get("top", 0)) - 0.99) < 1e-6
        and float(gains.get("top", 0)) > 1.0
        and float(gains.get("left", 0)) > 1.0
        and float(gains.get("right", 0)) < 1.0,
        "3D icon brightness is restored for the IconExporter 1.3.1 dark-lighting bug (PR #41)",
    )
    check(
        "icons/lighting-enum",
        all(icon.get("lighting") in LIGHTING_ENUM for icon in manifest["icons"]),
        "every icon declares lighting from the frozen enum block|flat|3d-other",
    )
    summary = manifest.get("lighting") or {}
    check(
        "icons/lighting-summary",
        set(summary) <= set(LIGHTING_ENUM) and sum(summary.values()) == manifest["count"],
        f"lighting summary covers the catalog: {summary}",
    )
    check(
        "icons/lighting-split",
        any(icon.get("lighting") == "block" for icon in manifest["icons"])
        and any(icon.get("lighting") == "flat" for icon in manifest["icons"])
        and all(by_slug.get(slug, {}).get("lighting") == "3d-other"
                for slug in ("anvil", "chest", "torch") if slug in by_slug)
        and by_slug.get("furnace", {}).get("lighting") == "block"
        and by_slug.get("hopper", {}).get("lighting") == "flat",
        "3D props take 3d-other, full cubes block, flat sprites untouched; hopper is flat in 1.21.4 (disclosed)",
    )
    check(
        "icons/stack-table",
        isinstance(stacks, dict)
        and len(stacks) == manifest["count"]
        and all(stacks.get(icon["slug"]) == icon.get("stack") for icon in manifest["icons"])
        and all(by_slug.get(slug, {}).get("stack") == size for slug, size in STACK_SAMPLES.items()
                if slug in by_slug),
        "MC_ICON_STACKS covers every icon and the frozen stack samples match",
    )
    check(
        "icons/stack-groups",
        sum((manifest.get("stack_groups") or {}).values()) == manifest["count"],
        "the stack groups partition the catalog",
    )
    if isinstance(names, list):
        names_ok = len(names) == len(slugs) and all(
            names[i] == by_slug[slug]["name"] for i, slug in enumerate(slugs)
        )
    else:
        names_ok = isinstance(names, dict) and len(names) == manifest["count"] and all(
            names.get(icon["slug"]) == icon["name"] for icon in manifest["icons"]
        )
    check("icons/names-complete", names_ok, "one display name per icon, agreeing with the manifest")
    check(
        "icons/source-pattern",
        all(
            icon.get("image") == icon["slug"] + ".png"
            and re.match(r"icon-exports-x256/minecraft__[^/]+\.png$", str(icon.get("source", "")).replace("\\", "/"))
            and re.fullmatch(r"[0-9a-f]{64}", str(icon.get("sha256", "")))
            for icon in manifest["icons"]
        ),
        "every icon carries image, exporter source and a sha256 digest",
    )
    check(
        "icons/local-install",
        ".minecraft" in source.get("jar", ""),
        "provenance points at the local client install",
    )
    check(
        "icons/export-source",
        "icon-exports" in source.get("exports", ""),
        "provenance names the local IconExporter export folder",
    )
    provenance = (ICONS / "PROVENANCE.md").read_text(encoding="utf-8")
    check("icons/mojang", "Mojang" in provenance, "rights holder named")
    check(
        "icons/no-redistribution",
        re.search(r"not[\s\S]{0,80}redistribut", provenance, re.IGNORECASE) is not None,
        "notice states the assets are not redistributed",
    )
    check("icons/fallback", "wireIconFallbacks" in APP, "missing icons degrade to lettered slots")
    gitignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
    check("icons/gitignored", "src/assets/icons/*.png" in gitignore, "vanilla PNGs are not committed")
    check(
        "icons/smooth-rendering",
        re.search(r"\.slot img\s*\{[^}]*image-rendering:\s*auto", CSS) is not None
        and re.search(r"\.avatar img\s*\{[^}]*image-rendering:\s*auto", CSS) is not None,
        "256px item renders are displayed smoothly downscaled, not nearest-neighbour",
    )
    check(
        "icons/textures-pixelated",
        "image-rendering: pixelated" in CSS,
        "tiled block textures keep their nearest-neighbour pixel contract",
    )
    pngs = sorted(ICONS.glob("*.png"))
    if not pngs:
        check("icons/generated", True, "not generated on this machine (manifest-only contract)")
        return
    check("icons/generated", len(pngs) == len(slugs), f"{len(pngs)} PNGs for {len(slugs)} slugs")
    expected = pixels or 256
    dimensions_ok = expected >= 128
    for path in pngs:
        head = path.read_bytes()[:24]
        if head[:4] != b"\x89PNG":
            dimensions_ok = False
        elif (
            int.from_bytes(head[16:20], "big") != expected
            or int.from_bytes(head[20:24], "big") != expected
        ):
            dimensions_ok = False
    check("icons/high-resolution-pngs", dimensions_ok, f"every generated icon is a {expected}x{expected} PNG")



# ------------------------------------------------------------------ structure
def audit_structure() -> None:
    check("html/lang", 'lang="en"' in HTML, "document language declared")
    check("html/title", "<title>" in HTML and "Build Tracker" in HTML, "page title present")
    check("html/viewport", 'name="viewport"' in HTML, "responsive viewport declared")
    check("a11y/single-h1", len(re.findall(r"<h1\b", HTML)) == 1, "exactly one h1")
    check("a11y/main-landmark", '<main class="panel" id="main"' in HTML, "main landmark with focus target")
    check("a11y/skip-link", 'class="skip-link" href="#main"' in HTML, "skip link is the first control")
    section_tabs = len(re.findall(r'class="tab"[^>]*role="tab"', HTML))
    section_panels = len(re.findall(r'role="tabpanel" aria-labelledby="tab-', HTML))
    picker_tabs = len(re.findall(r'class="picker-tab', HTML))
    check(
        "a11y/tablist",
        section_tabs == 3 and section_panels == 3 and picker_tabs == 0,
        f"{section_tabs} section tabs / {section_panels} panels / {picker_tabs} picker tabs (D7 removed the pair)",
    )
    check(
        "a11y/picker-tabs-retired",
        not re.search(r"icon-tab-item|icon-tab-image|icon-pane-item|icon-pane-image|picker-tabs|picker-pane", HTML),
        "the redundant Item/Image picker tabs are deleted, not hidden (D7)",
    )
    check(
        "a11y/tab-controls",
        all(
            f'aria-controls="{panel}"' in HTML
            for panel in ("view-builds", "view-materials", "view-worlds")
        ),
        "each tab points at its panel",
    )
    check("a11y/live-region", 'aria-live="polite"' in HTML, "status line and toast are announced")
    check("a11y/progressbar", HTML.count('role="progressbar"') >= 2, "progress bars expose their role")
    check(
        "a11y/no-inline-handlers",
        not re.search(r"\son(click|change|submit|input)=", HTML, re.IGNORECASE),
        "no inline handlers (CSP-friendly, events bound in app.js)",
    )
    buttons_without_type = [
        m.group(0)[:60]
        for m in re.finditer(r"<button\b[^>]*>", HTML)
        if 'type="' not in m.group(0)
    ]
    check("html/button-types", not buttons_without_type, f"<button> elements without type: {len(buttons_without_type)}")
    check("html/offline", not re.search(r"https?://", HTML + CSS + APP), "no remote URLs anywhere in the app")
    font_face = re.search(r"@font-face\s*\{[^}]*font-family:\s*'Minecraft'[^}]*\}", CSS)
    check(
        "html/local-font",
        font_face is not None and "assets/fonts/Minecraft.ttf" in CSS,
        "the bundled Minecraft face is declared locally (no CDN)",
    )
    check(
        "html/font-stack",
        re.search(r"--font-pixel:\s*'Minecraft'\s*,\s*'Pixelify'\s*,", CSS) is not None,
        "--font-pixel puts Minecraft first with the Pixelify fallback for the glyph gap (D1)",
    )
    check(
        "html/font-licence",
        (ROOT / "src" / "assets" / "fonts" / "Minecraft-LICENCE.md").is_file(),
        "the font ships with its licence note (F6)",
    )
    check("html/pixelated", "image-rendering: pixelated" in CSS, "pixel art scales nearest-neighbour")
    check("html/square", "border-radius" not in CSS, "no rounded corners (Minecraft GUI is square)")
    check("html/reduced-motion", "prefers-reduced-motion" in CSS, "motion can be disabled")
    check("html/focus-visible", ":focus-visible" in CSS, "keyboard focus is visible")

    # ---------------------------------------------------------- EDICT-0013 controls (D2-D5, D7-D9)
    for element in (
        "build-rename", "build-name-save", "build-name-cancel", "copy-coords",
        "notes-text", "notes-edit", "notes-save", "notes-cancel",
        "mat-choice", "mat-choice-slot", "mat-choice-name", "mat-item", "mat-error",
        "icon-upload", "icon-count-hint", "icon-dialog-title",
    ):
        check(f"html/control-{element}", f'id="{element}"' in HTML, f"#{element} exists under its frozen name")
    mat_item_tag = re.search(r"<input[^>]*id=\"mat-item\"[^>]*>", HTML)
    check(
        "html/mat-item-hidden",
        mat_item_tag is not None and 'type="hidden"' in mat_item_tag.group(0),
        "#mat-item stays in the DOM as the hidden value input (D8)",
    )
    mat_error_tag = re.search(r"<[^>]*id=\"mat-error\"[^>]*>", HTML)
    check(
        "html/mat-error-alert",
        mat_error_tag is not None and 'role="alert"' in mat_error_tag.group(0),
        "the add-material error is announced inline (role=alert)",
    )
    check("html/no-datalist", "item-options" not in HTML, "the #item-options datalist is retired (D8)")
    check(
        "html/notes-view-text",
        'class="notes__text"' in HTML or "notes__text" in APP,
        "the notes view renders a text paragraph, not a textarea (D4)",
    )
    notes_text_tag = re.search(r"<[^>]*id=\"notes-text\"[^>]*>", HTML)
    check(
        "html/notes-empty-default",
        notes_text_tag is not None or "No notes yet." in APP + HTML,
        "the empty notes state is the muted 'No notes yet.'",
    )
    check(
        "html/steppers",
        ".mat-steps" in CSS and ".mat-step" in CSS and "data-step" in APP and "MC_ICON_STACKS" in APP,
        "each material row renders the six-button stepper cluster from the stack table (D5)",
    )
    check(
        "html/spinners-hidden",
        re.search(r"::-webkit-inner-spin-button\s*\{[^}]*-webkit-appearance:\s*none", CSS) is not None
        and "::-webkit-outer-spin-button" in CSS
        and re.search(r"-moz-appearance:\s*textfield", CSS) is not None,
        "native number spinners are hidden by CSS only (AC5b)",
    )
    check(
        "html/needed-number",
        re.search(r'type="number"[^>]{0,200}data-mat-field="needed"', APP) is not None,
        "the Needed input stays type=number (AC5b)",
    )
    check(
        "html/step-clamp",
        re.search(r"function stepNeeded[\s\S]{0,240}Math\.max\(1", MODEL) is not None
        and "Needed must be at least 1." in MODEL,
        "needed clamps at 1 through one model path (D5)",
    )
    check("html/copy-coords-behaviour", "Coordinates copied" in APP, "the copy button's toast is wired")
    picker_css = "".join(m.group(1) for m in re.finditer(r"::picker\(select\)\s*\{([^}]*)\}", CSS))
    background = decl_value(picker_css, "background-color") or decl_value(picker_css, "background")
    border = decl_value(picker_css, "border") or decl_value(picker_css, "border-top")
    border_colour = None
    if border:
        hex_match = re.search(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", border)
        var_match = re.search(r"var\(--[a-z0-9-]+\)", border)
        if hex_match:
            digits = hex_match.group(1).lower()
            border_colour = "#" + (digits if len(digits) == 6 else "".join(ch * 2 for ch in digits))
        elif var_match:
            border_colour = resolve_colour(var_match.group(0)).lower()
    font_family = decl_value(picker_css, "font-family") or ""
    check(
        "html/base-select",
        re.search(r"@supports\s*\(\s*appearance:\s*base-select\s*\)", CSS) is not None
        and re.search(r"appearance:\s*base-select", CSS) is not None,
        "the dropdown theme is gated behind @supports(appearance: base-select) (D9)",
    )
    check(
        "html/picker-panel-theme",
        background is not None and resolve_colour(background).lower() == "#6f6f6f"
        and border_colour == "#000000"
        and ("Pixelify" in font_family or "Minecraft" in font_family or "var(--font-pixel)" in font_family),
        f"::picker(select) takes the themed panel face (background={background}, border={border}, font={font_family})",
    )
    check(
        "html/picker-icon-hidden",
        re.search(r"::picker-icon\s*\{[^}]*display:\s*none", CSS) is not None,
        "the native picker arrow is hidden inside the themed select",
    )
    check(
        "html/mobile",
        "max-width: 640px" in CSS and "max-width: 900px" in CSS,
        "two responsive breakpoints shipped",
    )



# ------------------------------------------------------------------ identity
def audit_identity() -> None:
    html_files = {
        "index": HTML,
        "css": CSS,
        "app": APP,
        "readme": (ROOT / "README.md").read_text(encoding="utf-8"),
        "gitignore": (ROOT / ".gitignore").read_text(encoding="utf-8"),
    }
    for element in (
        "world-avatar", "icon-dialog", "icon-grid", "icon-file", "detail-avatar", "build-dlg-icon",
        "icon-upload", "icon-count-hint", "icon-dialog-title", "mat-choice", "copy-coords", "build-rename",
    ):
        check(f"identity/html-{element}", f'id="{element}"' in HTML, f'#{element} exists in the page')
    for symbol in ("avatarHtml", "processImageFile", "renderIconPicker", "useIconDraft", "probeBackdrop"):
        check(f"identity/app-{symbol}", f"function {symbol}" in APP, f"{symbol}() implemented")
    check("identity/app-step-needed", "function stepNeeded" in MODEL, "the stepper arithmetic lives in the model")
    check(
        "identity/app-no-icon-mode",
        "setIconMode" not in APP and "iconMode" not in APP,
        "the retired item/image switcher is deleted, not orphaned (D7)",
    )
    for selector in (".avatar", ".icon-grid", ".icon-tile", ".detail__avatar", ".notes__text", ".mat-steps"):
        check(f"identity/css-{selector}", selector in CSS, f"{selector} styled")
    check("identity/css-no-picker-tab", ".picker-tab" not in CSS, "retired picker tab styles are gone (D7)")
    check("identity/panorama-layer", ":root.has-panorama .backdrop::before" in CSS, "panorama layer only when detected")
    check("identity/panorama-pan", "@keyframes panorama-drift" in CSS, "slow pan keyframes exist")
    check("identity/reduced-motion", "animation: none" in CSS, "motion can be disabled")
    check("identity/scrim", "--backdrop-scrim-alpha" in CSS, "text scrim token exists")
    check("identity/gitignore-pixels", "src/assets/panorama/*.webp" in html_files["gitignore"], "generated backdrop not committed")
    panorama = ROOT / "src" / "assets" / "panorama"
    check("identity/panorama-manifest", (panorama / "manifest.json").is_file(), "backdrop manifest committed")
    provenance = panorama / "PROVENANCE.md"
    check("identity/panorama-provenance", provenance.is_file() and "Mojang" in provenance.read_text(encoding="utf-8"), "backdrop provenance names the rights holder")
    check("identity/extractor", (ROOT / "scripts" / "mc-backdrop.py").is_file(), "backdrop extractor shipped")
    check("identity/readme-setup", "mc-backdrop.py" in html_files["readme"], "setup documented")


# -------------------------------------------------------- EDICT-0013 contracts
TTF = ROOT / "src" / "assets" / "fonts" / "Minecraft.ttf"
TTF_SHA256 = "bd47314d301e50ff4d109bff28dfcf637cb7eb13945480259878b848875acc65"
RAW_PAGE_SHA256 = "2e06df49ff9c3043d7ba28b3ac9849a59672a5f5f3ee587a6d6c057be0f5eba7"
PANORAMA = ROOT / "src" / "assets" / "panorama"
PROBE = ROOT / "reports" / "qa" / "evidence" / "edict-0013" / "picker-probe.json"


def audit_edict0013() -> None:
    """The source-level half of AC1, AC9 and AC10 (D1/D9/D10)."""
    licence = (ROOT / "src" / "assets" / "fonts" / "Minecraft-LICENCE.md").read_text(encoding="utf-8")
    check(
        "font/ttf-bytes",
        TTF.is_file() and sha256_file(TTF) == TTF_SHA256,
        "src/assets/fonts/Minecraft.ttf is the 14,488-byte DaFont file (sha256 matches the record)",
    )
    check(
        "font/licence-record",
        TTF_SHA256 in licence
        and "14,488" in licence
        and "fsType = 0" in licence
        and "100% Free" in licence
        and "DaFont" in licence
        and "107" in licence
        and "U+20AC" in licence,
        "the licence record names bytes, size, embedding flag, DaFont claim, 107 codepoints and the euro sign",
    )
    check(
        "font/page-vs-cmap",
        "110" in licence and ("numGlyphs" in licence or "maxp" in licence),
        "the record distinguishes the page's 110 glyph claim from the 107 mapped codepoints (F6)",
    )
    raw_manifest = json.loads((ROOT / "raw" / "manifest.json").read_text(encoding="utf-8"))
    sealed = (raw_manifest.get("files") or {}).get("sources/2026-10-25-minecraft-font-licence.md")
    check(
        "font/raw-seal",
        sealed == RAW_PAGE_SHA256,
        "the write-once DaFont intake page is sealed in raw/manifest.json (F6)",
    )
    page = ROOT / "raw" / "sources" / "2026-10-25-minecraft-font-licence.md"
    check(
        "font/raw-page",
        page.is_file() and "Craftron Gaming" in page.read_text(encoding="utf-8"),
        "the sealed page names the author and the licence badge",
    )
    check(
        "font/pixelify-fallback",
        (ROOT / "src" / "assets" / "fonts" / "PixelifySans-Medium.ttf").is_file(),
        "Pixelify Sans stays bundled as the fallback for the glyph gap",
    )

    panorama = json.loads((PANORAMA / "manifest.json").read_text(encoding="utf-8"))
    compose = panorama.get("compose") or {}
    output = panorama.get("output") or {}
    blur = float(compose.get("blur_radius", 99))
    check(
        "panorama/blur-baked",
        blur == 2.5,
        f"the regeneration bakes the frozen blur_radius {blur} (was 8; D10 freezes 2.5)",
    )
    check(
        "panorama/composition",
        compose.get("width") == 2560
        and compose.get("height") == 640
        and compose.get("faces") == 4
        and compose.get("pan_seconds", 0) > 0
        and len(panorama.get("inputs") or []) == 4,
        "four-face 2560x640 backdrop composition unchanged apart from the blur",
    )
    css_blur = re.search(
        r":root\.has-panorama \.backdrop::before\s*\{[^}]*filter:\s*blur\(([\d.]+)px\)", CSS
    )
    check(
        "panorama/css-blur",
        css_blur is not None and float(css_blur.group(1)) <= 1,
        f"the CSS layer blurs {css_blur.group(1) if css_blur else '?'}px (D10 ceiling 1px)",
    )
    mobile_blur = re.search(
        r"@media \(max-width: 640px\)[\s\S]{0,800}?blur\(([\d.]+)px\)", CSS
    )
    check(
        "panorama/css-blur-mobile",
        mobile_blur is not None and float(mobile_blur.group(1)) <= 1.5,
        f"the narrow-screen layer blurs <=1.5px (found {mobile_blur.group(1) if mobile_blur else '?'}px)",
    )
    generator = (ROOT / "scripts" / "mc-backdrop.py").read_text(encoding="utf-8")
    check(
        "panorama/generator",
        re.search(r"blur[^\n]{0,80}(?:radius|r)", generator, re.IGNORECASE) is not None
        and "max(4" not in generator,
        "the generator's blur floor is removed (no hardcoded 4px minimum)",
    )

    # AC9: the headless browser cannot open a native <select> popup, so the Lead records
    # CSS.supports + the computed ::picker(select) values against the same Chrome binary
    # that the app-qa stamp was made with (F4).
    check(
        "picker/probe-artifact",
        PROBE.is_file(),
        "reports/qa/evidence/edict-0013/picker-probe.json exists (F4 precondition for AC9)",
    )
    if PROBE.is_file():
        probe_text = PROBE.read_text(encoding="utf-8").lower()
        check(
            "picker/probe-supports",
            "base-select" in probe_text and re.search(r'"supports"\s*:\s*false', probe_text) is None,
            "the probe records that appearance:base-select is supported",
        )
        check(
            "picker/probe-chrome",
            "155" in probe_text,
            "the probe records the pinned Chrome 155 binary (F4)",
        )
        check(
            "picker/probe-values",
            ("111, 111, 111" in probe_text or "#6f6f6f" in probe_text)
            and ("0, 0, 0" in probe_text or "#000000" in probe_text)
            and "minecraft" in probe_text,
            "the probe records the themed panel face, black border and Minecraft type",
        )



def main() -> int:
    audit_contrast()
    audit_structure()
    audit_icons()
    audit_identity()
    audit_edict0013()
    for case, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} {case} — {detail}")
    failed = [case for case, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} cases passed")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
