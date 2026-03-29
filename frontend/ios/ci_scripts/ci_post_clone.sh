#!/bin/sh
set -e

echo "=== Xcode Cloud: ci_post_clone.sh ==="

# Ensure Homebrew paths are available
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

# -------------------------------------------------------
# 1. Install Node.js (not pre-installed on Xcode Cloud)
# -------------------------------------------------------
brew install node
echo "Node: $(node --version) at $(which node)"
echo "npm:  $(npm --version) at $(which npm)"

# -------------------------------------------------------
# 2. Tell Xcode build phases where to find node
#    - .xcode.env.local: sourced by "Bundle React Native
#      code and images" phase to set NODE_BINARY
#    - profile files: ensures login shells (bash -l) used
#      by the [Expo] Configure project phase find node
# -------------------------------------------------------
NODE_BIN=$(which node)
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
echo "export NODE_BINARY=$NODE_BIN" > .xcode.env.local
cat .xcode.env.local

# Ensure login shells (bash -l) can find node
echo "export PATH=\"/usr/local/bin:/opt/homebrew/bin:\$PATH\"" >> "$HOME/.bash_profile"
echo "export PATH=\"/usr/local/bin:/opt/homebrew/bin:\$PATH\"" >> "$HOME/.zprofile"

# -------------------------------------------------------
# 3. Install JavaScript dependencies
# -------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"
npm install

# -------------------------------------------------------
# 4. Install CocoaPods dependencies
# -------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
which pod || brew install cocoapods
pod install

# -------------------------------------------------------
# 5. Verify everything is in place for the build
# -------------------------------------------------------
echo "=== Pre-build verification ==="
echo "node_modules exists: $(test -d "$CI_PRIMARY_REPOSITORY_PATH/frontend/node_modules" && echo YES || echo NO)"
echo "Pods exists: $(test -d "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios/Pods" && echo YES || echo NO)"
echo ".xcode.env.local: $(cat "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios/.xcode.env.local")"
echo "entry file check:"
"$NODE_BIN" -e "console.log(require('expo/scripts/resolveAppEntry'))" "$CI_PRIMARY_REPOSITORY_PATH/frontend" ios absolute || echo "WARN: entry file resolution failed"

echo "=== ci_post_clone.sh complete ==="
