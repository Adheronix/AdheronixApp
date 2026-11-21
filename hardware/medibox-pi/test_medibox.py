import collections
import http.client
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from medibox import Box, Handler, Motor


class Serial:
    in_waiting = 0
    def __init__(self): self.written = []
    def write(self, value): self.written.append(value)


def motor():
    m = Motor.__new__(Motor)
    m.lock = threading.RLock()
    m.serial = Serial()
    m.speed = 90
    m.max_speed = 140
    m.direction = 'stop'
    m.deadline = 0
    m.armed = False
    m.ready = True
    m.error = None
    return m


def box():
    b = Box.__new__(Box)
    b.motor = motor()
    b.lock = threading.RLock()
    b.pin = '123456'
    b.session = None
    b.failures = {}
    b.distance_cm = None
    b.raw = 1000
    b.samples = collections.deque([1000] * 9)
    b.sensor_error = None
    b.sensor_time = time.monotonic()
    b.config = {}
    return b


class SafetyTests(unittest.TestCase):
    def test_cannot_move_before_arm(self):
        with self.assertRaises(ValueError): motor().command('forward', 1)

    def test_missing_heartbeat_stops(self):
        m = motor()
        m.armed = True
        m.command('forward', 1)
        m.tick(1.2)
        self.assertEqual(m.serial.written[-1], b'MOVE forward 90\n')
        m.tick(1.56)
        self.assertEqual(m.direction, 'stop')
        self.assertEqual(m.serial.written[-1], b'STOP\n')

    def test_emergency_stop_disarms(self):
        m = motor()
        m.armed = True
        m.command('left')
        m.stop()
        self.assertFalse(m.armed)
        with self.assertRaises(ValueError): m.command('forward')

    def test_bad_direction_rejected(self):
        m = motor()
        m.armed = True
        with self.assertRaises(ValueError): m.command('forward\nMOVE right 255')

    def test_obstacle_blocks_forward(self):
        b = box()
        b.motor.armed = True
        b.distance_cm = 10
        with self.assertRaises(ValueError): b.action('move', {'direction': 'forward'})
        b.action('move', {'direction': 'backward'})

    def test_speed_limit_cannot_be_raised_from_phone(self):
        b = box()
        with self.assertRaises(ValueError): b.action('speed', {'speed': 255})

    def test_stale_sensor_cannot_tare(self):
        b = box()
        b.sensor_time = 0
        with self.assertRaises(ValueError): b.action('tare', {})

    def test_calibrate_requires_tare_and_valid_mass(self):
        b = box()
        with self.assertRaises(ValueError): b.action('calibrate', {'grams': 100})
        b.config['tare_raw'] = 0
        for grams in [0, -1, float('nan'), float('inf'), 99999]:
            with self.assertRaises(ValueError): b.action('calibrate', {'grams': grams})

    def test_calibration_persists_real_signed_factor(self):
        b = box()
        with tempfile.TemporaryDirectory() as directory:
            b.config_path = Path(directory) / 'config.json'
            b.action('tare', {})
            b.raw = -12100
            b.action('calibrate', {'grams': 100})
            self.assertEqual(json.loads(b.config_path.read_text())['counts_per_gram'], -131)
            self.assertEqual(b.config_path.stat().st_mode & 0o777, 0o600)


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.box = box()
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def request(self, path, data, headers=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port)
        connection.request('POST', path, json.dumps(data), {'Content-Type': 'application/json', **(headers or {})})
        response = connection.getresponse()
        body = json.loads(response.read())
        result = (response.status, body, response.getheader('Set-Cookie'))
        connection.close()
        return result

    def test_anonymous_motion_rejected(self):
        self.assertEqual(self.request('/api/arm', {})[0], 401)

    def test_cross_origin_motion_rejected(self):
        self.assertEqual(self.request('/api/arm', {}, {'Origin': 'http://evil.example'})[0], 403)

    def test_pairing_arm_move_stop_and_old_session_revocation(self):
        status, _, cookie = self.request('/api/pair', {'code': '123456'})
        self.assertEqual(status, 200)
        headers = {'Cookie': cookie.split(';')[0]}
        self.assertEqual(self.request('/api/move', {'direction': 'forward'}, headers)[0], 400)
        self.assertEqual(self.request('/api/arm', {}, headers)[0], 200)
        self.assertEqual(self.request('/api/move', {'direction': 'forward'}, headers)[0], 200)
        self.assertEqual(self.server.box.motor.direction, 'forward')
        self.request('/api/pair', {'code': '123456'})
        self.assertFalse(self.server.box.motor.armed)
        self.assertEqual(self.request('/api/arm', {}, headers)[0], 401)

    def test_pairing_guess_limit(self):
        for _ in range(5): self.assertEqual(self.request('/api/pair', {'code': 'bad'})[0], 401)
        self.assertEqual(self.request('/api/pair', {'code': '123456'})[0], 429)


if __name__ == '__main__': unittest.main()
