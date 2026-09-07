const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Let Metro treat .sql migration files as source, so babel-plugin-inline-import
// can inline them. Without this the drizzle/ imports fail to resolve.
config.resolver.sourceExts.push('sql');

module.exports = config;
