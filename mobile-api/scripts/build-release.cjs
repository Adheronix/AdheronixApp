/* Build a self-contained preview APK and sign it with a private release key. */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env: process.env, ...options });
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed (${result.status})`);
}
try {
  const endpoint = new URL(process.env.EXPO_PUBLIC_API_URL || '');
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || /^(localhost|127\.|10\.|192\.168\.)/i.test(endpoint.hostname))
    throw new Error('Set EXPO_PUBLIC_API_URL to the deployed public HTTPS API.');
  for (const variable of ['ADHERONIX_KEYSTORE', 'ADHERONIX_STORE_PASSWORD', 'ADHERONIX_KEY_PASSWORD', 'ADHERONIX_KEY_ALIAS', 'ADHERONIX_RELEASE_OUTPUT'])
    if (!process.env[variable]) throw new Error(`Missing private build setting: ${variable}`);
  if (!fs.existsSync(process.env.ADHERONIX_KEYSTORE)) throw new Error('Release keystore does not exist.');
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('Set ANDROID_HOME to an installed Android SDK.');
  const versions = fs.readdirSync(path.join(sdk, 'build-tools')).filter(v => /^\d+\.\d+\.\d+$/.test(v)).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
  const tools = path.join(sdk, 'build-tools', versions.at(-1) || 'missing');
  for (const command of ['zipalign', 'apksigner'])
    if (!fs.existsSync(path.join(tools, command))) throw new Error(`Android ${command} is unavailable.`);
  process.env.EXPO_NO_DOTENV = '1';
  process.env.NODE_ENV = 'production';
  const architectures = process.env.ADHERONIX_ANDROID_ABIS || 'arm64-v8a,x86_64';
  if (!/^(arm64-v8a|armeabi-v7a|x86_64|x86)(,(arm64-v8a|armeabi-v7a|x86_64|x86))*$/.test(architectures)) throw new Error('Invalid Android ABI list.');
  const android = path.join(root, 'android');
  if (!process.env.ADHERONIX_CANDIDATE_APK) {
    if (!fs.existsSync(path.join(android, 'gradlew')))
      run(process.execPath, [require.resolve('expo/bin/cli'), 'prebuild', '--platform', 'android', '--no-install']);
    run('./gradlew', [':app:assembleRelease', '--no-daemon', '--max-workers=1', `-PreactNativeArchitectures=${architectures}`], { cwd: android });
  }
  const input = process.env.ADHERONIX_CANDIDATE_APK ? path.resolve(process.env.ADHERONIX_CANDIDATE_APK) : path.join(android, 'app/build/outputs/apk/release/app-release.apk');
  const output = path.resolve(process.env.ADHERONIX_RELEASE_OUTPUT);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const aligned = output + '.aligned.apk';
  run(path.join(tools, 'zipalign'), ['-f', '-P', '16', '4', input, aligned]);
  run(path.join(tools, 'apksigner'), ['sign', '--ks', process.env.ADHERONIX_KEYSTORE, '--ks-key-alias', process.env.ADHERONIX_KEY_ALIAS, '--ks-pass', 'env:ADHERONIX_STORE_PASSWORD', '--key-pass', 'env:ADHERONIX_KEY_PASSWORD', '--out', output, aligned]);
  run(path.join(tools, 'apksigner'), ['verify', '--verbose', '--print-certs', output]);
  fs.unlinkSync(aligned);
  console.log(`Verified signed preview APK: ${output}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
