# Physical MediBox: Raspberry Pi and phone control

Local phone control for a Raspberry Pi 5, USB Arduino Uno and **V1 L293D/74HC595 motor shield**. Uses the existing app API for device schedules and calibrated weight reports. No changes to the native app or patient dose-confirmation behavior are required.

## Operation

Open `http://<pi-address>:8080` from a phone on the same LAN and enter the private pairing code. Enable driving, then hold an arrow. Releasing stops; STOP also disables driving. Changing power disables driving until enabled again. A new phone pairing revokes the previous controller and stops the motors.

Browser movement commands renew a 550 ms lease. The Pi checks this independently of network and sensor calls. The Arduino releases its motor outputs after 650 ms without a valid movement command. Its `STATUS` reply reports commanded output values, not wheel rotation or supply voltage. The car is manually controlled; the distance sensor provides an additional forward stop only when it supplies a valid distance below 20 cm.

Phone controls stay local. The API key is held in a mode-0600 `config.json` on the Pi, never sent to the browser. Pairing uses a random code, a single active HttpOnly/SameSite session, failed-attempt throttling and same-origin JSON requests. Local HTTP is not encrypted: use a trusted presentation LAN and do not expose this control port publicly.

## Wiring preserved

All added peripherals remain on the Pi/breadboard. No peripheral is reassigned to covered Arduino headers.

- HX711 DT GPIO5, SCK GPIO6; preserve the owner's tested repaired load-cell wiring.
- Button GPIO22, internal pull-up, switch to ground.
- Indicator GPIO17, through the installed current-limiting resistor.
- Buzzer GPIO18, active low for the documented 3.3 V PNP driver. Do not use this mode with the withdrawn 5 V PNP circuit.
- HC-SR04 TRIG GPIO23, protected ECHO GPIO24. A direct 5 V Echo connection is unsuitable for Pi GPIO.
- LCD SDA GPIO2/SCL GPIO3, I²C bus 1. The documented limited test powers the complete module at 3.3 V; initialize the detected PCF8574 backpack at 0x27. Initialization does not prove readable contrast/text.
- USB serial to Uno; shield M1/M2 left and M3/M4 right, viewed along the car's forward direction. `MOTOR_SIGN` in the sketch can correct individual motor polarity after lifted-wheel verification.

These assignments follow the workspace hardware connection record. Enable optional peripherals in `config.json` only for the corresponding installed circuit. No valid ultrasonic Echo was observed during initial software testing, so obstacle stopping is not yet physically accepted.

## Setup on the Pi

Dependencies: Python 3, `python3-serial`, `python3-gpiozero`, `python3-lgpio`, `python3-smbus`, `arduino-core-avr`, `gcc-avr`, and `avrdude`. The user needs the existing dialout, gpio and i2c access. Enable I²C bus 1 for the LCD.

Copy this directory to `~/medibox`, copy `config.example.json` to `config.json`, restrict its mode to 0600, set a random pairing code, the persistent detected serial path, and privately provision the existing backend device key and device-to-patient mapping. Preserve all other device mappings. Do not put account identifiers, keys or local configuration in source control.

`python3 build_firmware.py` builds an Uno image in ignored `build/`. Back up the Arduino flash and EEPROM **before** the first upload; retain that original backup outside the source tree. Upload with avrdude only after confirming the actual board/bootloader. This sketch is for the V1 shield, not the I²C V2 shield.

Install `medibox.service` as a user systemd service under `~/.config/systemd/user/`, reload the user daemon and enable/start it. Enable linger for that user if it must start at boot without an interactive login. Never run two instances competing for serial/GPIO. `systemctl --user stop medibox` stops the installed service; the Arduino independently times out even if the Pi process cannot send STOP.

The default software power ceiling is 140/255 until the battery, motors and lifted-wheel behavior are checked. The deployed six-cell 1.2 V AA configuration uses a configurable 255 ceiling and initial 210 setting. The app cannot raise the configured ceiling. Motor battery voltage under load and actual wheel direction still need physical verification.

## Scale calibration and app connection

The scale initially shows real raw ADC readings. It deliberately withholds grams and cloud weight reports until calibrated. Empty the tray and select **Zero empty tray**; place an independently weighed reference object on the same mounting and enter its total mass. Calibration stores the signed counts-per-gram factor and tare privately on the Pi. Repeat a load/remove test to check drift and repeatability. A tablet's printed active-ingredient strength does not establish its complete mass.

Once calibrated and receiving fresh sensor samples, the Pi sends actual weight to `/api/smartbox/weight` every five seconds and fetches `/api/smartbox/:deviceId/schedule` every fifteen seconds. Its explicit User-Agent avoids rejection of the default Python client by the existing edge browser check. No synthetic weight is uploaded to make the box appear online. The native app lists the mapped box immediately; its connection indicator updates after real weight reports arrive.

The LCD alternates compartment weight/calibration status and the backend schedule. Physical button presses are local activity, with a short buzzer response if that circuit is enabled. This implementation does not automatically mark medication taken, identify tablets, or generate removal/dose events from unvalidated weight thresholds. Medication reminders and dose confirmations remain in the existing app. The camera is detected on the Pi but streaming/medicine identification is outside this implementation.

## Verification, 21 November 2026

- Python HTTP and safety tests cover pairing, origin rejection, anonymous control rejection, session revocation, lease expiry, STOP/disarm, speed ceiling, obstacle guard, stale readings, invalid calibration and private calibration persistence.
- Built the sketch for the detected ATmega328P, uploaded it and verified flash contents. Original flash/EEPROM retained privately on the Pi.
- Live serial tests received forward/reverse acknowledgements, `STATE 255 255`, `STATE -210 -210`, `STATE 0 0` after STOP, and `STATE 0 0` after withheld commands exceeded the watchdog.
- Pi service active with linger enabled; live HX711 samples and user-reported button presses observed. LCD backpack detected and initialized at 0x27. Schedule API returned 200 for the provisioned device.
- Physical wheel rotation, LCD readability, buzzer sound, valid ultrasonic echoes, known-mass calibration and weight delivery to the native app remain acceptance steps. Commanded motor states do not establish physical motion.

Run checks with `python3 -m unittest -v test_medibox.py`. The HTTP checks need permission to bind an ephemeral local port.

Shield pin references: [Adafruit V1 guide](https://learn.adafruit.com/adafruit-motor-shield?view=all) and [original AFMotor source](https://github.com/adafruit/Adafruit-Motor-Shield-library).
