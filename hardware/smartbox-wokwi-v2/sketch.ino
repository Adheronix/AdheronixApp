/* Adheronix SmartMediBox — ESP32-S3 sensor prototype.
 * Weight/removal observations are NEVER a patient dose confirmation.
 * Wokwi: click the HX711 and change its load (kg), e.g. 0.050 -> 0.040.
 * Serial: CONNECT <https-base-url> <temporary-preview-key>
 *         STATUS, SYNC, TARE (empty container only), MUTE
 * No real keys or patient records belong in a public Wokwi project.
 */
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <HX711.h>
#include <ArduinoJson.h>
#include <time.h>
#include "certificates.h"

const char* DEVICE_ID = "WOKWI-PREVIEW-01";
const int TFT_CS=10, TFT_DC=11, TFT_RST=12, TFT_SCK=14, TFT_MOSI=21, TFT_MISO=13;
const int HX_DT=16, HX_SCK=17, LED=40, BUZZER=39, BUTTON=38;
// Wokwi's 5kg part produces 2100 counts / 5000g. Calibrate real hardware separately.
const float COUNTS_PER_GRAM = 0.42f;
const uint16_t BG=0x0883, CARD=0x1927, INK=0xFFFF, AQUA=0x5EFA, MUTED=0xA556;
HX711 scale;
Adafruit_ILI9341 tft(TFT_CS,TFT_DC,TFT_RST);
String apiBase, sessionKey, medicine="Waiting for app", dosage="", scheduledTime="--:--", scheduledDate="";
String lastSlot, mutedSlot, activity="No removal recorded";
float weightG=0, candidateG=0, baselineG=0, pillWeightG=5;
bool sensorReady=false, baselineReady=false, connected=false, slotConfirmed=false, dirty=true;
unsigned long stableSince=0, lastSample=0, lastSync=0, lastWeight=0, lastGood=0, lastPaint=0, lastBeep=0, lastNetwork=0;
unsigned long muteUntil=0, lastButton=0;
struct Observation { float before, after; char timestamp[28]; unsigned long observedAt; };
Observation queue[8];
uint8_t queueHead=0, queueCount=0;
bool queueFull=false;

