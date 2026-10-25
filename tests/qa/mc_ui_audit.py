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


# ------------------------------------------------------------------ structure
def audit_structure() -> None:
    check("html/lang", 'lang="en"' in HTML, "document language declared")
    check("html/title", "<title>" in HTML and "Build Tracker" in HTML, "page title present")
    check("html/viewport", 'name="viewport"' in HTML, "responsive viewport declared")
    check("a11y/single-h1", len(re.findall(r"<h1\b", HTML)) == 1, "exactly one h1")
    check("a11y/main-landmark", '<main class="panel" id="main"' in HTML, "main landmark with focus target")
    check("a11y/skip-link", 'class="skip-link" href="#main"' in HTML, "skip link is the first control")
    check("a11y/tablist", HTML.count('role="tab"') == 3 and HTML.count('role="tabpanel"') == 3, "3 tabs / 3 panels")
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


def main() -> int:
    audit_contrast()
    audit_structure()
    for case, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} {case} — {detail}")
    failed = [case for case, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} cases passed")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
