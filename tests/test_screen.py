import base64
import threading
import unittest
from unittest.mock import Mock, patch

from butler.core import Keyboard
from butler.server import DeviceManager, Handler


class ScreenFrameTests(unittest.TestCase):
    def _keyboard(self):
        kb = Keyboard.__new__(Keyboard)
        kb.lock = threading.RLock()
        starts = []
        packets = []

        def fake_cmd(payload, bit=7, delay=0.012, retries=2, expect=None):
            starts.append((bytes(payload), bit))
            return bytes([0xA5, 1])

        kb.cmd = fake_cmd
        kb._send = lambda payload, bit=7: packets.append(kb._encode(payload, bit))
        return kb, starts, packets

    def test_send_images_uses_one_start_and_one_frame_set_per_frame(self):
        kb, starts, packets = self._keyboard()
        first = bytes([0xAA]) * 8
        second = bytes([0x55]) * 8
        with patch("butler.core.sleep_ms", lambda *_: None):
            kb.send_images([first, second], 10, 20, 12, 22, delay=50)

        self.assertEqual(len(starts), 1)
        start = starts[0][0]
        self.assertEqual(start[0], 0xA5)
        self.assertEqual(start[1], 0)
        self.assertEqual(start[2], 2)
        self.assertEqual(start[3], 50)
        self.assertEqual(start[4], 8)
        self.assertEqual(start[8:12], bytes([10, 20, 12, 22]))

        self.assertEqual(len(packets), 2)
        for index, packet in enumerate(packets):
            self.assertEqual(packet[0], 0x25)
            self.assertEqual(packet[1], index)
            self.assertEqual(packet[2], 2)
            self.assertEqual(packet[3], 50)
            self.assertEqual(packet[6], 8)
            self.assertEqual(packet[7], 255 - sum(packet[:7]) & 0xFF)
            self.assertEqual(packet[8:16], first if index == 0 else second)

    def test_send_image_remains_a_single_frame(self):
        kb, starts, packets = self._keyboard()
        frame = bytes(range(8))
        with patch("butler.core.sleep_ms", lambda *_: None):
            kb.send_image(frame, 0, 0, 2, 2)

        self.assertEqual(len(starts), 1)
        self.assertEqual(starts[0][0][2], 1)
        self.assertEqual(len(packets), 1)
        self.assertEqual(packets[0][1], 0)
        self.assertEqual(packets[0][2], 1)

    def test_send_images_rejects_wrong_frame_size(self):
        kb, _, _ = self._keyboard()
        with self.assertRaises(ValueError):
            kb.send_images([bytes(7)], 0, 0, 2, 2)

    def test_screen_playback_uses_driver_bytes(self):
        kb = Keyboard.__new__(Keyboard)
        sent = []
        kb.cmd = lambda payload, **kwargs: sent.append(bytes(payload))
        kb.set_screen_playback(False, 10)
        kb.set_screen_playback(True, 15)
        self.assertEqual(sent[0][:3], bytes([0x2F, 0, 10]))
        self.assertEqual(sent[1][:3], bytes([0x2F, 1, 15]))

    def test_upload_pins_the_page_by_default(self):
        keyboard = Mock()
        manager = DeviceManager()
        manager.kb = keyboard
        frame = base64.b64encode(bytes(2 * 2 * 2)).decode()
        body = {"left": 0, "top": 0, "right": 2, "bottom": 2, "frames": [frame]}
        with patch("butler.server.DEV", manager), patch("butler.server.MUSIC") as music, patch("butler.server.RIPPLE") as ripple:
            music.status.return_value = {"running": False}
            ripple.status.return_value = {"running": False}
            result = Handler.__new__(Handler)._screen_image(body)
        self.assertTrue(result["ok"])
        self.assertTrue(result["pinned"])
        keyboard.send_images.assert_called_once()
        keyboard.set_screen_playback.assert_called_once_with(False, 1)

    def test_upload_can_skip_pinning(self):
        keyboard = Mock()
        manager = DeviceManager()
        manager.kb = keyboard
        frame = base64.b64encode(bytes(2 * 2 * 2)).decode()
        body = {"left": 0, "top": 0, "right": 2, "bottom": 2, "frames": [frame], "pin": False}
        with patch("butler.server.DEV", manager), patch("butler.server.MUSIC") as music, patch("butler.server.RIPPLE") as ripple:
            music.status.return_value = {"running": False}
            ripple.status.return_value = {"running": False}
            result = Handler.__new__(Handler)._screen_image(body)
        self.assertFalse(result["pinned"])
        keyboard.set_screen_playback.assert_not_called()

    def test_upload_reports_pin_failure_without_failing_the_upload(self):
        from butler.core import HidError
        keyboard = Mock()
        keyboard.set_screen_playback.side_effect = HidError("sin respuesta")
        manager = DeviceManager()
        manager.kb = keyboard
        frame = base64.b64encode(bytes(2 * 2 * 2)).decode()
        body = {"left": 0, "top": 0, "right": 2, "bottom": 2, "frames": [frame]}
        with patch("butler.server.DEV", manager), patch("butler.server.MUSIC") as music, patch("butler.server.RIPPLE") as ripple:
            music.status.return_value = {"running": False}
            ripple.status.return_value = {"running": False}
            result = Handler.__new__(Handler)._screen_image(body)
        self.assertTrue(result["ok"])
        self.assertFalse(result["pinned"])
        self.assertIn("sin respuesta", result["pinError"])


if __name__ == "__main__":
    unittest.main()
