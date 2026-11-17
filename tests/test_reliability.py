import threading
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from butler.core import HidError, Keyboard
from butler.server import DeviceManager, Handler, _read_after_write


class ReliabilityTests(unittest.TestCase):
    def test_music_dazzle_uses_zero_not_eight(self):
        for mode in (20, 22):
            for low, expected in ((0, True), (4, False)):
                response = bytes([135, mode, 4, 4, low, 20, 30, 40, 0])
                self.assertEqual(Keyboard._parse_light(response)["dazzle"], expected)
        for low, expected in ((0, True), (4, False)):
            response = bytes([136, 6, 1, 4, low, 20, 30, 40, 0])
            self.assertEqual(Keyboard._parse_side_light(response)["dazzle"], expected)

    def test_read_reconnects_once(self):
        manager = DeviceManager()
        first, second = Mock(), Mock()
        manager.kb = first
        first.read.side_effect = HidError("desconectado")
        second.read.return_value = 42
        with patch("butler.server.Keyboard", return_value=second) as connect:
            self.assertEqual(manager.call(lambda kb: kb.read()), 42)
        first.read.assert_called_once()
        second.read.assert_called_once()
        connect.assert_called_once()

    def test_write_failure_is_not_replayed(self):
        manager = DeviceManager()
        keyboard = Mock()
        manager.kb = keyboard
        keyboard.write.side_effect = HidError("respuesta perdida")
        with patch("butler.server.Keyboard") as connect:
            with self.assertRaisesRegex(HidError, "puede haberse aplicado"):
                manager.call(lambda kb: kb.write(), write=True)
        keyboard.write.assert_called_once()
        connect.assert_not_called()
        self.assertIsNone(manager.kb)

    def test_failed_readback_reports_uncertain_result(self):
        with patch("butler.server.DEV") as manager:
            manager.call.side_effect = HidError("sin respuesta")
            with self.assertRaisesRegex(HidError, "no se pudo comprobar"):
                _read_after_write(lambda kb: kb.get_light())
            manager.call.assert_called_once()

    def test_invalid_command_response_is_rejected(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.lock = threading.RLock()
        keyboard._send = Mock()
        keyboard._read = Mock(return_value=bytes([0] * 64))
        with patch("butler.core.sleep_ms"):
            with self.assertRaisesRegex(HidError, "Respuesta inesperada"):
                keyboard.cmd([143], expect=143)
        self.assertEqual(keyboard._send.call_count, 3)

    def test_matrix_accepts_raw_data_without_command_echo(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.cmd = Mock(side_effect=[bytes([i]) * 64 for i in range(8)])
        result = keyboard.get_matrix()
        self.assertEqual(result, b"".join(bytes([i]) * 64 for i in range(8)))
        self.assertEqual(keyboard.cmd.call_count, 8)

    def test_short_matrix_response_fails(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.cmd = Mock(return_value=bytes([138]))
        with self.assertRaisesRegex(HidError, "Respuesta incompleta"):
            keyboard.get_matrix()

    def test_status_reads_identity_once(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.info = SimpleNamespace(product="X820UItra", vid=0x3151,
                                        pid=0x5002, path="test")
        response = bytearray(64)
        response[0] = 143
        response[1] = 1
        response[7] = 2
        keyboard.cmd = Mock(return_value=bytes(response))
        for name in ("get_rf_version", "get_oled_version", "get_profile",
                     "get_report_rate", "get_debounce", "get_light",
                     "get_side_light", "get_kb_option", "get_sleep"):
            setattr(keyboard, name, Mock(return_value=None))
        status = keyboard.status()
        self.assertEqual((status["deviceId"], status["usbVersion"]), (1, 2))
        keyboard.cmd.assert_called_once_with([143], expect=143, retries=3)

    def test_missing_current_settings_are_not_overwritten(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.cmd = Mock()
        keyboard.get_sleep = Mock(return_value=None)
        keyboard.get_kb_option = Mock(return_value=None)
        with self.assertRaises(HidError):
            keyboard.set_sleep(bt=60)
        with self.assertRaises(HidError):
            keyboard.set_os_mode("win")
        keyboard.cmd.assert_not_called()

    def test_color_packets_match_driver_and_preserve_payload(self):
        keyboard = Keyboard.__new__(Keyboard)
        keyboard.lock = threading.RLock()
        keyboard._send = Mock()
        data = bytes(i % 256 for i in range(384))
        with patch("butler.core.sleep_ms"):
            keyboard.set_key_colors(data)
        packets = [call.args[0] for call in keyboard._send.call_args_list]
        self.assertEqual(len(packets), 7)
        self.assertEqual(packets[-1][:8], bytes([12, 0, 255, 6, 42, 1, 0, 0]))
        self.assertEqual(b"".join(packet[8:8 + packet[4]] for packet in packets), data[:378])

    def test_colors_changed_externally_are_not_overwritten(self):
        import base64
        original = bytes(384)
        changed = bytearray(original)
        changed[0] = 255
        keyboard = Mock()
        keyboard.get_key_colors.return_value = bytes([1]) + original[1:]
        manager = DeviceManager()
        manager.kb = keyboard
        body = {"original": base64.b64encode(original).decode(),
                "data": base64.b64encode(changed).decode()}
        with patch("butler.server.DEV", manager):
            with self.assertRaisesRegex(ValueError, "cambiaron"):
                Handler.__new__(Handler)._set_key_colors(body)
        keyboard.set_key_colors.assert_not_called()

    def test_color_write_reads_back_before_activating(self):
        import base64
        original = bytes(384)
        edited = bytearray(original)
        edited[:3] = bytes([10, 20, 30])
        keyboard = Mock()
        keyboard.get_key_colors.side_effect = [original, bytes(edited)]
        keyboard.get_light.side_effect = [
            {"mode": "LightWave", "brightness": 4, "speed": 2},
            {"mode": "LightUserPicture", "brightness": 4, "speed": 2},
        ]
        manager = DeviceManager()
        manager.kb = keyboard
        body = {"original": base64.b64encode(original).decode(),
                "data": base64.b64encode(edited).decode()}
        with patch("butler.server.DEV", manager):
            result = Handler.__new__(Handler)._set_key_colors(body)
        self.assertTrue(result["ok"])
        keyboard.set_key_colors.assert_called_once_with(bytes(edited))
        self.assertLess(keyboard.mock_calls.index(unittest.mock.call.set_key_colors(bytes(edited))),
                        keyboard.mock_calls.index(unittest.mock.call.set_light("LightUserPicture", brightness=4, speed=2, option=0)))


if __name__ == "__main__":
    unittest.main()
