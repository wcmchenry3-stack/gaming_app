const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle .wasm files (required for @dimforge/rapier2d-compat)
config.resolver.assetExts.push("wasm");

module.exports = config;
