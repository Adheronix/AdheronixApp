const fs = require('fs');
const path = require('path');

// Packages hoisted to monorepo root that Expo's pre-flight check requires locally
const hoistedPackages = ['expo-notifications'];

const projectRoot = path.resolve(__dirname, '..');
const monorepoRoot = path.resolve(projectRoot, '..');

for (const pkg of hoistedPackages) {
  const localPath = path.join(projectRoot, 'node_modules', pkg);
  const rootPath = path.join(monorepoRoot, 'node_modules', pkg);

  if (fs.existsSync(localPath)) continue;
  if (!fs.existsSync(rootPath)) {
    console.warn(`[setup-workspace-links] Skipping ${pkg}: not found at ${rootPath}`);
    continue;
  }

  // 'junction' works without admin on Windows; ignored on Unix (treated as symlink)
  fs.symlinkSync(rootPath, localPath, 'junction');
  console.log(`[setup-workspace-links] Linked ${pkg} -> ${rootPath}`);
}
