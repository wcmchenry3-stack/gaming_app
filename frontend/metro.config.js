const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

// Allow Metro to bundle .wasm files (required for @dimforge/rapier2d-compat)
config.resolver.assetExts.push("wasm");

// Allow Metro to bundle .ogg audio files (Kenney sound packs)
config.resolver.assetExts.push("ogg");

module.exports = config;
