#!/usr/bin/env bash
# CI's perf job (.github/workflows/perf-android.yml) on one emulator (2 GB
# RAM, 4 cores) with the measuring APK (the web build with its synthetic
# fixtures packed in, never SIKOLA).
#   - WebView older than the app's minimum (capacitor.config.ts): the update
#     page must show instead of a blank screen, in both languages, and no
#     background check may be scheduled. Screenshots and the job list are kept.
#   - Otherwise, per tier: cold open until the "sulo-perf ringkasan" line in
#     logcat (device clock on both ends), three runs; then scripts/perf-cdp.mjs
#     (frames, memory, onboarding) through adb's devtools socket.
# Usage: perf-emulator.sh <apk> <outDir> [minutes]
# No pipefail: info commands are piped into head/grep on purpose.
set -eu
APK="$1"; OUT="$2"; MINUTES="${3:-5}"
PKG=dev.ikrar.sulo
MIN_WEBVIEW="$(grep -oE 'minWebViewVersion: *[0-9]+' "$(dirname "$0")/../capacitor.config.ts" | grep -oE '[0-9]+')"
mkdir -p "$OUT"
HERE="$(cd "$(dirname "$0")" && pwd)"

adb install -r "$APK" >/dev/null
adb shell getprop ro.build.version.release > "$OUT/android.txt" || true
(adb shell cat /proc/meminfo | head -1 >> "$OUT/android.txt") || true
WV="$( (adb shell dumpsys package com.google.android.webview | grep -m1 versionName | tr -d ' \r' | cut -d= -f2) || true)"
echo "$WV" > "$OUT/webview.txt"
WV_MAJOR="${WV%%.*}"

SINCE=0
launch() {
  adb shell am force-stop "$PKG"
  adb logcat -c 2>/dev/null || true
  SINCE="$(adb shell date +%s | tr -d '\r')"
  adb shell am start -n "$PKG/.MainActivity" >/dev/null
}
log_since() { adb logcat -d -v epoch -T "$SINCE.000" 2>/dev/null || adb logcat -d -v epoch; }
forward() {
  local pid=""
  for _ in $(seq 1 60); do pid="$(adb shell pidof "$PKG" | tr -d '\r')"; [ -n "$pid" ] && break; sleep 1; done
  adb forward --remove-all || true
  for _ in $(seq 1 60); do (adb shell cat /proc/net/unix | grep -q "webview_devtools_remote_$pid") && break; sleep 1; done
  adb forward tcp:9222 "localabstract:webview_devtools_remote_$pid" >/dev/null
}
jobs_scheduled() { (adb shell dumpsys jobscheduler | grep -c "$PKG") || true; }

# A slow emulator can leave "not responding" dialogs over the screen.
calm() { adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true; }
update_page() {
  local tag="$1"
  calm; launch; forward
  # The page's own address and text through the WebView's devtools: proof it is the update page, not a blank screen.
  node "$HERE/perf-cdp.mjs" --phase=probe > "$OUT/update-page-$tag.json" 2>> "$OUT/errors.txt" || echo "probe $tag failed" >> "$OUT/errors.txt"
  sleep 2; calm; sleep 1
  adb exec-out screencap -p > "$OUT/update-page-$tag.png"
  echo "job terjadwal setelah buka ($tag): $(jobs_scheduled)" >> "$OUT/summary.txt"
}

if [ -n "$WV_MAJOR" ] && [ "$WV_MAJOR" -lt "$MIN_WEBVIEW" ]; then
  echo "WebView $WV di bawah $MIN_WEBVIEW: uji halaman pembaruan" > "$OUT/summary.txt"
  adb shell settings put global window_animation_scale 0 || true
  adb shell settings put global transition_animation_scale 0 || true
  update_page en-US
  (log_since | grep -iE "Capacitor|perlu-pembaruan|Minimum" | head -20 > "$OUT/logcat-update.txt") || true
  # The same page in Indonesian: the emulator's locale switched (google_apis images allow root).
  adb root >/dev/null 2>&1 || true; sleep 3; adb wait-for-device
  adb shell setprop persist.sys.locale id-ID
  adb shell setprop ctl.restart zygote
  sleep 5; adb wait-for-device
  for _ in $(seq 1 120); do [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = "1" ] && break; sleep 2; done
  sleep 20
  update_page id-ID
  echo "perf-emulator: halaman pembaruan diuji, hasil di $OUT"
  exit 0
fi

for TIER in full lite; do
  launch; forward
  node "$HERE/perf-cdp.mjs" --tier="$TIER" --phase=setup > "$OUT/setup-$TIER.json" 2>> "$OUT/errors.txt" || { echo "setup $TIER failed" >> "$OUT/errors.txt"; continue; }
  COLD=()
  for RUN in 1 2 3; do
    launch
    LINE=""
    for _ in $(seq 1 120); do LINE="$(log_since | grep -m1 'sulo-perf ringkasan' || true)"; [ -n "$LINE" ] && break; sleep 0.5; done
    START="$( (log_since | grep -m1 -E 'START u0 .*'"$PKG" | awk '{print $1}') || true)"
    SHOWN="$(echo "$LINE" | awk '{print $1}')"
    if [ -n "$START" ] && [ -n "$SHOWN" ]; then COLD+=("$(awk -v a="$START" -v b="$SHOWN" 'BEGIN { printf "%d", (b - a) * 1000 }')"); else COLD+=("null"); fi
  done
  echo "{\"tier\":\"$TIER\",\"coldOpenMs\":[$(IFS=,; echo "${COLD[*]}")]}" > "$OUT/cold-$TIER.json"
  forward
  (adb shell dumpsys meminfo "$PKG" | grep -m1 'TOTAL' > "$OUT/meminfo-$TIER-before.txt") || true
  timeout $((MINUTES * 60 + 300)) node "$HERE/perf-cdp.mjs" --tier="$TIER" --phase=frames --minutes="$MINUTES" --out="$OUT/frames-$TIER.json" > /dev/null 2>> "$OUT/errors.txt" || echo "frames $TIER failed" >> "$OUT/errors.txt"
  (adb shell dumpsys meminfo "$PKG" | grep -m1 'TOTAL' > "$OUT/meminfo-$TIER-after.txt") || true
  timeout 300 node "$HERE/perf-cdp.mjs" --tier="$TIER" --phase=onboarding --out="$OUT/onboarding-$TIER.json" > /dev/null 2>> "$OUT/errors.txt" || echo "onboarding $TIER failed" >> "$OUT/errors.txt"
done
echo "perf-emulator: selesai, hasil di $OUT"
