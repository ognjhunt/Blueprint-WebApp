#!/usr/bin/env python3
"""Configure the owner-approved OpenAI key interactively on dot's computer."""
import getpass
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import urllib.request
import warnings

DOCTOR_URL = ("https://raw.githubusercontent.com/ognjhunt/Blueprint-WebApp/"
              "108d612c476b8b08a3d73bd064cde3c5cff1de5a/scripts/cloud/openai-doctor.mjs")


def private_file(path):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(fd, "r") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError("Credential must be an owner-only regular file")
        value = stream.read(16385).strip()
    if not value or len(value) > 16384:
        raise ValueError("Private file is missing or too large")
    return value


def write_once(path, value, mode):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    with os.fdopen(fd, "w") as stream:
        stream.write(value)


def main():
    home = Path.home()
    if home != Path("/home/agent"):
        raise ValueError("Run this on dot's VM, whose HOME is /home/agent")
    node = shutil.which("node")
    if not node or not shutil.which("curl"):
        raise ValueError("node and curl are required")
    folder = home / ".blueprint-secrets"
    folder.mkdir(mode=0o700, exist_ok=True)
    info = folder.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError(".blueprint-secrets must be an owner-only directory without symlinks")
    key_file = folder / "openai_api_key"
    if not key_file.exists() and not key_file.is_symlink():
        warnings.simplefilter("error", getpass.GetPassWarning)
        key = getpass.getpass("Paste existing OpenAI key here (hidden), then Enter: ").strip()
        if not key.startswith("sk-") or any(c.isspace() for c in key) or len(key) > 16384:
            raise ValueError("Key format is invalid; nothing was saved")
        write_once(key_file, key, 0o600)
        del key
    key = private_file(key_file)
    if any(c.isspace() for c in key):
        raise ValueError("Credential is malformed")
    del key
    doctor = folder / "openai-doctor.mjs"
    # This public, pinned source request carries no credentials.
    with urllib.request.urlopen(DOCTOR_URL, timeout=20) as response:
        source = response.read(65537)
    if len(source) > 65536:
        raise ValueError("Doctor source exceeded its size limit")
    if not doctor.exists() and not doctor.is_symlink():
        write_once(doctor, source.decode("utf-8"), 0o600)
    elif private_file(doctor) != source.decode("utf-8").strip():
        raise ValueError("Existing doctor differs; it was preserved")
    launcher = folder / "with-openai"
    launcher_source = "#!/usr/bin/env python3\n" + (
        "import os, pathlib, stat, sys\n"
        "if len(sys.argv) < 2: raise SystemExit('Usage: with-openai COMMAND [ARGS...]')\n"
        "p = pathlib.Path('/home/agent/.blueprint-secrets/openai_api_key')\n"
        "fd = os.open(p, os.O_RDONLY | os.O_NOFOLLOW)\n"
        "with os.fdopen(fd) as f:\n"
        "    s = os.fstat(f.fileno())\n"
        "    if not stat.S_ISREG(s.st_mode) or s.st_uid != os.getuid() or s.st_mode & 0o077:\n"
        "        raise SystemExit('Credential permissions are unsafe')\n"
        "    key = f.read(16385).strip()\n"
        "if not key or len(key) > 16384 or '\\n' in key or '\\r' in key:\n"
        "    raise SystemExit('Credential is missing or malformed')\n"
        "env = os.environ.copy()\n"
        "env['OPENAI_API_KEY'] = key\n"
        "env['OPENAI_API_KEY_FILE'] = str(p)\n"
        "os.execvpe(sys.argv[1], sys.argv[1:], env)\n"
    )
    if not launcher.exists() and not launcher.is_symlink():
        write_once(launcher, launcher_source, 0o700)
    elif private_file(launcher) != launcher_source.strip():
        raise ValueError("Existing launcher differs; it was preserved")
    env = os.environ.copy()
    env.pop("OPENAI_API_KEY", None)
    env["OPENAI_API_KEY_FILE"] = str(key_file)
    print(json.dumps({"credential_file": str(key_file), "mode": "0600",
                      "launcher": str(launcher)}), flush=True)
    return subprocess.run([node, str(doctor)], env=env, timeout=30, check=False).returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, getpass.GetPassWarning, subprocess.TimeoutExpired):
        # Suppress raw exception data, which may include provider or input contents.
        print("Setup could not complete safely. Existing files were preserved; no secret was printed.", file=sys.stderr)
        sys.exit(1)
