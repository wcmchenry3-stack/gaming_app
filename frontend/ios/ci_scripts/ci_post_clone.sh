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
#    The "Bundle React Native code and images" phase
#    sources .xcode.env.local to get NODE_BINARY.
#    (Do NOT symlink node over itself — brew already
#    placed it in /usr/local/bin.)
# -------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
echo "export NODE_BINARY=$(which node)" > .xcode.env.local
cat .xcode.env.local

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
