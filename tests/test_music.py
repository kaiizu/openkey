import math
import threading
import time
import unittest

from butler.audio import MusicSync, Spectrum, SYNC_FRAME_BYTES
from butler.core import Keyboard


class SyncColorTests(unittest.TestCase):
    def _keyboard(self):
        kb = Keyboard.__new__(Keyboard)
        kb.lock = threading.RLock()
        packets = []
        kb._send = lambda payload, bit=7: packets.append(kb._encode(payload, bit))
        return kb, packets

    def test_sync_color_uses_seven_driver_packets(self):
        kb, packets = self._keyboard()
        frame = bytes((i * 7) & 0xFF for i in range(SYNC_FRAME_BYTES))
        kb.send_sync_color(frame)

        self.assertEqual(len(packets), 7)
        for index, packet in enumerate(packets):
            self.assertEqual(packet[0], 0x0F)
            self.assertEqual(packet[1], 1)
            self.assertEqual(packet[2], index)
            self.assertEqual(packet[3], 56)
            self.assertEqual(packet[4], 1 if index == 6 else 0)
            self.assertEqual(packet[7], 255 - sum(packet[:7]) & 0xFF)
            expected = frame[index * 56:(index + 1) * 56]
            self.assertEqual(packet[8:8 + len(expected)], expected)
            self.assertTrue(all(value == 0 for value in packet[8 + len(expected):]))

    def test_clear_sync_color_sends_a_black_frame(self):
        kb, packets = self._keyboard()
        kb.clear_sync_color()
        self.assertEqual(len(packets), 7)
        for packet in packets:
            self.assertTrue(all(value == 0 for value in packet[8:]))

    def test_sync_color_rejects_wrong_size(self):
        kb, packets = self._keyboard()
        with self.assertRaises(ValueError):
            kb.send_sync_color(bytes(377))


class SpectrumTests(unittest.TestCase):
    def test_spectrum_frame_has_the_expected_shape(self):
        spectrum = Spectrum(48000)
        samples = [math.sin(2 * math.pi * 1000 * i / 48000) for i in range(4096)]
        spectrum.push(samples)
        frame = spectrum.frame(gain=10)
        self.assertEqual(len(frame), SYNC_FRAME_BYTES)
        self.assertTrue(any(frame))
        bottom_row = frame[5 * 21 * 3:6 * 21 * 3]
        self.assertTrue(any(bottom_row))

    def test_demo_frame_has_the_expected_shape(self):
        spectrum = Spectrum(48000)
        frame = spectrum.demo_frame(1.0, gain=6)
        self.assertEqual(len(frame), SYNC_FRAME_BYTES)
        self.assertTrue(any(frame))


class MusicManagerTests(unittest.TestCase):
    def test_demo_start_stop_restores_the_light(self):
        frames = []
        lights = []
        original = {"mode": "LightAlwaysOn", "brightness": 4, "speed": 2,
                    "rgb": 0xFFFFFF, "dazzle": False, "option": 0}

        music = MusicSync(frames.append, lambda: original.copy(),
                          lambda *args: lights.append(args))
        try:
            music.start(source="demo", gain=6, fps=60)
            time.sleep(0.25)
        finally:
            music.stop()

        self.assertGreaterEqual(len(frames), 3)
        self.assertEqual(lights[0], ("LightAlwaysOn", 4, 2, 0xFFFFFF, False, 0))
        self.assertEqual(lights[-1], ("LightAlwaysOn", 4, 2, 0xFFFFFF, False, 0))
        self.assertEqual(frames[-1], bytes(SYNC_FRAME_BYTES))
        self.assertFalse(music.status()["running"])


if __name__ == "__main__":
    unittest.main()
