import json
import shutil
import tempfile
import traceback
import urllib.request
import zipfile
from pathlib import Path
from typing import Any, Dict

import decky

REPO = "moi952/decky-proton-launch"
_API_URL = f"https://api.github.com/repos/{REPO}/releases/latest"
_HEADERS = {"User-Agent": "decky-proton-launch"}


def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())


def _download_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


async def perform_update() -> Dict[str, Any]:
    """Download the latest GitHub release zip and replace plugin files.

    Safe on Linux: the running process keeps old code in RAM; Decky reloads
    the plugin after this returns, picking up the new files from disk.
    """
    try:
        release = _fetch_json(_API_URL)
        tag = release.get("tag_name", "")
        assets = release.get("assets", [])
        zip_asset = next((a for a in assets if a["name"].endswith(".zip")), None)
        if not zip_asset:
            return {"success": False, "error": "no_zip_asset"}

        zip_url = zip_asset["browser_download_url"]
        decky.logger.info(f"[updater] downloading {zip_url}")

        zip_bytes = _download_bytes(zip_url)

        with tempfile.TemporaryDirectory() as tmp:
            zip_path = Path(tmp) / "update.zip"
            zip_path.write_bytes(zip_bytes)

            with zipfile.ZipFile(zip_path) as zf:
                zf.extractall(tmp)

            src = next(
                (d for d in Path(tmp).iterdir() if d.is_dir() and d.name != "__MACOSX"),
                None,
            )
            if not src:
                return {"success": False, "error": "bad_zip_structure"}

            dest = Path(decky.DECKY_PLUGIN_DIR)
            decky.logger.info(f"[updater] replacing {dest}")
            shutil.rmtree(dest)
            shutil.copytree(src, dest)

        decky.logger.info(f"[updater] updated to {tag}")
        return {"success": True, "version": tag}

    except Exception as e:
        decky.logger.error(f"[updater] {e}\n{traceback.format_exc()}")
        return {"success": False, "error": str(e)}
