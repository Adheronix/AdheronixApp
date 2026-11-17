const path = require('node:path');
const { spawnSync } = require('node:child_process');

// npm hoists the patched package to the repository's node_modules on clean installs.
const root = path.resolve(__dirname, '../..');
const manifest = require.resolve('patch-package/package.json');
const metadata = require(manifest);
const binary = typeof metadata.bin === 'string' ? metadata.bin : metadata.bin['patch-package'];
const result = spawnSync(process.execPath, [path.resolve(path.dirname(manifest), binary), '--patch-dir', 'mobile-api/patches', '--error-on-fail'], { cwd: root, stdio: 'inherit' });
process.exitCode = result.status ?? 1;
