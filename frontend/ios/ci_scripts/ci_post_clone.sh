#!/bin/sh
set -e

# Install Node.js via Homebrew (not pre-installed on Xcode Cloud runners)
brew install node

# Install CocoaPods if not available
which pod || brew install cocoapods

# Navigate to frontend root (parent of ios/)
cd "$CI_PRIMARY_REPOSITORY_PATH/frontend"

# Install Node.js dependencies
npm install

# Install CocoaPods dependencies
cd ios
pod install
