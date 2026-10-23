"""Zips extension/ into dist/subtitle-downloader-for-youtube-<version>.zip.

The archive is what Microsoft Edge Add-ons (and the Chrome Web Store) accept.
The version comes from extension/manifest.json; an existing archive is never
overwritten, so bump "version" in the manifest for every release.

Usage: python3 scripts/package.py
"""

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXTENSION = ROOT / "extension"
DIST = ROOT / "dist"


def main() -> int:
    version = json.loads((EXTENSION / "manifest.json").read_text(encoding="utf-8"))["version"]
    target = DIST / f"subtitle-downloader-for-youtube-{version}.zip"
    if target.exists():
        print(f"{target.relative_to(ROOT)} already exists; bump the manifest version first.", file=sys.stderr)
        return 1
    DIST.mkdir(exist_ok=True)
    files = sorted(p for p in EXTENSION.rglob("*") if p.is_file())
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(EXTENSION).as_posix())
    print(f"wrote {target.relative_to(ROOT)} ({len(files)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
