#!/usr/bin/env python3
"""
Render a Google Ads preview HTML file to PNG(s) using Playwright.

By default renders the whole page to one PNG. Pass --split to also export each
preview element separately (each device frame for search ads, each banner for
display ads), which is what you usually want for dropping into a deck.

Usage:
  python render_png.py preview.html                 # -> preview.png (full page)
  python render_png.py preview.html -o out.png      # full page to out.png
  python render_png.py preview.html --split         # full page + one PNG per element
  python render_png.py preview.html --split --selector ".banner-wrap"

The environment already has Chromium (PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers);
do NOT run `playwright install`. If Playwright's default lookup fails, the script
falls back to that path automatically.
"""
import argparse
import os
import sys
from pathlib import Path


def _launch(p):
    """Launch Chromium, falling back to the preinstalled browser path if needed."""
    try:
        return p.chromium.launch()
    except Exception:
        exe = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE") or "/opt/pw-browsers/chromium"
        return p.chromium.launch(executable_path=exe)


def main():
    ap = argparse.ArgumentParser(description="Render an ad-preview HTML file to PNG.")
    ap.add_argument("html", help="Path to the preview HTML file")
    ap.add_argument("-o", "--output", help="Output PNG path (default: <html>.png)")
    ap.add_argument("--split", action="store_true",
                    help="Also export each preview element as its own PNG")
    ap.add_argument("--selector", default=None,
                    help="CSS selector for --split elements. "
                         "Default tries '.device' then '.banner-wrap'.")
    ap.add_argument("--scale", type=float, default=2.0,
                    help="Device scale factor for crisp, high-res output (default 2.0)")
    args = ap.parse_args()

    html_path = Path(args.html).resolve()
    if not html_path.exists():
        sys.exit(f"File not found: {html_path}")

    out = Path(args.output) if args.output else html_path.with_suffix(".png")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright not installed. Run: pip install playwright  "
                 "(the browser binary is already present in this environment)")

    written = []
    with sync_playwright() as p:
        browser = _launch(p)
        page = browser.new_page(device_scale_factor=args.scale)
        page.goto(html_path.as_uri())
        page.wait_for_load_state("networkidle")

        page.screenshot(path=str(out), full_page=True)
        written.append(out)

        if args.split:
            selectors = [args.selector] if args.selector else [".device", ".banner-wrap"]
            elements = []
            for sel in selectors:
                elements = page.query_selector_all(sel)
                if elements:
                    break
            for i, el in enumerate(elements, 1):
                part = out.with_name(f"{out.stem}_{i}.png")
                el.screenshot(path=str(part))
                written.append(part)

        browser.close()

    for w in written:
        print(f"wrote {w}")


if __name__ == "__main__":
    main()
