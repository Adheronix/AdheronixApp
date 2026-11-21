#!/usr/bin/env python3
"""Local phone control and real HX711 telemetry. Credentials live in config.json."""
import collections
import datetime
import hmac
import http.cookies
import json
import math
import os
from pathlib import Path
import secrets
import signal
import statistics
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent


class Motor:
    def __init__(self, port, speed=90, max_speed=140):
        import serial
        self.serial = serial.Serial(port, 115200, timeout=0.08, write_timeout=0.1)
        self.lock = threading.RLock()
        self.max_speed = min(255, max(80, int(max_speed)))
        self.speed = min(self.max_speed, max(0, int(speed)))
        self.direction = 'stop'
        self.deadline = 0
        self.armed = False
        self.ready = False
        self.error = None
        self.last_ack = None
        time.sleep(2)
        self.serial.reset_input_buffer()
        self.serial.write(b'STOP\nPING\n')
        until = time.monotonic() + 2
        while time.monotonic() < until:
            if self.serial.readline().strip() == b'MEDIBOX_MOTOR_V1':
                self.ready = True
                break
        if not self.ready:
            self.error = 'Arduino firmware not identified'

    def command(self, direction, now=None):
        now = time.monotonic() if now is None else now
        if direction not in ('stop', 'forward', 'backward', 'left', 'right'):
            raise ValueError('Unknown direction')
        with self.lock:
            if direction != 'stop' and (not self.armed or not self.ready):
                raise ValueError('Enable driving first; Arduino must be connected')
            self.direction = direction
            self.deadline = now + 0.55 if direction != 'stop' else 0
            if direction == 'stop':
                self.serial.write(b'STOP\n')

    def tick(self, now=None):
        now = time.monotonic() if now is None else now
        with self.lock:
            if self.direction != 'stop' and now >= self.deadline:
                self.command('stop', now)
            if self.direction != 'stop':
                self.serial.write(f'MOVE {self.direction} {self.speed}\n'.encode())
            # Drain acknowledgements; never let a blocked network request delay this loop.
            if self.serial.in_waiting:
                reply = self.serial.read(self.serial.in_waiting).decode(errors='replace').strip()
                if reply:
                    self.last_ack = reply.splitlines()[-1]
                    if self.last_ack.startswith('ERR'):
                        self.error = self.last_ack
                        self.stop()

    def stop(self):
        with self.lock:
            self.armed = False
            self.command('stop')


