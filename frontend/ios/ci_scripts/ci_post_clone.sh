#!/bin/sh
set -e

# Install Node.js via Homebrew (not pre-installed on Xcode Cloud)
brew install node

# Navigate to frontend root (parent of ios/)
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"

# Install Node.js dependencies
npm install

# Install CocoaPods
cd ios
pod install
