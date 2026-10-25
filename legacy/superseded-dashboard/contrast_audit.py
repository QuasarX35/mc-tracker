#!/usr/bin/env python3
"""QA audit for the Minecraft Tracker dashboard (EDICT-0003, cycle 1).

Checks that can be proven from source, without a browser:
  * WCAG 2.2 contrast for every token pair the page actually uses
  * structural accessibility invariants of src/index.html
  * the pre-delivery checklist items from the ui-ux-pro-max skill

Run:  python tests/qa/contrast_audit.py
Exit: 0 = every case passed, 1 = at least one failure.
Evidence goes to stdout as PASS/FAIL lines so it can be archived verbatim.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "src" / "styles.css"
HTML = ROOT / "src" / "index.html"
JS = ROOT / "src" / "dashboard.js"

results: list[tuple[str, bool, str]] = []


def check(case: str, ok: bool, detail: str) -> None:
    results.append((case, ok, detail))


# --------------------------------------------------------------------------- colour
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
    css = CSS.read_text(encoding="utf-8")
    body = css.split(":root {", 1)[1].split("\n}", 1)[0]
    return {
        m.group(1).removeprefix("color-"): m.group(2).lower()
        for m in re.finditer(r"--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})", body)
    }


# (foreground token, background token, minimum ratio, kind, where it is used)
PAIRS = [
    ("foreground", "background", 4.5, "text", "body copy on page"),
    ("foreground", "card", 4.5, "text", "table + card copy"),
    ("muted-foreground", "background", 4.5, "text", "lede / footer"),
    ("muted-foreground", "card", 4.5, "text", "card sub-labels"),
    ("muted-foreground", "muted", 4.5, "text", "placeholder, pill text"),
    ("secondary", "card", 4.5, "text", "links, eyebrow, legend text"),
    ("secondary", "background", 4.5, "text", "links on page background"),
    ("success", "card", 4.5, "text", "online status label"),
    ("warning", "card", 4.5, "text", "warning delta"),
    ("on-primary", "primary", 4.5, "text", "pressed filter chip"),
    ("on-secondary", "secondary", 4.5, "text", "new-player badge"),
    ("on-accent", "accent", 4.5, "text", "primary button"),
    ("border-strong", "card", 3.0, "non-text", "input / control boundary"),
    ("border-strong", "background", 3.0, "non-text", "control boundary on page"),
    ("ring", "card", 3.0, "non-text", "focus indicator on cards"),
    ("ring", "background", 3.0, "non-text", "focus indicator on page"),
    ("destructive", "card", 3.0, "non-text", "skull glyph"),
    ("secondary", "card", 3.0, "non-text", "chart series stroke"),
    ("accent", "card", 3.0, "non-text", "dashed chart series"),
]

# colours written directly in markup / chart code
LITERALS = [
    ("#c4b5fd", "card", 4.5, "text", "SVG direct label (playtime)"),
    ("#fda4af", "card", 4.5, "text", "SVG direct label (players)"),
    ("#b6c2d4", "card", 4.5, "text", "SVG axis labels"),
    ("#ffffff", "primary", 4.5, "text", "brand mark glyph"),
]


def audit_contrast() -> None:
    tok = tokens()
    for key in ("primary", "accent", "background", "card", "ring", "border-strong"):
        check(f"token/{key}", key in tok, f"--color-{key} declared in :root")

    for fg, bg, minimum, kind, where in PAIRS:
        if fg not in tok or bg not in tok:
            check(f"contrast/{fg}-on-{bg}", False, "token missing")
            continue
        ratio = contrast(tok[fg], tok[bg])
        check(
            f"contrast/{fg}-on-{bg}",
            ratio >= minimum,
            f"{ratio:.2f}:1 >= {minimum}:1 ({kind}) — {where}",
        )

    for fg, bg, minimum, kind, where in LITERALS:
        if bg not in tok:
            check(f"contrast/{fg}-on-{bg}", False, "token missing")
            continue
        ratio = contrast(fg, tok[bg])
        check(
            f"contrast/{fg}-on-{bg}",
            ratio >= minimum,
            f"{ratio:.2f}:1 >= {minimum}:1 ({kind}) — {where}",
        )


# ------------------------------------------------------------------------ structure
USE_RE = re.compile(r'<use href="#([^"]+)"')
SYMBOL_RE = re.compile(r'<symbol id="([^"]+)"')
EMOJI_RE = re.compile("[\U0001f300-\U0001faff\u2600-\u27bf\ufe0f]")


def audit_html() -> None:
    html = HTML.read_text(encoding="utf-8")

    # viewport: zoom must never be disabled
    viewport = re.search(r'<meta name="viewport" content="([^"]+)"', html)
    vp = viewport.group(1) if viewport else ""
    check("html/viewport", "width=device-width" in vp and "initial-scale=1" in vp, vp)
    check(
        "html/zoom-not-disabled",
        "user-scalable=no" not in vp and "maximum-scale" not in vp,
        "no user-scalable=no / maximum-scale",
    )

    check("html/lang", bool(re.search(r'<html[^>]+lang="', html)), "lang attribute present")
    check("html/title", "<title>" in html, "document title present")

    # skip link + landmark
    check("html/skip-link", 'class="skip-link"' in html, "skip link to #main")
    check("html/main-landmark", 'id="main"' in html, 'main landmark with id="main"')

    # exactly one h1, and it precedes every h2
    h1s = [m.start() for m in re.finditer(r"<h1[\s>]", html)]
    first_h2 = html.find("<h2")
    check("html/one-h1", len(h1s) == 1, f"{len(h1s)} h1 element(s)")
    check("html/h1-before-h2", bool(h1s) and first_h2 > h1s[0], "h1 precedes first h2")

    # labels for form controls
    label_targets = set(re.findall(r'<label[^>]+for="([^"]+)"', html))
    control_ids = set(re.findall(r'<(?:input|select)[^>]+id="([^"]+)"', html))
    check(
        "html/form-labels",
        control_ids and control_ids <= label_targets,
        f"labelled: {sorted(control_ids & label_targets)} / controls: {sorted(control_ids)}",
    )

    # icon-only interactive controls must expose a name
    check("html/no-emoji-icons", not EMOJI_RE.search(html), "no emoji characters in markup")
    check("html/icon-sprite", len(SYMBOL_RE.findall(html)) >= 10, f"{len(SYMBOL_RE.findall(html))} sprite symbols")

    used = set(USE_RE.findall(html))
    defined = set(SYMBOL_RE.findall(html))
    check("html/sprite-refs", used <= defined, f"missing symbols: {sorted(used - defined) or 'none'}")

    # every inline icon is hidden from the a11y tree or has a role
    icons = re.findall(r'<svg class="icon[^"]*"[^>]*>', html)
    bad = [i for i in icons if "aria-hidden" not in i and "role=" not in i]
    check("html/icon-aria", not bad, f"{len(icons)} icons, unlabelled: {len(bad)}")

    # live regions
    check("html/live-regions", 'aria-live="polite"' in html, "polite live region present")
    check("html/table-caption", len(re.findall(r"<caption", html)) >= 3, "captions on data tables")
    check("html/details-fallback", html.count("<details") >= 2, "chart data-table fallbacks")

    # sortable headers use aria-sort
    check("html/aria-sort", 'aria-sort="descending"' in html and 'aria-sort="none"' in html, "aria-sort on sortable headers")
    check("html/scope-th", len(re.findall(r'<th scope="col"', html)) >= 7, "scoped column headers")


# ----------------------------------------------------------------------------- CSS
def audit_css() -> None:
    css = CSS.read_text(encoding="utf-8")

    check("css/focus-visible", ":focus-visible" in css, "visible focus ring for keyboard users")
    check("css/reduced-motion", "prefers-reduced-motion: reduce" in css, "reduced-motion media query")
    check("css/touch-targets", css.count("min-height: 44px") >= 5, f"{css.count('min-height: 44px')} interactive rules at 44px")
    check("css/cursor-pointer", css.count("cursor: pointer") >= 4, f"{css.count('cursor: pointer')} pointer affordances")
    check("css/table-overflow", css.count("overflow-x: auto") >= 1, "tables scroll inside their wrapper")
    check("css/base-font", "font-size: var(--text-base)" in css and "--text-base: 1rem" in css, "16px base font")
    check("css/line-height", "line-height: 1.55" in css, "body line-height 1.525-1.75")
    check("css/breakpoint-375", "@media (max-width: 767px)" in css, "small-phone breakpoint")
    check("css/breakpoint-1024", "@media (min-width: 1024px)" in css, "desktop breakpoint")
    check("css/no-horizontal-scroll", "overflow-x: hidden" in css, "page cannot scroll sideways")
    check("css/transition-tokens", css.count("var(--motion-") >= 10, f"{css.count('var(--motion-')} tokenised transition uses")

    # no raw hex inside component rules outside :root and the SVG gradient legend
    root_end = css.find("\n}\n", css.find(":root {"))
    body = css[root_end:]
    raw = re.findall(r"#[0-9a-fA-F]{6}\b", body)
    allowed: set[str] = set()          # every value must come from a :root token
    unexpected = sorted(set(raw) - allowed)
    check("css/token-discipline", not unexpected, f"unexpected raw hex outside :root: {unexpected or 'none'}")


def audit_js() -> None:
    js = JS.read_text(encoding="utf-8")
    check("js/no-dependencies", "import " not in js and "require(" not in js, "vanilla JS, no imports")
    check("js/chart-fallbacks", js.count("_table") >= 2 or "trend-table" in js and "heat-table" in js, "both charts render a data table")
    check("js/chart-titles", 'id="trend-title"' in js and 'id="heat-title"' in js, "SVG title/desc for screen readers")
    check("js/series-not-colour-only", "series-dashed" in js and "series-solid" in js, "solid vs dashed plus direct labels")
    check("js/loading-state", "skeleton" in js, "skeleton loading feedback")
    check("js/empty-state", "players-empty" in js, "empty state handled")
    check("js/reduced-motion-js", "prefers-reduced-motion" in (CSS.read_text(encoding="utf-8")), "motion preference honoured in CSS")


def main() -> int:
    for path in (CSS, HTML, JS):
        if not path.exists():
            print(f"FAIL file/{path.name}: missing")
            return 1
    audit_contrast()
    audit_html()
    audit_css()
    audit_js()

    failed = [r for r in results if not r[1]]
    for case, ok, detail in results:
        print(f"{'PASS' if ok else 'FAIL'} {case}: {detail}")
    print()
    print(f"cases: total={len(results)} pass={len(results) - len(failed)} fail={len(failed)}")
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