String field(const String& payload,const char* key) {
  String prefix=String(key)+"=";
  int pos=payload.indexOf(prefix); if(pos<0 || (pos>0 && payload[pos-1]!='\n')) return "";
  int end=payload.indexOf('\n',pos); if(end<0)end=payload.length();
  return payload.substring(pos+prefix.length(),end);
}
int pills() { return max(0,(int)lroundf(weightG/max(0.1f,pillWeightG))); }
bool clockReady() { return time(nullptr)>1700000000; }
void timestamp(char* dest,size_t size) {
  time_t now=time(nullptr); struct tm t; gmtime_r(&now,&t);
  strftime(dest,size,"%Y-%m-%dT%H:%M:%SZ",&t);
}
bool request(const String& path,const String& payload,String& response) {
  if(!apiBase.startsWith("https://") || !sessionKey.length() || WiFi.status()!=WL_CONNECTED || !clockReady()) return false;
  WiFiClientSecure client;
  client.setCACert(ROOT_CA);
  client.setHandshakeTimeout(30);
  HTTPClient http;
  if(!http.begin(client,apiBase+path))return false;
  http.useHTTP10(true);
  http.setReuse(false);
  http.setTimeout(20000);
  // Never forward the preview credential to a redirect destination.
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  http.addHeader("Authorization","Bearer "+sessionKey);
  http.addHeader("Content-Type","application/json");
  http.addHeader("ngrok-skip-browser-warning","true");
  int status=payload.length()?http.POST(payload):http.GET();
  response=status>0?http.getString():"";
  if(status<0) {
    char reason[160];int tls=client.lastError(reason,sizeof(reason));
    Serial.printf("[NETWORK] %s; TLS=%d %s; wifi=%d; clock=%ld\n",HTTPClient::errorToString(status).c_str(),tls,reason,WiFi.status(),(long)time(nullptr));
  }
  http.end();
  bool ok=status>=200 && status<300;
  connected=ok; dirty=true;
  if(ok)lastGood=millis();
  Serial.printf("[API] %s %s -> %d\n",payload.length()?"POST":"GET",path.c_str(),status);
  return ok;
}
void syncSchedule() {
  String data;
  if(!request(String("/api/smartbox/")+DEVICE_ID+"/schedule","",data))return;
  medicine=field(data,"medicine"); dosage=field(data,"dosage");
  scheduledTime=field(data,"scheduledTime");scheduledDate=field(data,"scheduledDate");
  float pw=field(data,"pillWeightG").toFloat(); if(pw>=0.1f)pillWeightG=pw;
  slotConfirmed=field(data,"doseTakenToday")=="1";
  String slot=scheduledDate+" "+scheduledTime;
  if(slot!=lastSlot){lastSlot=slot;mutedSlot="";muteUntil=0;}
  Serial.printf("[SCHEDULE] %s | %s | %s | patient-confirmed=%d\n",medicine.c_str(),dosage.c_str(),lastSlot.c_str(),slotConfirmed);
}
void sendWeight() {
  if(!sensorReady)return;
  JsonDocument doc;doc["deviceId"]=DEVICE_ID;doc["weightG"]=roundf(weightG*10)/10;
  doc["pillsEst"]=pills();doc["source"]="wokwi-hx711-simulation";
  String body,response;serializeJson(doc,body);
  if(request("/api/smartbox/weight",body,response))Serial.printf("[WEIGHT] synced %.1fg; estimate %d demo units\n",weightG,pills());
}
void sendObservation() {
  if(!queueCount)return;
  Observation& event=queue[queueHead];
  if(!event.timestamp[0]) {
    // Estimate capture time only after NTP succeeds; never throw offline readings away.
    time_t observed=time(nullptr)-(millis()-event.observedAt)/1000;
    struct tm utc;gmtime_r(&observed,&utc);
    strftime(event.timestamp,sizeof(event.timestamp),"%Y-%m-%dT%H:%M:%SZ",&utc);
  }
  JsonDocument doc;doc["deviceId"]=DEVICE_ID;doc["binIndex"]=0;
  doc["timestamp"]=event.timestamp;doc["confirmed"]=true; // confidence in removal ONLY
  doc["weightBefore"]=roundf(event.before*10)/10;doc["weightAfter"]=roundf(event.after*10)/10;
  doc["weightLeftG"]=roundf(event.after*10)/10;
  doc["pillsRemaining"]=max(0,(int)lroundf(event.after/max(0.1f,pillWeightG)));
  String body,response;serializeJson(doc,body);
  if(request("/api/smartbox/dose-event",body,response)) {
    queueHead=(queueHead+1)%8;queueCount--;queueFull=false;
    activity="Removal synced. Confirm in app.";
    Serial.println("[REMOVAL] backend accepted; patient confirmation unchanged");
    tone(BUZZER,1700,80);
  }
}
void sampleSensor() {
  if(millis()-lastSample<100)return;lastSample=millis();
  if(!scale.is_ready())return;
  float current=max(0.0f,scale.get_units(1));
  if(!sensorReady || fabsf(current-candidateG)>0.8f){candidateG=current;stableSince=millis();}
  sensorReady=true;weightG=current;
  if(millis()-stableSince<900)return;
  if(!baselineReady){baselineG=weightG;baselineReady=true;Serial.printf("[SCALE] HX711 baseline %.1fg\n",weightG);return;}
  float change=baselineG-weightG;
  if(change>=max(1.5f,pillWeightG*0.6f)) {
    if(queueCount==8){queueFull=true;activity="Queue full. Check connection.";dirty=true;return;}
    Observation& event=queue[(queueHead+queueCount)%8];event.before=baselineG;event.after=weightG;event.observedAt=millis();event.timestamp[0]='\0';
    if(clockReady())timestamp(event.timestamp,sizeof(event.timestamp));
    queueCount++;activity="Removal observed. Not ingestion.";
    Serial.printf("[REMOVAL] HX711 %.1fg -> %.1fg; queued=%u\n",baselineG,weightG,queueCount);
    baselineG=weightG;dirty=true;
  } else if(change<=-max(1.5f,pillWeightG*0.6f)) {
    Serial.printf("[REFILL] HX711 %.1fg -> %.1fg\n",baselineG,weightG);
    baselineG=weightG;activity="Refill / added weight observed";dirty=true;
  }
}
bool due() {
  if(!clockReady() || slotConfirmed || scheduledTime.length()!=5)return false;
  time_t now=time(nullptr);now+=2*3600; // schedule API uses Africa/Kigali (UTC+2)
  struct tm t;gmtime_r(&now,&t);char date[12];strftime(date,sizeof(date),"%Y-%m-%d",&t);
  int minutes=scheduledTime.substring(0,2).toInt()*60+scheduledTime.substring(3,5).toInt();
  int age=t.tm_hour*60+t.tm_min-minutes;
  return scheduledDate==date && age>=0 && age<180;
}
void mute() { muteUntil=millis()+5*60000;mutedSlot=lastSlot;activity="Reminder muted for 5 minutes";dirty=true;Serial.println("[BUTTON] reminder muted; no dose confirmed"); }
void reminders() {
  bool active=due() && !(mutedSlot==lastSlot && (long)(muteUntil-millis())>0);
  digitalWrite(LED,active?((millis()/500)%2):(connected?HIGH:LOW));
  if(active && millis()-lastBeep>8000){tone(BUZZER,1200,100);lastBeep=millis();dirty=true;}
  bool pressed=digitalRead(BUTTON)==LOW;
  if(pressed && millis()-lastButton>500){lastButton=millis();mute();}
}
void text(int x,int y,const String& value,int size,uint16_t color=INK) {
  tft.setCursor(x,y);tft.setTextSize(size);tft.setTextColor(color);tft.print(value);
}
void paint() {
  if(millis()-lastPaint<1800 || !dirty)return;lastPaint=millis();dirty=false;
  tft.fillScreen(BG);tft.fillRoundRect(8,8,304,36,10,CARD);
  text(18,18,"ADHERONIX",2,AQUA);text(212,21,connected?"SYNCED":"OFFLINE",1,connected?AQUA:MUTED);
  text(14,57,medicine.substring(0,24),2);text(14,82,dosage.substring(0,44),1,MUTED);
  tft.fillRoundRect(8,103,304,65,10,CARD);
  text(18,113,String(weightG,1)+" g",3,AQUA);text(18,148,"Sensor estimate: "+String(pills())+" demo units",1,MUTED);
  text(14,179,"Next: "+scheduledTime+ (due()?"  DUE":""),2);
  text(14,204,activity.substring(0,47),1,MUTED);
  text(14,221,apiBase.length()?"Confirm doses in your app":"Serial: CONNECT <https-url> <key>",1,AQUA);
}
void serialConsole() {
  static String input;
  while(Serial.available()) {
    char ch=Serial.read();if(ch=='\r')continue;
    if(ch!='\n'){if(input.length()<512)input+=ch;continue;}
    input.trim();
    if(input.startsWith("CONNECT ")) {
      int split=input.indexOf(' ',8);
      if(split>8) {
        String url=input.substring(8,split);String key=input.substring(split+1);key.trim();
        if(url.startsWith("https://") && key.length()>=16) {
          if(url.endsWith("/"))url.remove(url.length()-1);
          apiBase=url;sessionKey=key;lastSync=0;lastWeight=0;lastNetwork=0;
          Serial.println("[PAIR] temporary preview session configured (credential hidden)");dirty=true;
        } else Serial.println("[PAIR] HTTPS and a valid temporary preview key required");
      }
    } else if(input=="STATUS")Serial.printf("[STATUS] weight=%.1f; estimate=%d; sensor=%d; queued=%u; connected=%d; patient-confirmed=%d; wifi=%d; clock=%ld\n",weightG,pills(),sensorReady,queueCount,connected,slotConfirmed,WiFi.status(),(long)time(nullptr));
    else if(input=="SYNC"){lastSync=0;lastWeight=0;}
    else if(input=="MUTE")mute();
    else if(input=="TARE") {
      if(scale.is_ready() && queueCount==0){scale.tare(5);baselineReady=false;activity="Scale tared. Empty container only.";dirty=true;Serial.println("[SCALE] tared; no removal event");}
    } else Serial.println("Commands: CONNECT <https-url> <key>, STATUS, SYNC, MUTE, TARE");
    input="";
  }
}
void setup() {
  Serial.begin(115200);
  pinMode(LED,OUTPUT);pinMode(BUZZER,OUTPUT);pinMode(BUTTON,INPUT_PULLUP);
  SPI.begin(TFT_SCK,TFT_MISO,TFT_MOSI,TFT_CS);tft.begin();tft.setRotation(1);
  scale.begin(HX_DT,HX_SCK);scale.set_scale(COUNTS_PER_GRAM);scale.set_offset(0);
  WiFi.begin("Wokwi-GUEST","",6);
  configTime(0,0,"pool.ntp.org","time.google.com");
  Serial.println("[BOOT] Adheronix SmartMediBox | real HX711 simulation | bin 0");
  Serial.println("Change HX711 load: 0.050kg -> 0.040kg for a removal. Button only mutes.");
  Serial.println("Pair at runtime: CONNECT <https-base-url> <temporary-preview-key>");
  lastPaint=millis()-2000;
}
void loop() {
  serialConsole();sampleSensor();reminders();
  if(connected && millis()-lastGood>120000){connected=false;dirty=true;}
  static unsigned long refreshView=0;
  if(millis()-refreshView>5000){dirty=true;refreshView=millis();}
  if(apiBase.length() && clockReady() && WiFi.status()==WL_CONNECTED && millis()-lastNetwork>3000) {
    if(queueCount){lastNetwork=millis();sendObservation();}
    else if(lastSync==0 || millis()-lastSync>30000){lastNetwork=lastSync=millis();syncSchedule();}
    else if(lastWeight==0 || millis()-lastWeight>15000){lastNetwork=lastWeight=millis();sendWeight();}
  }
  paint();delay(20);
}
