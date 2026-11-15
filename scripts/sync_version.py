#!/usr/bin/env python3
"""
Synchronizes the release version across `package.json`, `plugin.json`, and `pyproject.toml`.
Used by `semantic-release` (`@semantic-release/exec` prepareCmd) and manual release bumps.
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def sync_version(version: str) -> None:
    clean_ver = version.lstrip("v").strip()
    if not re.match(r"^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$", clean_ver):
        raise ValueError(f"Invalid semantic version: {version}")

    for json_name in ("package.json", "plugin.json"):
        path = os.path.join(ROOT_DIR, json_name)
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        data["version"] = clean_ver
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")

    pyproject_path = os.path.join(ROOT_DIR, "pyproject.toml")
    with open(pyproject_path, encoding="utf-8") as f:
        content = f.read()
    updated = re.sub(
        r'(^version\s*=\s*")[^"]+(")',
        rf"\g<1>{clean_ver}\g<2>",
        content,
        count=1,
        flags=re.MULTILINE,
    )
    with open(pyproject_path, "w", encoding="utf-8") as f:
        f.write(updated)

    print(
        f"[Sync Version] Synchronized package.json, plugin.json, and pyproject.toml -> {clean_ver}"
    )


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 scripts/sync_version.py <version>")
    sync_version(sys.argv[1])


if __name__ == "__main__":
    main()
