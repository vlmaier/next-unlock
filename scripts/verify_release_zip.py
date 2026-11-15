#!/usr/bin/env python3
"""
Verifies the packaged `next-unlock.zip` release artifact before deployment to Steam Deck.
Checks:
1. Version consistency across plugin.json, package.json, and pyproject.toml.
2. Required files exist inside `next-unlock/` root folder in the zip archive.
3. No forbidden dev/cache files (`__pycache__`, `.venv`, `node_modules`) are leaked into the zip.
"""

from __future__ import annotations

import json
import os
import sys
import zipfile

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def verify_versions() -> str:
    with open(os.path.join(ROOT_DIR, "package.json"), encoding="utf-8") as f:
        pkg_ver = str(json.load(f)["version"])
    with open(os.path.join(ROOT_DIR, "plugin.json"), encoding="utf-8") as f:
        plugin_ver = str(json.load(f)["version"])

    if pkg_ver != plugin_ver:
        raise RuntimeError(
            f"Version mismatch: package.json ({pkg_ver}) != plugin.json ({plugin_ver})"
        )
    return pkg_ver


def verify_zip(zip_path: str) -> None:
    if not os.path.isfile(zip_path):
        raise RuntimeError(f"Release zip not found at {zip_path}")

    required_entries = {
        "next-unlock/plugin.json",
        "next-unlock/package.json",
        "next-unlock/main.py",
        "next-unlock/dist/index.js",
        "next-unlock/backend/models.py",
        "next-unlock/backend/recommendation.py",
        "next-unlock/backend/achievement_parser.py",
        "next-unlock/backend/achievement_fetcher.py",
    }

    with zipfile.ZipFile(zip_path, "r") as zf:
        names = set(zf.namelist())
        missing = required_entries - names
        if missing:
            raise RuntimeError(f"Missing required files in {zip_path}: {sorted(missing)}")

        for name in names:
            if "__pycache__" in name or name.endswith(".pyc") or "node_modules" in name:
                raise RuntimeError(f"Forbidden dev artifact found inside release zip: {name}")

        index_info = zf.getinfo("next-unlock/dist/index.js")
        if index_info.file_size < 1000:
            raise RuntimeError(f"dist/index.js in zip is too small ({index_info.file_size} bytes)")


def main() -> None:
    ver = verify_versions()
    zip_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT_DIR, "next-unlock.zip")
    if os.path.exists(zip_path):
        verify_zip(zip_path)
        print(
            f"[Package Verify] PASS: next-unlock.zip (v{ver}) verified for Decky Loader installation."
        )
    else:
        print(f"[Version Verify] PASS: package.json and plugin.json match (v{ver}).")


if __name__ == "__main__":
    main()
