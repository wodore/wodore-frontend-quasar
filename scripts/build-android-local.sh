#!/bin/bash
# Local Android builds without GitHub CI.
#
# Usage:
#   scripts/build-android-local.sh stg [--install]   # Wodore Preview (com.wodore.stg.dev, staging backend)
#   scripts/build-android-local.sh std [--install]   # Wodore RC (com.wodore.app.dev, production backend)
#
# Notes:
# - .env.local is stashed during the web build so the baked backend
#   hosts match the requested variant (CI parity); it is always restored.
# - JAVA_HOME must point at a full JDK (Android Studio's JBR works; the
#   system java may be a JRE without javac — quasar's internal gradle
#   call fails with "does not provide the required capabilities").
# - New worktrees need src-capacitor/android/local.properties
#   (sdk.dir=...) and a pnpm install in src-capacitor.
# - Known env gaps (2026-09): staging API sends no CORS header for the
#   Capacitor origin (https://localhost) and api.wodore.com is IPv6-only
#   — the map stays blank in emulators/IPv4 networks. Use the RC
#   variant on a phone with IPv6, or fix backend CORS.

set -euo pipefail
cd "$(dirname "$0")/.."

VARIANT="${1:-stg}"
INSTALL="${2:-}"
# Full JDK 21 required (Gradle 8.11 caps at Java 23; the snap JBR is
# Java 25 since the Android Studio refresh and breaks Groovy/lint).
JDK_HOME="${JAVA_HOME:-$HOME/jdks/jdk-21.0.12.1+1}"
if ! "$JDK_HOME/bin/javac" -version >/dev/null 2>&1; then
  echo "No full JDK at $JDK_HOME (javac missing). Install Temurin 21 to ~/jdks." >&2
  exit 1
fi
export JAVA_HOME="$JDK_HOME"
ENV_LOCAL=".env.local"
STASH="/tmp/wodore-env-local.$$"

MAPTILER_KEY="$(grep -E '^WODORE_MAPTILER_API_KEY=' "$ENV_LOCAL" | cut -d= -f2 | tr -d '\r')"
if [ -z "$MAPTILER_KEY" ]; then
  echo "WODORE_MAPTILER_API_KEY missing in $ENV_LOCAL" >&2
  exit 1
fi

if [ "$VARIANT" = "stg" ]; then
  GRADLE_TASK="assembleStgDev"
  ENVVARS=(
    WODORE_ENV=staging
    WODORE_API_HOST=https://hub.stg.wodore.com
    WODORE_API_VERSION=v1
    WODORE_TILE_SERVER_URL=https://tiles.stg.wodore.com
    WODORE_IMAGOR_URL=https://img.stg.wodore.com
    WODORE_IMAGOR_REPLACE_API_HOST_MEDIA=disabled
    WODORE_IMAGOR_KEY="${IMAGOR_KEY:-$(grep -oP '(?<=^WODORE_IMAGOR_KEY=).+' .env.local 2>/dev/null || echo '')}"
  )
  APK_PATH="src-capacitor/android/app/build/outputs/apk/stg/dev/app-stg-dev.apk"
elif [ "$VARIANT" = "std" ]; then
  GRADLE_TASK="assembleStdDev"
  ENVVARS=(
    WODORE_ENV=production
    WODORE_URL=https://wodore.com
    WODORE_DOMAIN=wodore.com
    WODORE_API_HOST=https://api.wodore.com
    WODORE_API_VERSION=v1
    WODORE_TILE_SERVER_URL=https://tiles.wodore.com
    WODORE_IMAGOR_URL=https://img.wodore.com
    WODORE_IMAGOR_REPLACE_API_HOST_MEDIA=wd
  )
  APK_PATH="src-capacitor/android/app/build/outputs/apk/std/dev/app-std-dev.apk"
else
  echo "Unknown variant '$VARIANT' (use stg or std)" >&2
  exit 1
fi

# Stash .env.local so the variant env is not overridden (it loads with
# override:true and would win over process env otherwise).
mv "$ENV_LOCAL" "$STASH"
restore_env() { mv "$STASH" "$ENV_LOCAL"; }
trap restore_env EXIT

BUILD_START=$(date +%s)
# quasar build:capacitor: web build + cap copy (assets land in the
# android project), then capacitor's gradle update for its library
# modules — which fails vital lint with the Android Studio JBR
# (AndroidLintWorkAction '25.0.3'; passes on CI's Temurin JDK). The
# failure happens AFTER the asset copy, so tolerate it and verify the
# packaged assets are fresh instead.
env "${ENVVARS[@]}" WODORE_MAPTILER_API_KEY="$MAPTILER_KEY" \
  pnpm build:capacitor || echo "(quasar exit tolerated — see note above)"

restore_env
trap - EXIT

if ! find src-capacitor/android/app/src/main/assets/public -newermt "@$BUILD_START" \
  -print -quit 2>/dev/null | grep -q .; then
  echo "Packaged assets were not refreshed — the web build failed." >&2
  exit 1
fi

(cd src-capacitor/android && ./gradlew "$GRADLE_TASK" --no-daemon)

echo
echo "APK: $APK_PATH"
if [ "$INSTALL" = "--install" ]; then
  ADB="${ANDROID_HOME:-/home/tobias/Android/Sdk}/platform-tools/adb"
  "$ADB" install -r "$APK_PATH"
fi
