# Adelonix Smart Box Velxio Demo

Use these files in a Velxio ESP32-S3 Arduino project (Wokwi-compatible `diagram.json`). If your project page was created from the MicroPython template, switch it to use `sketch.ino`; the firmware is Arduino/C++.

- `diagram.json`: complete circuit wiring.
- `sketch.ino`: ESP32-S3 firmware with ILI9341 display, load-cell driven dose detection, due-dose reminders, LED/buzzer/button feedback, weight telemetry, and HTTP sync to the backend.
- `libraries.txt`: intentionally empty. HX711 is simulated through a Serial Monitor console.

Run order:

1. Start the Nest backend on your computer.
2. Expose it to Velxio, for example `ngrok http 3000`.
3. Copy the working public URL into `API_BASE_URL` in `sketch.ino`.
4. Set `SMARTBOX_API_KEY` in `backend-api/.env` and put the same value into `API_KEY` in `sketch.ino`.
5. Optional: set `SMARTBOX_DEVICE_PATIENT_MAP={"SMARTBOX-0001":"<patient_uuid>"}` so Velxio events update that patient's Health Score.
6. Scan a medication QR in the mobile app, or use existing backend medication schedule data.
7. Start the simulation. It fetches `/api/smartbox/SMARTBOX-0001/schedule`, anchors its simulated load cell to the backend pill count, renders the schedule on the TFT, and syncs its clock from the payload (`serverDate`/`serverTime`).
8. When a dose is due (`scheduledTime` reached, not yet taken), the box enters reminder mode: red `DUE NOW - TAKE MED` banner plus a beep every 8s for up to 3h.
9. Remove medicine by typing `TAKE` in the Serial Monitor (or press the green button -- both lower the simulated load cell). Any drop >= 60% of one pill is treated as a real intake: the box pulses the LED/buzzer and POSTs a verified dose event to `/api/smartbox/dose-event`.
10. The backend marks today's matching schedule TAKEN, updates `pillsRemaining` on the medication, fires a notification, and adds Health Score. The next schedule refresh clears the reminder.
11. Every 60s the box also POSTs live mass to `/api/smartbox/weight` (latest reading available at `GET /api/smartbox/:deviceId/weight/latest`).
12. Confirm the Serial Monitor shows `[NET] POST dose-event -> 200`.
13. Open the mobile app IoT tab. It polls every 10 seconds and shows the current backend schedule and the latest verified dose.

For a mobile-only smoke test, use the `Send test dose` button on the IoT tab. That uses the logged-in patient and does not require Velxio or a public tunnel.

Serial Monitor console (115200 baud, Newline endings):

| Command   | Effect                                          |
| --------- | ----------------------------------------------- |
| `W 45`    | Force bin weight to 45 g                        |
| `TAKE`    | Remove one pill worth of grams                  |
| `TAKE 3`  | Remove three pills                              |
| `PUT 2`   | Add two pills back (refill, re-baselines scale) |
| `PILLS 8` | Set contents to exactly 8 pills                 |
| `TARE`    | Zero the scale at the current reading           |
| `STATUS`  | Dump weight / baseline / pill / reminder state  |
| `HELP`    | List commands                                   |

Important pin checks:

- Button `btn1:2.r` must connect to `esp:38`, not GPIO48.
- LED resistor should connect to GPIO40 (blinks on WiFi connect, pulses on intake).
- Buzzer positive should connect to GPIO39.
- Load cell HX711: `DT -> GPIO16`, `SCK -> GPIO17`. In Velxio the values come from the Serial console above; on real hardware replace `readBinWeightG()` in `sketch.ino` with an HX711 library read and delete the sim anchor block in `applyData()`.
- Display (ILI9341) uses `CS=10`, `DC=11`, `RST=12`, `CLK=14`, `MOSI=21`, `MISO=13`.

Medicine simulation:

- Bin 1 starts in `Syncing backend` mode; the first successful schedule fetch anchors the scale to `pillsRemaining x pillWeightG`.
- From then on the load cell is authoritative: weight drops become dose events, weight rises are refills.
- The backend schedule endpoint returns `medicine`, `dosage`, `condition`, `scheduledTime`, `scheduledDate`, `pillsRemaining`, `totalPills`, `pillWeightG`, `doseTakenToday`, `serverDate`, and `serverTime`.
- Pressing the green button or typing `TAKE` lowers the scale; the resulting verified dose event flows through to schedules, notifications, and the Health Score.
