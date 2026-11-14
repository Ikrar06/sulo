#!/bin/sh
# Rebuilds public/icon/icon-128.png from assets/brand/tile-dark.svg:
# the tile is rendered at 96x96 and centered on a transparent 128x128 page,
# as Chrome Web Store icon guidelines recommend.
#
# Requires rsvg-convert (librsvg), a local tool only, not a project
# dependency. macOS: brew install librsvg.
#
# icon-16/32 (flame only) and icon-48 (tile) are hand-tuned exports and are
# not generated here.
set -eu

cd "$(dirname "$0")/.."

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert tidak ditemukan. Pasang librsvg dulu (brew install librsvg)." >&2
  exit 1
fi

rsvg-convert assets/brand/tile-dark.svg \
  --width 96 --height 96 \
  --page-width 128 --page-height 128 \
  --left 16 --top 16 \
  --background-color none \
  --output public/icon/icon-128.png

echo "Ditulis: public/icon/icon-128.png (kotak 96x96 di tengah 128x128)"
