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
# 4. Install CocoaPods (fresh install to fix paths)
#    The committed Pods have hardcoded local machine paths
#    (e.g. HERMES_CLI_PATH). Removing and reinstalling
#    regenerates xcconfigs with correct CI runner paths.
# -------------------------------------------------------
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend/ios"
rm -rf Pods
which pod || brew install cocoapods
pod install

# -------------------------------------------------------
# 5. Verify HERMES_CLI_PATH is correct
# -------------------------------------------------------
echo "=== Pre-build verification ==="
HERMES_PATH=$(grep HERMES_CLI_PATH "Pods/Target Support Files/Pods-GamingApp/Pods-GamingApp.release.xcconfig" || echo "NOT FOUND")
echo "HERMES_CLI_PATH: $HERMES_PATH"
echo "node_modules: $(test -d "$CI_PRIMARY_REPOSITORY_PATH/frontend/node_modules" && echo YES || echo NO)"

echo "=== ci_post_clone.sh complete ==="
