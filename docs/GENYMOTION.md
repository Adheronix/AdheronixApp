# Genymotion preview

Adheronix uses Expo SDK 54. The Genymotion Pixel 9 preview runs in the compatible Expo Go 54 client. Expo provides the Android client on its [SDK 54 download page](https://expo.dev/go?sdkVersion=54&platform=android&device=false).

The workstation’s device identifier is `127.0.0.1:6555`; Expo CLI displays its model as `Pixel_9`.

Keep the local API on port 3250 and Metro on port 3253. From the `mobile-api` folder, start Metro if needed:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:3250 npx expo start --port 3253 --localhost
```

Forward both services to the Android device and open the app:

```sh
adb -s 127.0.0.1:6555 reverse tcp:3250 tcp:3250
adb -s 127.0.0.1:6555 reverse tcp:3253 tcp:3253
adb -s 127.0.0.1:6555 shell am start -W \
  -a android.intent.action.VIEW \
  -d exp://127.0.0.1:3253 host.exp.exponent
```

Forward the ports again after restarting or reconnecting the emulator. The preview requires Metro and the API to remain running. The local API currently uses the isolated local development database described in `PATIENT_EXPERIENCE.md`.

Validated on 16 November 2026: the Android bundle compiled and Adheronix rendered its sign-in screen on the Genymotion Pixel 9. The emulator’s SDK 58 Expo Go was switched to SDK 54 using Android’s data-retaining uninstall option before installing the compatible client. The existing client APKs were saved locally for restoration. No app-data-clearing command was used.

This preview uses Expo Go’s native runtime. Packaged APK/AAB builds and store signing require separate validation. The attempted standalone build exposed missing toolchain storage; no release APK was produced or published.

Native development requests use the `/care-api` proxy on the Metro host that supplied the JavaScript bundle. This prevents a stale LAN API URL in an environment file from breaking device signup or sign-in. The Metro server’s `EXPO_PUBLIC_API_URL` selects the backend; release builds use their configured API URL directly.

Device registration and a cold app restart were verified after the connection fix; the signed-in session was retained. Connection regression tests cover native Metro URLs, web development, and release configuration.
