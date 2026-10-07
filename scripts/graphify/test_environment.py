"""Offline regression checks for fresh-session setup and recovery."""
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location("graphify_environment", Path(__file__).with_name("ensure-environment.py"))
setup = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(setup)
REAL_PROBE = setup.usable
REAL_RUN = subprocess.run


class EnvironmentTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory()
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.requirements = self.root / "requirements.txt"
        self.requirements.write_text("graphifyy==0.9.79\n")
        self.builder = patch.object(setup.venv, "EnvBuilder").start()
        self.addCleanup(patch.stopall)
        self.builder.return_value.create.side_effect = self.create_fake_environment
        self.pip = patch.object(setup.subprocess, "run").start()
        self.probe = patch.object(setup, "usable", return_value=True).start()

    def create_fake_environment(self, destination):
        destination.mkdir(parents=True, exist_ok=True)
        (destination / "bin").mkdir(exist_ok=True)
        (destination / "bin/python").touch()
        (destination / ".blueprint-ready.json").unlink(missing_ok=True)

    def ensure(self):
        return setup.ensure_environment(self.root, self.requirements)

    def test_fresh_setup_then_offline_reuse(self):
        python = self.ensure()
        self.assertTrue((python.parent.parent / ".blueprint-ready.json").exists())
        self.assertEqual(self.pip.call_count, 2)
        self.pip.reset_mock()
        self.pip.side_effect = AssertionError("A warm session must not download packages")
        self.assertEqual(self.ensure(), python)
        self.pip.assert_not_called()
        self.builder.assert_called_once()

    def test_failed_install_is_not_ready_and_retries(self):
        self.pip.side_effect = subprocess.CalledProcessError(1, ["pip", "install"])
        with self.assertRaises(subprocess.CalledProcessError):
            self.ensure()
        self.assertEqual(list(self.root.rglob(".blueprint-ready.json")), [])
        self.pip.side_effect = None
        python = self.ensure()
        self.assertTrue((python.parent.parent / ".blueprint-ready.json").exists())

    def test_changed_requirements_get_new_environment(self):
        original = self.ensure()
        self.requirements.write_text("graphifyy==0.9.79\nnetworkx==3.4.2\n")
        updated = self.ensure()
        self.assertNotEqual(original, updated)
        self.assertTrue(original.exists())

    def test_broken_import_repairs_managed_environment(self):
        python = self.ensure()
        self.probe.side_effect = [False, True]
        self.assertEqual(self.ensure(), python)
        self.assertEqual(self.builder.call_count, 2)

    def test_nonexecutable_and_corrupt_interpreters_are_repaired(self):
        python = self.ensure()
        for permissions in (0o644, 0o755):
            with self.subTest(permissions=permissions):
                python.chmod(permissions)
                before = self.builder.call_count
                def real_broken_probe(path):
                    if self.builder.call_count != before:
                        return True
                    with patch.object(setup.subprocess, "run", REAL_RUN):
                        return REAL_PROBE(path)
                self.probe.side_effect = real_broken_probe
                self.assertEqual(self.ensure(), python)
                self.assertEqual(self.builder.call_count, before + 1)

    def test_concurrent_sessions_install_once(self):
        def slow_install(*args, **kwargs):
            time.sleep(0.05)
        self.pip.side_effect = slow_install
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.ensure(), range(2)))
        self.assertEqual(results[0], results[1])
        self.builder.assert_called_once()
        self.assertEqual(self.pip.call_count, 2)


if __name__ == "__main__":
    unittest.main()
