const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = `${projectRoot}/../..`;

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  `${projectRoot}/node_modules`,
  `${workspaceRoot}/node_modules`,
];

module.exports = config;