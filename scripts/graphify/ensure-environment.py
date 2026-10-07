"""Provision the repo's pinned, local-only Graphify tool environment."""
from __future__ import annotations

import fcntl
import hashlib
import json
from pathlib import Path
import platform
import subprocess
import sys
import time
import venv


ROOT = Path(__file__).resolve().parents[2]
REQUIREMENTS = ROOT / "scripts/graphify/requirements.txt"
PROBE = """
from graphify.analyze import god_nodes, surprising_connections
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.detect import detect
from graphify.export import to_html, to_json
from graphify.extract import extract
from graphify.report import generate
"""


def environment_key(requirements: Path) -> str:
    identity = requirements.read_bytes() + repr((sys.version_info[:2], sys.platform, platform.machine())).encode()
    return hashlib.sha256(identity).hexdigest()


def usable(python: Path) -> bool:
    if not python.exists():
        return False
    try:
        return subprocess.run([str(python), "-c", PROBE], capture_output=True, timeout=30).returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False


def ensure_environment(root: Path = ROOT, requirements: Path = REQUIREMENTS) -> Path:
    if sys.version_info < (3, 10):
        raise RuntimeError("Graphify setup requires Python 3.10 or newer.")
    key = environment_key(requirements)
    cache = root / ".graphify_venv"
    cache.mkdir(exist_ok=True)
    environment = cache / f"py{sys.version_info.major}{sys.version_info.minor}-{key[:16]}"
    python = environment / "bin/python"
    marker = environment / ".blueprint-ready.json"

    # Multiple agents may start a fresh checkout at once. Only the installer
    # holds this lock; warmed environments still work without network access.
    with (cache / ".setup.lock").open("a") as lock:
        deadline = time.monotonic() + 300
        while True:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise RuntimeError("Timed out waiting for another Graphify setup; retry the command.")
                time.sleep(1)
        try:
            ready = json.loads(marker.read_text()) if marker.exists() else {}
        except (OSError, ValueError):
            ready = {}
        if ready.get("requirementsKey") == key and usable(python):
            return python

        if environment.is_symlink():
            raise RuntimeError(f"Managed Graphify environment must be a directory: {environment}")
        print("[graphify setup] installing pinned dependencies for this checkout", file=sys.stderr)
        venv.EnvBuilder(with_pip=True, clear=True).create(environment)
        subprocess.run([str(python), "-m", "pip", "install", "--no-input", "--no-cache-dir",
                        "--disable-pip-version-check", "--index-url", "https://pypi.org/simple",
                        "--requirement", str(requirements)], check=True, stdout=sys.stderr)
        subprocess.run([str(python), "-m", "pip", "--no-cache-dir", "--disable-pip-version-check", "check"],
                       check=True, stdout=sys.stderr)
        if not usable(python):
            raise RuntimeError("Installed Graphify failed its AST import check; retry setup.")
        # A failed/interrupted install never marks the environment ready.
        marker.write_text(json.dumps({"requirementsKey": key, "python": str(python)}, indent=2) + "\n")
        return python


if __name__ == "__main__":
    try:
        print(ensure_environment())
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        print(f"[graphify setup] {error}", file=sys.stderr)
        print("Retry the same command after restoring Python venv/pip and package-download access. "
              "An already-provisioned environment can run offline.", file=sys.stderr)
        sys.exit(1)
