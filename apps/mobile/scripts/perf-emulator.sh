#!/usr/bin/env bash
# CI's perf job (.github/workflows/perf-android.yml): an Android emulator
# with 2 GB of RAM and 4 cores runs the measuring APK (the web build with
# its synthetic fixtures, never SIKOLA), then scripts/perf-measure.mjs is
# attached to its WebView through adb's devtools socket. Per tier:
#   - cold open: force-stop, start, until the "sulo-perf ringkasan" line
#     in logcat (both times from the device's own clock), three runs
#   - frames (scroll, tabs, sheet, onboarding) and memory after N minutes
# Usage: perf-emulator.sh <apk> <outDir> [minutes]
set -euo pipefail
APK="$1"; OUT="$2"; MINUTES="${3:-5}"
PKG=dev.ikrar.sulo
mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"

adb install -r "$APK" >/dev/null
adb shell getprop ro.build.version.release > "$OUT/android.txt"
adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tr -d ' ' > "$OUT/webview.txt" || true
adb shell cat /proc/meminfo | head -1 >> "$OUT/android.txt"

forward() {
  local pid=""
  for _ in $(seq 1 60); do pid="$(adb shell pidof "$PKG" | tr -d '\r')"; [ -n "$pid" ] && break; sleep 1; done
  adb forward --remove-all || true
  # The WebView's devtools socket appears once the page has loaded.
  for _ in $(seq 1 60); do adb shell cat /proc/net/unix | grep -q "webview_devtools_remote_$pid" && break; sleep 1; done
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid"
}

launch() {
  adb shell am force-stop "$PKG"
  adb logcat -c
  adb shell am start -n "$PKG/.MainActivity" >/dev/null
}

for TIER in full lite; do
  # Sign in to the stand-in once with 50 tasks and this tier (the tier is kept for cold opens).
  launch; forward
  node "$HERE/perf-measure.mjs" --target=cdp --tier="$TIER" --only=setup --minutes=0 > /dev/null
  COLD=()
  for RUN in 1 2 3; do
    launch
    LINE=""
    for _ in $(seq 1 120); do LINE="$(adb logcat -d -v epoch | grep -m1 'sulo-perf ringkasan' || true)"; [ -n "$LINE" ] && break; sleep 0.5; done
    START="$(adb logcat -d -v epoch | grep -m1 -E 'START u0 .*'"$PKG" | awk '{print $1}')"
    SHOWN="$(echo "$LINE" | awk '{print $1}')"
    if [ -n "$START" ] && [ -n "$SHOWN" ]; then COLD+=("$(awk -v a="$START" -v b="$SHOWN" 'BEGIN { printf "%d", (b - a) * 1000 }')"); else COLD+=("null"); fi
  done
  echo "{\"tier\":\"$TIER\",\"coldOpenMs\":[$(IFS=,; echo "${COLD[*]}")]}" > "$OUT/cold-$TIER.json"
  forward
  adb shell dumpsys meminfo "$PKG" | grep -m1 'TOTAL' > "$OUT/meminfo-$TIER-before.txt" || true
  node "$HERE/perf-measure.mjs" --target=cdp --tier="$TIER" --only=scroll,tabs,sheet,memory --minutes="$MINUTES" --out="$OUT/frames-$TIER.json" > /dev/null
  adb shell dumpsys meminfo "$PKG" | grep -m1 'TOTAL' > "$OUT/meminfo-$TIER-after.txt" || true
  node "$HERE/perf-measure.mjs" --target=cdp --tier="$TIER" --only=onboarding --minutes=0 --out="$OUT/onboarding-$TIER.json" > /dev/null || echo "onboarding $TIER failed" >> "$OUT/errors.txt"
done
echo "perf-emulator: selesai, hasil di $OUT"
