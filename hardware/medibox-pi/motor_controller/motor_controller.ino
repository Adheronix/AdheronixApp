// Arduino Uno + V1 L293D/74HC595 shield. No extra libraries required.
// Wiring reference: https://github.com/adafruit/Adafruit-Motor-Shield-library
// M1/M2 = left, M3/M4 = right. Flip individual signs after lifted-wheel tests.
#include <Arduino.h>
const byte PWM_PINS[] = {11, 3, 6, 5};
const byte A_BITS[] = {2, 1, 5, 0};
const byte B_BITS[] = {3, 4, 7, 6};
const int MOTOR_SIGN[] = {1, 1, 1, 1};
const byte LATCH = 12, CLOCK = 4, ENABLE = 7, DATA = 8;
unsigned long lastCommand = 0;
bool moving = false;
int currentLeft = 0, currentRight = 0;
char line[48];
byte used = 0;

void drive(int left, int right) {
  byte bits = 0;
  // Disable PWM while direction changes.
  for (byte i = 0; i < 4; ++i) analogWrite(PWM_PINS[i], 0);
  for (byte i = 0; i < 4; ++i) {
    int value = (i < 2 ? left : right) * MOTOR_SIGN[i];
    if (value > 0) bits |= (1 << A_BITS[i]);
    if (value < 0) bits |= (1 << B_BITS[i]);
  }
  digitalWrite(LATCH, LOW);
  shiftOut(DATA, CLOCK, MSBFIRST, bits);
  digitalWrite(LATCH, HIGH);
  for (byte i = 0; i < 4; ++i) analogWrite(PWM_PINS[i], abs(i < 2 ? left : right));
  moving = left || right;
  currentLeft = left;
  currentRight = right;
}

void processLine() {
  if (!strcmp(line, "STOP")) {
    drive(0, 0); Serial.println(F("OK stop")); return;
  }
  if (!strcmp(line, "PING")) {
    Serial.println(F("MEDIBOX_MOTOR_V1")); return;
  }
  if (!strcmp(line, "STATUS")) {
    Serial.print(F("STATE ")); Serial.print(currentLeft);
    Serial.print(' '); Serial.println(currentRight); return;
  }
  char direction[12], extra;
  int speed;
  if (sscanf(line, "MOVE %11s %d %c", direction, &speed, &extra) != 2 || speed < 0 || speed > 255) {
    drive(0, 0); Serial.println(F("ERR command")); return;
  }
  if (!strcmp(direction, "forward")) drive(speed, speed);
  else if (!strcmp(direction, "backward")) drive(-speed, -speed);
  else if (!strcmp(direction, "left")) drive(-speed, speed);
  else if (!strcmp(direction, "right")) drive(speed, -speed);
  else { drive(0, 0); Serial.println(F("ERR direction")); return; }
  lastCommand = millis();
  Serial.print(F("OK ")); Serial.println(direction);
}

void setup() {
  digitalWrite(ENABLE, HIGH);
  pinMode(ENABLE, OUTPUT);
  pinMode(LATCH, OUTPUT); pinMode(CLOCK, OUTPUT); pinMode(DATA, OUTPUT);
  for (byte i = 0; i < 4; ++i) pinMode(PWM_PINS[i], OUTPUT);
  drive(0, 0);
  digitalWrite(ENABLE, LOW);
  Serial.begin(115200);
  Serial.println(F("MEDIBOX_MOTOR_V1"));
}

void loop() {
  // A missing Pi, dead browser or stalled serial link releases all motors.
  if (moving && millis() - lastCommand > 650) drive(0, 0);
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') continue;
    if (c == '\n') { line[used] = 0; processLine(); used = 0; }
    else if (used < sizeof(line) - 1) line[used++] = c;
    else { used = 0; drive(0, 0); }
  }
}
