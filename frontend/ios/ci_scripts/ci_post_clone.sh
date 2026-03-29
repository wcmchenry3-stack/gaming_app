#!/bin/sh
set -e

echo "=== Xcode Cloud: ci_post_clone.sh ==="

# -------------------------------------------------------
# 1. Install Node.js (not pre-installed on Xcode Cloud)
# -------------------------------------------------------
brew install node
echo "Node: $(node --version) at $(which node)"

# -------------------------------------------------------
# 2. Tell Xcode build phases where to find node
#    Build phases source .xcode.env / .xcode.env.local
#    to locate NODE_BINARY. Without this, the "Bundle
#    React Native code and images" phase fails.
# -------------------------------------------------------
NODE_PATH=$(which node)
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
echo "export NODE_BINARY=$NODE_PATH" > .xcode.env.local
echo "Wrote .xcode.env.local -> NODE_BINARY=$NODE_PATH"

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

echo "=== ci_post_clone.sh complete ==="
