/*
 * ============================================================
 *  ADELONIX SMART BOX - FIXED DISPLAY FIRMWARE
 *  ESP32-S3 | ILI9341 | WiFi | HTTP GET -> TFT
 *
 *  Fix applied:
 *   - Removed the GFXcanvas16 + per-pixel fillRect() blit path.
 *     That approach issued thousands of tiny 1px SPI writes per
 *     line of text, which is what corrupted the middle of the
 *     screen in Velxio's ILI9341 emulation.
 *   - Dropped the smooth fonts (FreeSans*) for body text as well;
 *     everything now renders with the classic built-in bitmap
 *     font via tft.setFont() + tft.print(), the same reliable
 *     path that was already rendering the header/footer.
 *   - Kept the staged paint-job queue (one job per loop tick) so
 *     SPI traffic is still spread out and each job stays logged.
 *   - Restored the LED/buzzer/button feedback that was lost in the
 *     display rewrite: GPIO40 LED, GPIO39 buzzer, GPIO38 button
 *     (INPUT_PULLUP). Button press = one pill removed + POST
 *     /api/smartbox/dose-event to the backend.
 * ============================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>

// ============== WIFI / BACKEND ==============
const char* WIFI_SSID = "Velxio-GUEST";
const char* WIFI_PASSWORD = "";
// Velxio note: the emulated ESP32 reaches the internet via SLIRP NAT.
// Plain HTTP works; TLS dies at handshake against some edges, so we
// tunnel the local backend through a Cloudflare quick tunnel, which
// serves PLAIN http:// with no redirect and no account needed:
//   /tmp/opencode/bin/cloudflared tunnel --url http://127.0.0.1:3000
// Copy the printed https://xxx.trycloudflare.com URL below but keep
// the http:// scheme. Quick-tunnel URLs change on every restart --
// paste the fresh one here each time. On real hardware you can switch
// back to ngrok https + WiFiClientSecure if you want encryption.
const char* API_BASE_URL = "http://reveals-fix-car-residents.trycloudflare.com";
const char* DEVICE_ID = "SMARTBOX-0001";
const char* API_KEY = "change-me-smartbox-device-token";

// ============== TFT PINS ==============
const int TFT_CS = 10;
const int TFT_DC = 11;
const int TFT_RST = 12;
const int TFT_SCK = 14;
const int TFT_MOSI = 21;
const int TFT_MISO = 13;

// ============== LED / BUZZER / BUTTON PINS ==============
// Matches diagram.json wiring:
//   led1  -> 220R -> GPIO40 (active HIGH), cathode -> GND
//   bz1:2 -> GPIO39 (tone pin)
//   btn1  -> GPIO38, other leg -> GND (active LOW, needs pull-up)
const int PIN_LED = 40;
const int PIN_BUZZER = 39;
const int PIN_BUTTON = 38;

Adafruit_ILI9341 tft = Adafruit_ILI9341(TFT_CS, TFT_DC, TFT_RST);
bool displayReady = false;
bool netOk = false;

// ============== COLOR PALETTE ==============
const uint16_t COL_BG     = 0x0883;
const uint16_t COL_CARD   = 0x1906;
const uint16_t COL_TEAL   = 0x0698;
const uint16_t COL_GREEN  = 0x46F0;
const uint16_t COL_AMBER  = 0xFD45;
const uint16_t COL_RED    = 0xFA8A;
const uint16_t COL_WHITE  = 0xFFFF;
const uint16_t COL_GRAY   = 0x94F6;

// ============== DATA FROM BACKEND ==============
char medName[40] = "-";
char medDosage[24] = "-";
char medCondition[40] = "-";
char medTime[12] = "--:--";
int pillsRemaining = -1;
int totalPills = 0;
float pillWeightG = 5.0;

char lineCond[72] = "";
char lineNum[64] = "";
char lastDrawnHash[160] = "";

// ---- backend clock / dose slot tracking ----
// The backend stamps every schedule payload with its own date/time,
// so no NTP is needed: we anchor a soft clock at each fetch.
char serverDate[12] = "";     // YYYY-MM-DD at fetch time
int serverMinAtFetch = -1;    // minutes-of-day at fetch time
unsigned long fetchAnchorMs = 0;
char schedDate[12] = "";      // date the displayed dose is scheduled for
int schedMinutes = -1;        // scheduledTime as minutes-of-day
bool doseTakenToday = false;

unsigned long lastFetch = 0;
unsigned long lastWifiTry = 0;
WiFiClient apiClient;   // plain TCP; see API_BASE_URL note above for https

bool eventInFlight = false;   // one dose event at a time

// ============== LOAD CELL / WEIGHT MODEL ==============
// diagram.json: cell1:DT -> GPIO16, cell1:SCK -> GPIO17.
// Velxio emulates the HX711, so the raw reading is driven from the
// Serial Monitor console (see handleSerial). On real hardware,
// readBinWeightG() is the only function you replace with a proper
// HX711 library call -- everything else already works off it.

const int HX_DT = 16;
const int HX_SCK = 17;

float simBinG = 0;        // current load-cell reading (grams)
float tareOffsetG = 0;    // TARE command offset
float baselineG = 0;      // reference weight for intake detection
bool baselineValid = false;
bool scaleReady = false;  // true once first schedule sync anchors the bin

unsigned long lastTelemetry = 0;
unsigned long nextReminderBeep = 0;
bool reminderActive = false;
char remindedSlot[24] = "";   // "date|HH:MM" we already alarmed for

float readBinWeightG() {
  return simBinG - tareOffsetG;
}

int pillsEstFromWeight() {
  return max(0, (int)((readBinWeightG() / pillWeightG) + 0.5));
}

// ============== LED / BUZZER FEEDBACK ==============

void alertFeedback() {
  // dose detected: LED + buzzer pulse
  for (int i = 0; i < 4; i++) {
    digitalWrite(PIN_LED, HIGH);
    tone(PIN_BUZZER, 2200, 80);
    delay(100);
    digitalWrite(PIN_LED, LOW);
    delay(80);
  }
}

void successFeedback() {
  digitalWrite(PIN_LED, HIGH);
  tone(PIN_BUZZER, 1800, 100);
  delay(130);
  tone(PIN_BUZZER, 2300, 100);
  delay(130);
  tone(PIN_BUZZER, 2800, 160);
  delay(250);
  digitalWrite(PIN_LED, LOW);
}

void networkOkFeedback() {
  digitalWrite(PIN_LED, HIGH);
  tone(PIN_BUZZER, 2600, 90);
  delay(120);
  digitalWrite(PIN_LED, LOW);
}

void networkFailFeedback() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_LED, HIGH);
    tone(PIN_BUZZER, 700, 180);
    delay(220);
    digitalWrite(PIN_LED, LOW);
    delay(140);
  }
}

// ============== SERIAL LOAD-CELL CONSOLE ==============
// Type commands in the Serial Monitor (115200, Newline) to change
// what the load cell "reads". This is how the box is loaded and how
// medicine physically leaves it in Velxio:
//   W 45      -> set bin weight to 45 g
//   TAKE      -> one pill removed (weight -= pillWeightG)
//   TAKE 3    -> three pills removed
//   PUT 2     -> two pills added back
//   PILLS 8   -> set contents to exactly 8 pills
//   TARE      -> zero the scale at current reading
//   STATUS    -> dump current state
//   HELP

char serialBuf[48];

void printHelp() {
  Serial.println("SmartBox console:");
  Serial.println("  W <g>     set bin weight in grams");
  Serial.println("  TAKE [n]  remove n pills (default 1)");
  Serial.println("  PUT [n]   add n pills (default 1)");
  Serial.println("  PILLS <n> set contents to n pills");
  Serial.println("  TARE      zero the scale now");
  Serial.println("  STATUS    show state");
}

void printStatus() {
  Serial.printf("[SCALE] reading=%.1fg tare=%.1fg baseline=%s%.1fg pills=%d est=%d\n",
                readBinWeightG(), tareOffsetG,
                baselineValid ? "" : "~", baselineG,
                pillsRemaining, pillsEstFromWeight());
  Serial.printf("[SLOT] %s @ %s takenToday? server said: %s | reminder=%s\n",
                medName, medTime, doseTakenToday ? "yes" : "no",
                reminderActive ? "ON" : "off");
}

long parseCountArg(const char* arg, long defval) {
  if (!arg || !arg[0]) return defval;
  return atol(arg);
}

void handleSerial() {
  static size_t idx = 0;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c != '\n') {
      if (idx < sizeof(serialBuf) - 1) serialBuf[idx++] = c;
      continue;
    }
    serialBuf[idx] = '\0';
    idx = 0;
    String line = String(serialBuf);
    line.trim();
    if (!line.length()) continue;

    int sp = line.indexOf(' ');
    String cmd = (sp < 0) ? line : line.substring(0, sp);
    cmd.toUpperCase();
    String arg = (sp < 0) ? "" : line.substring(sp + 1);
    arg.trim();

    if (cmd == "HELP") {
      printHelp();
    } else if (cmd == "STATUS") {
      printStatus();
    } else if (cmd == "TARE") {
      tareOffsetG = simBinG;
      baselineG = readBinWeightG();
      Serial.printf("[SCALE] tared, baseline %.1fg\n", baselineG);
    } else if (cmd == "W") {
      float g = arg.toFloat();
      simBinG = g + tareOffsetG;
      Serial.printf("[SCALE] weight forced to %.1fg\n", readBinWeightG());
    } else if (cmd == "PILLS") {
      long n = parseCountArg(arg.c_str(), -1);
      if (n >= 0) {
        simBinG = n * pillWeightG + tareOffsetG;
        Serial.printf("[SCALE] set to %ld pills = %.1fg\n", n, readBinWeightG());
      }
    } else if (cmd == "TAKE" || cmd == "PUT") {
      long n = parseCountArg(arg.c_str(), 1);
      if (n < 0) n = 0;
      float delta = n * pillWeightG;
      if (cmd == "TAKE") {
        // never let the simulated bin go below zero
        delta = min(delta, max(0.0f, readBinWeightG()));
        simBinG -= delta;
        Serial.printf("[SCALE] removed %ld pill(s), reading %.1fg\n",
                      n, readBinWeightG());
      } else {
        simBinG += delta;
        Serial.printf("[SCALE] added %ld pill(s), reading %.1fg\n",
                      n, readBinWeightG());
      }
    } else {
      Serial.printf("[CONSOLE] unknown '%s' (try HELP)\n", serialBuf);
    }
  }
}

// ============== TEXT HELPERS ==============

void clampCopy(char* dst, size_t cap, const char* src, size_t maxChars) {
  size_t n = strlen(src);
  if (n > maxChars) n = maxChars;
  if (n > cap - 1) n = cap - 1;
  memcpy(dst, src, n);
  dst[n] = '\0';
}

void valueForKey(const String& text, const char* key, char* out, size_t cap) {
  String needle = String(key) + "=";
  int start = text.indexOf(needle);
  out[0] = '\0';
  if (start < 0) return;
  start += needle.length();
  int end = text.indexOf('\n', start);
  if (end < 0) end = text.length();
  String value = text.substring(start, end);
  value.trim();
  clampCopy(out, cap, value.c_str(), cap - 1);
}

// classic bitmap font, used for EVERYTHING now (header, footer, body)
void uiText(int16_t x, int16_t y, const char* text, uint16_t color, uint8_t size) {
  tft.setFont();
  tft.setCursor(x, y);
  tft.setTextColor(color);
  tft.setTextSize(size);
  tft.print(text);
}

// ---- direct classic-font rendering (replaces the canvas+blit path) ----

// Shrinks text in place, appending "..." if it doesn't fit maxWidth
void truncateToFit(char* text, uint8_t size, int16_t maxWidth) {
  tft.setFont();
  tft.setTextSize(size);
  int16_t x1, y1; uint16_t w, h;
  tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  if (w <= maxWidth) return;

  while (w > maxWidth - 20 && strlen(text) > 1) {
    text[strlen(text) - 1] = '\0';
    tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  }
  strcat(text, "...");
}

// Draws one line of text, horizontally centered on a 320px-wide screen,
// vertically centered on cy. Straight tft.print() -- no off-screen canvas,
// no per-pixel blit, so nothing to desync mid-line.
void drawCenteredLine(int16_t cy, const char* text, uint8_t size, uint16_t color) {
  tft.setFont();
  tft.setTextSize(size);
  int16_t x1, y1; uint16_t w, h;
  tft.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);

  int16_t x = 160 - (int16_t)w / 2 - x1;
  int16_t y = cy - (int16_t)h / 2 - y1;
  if (x < 6) x = 6;

  tft.setCursor(x, y);
  tft.setTextColor(color);
  tft.print(text);
}

// ---- loading animation: fills only, always safe ----

void showLoader(const char* label) {
  tft.fillScreen(COL_BG);
  tft.fillRect(0, 0, 320, 28, COL_CARD);
  uiText(10, 8, label, COL_WHITE, 2);
  tft.fillRect(58, 118, 204, 12, COL_CARD);
}

void loaderBar(uint8_t segments) {
  if (segments > 8) segments = 8;
  tft.fillRect(60, 120, segments * 25, 8, COL_TEAL);
}

uint16_t stockColor() {
  if (totalPills <= 0 || pillsRemaining < 0) return COL_WHITE;
  if (pillsRemaining > totalPills / 2) return COL_GREEN;
  if (pillsRemaining > totalPills / 5) return COL_AMBER;
  return COL_RED;
}

// ============== STAGED PAINT QUEUE ==============
// Still one job per loop tick -- this part was never the problem, it's kept
// so SPI traffic stays spread out and each stage is still individually
// logged if something ever needs debugging again.

typedef void (*PaintFn)();
static PaintFn paintJobs[8];
static uint8_t paintCount = 0;
static uint8_t paintIndex = 0;
static unsigned long paintNextAt = 0;

void paintFrame() {
  tft.fillScreen(COL_BG);
  tft.fillRect(0, 0, 320, 28, COL_CARD);
  uiText(10, 8, "ADELONIX", COL_WHITE, 2);
  uiText(238, 8, netOk ? "SYNCED" : "RETRY", netOk ? COL_GREEN : COL_AMBER, 2);
  tft.fillRect(0, 212, 320, 28, COL_CARD);
  uiText(64, 220, "SMART MED BOX v1", COL_GRAY, 2);
}

void paintBodyCard() {
  tft.fillRect(0, 28, 320, 184, COL_CARD);
}

void paintMedName() {
  char nameBuf[40];
  strcpy(nameBuf, medName);
  truncateToFit(nameBuf, 3, 300);
  drawCenteredLine(58, nameBuf, 3, COL_WHITE);
}

void paintDoseLine() {
  drawCenteredLine(96, medDosage, 2, COL_TEAL);
  tft.fillRect(110, 112, 100, 4, COL_TEAL);
}

void paintCondLine() {
  char condBuf[72];
  strcpy(condBuf, lineCond);
  truncateToFit(condBuf, 2, 300);
  drawCenteredLine(142, condBuf, 2, COL_GRAY);
}

void paintPillCount() {
  char numBuf[64];
  strcpy(numBuf, lineNum);
  uint8_t numSize = 3;
  truncateToFit(numBuf, numSize, 300);
  int16_t x1, y1; uint16_t w, h;
  tft.getTextBounds(numBuf, 0, 0, &x1, &y1, &w, &h);
  if (w > 300) numSize = 2;
  drawCenteredLine(182, numBuf, numSize, stockColor());
}

void startPaintJobs() {
  paintCount = 0;
  paintIndex = 0;
  paintJobs[paintCount++] = paintFrame;
  paintJobs[paintCount++] = paintBodyCard;
  paintJobs[paintCount++] = paintMedName;
  paintJobs[paintCount++] = paintDoseLine;
  if (reminderActive) paintJobs[paintCount++] = paintReminder; // hides cond line
  else paintJobs[paintCount++] = paintCondLine;
  paintJobs[paintCount++] = paintPillCount;
  paintNextAt = millis() + 40;
  Serial.printf("[TFT] %d paint jobs queued\n", paintCount);
}

void pumpPaintJobs() {
  if (paintIndex >= paintCount) return;
  if ((long)(millis() - paintNextAt) < 0) return;
  Serial.printf("[TFT] job %d/%d\n", paintIndex + 1, paintCount);
  paintJobs[paintIndex]();
  paintIndex++;
  paintNextAt = millis() + 45;
  if (paintIndex >= paintCount) Serial.println("[TFT] all jobs done");
}

bool paintBusy() {
  return paintIndex < paintCount;
}

// ============== NETWORK ==============

String fetchSchedule() {
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/smartbox/" + DEVICE_ID + "/schedule";
  apiClient.stop();
  apiClient.setTimeout(20000);
  http.begin(apiClient, url);
  http.setTimeout(20000);
  http.useHTTP10(true);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("bypass-tunnel-reminder", "true");
  http.addHeader("User-Agent", "Adelonix-SmartBox-Wokwi");
  int code = http.GET();
  String response = http.getString();
  http.end();

  Serial.printf("[NET] GET -> %d (%u bytes)\n", code, response.length());
  Serial.printf("[MEM] heap: %u\n", (unsigned)ESP.getFreeHeap());
  return (code == 200) ? response : String("");
}

int valueForKeyInt(const String& text, const char* key) {
  char buf[16];
  valueForKey(text, key, buf, sizeof(buf));
  return atoi(buf);
}

float valueForKeyFloat(const String& text, const char* key) {
  char buf[16];
  valueForKey(text, key, buf, sizeof(buf));
  return atof(buf);
}

// Minimal JSON escaping for the string fields we send
void jsonEscape(const char* src, char* out, size_t cap) {
  size_t o = 0;
  for (size_t i = 0; src[i] != '\0' && o < cap - 2; i++) {
    char c = src[i];
    if (c == '"' || c == '\\') {
      if (o < cap - 3) out[o++] = '\\';
    }
    out[o++] = c;
  }
  out[o] = '\0';
}

bool sendDoseEvent(float weightBefore, float weightAfter) {
  char medEsc[80], doseEsc[48], condEsc[80], timeEsc[24];
  jsonEscape(medName, medEsc, sizeof(medEsc));
  jsonEscape(medDosage, doseEsc, sizeof(doseEsc));
  jsonEscape(medCondition, condEsc, sizeof(condEsc));
  jsonEscape(medTime, timeEsc, sizeof(timeEsc));

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"binIndex\":0,";
  payload += "\"medicine\":\"" + String(medEsc) + "\",";
  payload += "\"dosage\":\"" + String(doseEsc) + "\",";
  payload += "\"condition\":\"" + String(condEsc) + "\",";
  payload += "\"scheduledTime\":\"" + String(timeEsc) + "\",";
  payload += "\"timestamp\":\"" + String((unsigned long)(millis() / 1000)) + "\",";
  payload += "\"confirmed\":true,";
  payload += "\"verified\":true,";
  payload += "\"weightBefore\":" + String(weightBefore, 1) + ",";
  payload += "\"weightAfter\":" + String(weightAfter, 1) + ",";
  payload += "\"weightLeftG\":" + String(weightAfter, 1) + ",";
  payload += "\"pillsRemaining\":" + String(max(0, pillsRemaining)) + ",";
  payload += "\"scoreImpact\":15";
  payload += "}";

  Serial.println("[DOSE] sending event");
  Serial.println(payload);

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/smartbox/dose-event";
  apiClient.stop();
  apiClient.setTimeout(20000);
  http.begin(apiClient, url);
  http.setTimeout(20000);
  http.useHTTP10(true);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("bypass-tunnel-reminder", "true");
  http.addHeader("User-Agent", "Adelonix-SmartBox-Wokwi");
  int code = http.POST(payload);
  Serial.printf("[NET] POST dose-event -> %d\n", code);
  http.end();

  return (code == 200 || code == 201);
}

bool applyData(const String& response) {
  valueForKey(response, "medicine", medName, sizeof(medName));
  valueForKey(response, "dosage", medDosage, sizeof(medDosage));
  valueForKey(response, "condition", medCondition, sizeof(medCondition));
  int pr = valueForKeyInt(response, "pillsRemaining");
  int tp = valueForKeyInt(response, "totalPills");
  float pw = valueForKeyFloat(response, "pillWeightG");

  // ---- backend clock sync + dose-slot info ----
  char timeBuf[8];
  valueForKey(response, "serverDate", serverDate, sizeof(serverDate));
  valueForKey(response, "serverTime", timeBuf, sizeof(timeBuf));
  int sh = 0, sm = 0;
  if (sscanf(timeBuf, "%d:%d", &sh, &sm) == 2) {
    serverMinAtFetch = sh * 60 + sm;
    fetchAnchorMs = millis();
  }
  valueForKey(response, "scheduledDate", schedDate, sizeof(schedDate));
  valueForKey(response, "scheduledTime", medTime, sizeof(medTime));
  int th = 0, tm = 0;
  if (sscanf(medTime, "%d:%d", &th, &tm) == 2) schedMinutes = th * 60 + tm;
  char ttBuf[4];
  valueForKey(response, "doseTakenToday", ttBuf, sizeof(ttBuf));
  doseTakenToday = atoi(ttBuf) == 1;

  bool changed = false;
  if (pr >= 0 && pr != pillsRemaining) { pillsRemaining = pr; changed = true; }
  if (tp > 0 && tp != totalPills) { totalPills = tp; changed = true; }
  if (pw > 0.1 && fabs(pw - pillWeightG) > 0.05) { pillWeightG = pw; changed = true; }

  // ---- anchor the simulated load cell once, from the backend count.
  // After this the scale is authoritative: only TAKE/PUT/W commands
  // (or real load-cell changes) move it.
  if (!scaleReady && pillsRemaining >= 0) {
    simBinG = pillsRemaining * pillWeightG + tareOffsetG;
    baselineG = readBinWeightG();
    baselineValid = true;
    scaleReady = true;
    Serial.printf("[SCALE] anchored to backend: %.1fg (%d pills x %.1fg)\n",
                  baselineG, pillsRemaining, pillWeightG);
  }

  if (pillsRemaining >= 0) {
    long tenths = (long)(((float)pillsRemaining * pillWeightG) * 10.0 + 0.5);
    snprintf(lineNum, sizeof(lineNum), "%d pills | %ld.%ld g",
             pillsRemaining, tenths / 10L, tenths % 10L);
  } else {
    snprintf(lineNum, sizeof(lineNum), "waiting for data");
  }
  snprintf(lineCond, sizeof(lineCond), "%s | AT %s", medCondition, medTime);

  char hash[224];
  int pwTenths = (int)(pillWeightG * 10.0 + 0.5);
  snprintf(hash, sizeof(hash), "%.38s|%.22s|%.38s|%.10s|%d|%d|%d",
           medName, medDosage, medCondition, medTime, pillsRemaining, totalPills, pwTenths);
  if (strcmp(hash, lastDrawnHash) != 0) {
    strncpy(lastDrawnHash, hash, sizeof(lastDrawnHash) - 1);
    changed = true;
  }

  Serial.println(changed ? "[DATA] changed" : "[DATA] unchanged");
  return changed;
}

void syncOnce() {
  String response = fetchSchedule();
  loaderBar(7);
  if (response.length() > 0) {
    netOk = true;
    if (applyData(response)) {
      loaderBar(8);
      Serial.println("[SETTLE] pausing before paint");
      delay(700);
      startPaintJobs();
    } else {
      loaderBar(8);
    }
  } else {
    netOk = false;
    Serial.println("[NET] fetch failed, showing retry state");
    startPaintJobs();
  }
}

// ============== SOFT CLOCK / REMINDER ==============

int nowMinutesOfDay() {
  if (serverMinAtFetch < 0) return -1;
  long elapsedMin = (long)((millis() - fetchAnchorMs) / 60000UL);
  return (serverMinAtFetch + (int)(elapsedMin % 1440L)) % 1440;
}

bool doseDue() {
  if (!scaleReady || schedMinutes < 0 || serverMinAtFetch < 0) return false;
  if (doseTakenToday) return false;
  // only remind if the displayed slot is scheduled for today
  if (schedDate[0] && serverDate[0] && strcmp(schedDate, serverDate) != 0) return false;
  int now = nowMinutesOfDay();
  if (now < 0) return false;
  return now >= schedMinutes && now < schedMinutes + 180; // 3h nag window
}

void doseSlotId(char* out, size_t cap) {
  snprintf(out, cap, "%.10s|%.5s", schedDate, medTime);
}

void updateReminder() {
  bool due = doseDue();

  if (!due) {
    if (reminderActive) { // window passed or backend says taken
      reminderActive = false;
      digitalWrite(PIN_LED, LOW);
      Serial.println("[REMIND] cleared");
      strncpy(lastDrawnHash, "", sizeof(lastDrawnHash) - 1);
      startPaintJobs(); // repaint without banner
    }
    return;
  }

  char slot[24];
  doseSlotId(slot, sizeof(slot));
  if (strcmp(remindedSlot, slot) != 0) {
    strcpy(remindedSlot, slot);
    reminderActive = true;
    nextReminderBeep = 0;
    Serial.printf("[REMIND] dose due: %s @ %s\n", medName, medTime);
    strncpy(lastDrawnHash, "", sizeof(lastDrawnHash) - 1);
    startPaintJobs();
  }

  if (reminderActive && millis() > nextReminderBeep) {
    tone(PIN_BUZZER, 2400, 150);
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
    nextReminderBeep = millis() + 8000;
  }
}

void paintReminder() {
  tft.fillRect(6, 126, 308, 34, COL_RED);
  drawCenteredLine(143, "DUE NOW - TAKE MED", 2, COL_WHITE);
}

// ============== INTAKE DETECTION (WEIGHT DROP) ==============
// The load cell is the source of truth. Any drop of >= 60% of one
// pill since baseline means medicine left the box -> verified dose
// event goes to the backend. A rise means refill -> silent re-baseline.

void monitorWeight() {
  static unsigned long lastCheck = 0;
  if (millis() - lastCheck < 400) return;
  lastCheck = millis();

  if (!baselineValid || eventInFlight) return;

  float cur = readBinWeightG();
  float onePill = max(0.5f, pillWeightG);
  float drop = baselineG - cur;
  float rise = cur - baselineG;

  if (drop >= onePill * 0.6) {
    eventInFlight = true;

    int removedPills = max(1, (int)((drop / onePill) + 0.5));
    float weightBefore = baselineG;

    Serial.printf("[INTAKE] %.1fg lost (~%d pills)\n", drop, removedPills);
    alertFeedback();

    if (pillsRemaining >= 0) {
      pillsRemaining = max(0, pillsRemaining - removedPills);
    } else {
      pillsRemaining = pillsEstFromWeight();
    }

    if (pillsRemaining >= 0) {
      long tenths = (long)(cur * 10.0 + 0.5);
      snprintf(lineNum, sizeof(lineNum), "%d pills | %ld.%ld g",
               pillsRemaining, tenths / 10L, tenths % 10L);
      strncpy(lastDrawnHash, "", sizeof(lastDrawnHash) - 1);
      startPaintJobs();
    }

    // reminder satisfied by physical removal
    reminderActive = false;
    digitalWrite(PIN_LED, LOW);

    bool ok = sendDoseEvent(weightBefore, cur);
    if (ok) {
      Serial.println("[DOSE] verified by backend");
      successFeedback();
    } else {
      Serial.println("[DOSE] backend unreachable/rejected");
      networkFailFeedback();
    }

    baselineG = cur;
    lastTelemetry = millis(); // don't double-fire telemetry right away
    eventInFlight = false;

  } else if (rise >= onePill * 0.6) {
    Serial.printf("[SCALE] refill: +%.1fg\n", rise);
    baselineG = cur;
  }
}

// ============== WEIGHT TELEMETRY ==============

void sendWeightTelemetry() {
  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"weightG\":" + String(readBinWeightG(), 1) + ",";
  payload += "\"pillsEst\":" + String(pillsEstFromWeight()) + ",";
  payload += "\"source\":\"velxio-sim\"";
  payload += "}";

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/smartbox/weight";
  apiClient.stop();
  apiClient.setTimeout(10000);
  http.begin(apiClient, url);
  http.setTimeout(10000);
  http.useHTTP10(true);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("bypass-tunnel-reminder", "true");
  http.addHeader("User-Agent", "Adelonix-SmartBox-Wokwi");
  int code = http.POST(payload);
  http.end();
  Serial.printf("[NET] POST weight -> %d (%s)\n", code, payload.c_str());
}

// ============== BUTTON / DOSE DETECTION ==============

// The green button physically ejects one pill from the bin: it lowers
// the simulated load-cell reading, and monitorWeight() turns that
// weight drop into a verified backend dose event -- exactly like a
// real pill leaving a real box.
void handleButton() {
  if (digitalRead(PIN_BUTTON) != LOW) return;

  // debounce: still pressed after 30ms?
  delay(30);
  if (digitalRead(PIN_BUTTON) != LOW) return;

  float reading = readBinWeightG();
  float delta = min(pillWeightG, max(0.0f, reading));
  simBinG -= delta;
  tone(PIN_BUZZER, 2000, 60);
  Serial.printf("[BTN] pill ejected -> %.1fg\n", readBinWeightG());

  // wait for release so one press = one pill
  while (digitalRead(PIN_BUTTON) == LOW) delay(10);
}

// ============== LIFECYCLE ==============

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(TFT_CS, OUTPUT);
  digitalWrite(TFT_CS, HIGH);
  SPI.begin(TFT_SCK, TFT_MISO, TFT_MOSI, TFT_CS);
  tft.begin();
  tft.setRotation(1); // Landscape 320x240
  displayReady = true;

  // hardware feedback pins
  pinMode(PIN_LED, OUTPUT);
  digitalWrite(PIN_LED, LOW);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  Serial.println("[BOOT] smartbox display");

  // PHASE 1: standalone loading animation, zero network involved
  showLoader("STARTING...");
  for (uint8_t seg = 1; seg <= 8; seg++) {
    loaderBar(seg);
    Serial.printf("[LOAD] segment %d\n", seg);
    delay(220);
  }

  // PHASE 2: wifi
  showLoader("CONNECTING...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("[WIFI] connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    digitalWrite(PIN_LED, !digitalRead(PIN_LED)); // LED blinks while connecting
    delay(300);
    Serial.print(".");
  }
  digitalWrite(PIN_LED, LOW);
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WIFI] FAILED");
    netOk = false;
    snprintf(lineNum, sizeof(lineNum), "waiting for data");
    startPaintJobs();
    return;
  }

  Serial.print("[WIFI] connected IP: ");
  Serial.println(WiFi.localIP());

  // PHASE 3: fetch
  showLoader("FETCHING DATA");
  loaderBar(5);
  syncOnce();
}

void loop() {
  pumpPaintJobs();
  handleSerial();
  handleButton();
  monitorWeight();
  updateReminder();

  static unsigned long hb = 0;
  if (millis() - hb > 3000) {
    Serial.printf("[HB] alive %lus\n", millis() / 1000);
    hb = millis();
  }

  if (millis() - lastFetch > 30000 && !paintBusy()) {
    lastFetch = millis();
    if (WiFi.status() == WL_CONNECTED) {
      String response = fetchSchedule();
      if (response.length() > 0) {
        netOk = true;
        if (applyData(response)) startPaintJobs();
        else updateReminder(); // slot info may have changed
      } else {
        netOk = false;
      }
    } else if (millis() - lastWifiTry > 15000) {
      lastWifiTry = millis();
      Serial.println("[WIFI] retrying");
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
  }

  // periodic load-cell telemetry -> backend
  if (scaleReady && !eventInFlight &&
      WiFi.status() == WL_CONNECTED &&
      millis() - lastTelemetry > 60000) {
    lastTelemetry = millis();
    sendWeightTelemetry();
  }

  delay(40);
}
