/*
 * ============================================================
 *  ADELONIX SMART BOX - Wokwi Integrated Demo Firmware v3.5
 *  ESP32-S3 | HX711 | E-Paper | AI Noise Filter | WiFi | HTTP
 * ============================================================
 *
 * Demo flow:
 * 1. ESP32 connects to WiFi and blinks the status LED.
 * 2. Press the green button to simulate one pill being removed.
 * 3. Firmware filters noisy HX711 readings with median + Kalman filtering.
 * 4. It blinks/beeps and sends a verified event to the Nest backend.
 * 5. Mobile IoT tab reads /api/smartbox/latest and displays the event.
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SPI.h>

// Browser demo: no external libraries. The e-paper is driven directly over SPI.

// ============== MODE ==============
const bool IS_SIMULATION = true;

// ============== WIFI / BACKEND ==============
const char* WIFI_SSID = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";
const char* API_BASE_URL = "https://wild-guests-win.loca.lt";
const char* DEVICE_ID = "SMARTBOX-0001";
const char* API_KEY = "change-me-smartbox-device-token";

// ============== PIN MAP ==============
const int HX_DT = 16;
const int HX_SCK = 17;
const int PIN_BUTTON = 38;
const int PIN_BUZZER = 39;
const int PIN_LED = 40;

const int EPD_CS = 10;
const int EPD_DC = 11;
const int EPD_RST = 12;
const int EPD_BUSY = 13;
const int EPD_SCK = 14;
const int EPD_MOSI = 21;

// ============== TUNABLES ==============
const float PILL_WEIGHT_G = 5.0;
const float INITIAL_WEIGHT_G = 50.0;
const float DOSE_DROP_THRESHOLD_G = 2.0;
const int FILTER_WINDOW_SIZE = 7;

// ============== MEDICINE IN THE BOX ==============
struct Medicine {
  String name;
  String dosage;
  String condition;
  String scheduledTime;
  int binIndex;
  float pillWeightG;
  int totalPills;
  int remainingPills;
};

Medicine binMedicine = {
  "Syncing",
  "backend",
  "Waiting schedule",
  "--:--",
  0,
  PILL_WEIGHT_G,
  0,
  0,
};

bool displayReady = false;

const int EPD_RAW_WIDTH = 128;
const int EPD_RAW_HEIGHT = 296;
const int EPD_VIEW_WIDTH = 296;
const int EPD_VIEW_HEIGHT = 128;
const int EPD_BUFFER_SIZE = EPD_RAW_WIDTH * EPD_RAW_HEIGHT / 8;
uint8_t epdBuffer[EPD_BUFFER_SIZE];

class AINoiseFilter {
  private:
    float estimate = INITIAL_WEIGHT_G;
    float errorEstimate = 1.0;
    float processNoise = 0.01;
    float sensorNoise = 2.0;
    float readings[15] = {0};
    int index = 0;

  public:
    void reset(float initial) {
      estimate = initial;
      errorEstimate = 1.0;
      index = 0;
      for (int i = 0; i < 15; i++) readings[i] = 0;
    }

    float kalmanUpdate(float measurement) {
      float predictionError = errorEstimate + processNoise;
      float kalmanGain = predictionError / (predictionError + sensorNoise);
      estimate = estimate + kalmanGain * (measurement - estimate);
      errorEstimate = (1 - kalmanGain) * predictionError;
      return estimate;
    }

    float medianFilter(float newReading) {
      readings[index] = newReading;
      index = (index + 1) % FILTER_WINDOW_SIZE;

      float sorted[FILTER_WINDOW_SIZE];
      int count = 0;
      for (int i = 0; i < FILTER_WINDOW_SIZE; i++) {
        if (readings[i] > 0.01) sorted[count++] = readings[i];
      }
      if (count == 0) return newReading;

      for (int i = 0; i < count - 1; i++) {
        for (int j = 0; j < count - i - 1; j++) {
          if (sorted[j] > sorted[j + 1]) {
            float temp = sorted[j];
            sorted[j] = sorted[j + 1];
            sorted[j + 1] = temp;
          }
        }
      }
      return sorted[count / 2];
    }

    float process(float raw) {
      return kalmanUpdate(medianFilter(raw));
    }
};

AINoiseFilter aiFilter;

float baselineWeight = INITIAL_WEIGHT_G;
float currentWeight = INITIAL_WEIGHT_G;
float simulatedWeight = INITIAL_WEIGHT_G;
bool scaleReady = false;
bool eventInFlight = false;
WiFiClientSecure secureClient;
bool scheduleSynced = false;
unsigned long lastScheduleSync = 0;

const uint8_t* glyphFor(char raw) {
  static const uint8_t blank[5] = {0, 0, 0, 0, 0};
  static const uint8_t glyphs[][5] = {
    {0x7E, 0x11, 0x11, 0x11, 0x7E}, // A
    {0x7F, 0x49, 0x49, 0x49, 0x36}, // B
    {0x3E, 0x41, 0x41, 0x41, 0x22}, // C
    {0x7F, 0x41, 0x41, 0x22, 0x1C}, // D
    {0x7F, 0x49, 0x49, 0x49, 0x41}, // E
    {0x7F, 0x09, 0x09, 0x09, 0x01}, // F
    {0x3E, 0x41, 0x49, 0x49, 0x7A}, // G
    {0x7F, 0x08, 0x08, 0x08, 0x7F}, // H
    {0x00, 0x41, 0x7F, 0x41, 0x00}, // I
    {0x20, 0x40, 0x41, 0x3F, 0x01}, // J
    {0x7F, 0x08, 0x14, 0x22, 0x41}, // K
    {0x7F, 0x40, 0x40, 0x40, 0x40}, // L
    {0x7F, 0x02, 0x0C, 0x02, 0x7F}, // M
    {0x7F, 0x04, 0x08, 0x10, 0x7F}, // N
    {0x3E, 0x41, 0x41, 0x41, 0x3E}, // O
    {0x7F, 0x09, 0x09, 0x09, 0x06}, // P
    {0x3E, 0x41, 0x51, 0x21, 0x5E}, // Q
    {0x7F, 0x09, 0x19, 0x29, 0x46}, // R
    {0x46, 0x49, 0x49, 0x49, 0x31}, // S
    {0x01, 0x01, 0x7F, 0x01, 0x01}, // T
    {0x3F, 0x40, 0x40, 0x40, 0x3F}, // U
    {0x1F, 0x20, 0x40, 0x20, 0x1F}, // V
    {0x3F, 0x40, 0x38, 0x40, 0x3F}, // W
    {0x63, 0x14, 0x08, 0x14, 0x63}, // X
    {0x07, 0x08, 0x70, 0x08, 0x07}, // Y
    {0x61, 0x51, 0x49, 0x45, 0x43}, // Z
    {0x3E, 0x51, 0x49, 0x45, 0x3E}, // 0
    {0x00, 0x42, 0x7F, 0x40, 0x00}, // 1
    {0x42, 0x61, 0x51, 0x49, 0x46}, // 2
    {0x21, 0x41, 0x45, 0x4B, 0x31}, // 3
    {0x18, 0x14, 0x12, 0x7F, 0x10}, // 4
    {0x27, 0x45, 0x45, 0x45, 0x39}, // 5
    {0x3C, 0x4A, 0x49, 0x49, 0x30}, // 6
    {0x01, 0x71, 0x09, 0x05, 0x03}, // 7
    {0x36, 0x49, 0x49, 0x49, 0x36}, // 8
    {0x06, 0x49, 0x49, 0x29, 0x1E}, // 9
    {0x00, 0x36, 0x36, 0x00, 0x00}, // :
    {0x08, 0x08, 0x3E, 0x08, 0x08}, // +
    {0x08, 0x08, 0x08, 0x08, 0x08}, // -
    {0x40, 0x30, 0x08, 0x06, 0x01}, // /
    {0x00, 0x60, 0x60, 0x00, 0x00}, // .
  };

  char c = raw;
  if (c >= 'a' && c <= 'z') c -= 32;
  if (c >= 'A' && c <= 'Z') return glyphs[c - 'A'];
  if (c >= '0' && c <= '9') return glyphs[26 + c - '0'];
  if (c == ':') return glyphs[36];
  if (c == '+') return glyphs[37];
  if (c == '-') return glyphs[38];
  if (c == '/') return glyphs[39];
  if (c == '.') return glyphs[40];
  return blank;
}

void epdCommand(uint8_t command) {
  digitalWrite(EPD_DC, LOW);
  digitalWrite(EPD_CS, LOW);
  SPI.transfer(command);
  digitalWrite(EPD_CS, HIGH);
}

void epdData(uint8_t data) {
  digitalWrite(EPD_DC, HIGH);
  digitalWrite(EPD_CS, LOW);
  SPI.transfer(data);
  digitalWrite(EPD_CS, HIGH);
}

void epdWait() {
  unsigned long start = millis();
  while (digitalRead(EPD_BUSY) == HIGH && millis() - start < 5000) {
    delay(10);
  }
}

void epdReset() {
  digitalWrite(EPD_RST, LOW);
  delay(20);
  digitalWrite(EPD_RST, HIGH);
  delay(20);
}

void epdSetWindowAndCursor() {
  epdCommand(0x44);
  epdData(0x00);
  epdData((EPD_RAW_WIDTH / 8) - 1);
  epdCommand(0x45);
  epdData(0x00);
  epdData(0x00);
  epdData((EPD_RAW_HEIGHT - 1) & 0xFF);
  epdData(((EPD_RAW_HEIGHT - 1) >> 8) & 0xFF);
  epdCommand(0x4E);
  epdData(0x00);
  epdCommand(0x4F);
  epdData(0x00);
  epdData(0x00);
  epdWait();
}

void epdClearBuffer() {
  memset(epdBuffer, 0xFF, sizeof(epdBuffer));
}

void epdRawPixel(int x, int y, bool black) {
  if (x < 0 || x >= EPD_RAW_WIDTH || y < 0 || y >= EPD_RAW_HEIGHT) return;
  int index = (x / 8) + y * (EPD_RAW_WIDTH / 8);
  uint8_t mask = 0x80 >> (x % 8);
  if (black) {
    epdBuffer[index] &= ~mask;
  } else {
    epdBuffer[index] |= mask;
  }
}

void epdPixel(int x, int y, bool black) {
  if (x < 0 || x >= EPD_VIEW_WIDTH || y < 0 || y >= EPD_VIEW_HEIGHT) return;

  // The 2.9" Wokwi e-paper memory is 128x296, while the module is shown
  // landscape. Rotate the app's 296x128 layout into the panel memory.
  int rawX = EPD_RAW_WIDTH - 1 - y;
  int rawY = x;
  epdRawPixel(rawX, rawY, black);
}

void epdRect(int x, int y, int w, int h, bool black) {
  for (int yy = y; yy < y + h; yy++) {
    for (int xx = x; xx < x + w; xx++) {
      epdPixel(xx, yy, black);
    }
  }
}

void epdFrame(int x, int y, int w, int h) {
  epdRect(x, y, w, 2, true);
  epdRect(x, y + h - 2, w, 2, true);
  epdRect(x, y, 2, h, true);
  epdRect(x + w - 2, y, 2, h, true);
}

void epdChar(int x, int y, char c, int scale) {
  const uint8_t* glyph = glyphFor(c);
  for (int col = 0; col < 5; col++) {
    for (int row = 0; row < 7; row++) {
      if (glyph[col] & (1 << row)) {
        epdRect(x + col * scale, y + row * scale, scale, scale, true);
      }
    }
  }
}

void epdText(int x, int y, const char* text, int scale) {
  int cursor = x;
  int step = 6 * scale;
  while (*text && cursor < EPD_VIEW_WIDTH - step) {
    epdChar(cursor, y, *text, scale);
    cursor += step;
    text++;
  }
}

void epdRefresh() {
  epdSetWindowAndCursor();
  epdCommand(0x24);
  for (int i = 0; i < EPD_BUFFER_SIZE; i++) {
    epdData(epdBuffer[i]);
  }
  epdCommand(0x22);
  epdData(0xF7);
  epdCommand(0x20);
  epdWait();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(PIN_BUTTON, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_LED, LOW);

  aiFilter.reset(INITIAL_WEIGHT_G);
  initDisplay();
  updateDisplay("Adelonix", "Booting", "Smart Medbox");
  bootFeedback();

  scaleReady = false;
  Serial.println("HX711 browser simulation active");

  Serial.println();
  Serial.println("========================================");
  Serial.println(" ADELONIX SMART BOX - INTEGRATED DEMO");
  Serial.println(" Button: GPIO38 | LED: GPIO40 | Buzzer: GPIO39");
  Serial.println(" Press green button to remove one pill");
  Serial.println("========================================");

  connectWiFi();
  fetchBackendSchedule();
  drawMedicineSchedule();
}

void loop() {
  unsigned long syncInterval = scheduleSynced ? 60000 : 15000;
  if (WiFi.status() == WL_CONNECTED && millis() - lastScheduleSync > syncInterval) {
    fetchBackendSchedule();
    drawMedicineSchedule();
  }

  if (digitalRead(PIN_BUTTON) == LOW && !eventInFlight) {
    delay(200);
    if (digitalRead(PIN_BUTTON) == LOW) {
      simulatePillRemoval();
      while (digitalRead(PIN_BUTTON) == LOW) delay(10);
    }
  }

  float raw = readSensor();
  currentWeight = aiFilter.process(raw);

  static unsigned long lastPrint = 0;
  if (millis() - lastPrint > 400) {
    int pills = max(0, int((currentWeight / binMedicine.pillWeightG) + 0.5));
    Serial.printf("[LIVE] Bin 1 %s %s | Raw:%5.1fg | AI:%5.1fg | Pills:%2d | Label:%2d | Baseline:%5.1fg\n",
                  binMedicine.name.c_str(),
                  binMedicine.dosage.c_str(),
                  raw,
                  currentWeight,
                  pills,
                  binMedicine.remainingPills,
                  baselineWeight);
    lastPrint = millis();
  }

  float drop = baselineWeight - currentWeight;
  if (!eventInFlight && drop > DOSE_DROP_THRESHOLD_G) {
    eventInFlight = true;
    Serial.println();
    Serial.println("AI DETECTION: real pill-weight drop confirmed");
    Serial.printf("Drop %.1fg passed threshold %.1fg\n", drop, DOSE_DROP_THRESHOLD_G);
    drawPendingDose();
    alertFeedback();
    sendDoseEvent(baselineWeight, currentWeight, true);
    baselineWeight = currentWeight;
    successFeedback();
    drawDoseTaken();
    delay(2500);
    resetForNextDemo();
  }

  delay(100);
}

float readSensor() {
  float jitter = random(-15, 16) / 10.0;
  return max(0.0f, simulatedWeight + jitter);
}

void simulatePillRemoval() {
  if (simulatedWeight < binMedicine.pillWeightG) return;
  simulatedWeight -= binMedicine.pillWeightG;
  if (binMedicine.remainingPills > 0) {
    binMedicine.remainingPills--;
  }
  Serial.println();
  Serial.printf("BUTTON: simulated one %s %s pill removed from bin 1\n",
                binMedicine.name.c_str(),
                binMedicine.dosage.c_str());
  Serial.printf("Medicine label now shows %d pills remaining\n", binMedicine.remainingPills);
  drawPendingDose();
}

String escapeJson(String value) {
  value.replace("\\", "\\\\");
  value.replace("\"", "\\\"");
  return value;
}

String valueForKey(const String& text, const String& key) {
  String needle = key + "=";
  int start = text.indexOf(needle);
  if (start < 0) return "";
  start += needle.length();
  int end = text.indexOf('\n', start);
  if (end < 0) end = text.length();
  String value = text.substring(start, end);
  value.trim();
  return value;
}

void applyScheduleValue(const String& text, const String& key, String& target) {
  String value = valueForKey(text, key);
  if (value.length() > 0) {
    target = value.substring(0, 48);
  }
}

void fetchBackendSchedule() {
  lastScheduleSync = millis();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Schedule sync skipped: WiFi offline");
    updateDisplay("Schedule sync", "WiFi offline", "Retrying");
    return;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/smartbox/" + DEVICE_ID + "/schedule";
  updateDisplay("Schedule sync", "Fetching backend", "Please wait");

  secureClient.stop();
  secureClient.setInsecure();
  secureClient.setTimeout(20000);
  http.begin(secureClient, url);
  http.setTimeout(20000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.useHTTP10(true);
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("bypass-tunnel-reminder", "true");
  http.addHeader("User-Agent", "Adelonix-SmartBox-Wokwi");
  int code = http.GET();
  String response = http.getString();
  http.end();

  Serial.println();
  Serial.println("--- SCHEDULE SYNC ---");
  Serial.printf("GET %s -> %d\n", url.c_str(), code);
  Serial.println(response);
  Serial.println("--- END SCHEDULE ---");

  if (code != 200) {
    scheduleSynced = false;
    char codeLine[32];
    snprintf(codeLine, sizeof(codeLine), "HTTP code %d", code);
    updateDisplay("Schedule failed", codeLine, "Retrying soon");
    networkFailFeedback();
    return;
  }

  applyScheduleValue(response, "medicine", binMedicine.name);
  applyScheduleValue(response, "dosage", binMedicine.dosage);
  applyScheduleValue(response, "condition", binMedicine.condition);
  applyScheduleValue(response, "scheduledTime", binMedicine.scheduledTime);

  int totalPills = valueForKey(response, "totalPills").toInt();
  int pillsRemaining = valueForKey(response, "pillsRemaining").toInt();
  float pillWeightG = valueForKey(response, "pillWeightG").toFloat();

  if (totalPills > 0) binMedicine.totalPills = totalPills;
  if (pillsRemaining >= 0) binMedicine.remainingPills = pillsRemaining;
  if (pillWeightG > 0.1) binMedicine.pillWeightG = pillWeightG;

  simulatedWeight = binMedicine.remainingPills * binMedicine.pillWeightG;
  baselineWeight = simulatedWeight;
  currentWeight = simulatedWeight;
  aiFilter.reset(simulatedWeight);
  scheduleSynced = true;
  networkOkFeedback();
}

void sendDoseEvent(float weightBefore, float weightAfter, bool confirmed) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected - trying reconnect");
    connectWiFi();
  }

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"binIndex\":0,";
  payload += "\"medicine\":\"" + escapeJson(binMedicine.name) + "\",";
  payload += "\"dosage\":\"" + escapeJson(binMedicine.dosage) + "\",";
  payload += "\"condition\":\"" + escapeJson(binMedicine.condition) + "\",";
  payload += "\"scheduledTime\":\"" + escapeJson(binMedicine.scheduledTime) + "\",";
  payload += "\"timestamp\":\"" + String((unsigned long)(millis() / 1000)) + "\",";
  payload += "\"confirmed\":" + String(confirmed ? "true" : "false") + ",";
  payload += "\"verified\":" + String(confirmed ? "true" : "false") + ",";
  payload += "\"weightBefore\":" + String(weightBefore, 1) + ",";
  payload += "\"weightAfter\":" + String(weightAfter, 1) + ",";
  payload += "\"weightLeftG\":" + String(weightAfter, 1) + ",";
  payload += "\"pillsRemaining\":" + String(binMedicine.remainingPills) + ",";
  payload += "\"scoreImpact\":" + String(confirmed ? 15 : 0);
  payload += "}";

  Serial.println();
  Serial.println("--- NETWORK TRANSMISSION ---");
  Serial.println(payload);

  HTTPClient http;
  secureClient.stop();
  secureClient.setInsecure();
  secureClient.setTimeout(20000);
  http.begin(secureClient, String(API_BASE_URL) + "/api/smartbox/dose-event");
  http.setTimeout(20000);
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.useHTTP10(true);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + API_KEY);
  http.addHeader("ngrok-skip-browser-warning", "true");
  http.addHeader("bypass-tunnel-reminder", "true");
  http.addHeader("User-Agent", "Adelonix-SmartBox-Wokwi");
  int code = http.POST(payload);
  String response = http.getString();
  http.end();

  Serial.printf("HTTP status: %d\n", code);
  Serial.println(response);
  Serial.println("--- END ---");

  if (code == 200 || code == 201) {
    networkOkFeedback();
  } else {
    networkFailFeedback();
  }
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting WiFi");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    digitalWrite(PIN_LED, !digitalRead(PIN_LED));
    delay(300);
    Serial.print(".");
  }
  digitalWrite(PIN_LED, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("WiFi connected | IP: ");
    Serial.println(WiFi.localIP());
    updateDisplay("WiFi connected", WiFi.localIP().toString().c_str(), "Ready");
    networkOkFeedback();
  } else {
    Serial.println();
    Serial.println("WiFi failed");
    updateDisplay("WiFi failed", "Check Wokwi", "No sync");
    networkFailFeedback();
  }
}

void initDisplay() {
  pinMode(EPD_CS, OUTPUT);
  pinMode(EPD_DC, OUTPUT);
  pinMode(EPD_RST, OUTPUT);
  pinMode(EPD_BUSY, INPUT);
  digitalWrite(EPD_CS, HIGH);
  SPI.begin(EPD_SCK, -1, EPD_MOSI, EPD_CS);
  epdReset();
  epdCommand(0x12);
  epdWait();
  epdCommand(0x01);
  epdData(0x27);
  epdData(0x01);
  epdData(0x00);
  epdCommand(0x11);
  epdData(0x03);
  epdCommand(0x3C);
  epdData(0x05);
  epdCommand(0x18);
  epdData(0x80);
  epdSetWindowAndCursor();
  epdClearBuffer();
  epdRefresh();
  displayReady = true;
}

void updateDisplay(const char* line1, const char* line2, const char* line3) {
  virtualDisplay(line1, line2, line3);
  if (!displayReady) return;
  epdClearBuffer();
  epdText(12, 18, line1, 2);
  epdText(12, 54, line2, 1);
  epdText(12, 80, line3, 1);
  epdFrame(4, 4, 288, 120);
  epdRefresh();
}

void drawMedicineSchedule() {
  char pillsLine[40];
  char timeLine[48];
  char weightLine[40];
  char medLine[48];
  char doseLine[32];
  snprintf(pillsLine, sizeof(pillsLine), "%d pills left", binMedicine.remainingPills);
  snprintf(timeLine, sizeof(timeLine), "%s %s at %s", binMedicine.name.c_str(), binMedicine.dosage.c_str(), binMedicine.scheduledTime.c_str());
  snprintf(medLine, sizeof(medLine), "%s %s", binMedicine.name.c_str(), binMedicine.dosage.c_str());
  snprintf(doseLine, sizeof(doseLine), "DOSE %s", binMedicine.scheduledTime.c_str());
  snprintf(weightLine, sizeof(weightLine), "Bin 1 %.1fg READY", simulatedWeight);

  virtualDisplay(timeLine, binMedicine.condition.c_str(), pillsLine);

  if (!displayReady) return;
  epdClearBuffer();
  epdText(10, 8, "ADELONIX SMART BOX", 2);
  epdFrame(8, 36, 176, 58);
  epdText(16, 46, medLine, 1);
  epdText(16, 64, binMedicine.condition.c_str(), 1);
  epdText(16, 82, doseLine, 1);
  epdFrame(192, 36, 94, 58);
  epdText(202, 48, pillsLine, 1);
  epdText(202, 68, "BIN 1", 1);
  epdText(202, 86, weightLine, 1);
  epdText(10, 108, "READY", 2);
  epdRefresh();
}

void drawPendingDose() {
  char line2[48];
  char line3[48];
  snprintf(line2, sizeof(line2), "%s %s", binMedicine.name.c_str(), binMedicine.dosage.c_str());
  snprintf(line3, sizeof(line3), "%d pills left - sending", binMedicine.remainingPills);
  virtualDisplay("PILL REMOVED", line2, line3);

  if (!displayReady) return;
  epdClearBuffer();
  epdText(10, 10, "PILL REMOVED", 2);
  epdFrame(8, 42, 280, 48);
  epdText(18, 54, line2, 1);
  epdText(18, 72, "AI DROP OK - SENDING", 1);
  epdText(10, 104, "SYNCING", 2);
  epdRefresh();
}

void drawDoseTaken() {
  char line2[48];
  char line3[48];
  snprintf(line2, sizeof(line2), "%s %s", binMedicine.name.c_str(), binMedicine.dosage.c_str());
  snprintf(line3, sizeof(line3), "%d pills left | Score +15", binMedicine.remainingPills);
  virtualDisplay("DOSE TAKEN", line2, line3);

  if (!displayReady) return;
  epdClearBuffer();
  epdText(10, 10, "DOSE TAKEN", 2);
  epdFrame(8, 42, 280, 46);
  epdText(18, 54, line2, 1);
  epdText(18, 72, line3, 1);
  epdText(10, 102, "SCORE +15", 2);
  epdText(160, 108, "BACKEND SYNCED", 1);
  epdRefresh();
}

void virtualDisplay(const char* line1, const char* line2, const char* line3) {
  Serial.println();
  Serial.println("+--------------------------------------+");
  Serial.println("|          ADELONIX E-PAPER            |");
  Serial.println("+--------------------------------------+");
  Serial.printf("| %-36s |\n", line1);
  Serial.printf("| %-36s |\n", line2);
  Serial.printf("| %-36s |\n", line3);
  Serial.println("+--------------------------------------+");
}

void bootFeedback() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(PIN_LED, HIGH);
    tone(PIN_BUZZER, 1800 + i * 400, 120);
    delay(160);
    digitalWrite(PIN_LED, LOW);
    delay(100);
  }
}

void alertFeedback() {
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

void resetForNextDemo() {
  simulatedWeight = binMedicine.remainingPills * binMedicine.pillWeightG;
  baselineWeight = simulatedWeight;
  currentWeight = simulatedWeight;
  aiFilter.reset(simulatedWeight);
  eventInFlight = false;
  Serial.println("Reset for next demo. Press green button again.");
  drawMedicineSchedule();
}
