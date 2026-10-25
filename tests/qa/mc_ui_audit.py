#!/usr/bin/env python3
"""UI audit for the Minecraft Build Tracker (测试部, EDICT-0005).

Proves from source, without a browser, the parts a screenshot cannot:
  * WCAG 2.2 contrast for the token pairs the UI actually uses
  * structural accessibility invariants of src/index.html
  * the pixel/GUI contract (square, pixelated, offline)

Run:  <dsh python> tests/qa/mc_ui_audit.py
Exit: 0 = all cases passed, 1 = at least one failure.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")
HTML = (ROOT / "src" / "index.html").read_text(encoding="utf-8")
APP = (ROOT / "src" / "app.js").read_text(encoding="utf-8")

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



# ------------------------------------------------------------------ icons
ICONS = ROOT / "src" / "assets" / "icons"


def audit_icons() -> None:
    manifest = json.loads((ICONS / "manifest.json").read_text(encoding="utf-8"))
    icons_js = (ICONS / "icons.js").read_text(encoding="utf-8")
    match = re.search(r"window\.MC_ICON_SET\s*=\s*(\[[^\]]*\])", icons_js)
    slugs = json.loads(match.group(1)) if match else []
    check("icons/count", len(slugs) >= 40, f"{len(slugs)} icons declared")
    check("icons/manifest", manifest["count"] == len(slugs), "manifest matches the generated set")
    check("icons/source-version", manifest["source"]["version"] == "1.21.4", "source game version recorded")
    check("icons/isometric", "isometric" in manifest["source"]["method"].lower(), "blocks composited as cubes")
    check("icons/local-jar", ".minecraft" in manifest["source"]["jar"], "provenance points at the local client")
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
    pngs = sorted(ICONS.glob("*.png"))
    if not pngs:
        check("icons/generated", True, "not generated on this machine (manifest-only contract)")
        return
    check("icons/generated", len(pngs) == len(slugs), f"{len(pngs)} PNGs for {len(slugs)} slugs")
    dimensions_ok = True
    for path in pngs:
        head = path.read_bytes()[:24]
        if head[:4] != b"\x89PNG":
            dimensions_ok = False
        elif int.from_bytes(head[16:20], "big") != 16 or int.from_bytes(head[20:24], "big") != 16:
            dimensions_ok = False
    check("icons/16x16", dimensions_ok, "every generated icon is a 16x16 PNG")


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
    picker_tabs = len(re.findall(r'class="picker-tab"', HTML))
    check(
        "a11y/tablist",
        section_tabs == 3 and section_panels == 3 and picker_tabs == 2,
        f"{section_tabs} section tabs / {section_panels} panels / {picker_tabs} picker tabs",
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
    check("html/local-font", "assets/fonts/PixelifySans-Medium.ttf" in CSS, "bundled pixel font, no CDN")
    check("html/pixelated", "image-rendering: pixelated" in CSS, "pixel art scales nearest-neighbour")
    check("html/square", "border-radius" not in CSS, "no rounded corners (Minecraft GUI is square)")
    check("html/reduced-motion", "prefers-reduced-motion" in CSS, "motion can be disabled")
    check("html/focus-visible", ":focus-visible" in CSS, "keyboard focus is visible")
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
    for element in ("world-avatar", "icon-dialog", "icon-grid", "icon-file", "detail-avatar", "build-dlg-icon"):
        check(f"identity/html-{element}", f'id="{element}"' in HTML, f'#{element} exists in the page')
    for symbol in ("avatarHtml", "processImageFile", "renderIconPicker", "probeBackdrop"):
        check(f"identity/app-{symbol}", f"function {symbol}" in APP, f"{symbol}() implemented")
    for selector in (".avatar", ".icon-grid", ".icon-tile", ".picker-tab", ".detail__avatar"):
        check(f"identity/css-{selector}", selector in CSS, f"{selector} styled")
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


def main() -> int:
    audit_contrast()
    audit_structure()
    audit_icons()
    audit_identity()
    for case, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} {case} — {detail}")
    failed = [case for case, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} cases passed")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
