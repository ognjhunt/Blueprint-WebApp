"""Verify/extract the pinned research-only release; optional isolated CPU SDK install."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tarfile
from pathlib import Path


def prepare(source, target, *, install=True):
    receipt = json.loads((source / "receipt.json").read_text())
    archive = source / "blueprint-research.tar"
    if (not re.fullmatch(r"[0-9a-f]{40}", receipt["source_commit"])
            or hashlib.sha256(archive.read_bytes()).hexdigest() != receipt["sha256"]):
        raise ValueError("research_release_digest_mismatch")
    with tarfile.open(archive) as package:
        members = package.getmembers()
        if any(not member.isfile() or member.name.startswith("/") or ".." in Path(member.name).parts for member in members):
            raise ValueError("research_release_member_invalid")
        manifest = json.load(package.extractfile("manifest.json"))
        if (manifest["source_commit"] != receipt["source_commit"] or manifest["activation_performed"] is not False
                or set(member.name for member in members) != {"manifest.json", *manifest["files"]}
                or len(members) != len(manifest["files"]) + 1):
            raise ValueError("research_release_manifest_invalid")
        contents = {}
        for member in members:
            if member.name != "manifest.json" and not member.name.startswith("tools/daily_research/"):
                raise ValueError("research_release_scope_invalid")
            raw = package.extractfile(member).read()
            if member.name != "manifest.json" and hashlib.sha256(raw).hexdigest() != manifest["files"][member.name]:
                raise ValueError("research_release_file_digest_mismatch")
            contents[member.name] = raw
    # Manual regular-file extraction works on Render's Python 3.11.2 too.
    release = target / "release"
    release.mkdir(parents=True, exist_ok=True)
    for name, raw in contents.items():
        path = release / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    if install:
        venv = target / "venv"
        subprocess.run([sys.executable, "-m", "venv", str(venv)], check=True)
        subprocess.run([str(venv / "bin/python"), "-m", "pip", "install", "--no-cache-dir", "--disable-pip-version-check",
                        "-r", str(release / "tools/daily_research/requirements.txt")], check=True)
    return {"source_commit": receipt["source_commit"], "sha256": receipt["sha256"], "installed_sdk": install}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="vendor/daily-research")
    parser.add_argument("--target", default="dist/daily-research")
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    print(json.dumps(prepare(Path(args.source), Path(args.target), install=not args.verify_only), sort_keys=True))
