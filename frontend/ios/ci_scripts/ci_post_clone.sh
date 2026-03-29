#!/bin/sh
set -e

echo "=== Xcode Cloud: ci_post_clone.sh ==="

# -------------------------------------------------------
# 1. Install Node.js (not pre-installed on Xcode Cloud)
# -------------------------------------------------------
brew install node
NODE_PATH=$(which node)
echo "Node: $(node --version) at $NODE_PATH"

# -------------------------------------------------------
# 2. Make node available to ALL Xcode build phase scripts
#    - .xcode.env.local: sourced by "Bundle React Native
#      code and images" phase to set NODE_BINARY
#    - symlink to /usr/local/bin: ensures node is on PATH
#      for any build phase that runs via `bash -l` (e.g.
#      the [Expo] Configure project phase)
# -------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
echo "export NODE_BINARY=$NODE_PATH" > .xcode.env.local
ln -sf "$NODE_PATH" /usr/local/bin/node
echo "Wrote .xcode.env.local and symlinked node to /usr/local/bin"

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
