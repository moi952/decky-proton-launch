import asyncio
import json
import os
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import decky

# Checks GitHub Releases for a newer decky-proton-launch build than the one
# currently installed. Used from Plugin._main() so a notification can fire
# once per Decky Loader session even if the user never opens the plugin's
# own panel — a plain frontend fetch() only runs once that panel actually
# mounts, which doesn't happen until the user opens it.
GITHUB_REPO = "moi952/decky-proton-launch"
FALLBACK_RELEASE_URL = f"https://github.com/{GITHUB_REPO}/releases/latest"

PLUGIN_JSON_PATH = Path(decky.DECKY_PLUGIN_DIR) / "plugin.json"
# release.yml's own $PLUGIN_NAME comes from package.json's "name" (the npm
# package / repo name, "decky-proton-launch") — a different field from
# plugin.json's "name" (the human-readable display name, "Decky Proton
# Launch"). Only the former matches the asset filename it actually
# uploads.
PACKAGE_JSON_PATH = Path(decky.DECKY_PLUGIN_DIR) / "package.json"

_TAG_RE = re.compile(r"/releases/download/([^/]+)/")


def _clean_env() -> Dict[str, str]:
    """Decky Loader's own backend process runs with LD_LIBRARY_PATH pointed
    at its bundled libs; that leaks into every subprocess we spawn and makes
    system binaries (curl, ...) load the wrong shared libs. Stripping it
    before exec is the standard fix — see decky-nvidia-update's plugin.py,
    which hits (and fixes) the exact same issue for its own subprocess
    calls. Without this, curl silently fails here and the update check
    always reports "couldn't check for updates"."""
    env = os.environ.copy()
    env.pop("LD_LIBRARY_PATH", None)
    return env


def _version_tuple(v: str):
    """'1.2.10' -> (1, 2, 10), tolerant of a leading 'v' and non-numeric
    trailing junk (e.g. a '-beta' suffix on a hand-made tag)."""
    parts = []
    for p in v.lstrip("vV").split("."):
        m = re.match(r"\d+", p)
        parts.append(int(m.group()) if m else 0)
    return tuple(parts)


async def _run_curl(args: List[str]) -> Optional[str]:
    try:
        proc = await asyncio.create_subprocess_exec(
            *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
            env=_clean_env(),
        )
        out, _ = await proc.communicate()
        if proc.returncode != 0:
            return None
        return out.decode(errors="replace")
    except Exception as e:
        decky.logger.error(f"[plugin_updater] curl failed: {e}")
        return None


async def _resolve_redirect(url: str) -> Optional[str]:
    """The single Location a request to `url` redirects to — never
    follows it. GitHub's own releases/latest/download/<name> redirects to
    the real latest release's tag regardless of whether <name> is an
    actual asset in it, so a HEAD there resolves the tag for free, without
    touching the rate-limited api.github.com."""
    out = await _run_curl(
        ["curl", "-sI", "-o", "/dev/null", "-w", "%{redirect_url}", "--max-time", "15", url]
    )
    return (out or "").strip() or None


async def _url_exists(url: str) -> bool:
    out = await _run_curl(["curl", "-sfIL", "-o", "/dev/null", "--max-time", "15", url])
    return out is not None


async def resolve_latest_release(repo: str, plugin_name: str) -> Optional[Dict[str, Any]]:
    """Resolves `repo`'s latest GitHub release — a tag and a matching
    asset download URL — without ever calling api.github.com, sidestepping
    its 60/hour/IP anonymous quota entirely. Costs: no sha256 digest
    (Decky's own installer already treats a missing one as "skip
    verification") and no prerelease flag (moot here — release.yml never
    publishes a prerelease). See resolve_redirect's own note for why this
    works, and plugin.py's resolve_other_plugin_release for why it's valid
    for a sibling plugin's repo too (same release.yml asset-naming
    convention: "<plugin_name>-<tag>.zip")."""
    location = await _resolve_redirect(f"https://github.com/{repo}/releases/latest/download/_")
    if not location:
        return None
    match = _TAG_RE.search(location)
    if not match:
        return None
    tag = match.group(1)
    asset_name = f"{plugin_name}-{tag}.zip"
    asset_url = f"https://github.com/{repo}/releases/download/{tag}/{asset_name}"
    if not await _url_exists(asset_url):
        return None
    return {
        "tag": tag,
        "version": tag.lstrip("vV"),
        "url": f"https://github.com/{repo}/releases/tag/{tag}",
        "asset_url": asset_url,
        "sha256": "",
        "prerelease": False,
    }


