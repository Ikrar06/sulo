#!/bin/sh
# The install step on Vercel ("installCommand" in apps/landing/vercel.json).
#
# Vercel builds on Amazon Linux 2023. The build photographs the app's screens
# for the tilted iPhones (Playwright's headless Chromium) and encodes them
# with cwebp, so the system packages both need come from dnf first. The list
# is what that Chromium links against, by its package name on Amazon Linux,
# tried in a plain amazonlinux:2023 container on x86_64 and arm64 (25 Nov
# 2026); the "vercel" job of .github/workflows/landing.yml runs this file and
# the build on that system on every change.
#
# Where there is no dnf (a GitHub runner, a laptop) only the packages of the
# workspace are installed: Chromium's libraries are that machine's own matter.
set -e
if command -v dnf >/dev/null 2>&1; then
  dnf install -y -q \
    alsa-lib at-spi2-atk at-spi2-core atk cairo cups-libs dbus-libs libdrm \
    libX11 libXcomposite libXdamage libXext libXfixes libXrandr libxcb libxkbcommon \
    mesa-libgbm nspr nss pango systemd-libs \
    libwebp-tools
fi
pnpm install --frozen-lockfile