class Box:
    def __init__(self, config_path=ROOT / 'config.json'):
        self.config_path = Path(config_path)
        self.config = json.loads(self.config_path.read_text())
        self.lock = threading.RLock()
        self.samples = collections.deque(maxlen=9)
        self.raw = None
        self.weight = None
        self.sensor_time = 0
        self.sensor_error = 'Waiting for sensor'
        self.cloud = 'Not configured'
        self.last_uploaded = None
        self.schedule = {}
        self.events = collections.deque(maxlen=20)
        self.pin = str(self.config['pairing_code'])
        self.session = None
        self.failures = {}
        self.motor = None
        self.motor_error = None
        self.running = True
        self.button = self.led = self.buzzer = self.distance = None
        self.lcd = None
        self.lcd_status = 'Not enabled'
        self.distance_cm = None
        try:
            self.motor = Motor(self.config['serial_port'], self.config.get('speed', 90), self.config.get('max_speed', 140))
        except Exception as exc:
            self.motor_error = type(exc).__name__ + ': ' + str(exc)
        self.start(self.motor_loop)
        self.start(self.sensor_loop)
        self.start(self.cloud_loop)
        self.start(self.peripherals_loop)
        self.start(self.display_loop)

    def start(self, function):
        threading.Thread(target=function, daemon=True).start()

    def save(self):
        tmp = self.config_path.with_suffix('.tmp')
        fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(self.config, f, indent=2)
        tmp.replace(self.config_path)

    def motor_loop(self):
        while self.running:
            if self.motor:
                try:
                    if self.distance_cm is not None and self.distance_cm < 20 and self.motor.direction == 'forward':
                        self.motor.stop()
                    self.motor.tick()
                except Exception as exc:
                    self.motor.ready = False
                    self.motor.armed = False
                    self.motor.direction = 'stop'
                    self.motor.error = type(exc).__name__
            time.sleep(0.1)

    def sensor_loop(self):
        try:
            from gpiozero import DigitalInputDevice, DigitalOutputDevice
            from gpiozero.pins.lgpio import LGPIOFactory
            factory = LGPIOFactory()
            data = DigitalInputDevice(5, pull_up=False, pin_factory=factory)
            clock = DigitalOutputDevice(6, initial_value=False, pin_factory=factory)
        except Exception as exc:
            self.sensor_error = str(exc)
            return
        try:
            while self.running:
                try:
                    start = time.monotonic()
                    while data.value:
                        if time.monotonic() - start > 1:
                            raise TimeoutError('HX711 not responding on GPIO5/6')
                        time.sleep(0.005)
                    value = 0
                    for _ in range(24):
                        clock.on()
                        try:
                            value = (value << 1) | int(data.value)
                        finally:
                            clock.off()
                    clock.on()
                    clock.off()
                    if value & 0x800000:
                        value -= 1 << 24
                    if value in (-8388608, 8388607, 0):
                        raise ValueError('HX711 saturated or invalid reading')
                    with self.lock:
                        self.samples.append(value)
                        self.raw = statistics.median(self.samples)
                        self.sensor_time = time.monotonic()
                        factor = self.config.get('counts_per_gram')
                        offset = self.config.get('tare_raw')
                        self.weight = (self.raw - offset) / factor if factor and offset is not None else None
                        self.sensor_error = None
                except Exception as exc:
                    self.sensor_error = str(exc)
                    self.weight = None
                time.sleep(0.05)
        finally:
            clock.off()
            data.close()
            clock.close()

    def request(self, route, payload=None):
        key = self.config.get('api_key')
        base = self.config.get('api_url', '')
        if not key or not base.startswith('https://'):
            raise ValueError('Cloud credentials not configured')
        request = urllib.request.Request(base.rstrip('/') + route,
            data=json.dumps(payload).encode() if payload is not None else None,
            headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
                     'User-Agent': 'Adheronix-MediBox/1.0 (Raspberry Pi)'})
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.read().decode()

    def cloud_loop(self):
        last_schedule = 0
        while self.running:
            try:
                device = self.config['device_id']
                if time.monotonic() - last_schedule > 15:
                    text = self.request('/api/smartbox/' + device + '/schedule')
                    self.schedule = dict(line.split('=', 1) for line in text.splitlines() if '=' in line)
                    last_schedule = time.monotonic()
                with self.lock:
                    weight = self.weight
                    fresh = time.monotonic() - self.sensor_time < 3
                if weight is not None and fresh and not self.sensor_error:
                    if not 0 <= weight <= 20000:
                        self.cloud = 'Weight outside upload range; check tare'
                    else:
                        payload = {'deviceId': device, 'weightG': round(weight, 2), 'source': 'raspberry-pi-hx711'}
                        self.request('/api/smartbox/weight', payload)
                        self.cloud = 'Live weight delivered to app'
                        self.last_uploaded = datetime.datetime.now(datetime.timezone.utc).isoformat()
                else:
                    self.cloud = 'API connected; waiting for calibrated weight'
            except urllib.error.HTTPError as exc:
                self.cloud = 'API connection failed: HTTP ' + str(exc.code)
            except Exception as exc:
                self.cloud = 'Connection: ' + type(exc).__name__
            time.sleep(5)

    def peripherals_loop(self):
        # Enable only the Pi circuits confirmed in config. Buzzer PNP is active LOW.
        cfg = self.config.get('peripherals', {})
        try:
            from gpiozero import Button, LED, DigitalOutputDevice, DistanceSensor
            from gpiozero.pins.lgpio import LGPIOFactory
            factory = LGPIOFactory()
            if cfg.get('button'):
                self.button = Button(22, pull_up=True, bounce_time=0.05, pin_factory=factory)
                self.button.when_pressed = self.button_pressed
            if cfg.get('led'):
                self.led = LED(17, initial_value=False, pin_factory=factory)
            if cfg.get('buzzer'):
                self.buzzer = DigitalOutputDevice(18, active_high=False, initial_value=False, pin_factory=factory)
            if cfg.get('distance'):
                self.distance = DistanceSensor(echo=24, trigger=23, max_distance=2,
                    queue_len=3, pin_factory=factory)
            while self.running:
                if self.distance:
                    distance = self.distance.distance * 100
                    self.distance_cm = round(distance, 1) if distance > 0 else None
                if self.led:
                    self.led.value = bool(not self.sensor_error and
                        self.cloud in ('API connected; waiting for calibrated weight', 'Live weight delivered to app'))
                time.sleep(0.25)
        except Exception as exc:
            self.events.append('Peripherals: ' + str(exc))

    def button_pressed(self):
        self.events.append('Physical button pressed at ' + datetime.datetime.now().strftime('%H:%M:%S'))
        self.beep()

    def beep(self):
        if self.buzzer:
            try:
                # Test both an active DC buzzer and a passive piezo, without rewiring.
                self.buzzer.on()
                time.sleep(0.35)
                self.buzzer.off()
                time.sleep(0.15)
                for _ in range(400):
                    self.buzzer.on()
                    time.sleep(0.0005)
                    self.buzzer.off()
                    time.sleep(0.0005)
            finally:
                self.buzzer.off()

    def display_loop(self):
        if not self.config.get('peripherals', {}).get('lcd'):
            return
        try:
            from smbus import SMBus
            bus = SMBus(1)
            address = int(self.config.get('lcd_address', 0x27))
            def nibble(value):
                bus.write_byte(address, value | 8 | 4)
                time.sleep(0.0005)
                bus.write_byte(address, (value | 8) & ~4)
                time.sleep(0.0005)
            def write(value, data=False):
                nibble((value & 0xf0) | int(data))
                nibble(((value << 4) & 0xf0) | int(data))
            time.sleep(0.05)
            for value in (0x30, 0x30, 0x30, 0x20):
                nibble(value)
                time.sleep(0.005)
            for value in (0x28, 0x0c, 0x06, 0x01):
                write(value)
                time.sleep(0.003)
            self.lcd_status = 'LCD detected and initialized'
            previous = None
            while self.running:
                if int(time.time() / 5) % 2 and self.schedule.get('medicine'):
                    lines = [self.schedule.get('medicine', 'MediBox'),
                             'Next ' + self.schedule.get('scheduledTime', '--:--')]
                else:
                    lines = ['Adheronix MediBox',
                             f'{self.weight:.1f} g' if self.weight is not None else 'Scale: calibrate']
                lines = [str(line).encode('ascii', 'replace').decode()[:16].ljust(16) for line in lines]
                if lines != previous:
                    for row, line in enumerate(lines):
                        write(0x80 if row == 0 else 0xc0)
                        for char in line:
                            write(ord(char), True)
                    previous = lines
                time.sleep(0.5)
            bus.close()
        except Exception as exc:
            self.lcd_status = 'LCD: ' + type(exc).__name__

    def state(self):
        with self.lock:
            fresh = time.monotonic() - self.sensor_time < 3
            return {'deviceId': self.config['device_id'], 'raw': self.raw,
                'weightG': round(self.weight, 2) if self.weight is not None and fresh else None,
                'sensorError': self.sensor_error if fresh else self.sensor_error or 'Sensor reading is stale',
                'calibrated': bool(self.config.get('counts_per_gram')),
                'cloud': self.cloud, 'lastUpload': self.last_uploaded,
                'motorReady': bool(self.motor and self.motor.ready),
                'motorError': self.motor.error if self.motor else self.motor_error,
                'armed': bool(self.motor and self.motor.armed),
                'speed': self.motor.speed if self.motor else self.config.get('speed', 90),
                'maxSpeed': self.motor.max_speed if self.motor else self.config.get('max_speed', 140),
                'motorAck': self.motor.last_ack if self.motor else None,
                'direction': self.motor.direction if self.motor else 'stop',
                'lcd': self.lcd_status,
                'distanceCm': self.distance_cm, 'events': list(self.events),
                'medicine': self.schedule.get('medicine'), 'scheduledTime': self.schedule.get('scheduledTime')}

    def action(self, action, data):
        if action == 'stop':
            if self.motor:
                self.motor.stop()
            return
        if action == 'arm':
            if not self.motor or not self.motor.ready:
                raise ValueError('Arduino is not ready')
            self.motor.command('stop')
            self.motor.armed = True
        elif action == 'speed':
            speed = int(data['speed'])
            if not self.motor:
                raise ValueError('Arduino disconnected')
            if not 80 <= speed <= self.motor.max_speed:
                raise ValueError('Motor power exceeds the configured supply limit')
            self.motor.stop()
            self.motor.speed = speed
            self.config['speed'] = speed
            with self.lock:
                self.save()
        elif action == 'move':
            direction = data.get('direction')
            if direction == 'forward' and self.distance_cm is not None and self.distance_cm < 20:
                raise ValueError('Obstacle closer than 20 cm')
            if not self.motor:
                raise ValueError('Arduino disconnected')
            self.motor.command(direction)
        elif action in ('tare', 'calibrate'):
            with self.lock:
                if self.raw is None or self.sensor_error or time.monotonic() - self.sensor_time > 3 or len(self.samples) < 5:
                    raise ValueError('Wait for stable live sensor readings')
                if self.motor and self.motor.direction != 'stop':
                    raise ValueError('Stop the car before calibrating')
                if action == 'tare':
                    self.config['tare_raw'] = self.raw
                else:
                    grams = float(data['grams'])
                    if not math.isfinite(grams) or not 1 <= grams <= 5000:
                        raise ValueError('Use a known reference mass between 1 and 5000 g')
                    if 'tare_raw' not in self.config:
                        raise ValueError('Tare with empty tray first')
                    difference = self.raw - self.config['tare_raw']
                    if abs(difference) < 100:
                        raise ValueError('Reference mass has not changed the reading enough')
                    self.config['counts_per_gram'] = difference / grams
                self.save()
        elif action == 'beep':
            if not self.buzzer:
                raise ValueError('Buzzer circuit is not enabled')
            self.events.append('Buzzer test requested')
            self.start(self.beep)
        else:
            raise ValueError('Unknown action')

    def close(self):
        self.running = False
        if self.motor:
            self.motor.stop()
        for device in (self.button, self.led, self.buzzer, self.distance):
            if device:
                device.close()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # No request payloads or credentials in logs.

    def send(self, status, value, cookie=None, html=False):
        body = value.encode() if html else json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8' if html else 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def authenticated(self):
        cookies = http.cookies.SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
            token = cookies.get('medibox')
            return bool(token and self.server.box.session and hmac.compare_digest(token.value, self.server.box.session))
        except (http.cookies.CookieError, TypeError):
            return False

    def do_GET(self):
        if self.path == '/':
            return self.send(200, (ROOT / 'phone.html').read_text(), html=True)
        if not self.authenticated():
            return self.send(401, {'error': 'Enter the pairing code'})
        if self.path == '/api/state':
            return self.send(200, self.server.box.state())
        self.send(404, {'error': 'Not found'})

    def do_POST(self):
        box = self.server.box
        origin = self.headers.get('Origin')
        if origin and origin != 'http://' + self.headers.get('Host', ''):
            return self.send(403, {'error': 'Use the control page on this Pi'})
        if self.headers.get('Content-Type', '').split(';')[0] != 'application/json':
            return self.send(415, {'error': 'JSON required'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 4096:
                raise ValueError('Invalid request size')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError('Expected an object')
            if self.path == '/api/pair':
                address = self.client_address[0]
                count, since = box.failures.get(address, (0, time.monotonic()))
                if time.monotonic() - since > 60:
                    count, since = 0, time.monotonic()
                if count >= 5:
                    return self.send(429, {'error': 'Wait one minute before trying again'})
                if not hmac.compare_digest(str(data.get('code', '')), box.pin):
                    box.failures[address] = (count + 1, since)
                    return self.send(401, {'error': 'Incorrect pairing code'})
                with box.lock:
                    if box.motor:
                        box.motor.stop()
                    box.session = secrets.token_urlsafe(32)
                return self.send(200, {'ok': True}, 'medibox=' + box.session + '; HttpOnly; SameSite=Strict; Path=/')
            if not self.authenticated():
                return self.send(401, {'error': 'Enter the pairing code'})
            if not self.path.startswith('/api/'):
                return self.send(404, {'error': 'Not found'})
            box.action(self.path.removeprefix('/api/'), data)
            self.send(200, {'ok': True})
        except (ValueError, KeyError, TypeError) as exc:
            self.send(400, {'error': str(exc)})
        except Exception:
            if box.motor:
                try:
                    box.motor.stop()
                except Exception:
                    pass
            self.send(503, {'error': 'Hardware unavailable; driving stopped'})


def main():
    box = Box()
    server = ThreadingHTTPServer(('0.0.0.0', int(box.config.get('port', 8080))), Handler)
    server.box = box
    def shutdown(*_):
        box.close()
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    print('MediBox phone controls ready on port', server.server_port, flush=True)
    try:
        server.serve_forever()
    finally:
        box.close()
        server.server_close()


if __name__ == '__main__':
    main()
