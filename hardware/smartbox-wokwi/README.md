# Adelonix Smart Box Wokwi Demo

Use these files in a Wokwi ESP32-S3 Arduino project. If your Wokwi page was created from the MicroPython template, create a new Arduino ESP32-S3 project or change it to use `sketch.ino`; the current firmware is Arduino/C++.

- `diagram.json`: complete circuit wiring.
- `sketch.ino`: ESP32-S3 firmware with median + Kalman filtering, LED/buzzer/virtual e-paper feedback, and HTTP sync.
- `libraries.txt`: intentionally empty. The browser demo has a built-in SPI e-paper driver, and HX711 is simulated.

Run order:

1. Start the Nest backend on your computer.
2. Expose it to Wokwi, for example `ngrok http 3000` or `ssh -R 80:localhost:3000 nokey@localhost.run`.
3. Copy the working public HTTPS URL into `API_BASE_URL` in `sketch.ino`.
4. Set `SMARTBOX_API_KEY` in `backend-api/.env` and put the same value into `API_KEY` in `sketch.ino`.
5. Optional: set `SMARTBOX_DEVICE_PATIENT_MAP={"SMARTBOX-0001":"<patient_uuid>"}` so Wokwi events update that patient's Health Score.
6. Scan a medication QR in the mobile app, or use existing backend medication schedule data.
7. Start the Wokwi simulation. It will fetch `/api/smartbox/SMARTBOX-0001/schedule` and render the current backend schedule on the e-paper.
8. Press the green `Verified` button to simulate one pill removed.
9. Watch the hardware feedback:
   - LED blinks while WiFi connects.
   - LED/buzzer pulse when a dose is detected.
   - LED/buzzer success tone plays after the backend responds.
   - The e-paper and Serial Monitor virtual e-paper show the medicine, dosage, condition, dose time, pill count, and simulated bin weight from the backend.
   - After the button press, the e-paper changes to `PILL REMOVED`, then `DOSE TAKEN`, then returns to the inventory with one fewer pill.
10. Confirm the Serial Monitor shows `HTTP status: 200`.
11. Open the mobile app IoT tab. It polls every 10 seconds and should show the current backend schedule and then the verified dose.

For a mobile-only smoke test, use the `Send test dose` button on the IoT tab. That uses the logged-in patient and does not require Wokwi or a public tunnel.

Important pin checks:

- Button `btn1:2.r` must connect to `esp:38`, not GPIO48.
- LED resistor should connect to GPIO40.
- Buzzer positive should connect to GPIO39.
- E-paper uses `CS=10`, `DC=11`, `RST=12`, `BUSY=13`, `CLK=14`, `DIN=21`.
- The browser demo uses the Wokwi e-paper with a built-in SPI driver and simulates HX711 weight values. For real hardware load-cell readings, add the HX711 library and restore the physical scale reads.

Medicine simulation:

- Bin 1 is no longer hardcoded. It starts in `Syncing backend` mode.
- The backend schedule endpoint returns `medicine`, `dosage`, `condition`, `scheduledTime`, `pillsRemaining`, `totalPills`, and `pillWeightG`.
- The simulated load-cell weight is calculated as `pillsRemaining * pillWeightG`.
- Pressing the green button removes one pill and sends the updated dose event back to the backend.
