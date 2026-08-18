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
shot states.png    1280,955   7000 "http://localhost:4330/tools/shots/states.html"
shot tool-call.png 1180,440   9000 "http://localhost:4330/tools/shots/tool.html"
command -v sips >/dev/null && sips -Z 1400 "$ROOT"/docs/*.png >/dev/null
echo "docs/hero.png docs/lab.png docs/states.png docs/tool-call.png"