class PluginUpdaterMixin:
    """Backend half of the plugin self-update check. Mixed into Plugin (see
    plugin.py) so its methods/attributes are reachable from _main()."""

    def _read_plugin_json(self) -> Dict[str, Any]:
        try:
            return json.loads(PLUGIN_JSON_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[plugin_updater] reading plugin.json: {e}")
            return {}

    def _read_package_json(self) -> Dict[str, Any]:
        try:
            return json.loads(PACKAGE_JSON_PATH.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[plugin_updater] reading package.json: {e}")
            return {}

    def _self_identity(self) -> tuple:
        """(current_version, display_name, plugin_name) — plugin_name is
        package.json's "name" (release.yml's own $PLUGIN_NAME, the asset-
        naming key resolve_latest_release needs), not plugin.json's "name"
        (the human-readable display_name — a different field)."""
        plugin_json = self._read_plugin_json()
        current = str(plugin_json.get("version", ""))
        display_name = str(plugin_json.get("name", "Decky Proton Launch"))
        plugin_name = str(self._read_package_json().get("name", "")) or GITHUB_REPO.split("/")[-1]
        return current, display_name, plugin_name

    async def check_plugin_update_on_load(self) -> Optional[Dict[str, Any]]:
        """Called once from _main(). Returns the update-info dict (matching
        the frontend's PluginUpdateInfo shape) only when a newer version is
        actually available — None otherwise, including on any check failure
        (nothing to notify about in that case)."""
        current, display_name, plugin_name = self._self_identity()
        release = await resolve_latest_release(GITHUB_REPO, plugin_name)
        if release is None:
            return None

        if _version_tuple(release["version"]) <= _version_tuple(current):
            return None

        return {
            "current_version": current,
            "latest_version": release["version"],
            "has_update": True,
            "release_url": release["url"],
            "asset_url": release["asset_url"],
            "sha256": release["sha256"],
            "plugin_display_name": display_name,
            "checked_ok": True,
        }

    async def check_plugin_update_now(self) -> Dict[str, Any]:
        """Same resolution as check_plugin_update_on_load, but always
        returns the full PluginUpdateInfo shape — even with no update
        available, or the check itself failing — since this is what the
        frontend's Settings section (and its own on-mount check) calls,
        replacing what used to be its own direct fetch() to
        api.github.com (see githubReleases.ts's fetchLatestReleaseInfo)."""
        current, display_name, plugin_name = self._self_identity()
        empty = {
            "current_version": current,
            "latest_version": "",
            "has_update": False,
            "release_url": FALLBACK_RELEASE_URL,
            "asset_url": "",
            "sha256": "",
            "plugin_display_name": display_name,
            "checked_ok": False,
        }
        try:
            release = await resolve_latest_release(GITHUB_REPO, plugin_name)
        except Exception as e:
            decky.logger.error(f"[check_plugin_update_now] {e}")
            return empty
        if release is None:
            return empty
        return {
            "current_version": current,
            "latest_version": release["version"],
            "has_update": _version_tuple(release["version"]) > _version_tuple(current),
            "release_url": release["url"],
            "asset_url": release["asset_url"],
            "sha256": release["sha256"],
            "plugin_display_name": display_name,
            "checked_ok": True,
        }
