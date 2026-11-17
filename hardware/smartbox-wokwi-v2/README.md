# Adheronix SmartMediBox — ESP32-S3 sensor prototype

This single-bin simulator implements the October 2026 Adheronix specification's
weight-based observations, estimated inventory, reminders, and separate patient
confirmations. It preserves the existing ESP32-S3 circuit's GPIO assignments.
The older `hardware/smartbox-wokwi` Velxio demo remains available separately.

Saved public project:
[Adheronix SmartMediBox](https://wokwi.com/projects/480914095476006913).
Its four project files contain no runtime credentials or patient records.

## Hardware and behavior

- ESP32-S3, HX711 with integrated Wokwi load cell, ILI9341 TFT, LED, buzzer and
  reminder-silence button.
- HX711 DT=16, SCK=17; LED=40; buzzer=39; silence button=38 to GND with pull-up.
- TFT CS=10, DC=11, RST=12, SCK=14, MOSI=21, MISO=13.
- Sensor readings come from `HX711.get_units()`, never from a fake `TAKE` command.
- Stable weight drops queue physical-removal observations; rising weight is a refill.
  Estimated inventory is measured grams divided by the configured demo unit weight.
- Reminders use the app schedule and Africa/Kigali time. The button mutes reminders
  for five minutes. It never changes the measured weight or confirms a dose.
- An accepted removal remains a device observation. Only the app's explicit patient
  action confirms taking medication; device events do not improve a health score.
- The display shows sync state, measured weight, inventory estimate and pending activity.

## Running in Wokwi

1. Create an ESP32-S3 Arduino project and load `sketch.ino`, `diagram.json`,
   `libraries.txt` and `certificates.h` into its editor.
2. Start the simulation. The HX711 starts at 0.05 kg (50 g).
3. Connect only to a disposable preview session. In Serial Monitor enter:
   `CONNECT <https-base-url> <temporary-preview-key>`.
   Runtime configuration is intentionally absent from saved project files.
4. Click the HX711 and lower its slider by one step, 0.05 to 0.04 kg. Its slider
   resolution is 10 g and the simulated ADC is quantized; this test produced about
   38.1 g from a 40 g setting. These are demo units, not calibrated real pills.
5. Look for `[REMOVAL] HX711 ...; queued=1`, then an HTTP 200 acknowledgement.
6. In the app, open MediBox for weight/activity and Today for the separate dose status.

Serial commands: `STATUS`, `SYNC`, `MUTE`, `TARE`. Tare only an empty container;
it resets the baseline and does not generate a removal event. No invented
patient data or API keys should be saved into the project.

## Local backend bridge

Wokwi's public gateway cannot reach localhost. `preview-bridge.cjs` optionally
exposes only three routes for one synthetic `WOKWI-PREVIEW-*` device through a
temporary HTTPS tunnel: its schedule GET, weight POST and removal POST.
It rejects other device IDs, patient ID injection, unexpected fields, unrelated
API routes, oversized bodies, missing credentials, expired sessions and excessive
request rates. Successful identical removal requests are deduplicated in memory.
The real backend device key stays in the local process.

Run `node preview-bridge.test.cjs` to verify those boundaries.
Run `node preview-bridge.cjs /absolute/private/hardware-config.json` to listen
only on `127.0.0.1:3256`, then tunnel that port, never the full application port.
The private JSON contains `deviceId`, `deviceKey`, `bridgeKey`, and an `expiresAt`
epoch in milliseconds. It must stay outside Git and Wokwi. Provision the backend
mapping for this synthetic device to its synthetic test patient separately.

The firmware verifies HTTPS certificates using the public CA roots in
`certificates.h`; no `setInsecure()` or plaintext credential transport is used.
Cloudflare quick-tunnel hostnames and preview sessions are temporary.

## Prototype limitations

### Verification status — 17 November 2026

The saved project compiles and runs in Wokwi. Changing the HX711 load from
0.05 to 0.04 kg produced a measured drop from 50.0 to 38.1 g and queued one
removal observation. This was reproduced in both the built-in browser and Chrome.
The bridge boundary tests pass, and independent HTTPS requests through both
Cloudflare and ngrok retrieve the synthetic device schedule. A separate manual
HTTP smoke test wrote weight/removal observations and verified that patient dose
confirmation stayed unchanged.

Full simulator-to-app delivery is **not yet verified**. The simulator retrieved
the schedule once, but subsequent requests failed and Wokwi displayed an IoT
gateway connection error in both browsers. No successful firmware-originated
weight/removal POST has been observed. Manual HTTP checks do not prove that path.
Recheck Wokwi gateway connectivity before treating this prototype as a live app
integration; keep queued observations visible and use synthetic data only.

This is not production firmware or a verified ingestion sensor. Real HX711 hardware
needs electrical review, calibration, suitable load-cell resolution, noise/drift
testing and container-movement detection. Ensure 3.3 V-safe digital levels for the
ESP32; simulation power wiring is not an electrical certification.

The eight-entry observation queue and bridge deduplication cache are RAM-only and
are lost on restart. Delivery retries are not an exactly-once guarantee if the
backend accepts a request but its acknowledgement is lost. Production work needs
persistent event IDs/queues, backend idempotency, per-device provisioning, replay
protection, ownership management and physical testing. Offline observation times
are estimated after NTP becomes available. HTTPS requests currently block the
Arduino loop while connecting; production scheduling should use a separate task.

## References

- [Adheronix specification](https://docs.google.com/document/d/1BcG5yltaxoH7J8tDYU1TEeOfT_HSum4lgowQjNfeRg4)
- [Wokwi HX711](https://docs.wokwi.com/parts/wokwi-hx711)
- [Wokwi Wi-Fi and gateway](https://docs.wokwi.com/guides/esp32-wifi)
- [Wokwi ILI9341](https://docs.wokwi.com/parts/wokwi-ili9341)
