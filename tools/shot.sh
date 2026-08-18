#!/usr/bin/env bash
# Rebuild the images the README uses.
#
# The avatar only exists once a browser has run it, so the shots are taken by
# headless Chrome against the running dev server rather than drawn by hand.
#
#   bun run dev        # in another shell, serves :4330
#   bash tools/shot.sh
set -euo pipefail
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
  --window-size="$2" --virtual-time-budget="$3" --screenshot="$ROOT/docs/$1" "$4" >/dev/null 2>&1; }

shot hero.png      1440,860  11000 "http://localhost:4330/"
shot lab.png       1440,1210  9000 "http://localhost:4330/lab.html"
shot gallery.png   1000,548   9000 "http://localhost:4330/tools/shots/gallery.html"
command -v sips >/dev/null && sips -Z 1400 "$ROOT"/docs/*.png >/dev/null
echo "docs/hero.png docs/lab.png docs/gallery.png"
