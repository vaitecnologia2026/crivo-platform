#!/usr/bin/env bash
# Wrapper de `cap sync` que re-injeta o firebase-ios-sdk no Package.swift do iOS.
# `npx cap sync` regenera ios/App/CapApp-SPM/Package.swift toda vez, apagando a
# dependência do Firebase (necessária pro FCM). Este wrapper reaplica.
# SEMPRE usar `pnpm cap:sync` (nunca `npx cap sync` direto).
set -euo pipefail
cd "$(dirname "$0")/.."

npx cap sync "$@"

PACKAGE_SWIFT="ios/App/CapApp-SPM/Package.swift"

if [ -f "$PACKAGE_SWIFT" ] && ! grep -q "firebase-ios-sdk" "$PACKAGE_SWIFT"; then
  echo "[cap-sync] re-injecting firebase-ios-sdk into $PACKAGE_SWIFT"
  # Ancora nas linhas do CapacitorPushNotifications (independe do hash pnpm no path).
  /usr/bin/sed -i '' \
    -e 's|\(\.package(name: "CapacitorPushNotifications", path: "[^"]*")\)|\1,\
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0")|' \
    "$PACKAGE_SWIFT"
  /usr/bin/sed -i '' \
    -e 's|\(\.product(name: "CapacitorPushNotifications", package: "CapacitorPushNotifications")\)|\1,\
                .product(name: "FirebaseMessaging", package: "firebase-ios-sdk")|' \
    "$PACKAGE_SWIFT"
fi
