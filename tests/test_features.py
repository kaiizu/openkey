import threading
import time
import unittest
from unittest.mock import Mock, patch

from butler.audio import SYNC_FRAME_BYTES
from butler.core import Keyboard, decode_macro, encode_macro
from butler.ripple import RippleSync, render_ripple_frame
from butler.server import DeviceManager, Handler


class MacroProtocolTests(unittest.TestCase):
    def test_macro_encode_decode_round_trip(self):
        original = {
            "repeat": 3,
            "events": [
                {"kind": "key", "usage": 4, "pressed": True, "delayMs": 25},
                {"kind": "key", "usage": 4, "pressed": False, "delayMs": 250},
                {"kind": "mouseButton", "button": 0, "pressed": True, "delayMs": 30},
                {"kind": "mouseButton", "button": 0, "pressed": False, "delayMs": 30},
                {"kind": "mouseMove", "dx": -12, "dy": 18, "delayMs": 20},
            ],
        }
        blob = encode_macro(original)
        self.assertEqual(len(blob), 256)
        decoded = decode_macro(blob)
        self.assertEqual(decoded, original)

    def test_set_macro_writes_driver_packets_and_reads_back(self):
        kb = Keyboard.__new__(Keyboard)
        kb.lock = threading.RLock()
        sent = []
        kb._send = lambda payload, bit=7: sent.append(kb._encode(payload, bit))
        macro = {
            "repeat": 1,
            "events": [
                {"kind": "key", "usage": 4, "pressed": True, "delayMs": 25},
                {"kind": "key", "usage": 4, "pressed": False, "delayMs": 25},
            ],
        }
        blob = encode_macro(macro)
        kb.cmd = Mock(side_effect=[blob[i * 64:(i + 1) * 64] for i in range(4)])
        with patch("butler.core.sleep_ms"):
            readback = kb.set_macro(2, macro)
        self.assertEqual(readback, macro)
        self.assertEqual(len(sent), 1)
        self.assertEqual(sent[0][:5], bytes([11, 2, 0, 56, 1]))
        self.assertEqual(sent[0][8:64], blob[:56])


class BulkKeymapTests(unittest.TestCase):
    def test_bulk_matrix_write_and_restore_preserves_fn(self):
        kb = Keyboard.__new__(Keyboard)
        kb.lock = threading.RLock()
        sent = []
        kb._send = lambda payload, bit=7: sent.append(kb._encode(payload, bit))
        raw = bytearray(512)
        raw[0:4] = bytes([0, 0, 41, 0])
        # Corrupt slot 65 (Fn) in input backup to verify server restores [10, 1, 0, 0]
        raw[65 * 4:65 * 4 + 4] = bytes([0, 0, 4, 0])

        expected = bytearray(raw)
        expected[65 * 4:65 * 4 + 4] = bytes([10, 1, 0, 0])
        kb.get_matrix = Mock(return_value=bytes(expected))

        manager = DeviceManager()
        manager.kb = kb
        with patch("butler.server.DEV", manager), patch("butler.core.sleep_ms"):
            res = Handler.__new__(Handler)._keys_restore({"profiles": {"0": {"0": raw.hex()}}})
        self.assertTrue(res["ok"])
        self.assertEqual(res["restoredLayers"], 1)
        self.assertEqual(len(sent), 10)
        self.assertEqual(sent[-1][:7], bytes([10, 0, 255, 9, 8, 1, 0]))
        reconstructed = b"".join(pkt[8:8 + pkt[4]] for pkt in sent)
        self.assertEqual(reconstructed, bytes(expected))


class RippleTests(unittest.TestCase):
    def test_ripple_frame_renders_water_drop_ring(self):
        ripples = [{"x": 10.5, "y": 3.0, "hue": 190.0, "born": 1.0}]
        frame = render_ripple_frame(
            ripples,
            1.25,
            color_mode="fixed",
            color=(0, 229, 255),
            expansion=1.0,
            lifetime=1.1,
            thickness=0.6,
            max_radius=6.0,
        )
        self.assertEqual(len(frame), SYNC_FRAME_BYTES)
        self.assertTrue(any(b > 20 for b in frame))

    def test_ripple_manager_starts_triggers_and_restores_light(self):
        frames = []
        lights = []
        original = {"mode": "LightWave", "brightness": 4, "speed": 2,
                    "rgb": 0xFFFFFF, "dazzle": False, "option": 0}
        layout = {"width": 773, "height": 299, "keys": [{"code": "KeyA", "x": 100, "y": 100, "w": 40, "h": 40}]}
        ripple = RippleSync(frames.append, lambda: original.copy(),
                            lambda *args: lights.append(args), layout)
        try:
            ripple.start(fps=30)
            ripple.trigger(10.5, 3.0)
            time.sleep(0.15)
        finally:
            ripple.stop()
        self.assertGreaterEqual(len(frames), 2)
        self.assertEqual(lights[0][0], "LightAlwaysOn")
        self.assertEqual(lights[-1][0], "LightWave")
        self.assertEqual(frames[-1], bytes(SYNC_FRAME_BYTES))
        self.assertFalse(ripple.status()["running"])

    def test_stopping_an_idle_ripple_sends_nothing(self):
        frames = []
        layout = {"width": 773, "height": 299, "keys": []}
        ripple = RippleSync(frames.append, lambda: None, lambda *args: None, layout)
        ripple.stop()
        self.assertEqual(frames, [])


if __name__ == "__main__":
    unittest.main()
