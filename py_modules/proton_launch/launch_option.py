import shutil
import traceback
from pathlib import Path
from typing import Optional

import decky

from .vdf import parse_text, serialize_text
from .steam import get_user_dirs
from .profile import chown_to_user


LAUNCH_OPTION = "~/proton-launch %command%"


def find_localconfig(app_id: int) -> Optional[Path]:
    """Return the localconfig.vdf that contains this app_id, or None."""
    for user_dir in get_user_dirs():
        lc = user_dir / "config" / "localconfig.vdf"
        if not lc.is_file():
            continue
        try:
            data = parse_text(lc.read_text(encoding="utf-8", errors="replace"))
            apps = (
                data.get("UserLocalConfigStore", {})
                    .get("Software", {})
                    .get("Valve", {})
                    .get("Steam", {})
                    .get("apps", {})
            )
            if str(app_id) in apps:
                return lc
        except Exception as e:
            decky.logger.warning(f"[localconfig] error reading {lc}: {e}")
    # Fallback to first available
    for user_dir in get_user_dirs():
        lc = user_dir / "config" / "localconfig.vdf"
        if lc.is_file():
            return lc
    return None


def set_launch_option(app_id: int) -> bool:
    """Write ~/proton-launch %command% to localconfig.vdf for this app."""
    lc = find_localconfig(app_id)
    if lc is None:
        decky.logger.error(f"[launch_option] no localconfig.vdf found for app {app_id}")
        return False
    try:
        data = parse_text(lc.read_text(encoding="utf-8", errors="replace"))
        apps = (
            data.setdefault("UserLocalConfigStore", {})
                .setdefault("Software", {})
                .setdefault("Valve", {})
                .setdefault("Steam", {})
                .setdefault("apps", {})
        )
        app_str = str(app_id)
        if app_str not in apps:
            apps[app_str] = {}

        current = apps[app_str].get("LaunchOptions", "")
        if LAUNCH_OPTION in current:
            decky.logger.info(f"[launch_option] already set for {app_id}")
            return True

        if current.strip():
            apps[app_str]["LaunchOptions"] = f"{LAUNCH_OPTION} {current}"
        else:
            apps[app_str]["LaunchOptions"] = LAUNCH_OPTION

        shutil.copy2(lc, lc.with_suffix(".vdf.bak"))
        lc.write_text(serialize_text(data), encoding="utf-8")
        chown_to_user(lc)
        decky.logger.info(f"[launch_option] set for app {app_id} in {lc}")
        return True
    except Exception as e:
        decky.logger.error(f"[launch_option] set error for {app_id}: {e}\n{traceback.format_exc()}")
        return False


def remove_launch_option(app_id: int) -> bool:
    """Remove ~/proton-launch %command% from localconfig.vdf for this app."""
    lc = find_localconfig(app_id)
    if lc is None:
        return True
    try:
        data = parse_text(lc.read_text(encoding="utf-8", errors="replace"))
        apps = (
            data.get("UserLocalConfigStore", {})
                .get("Software", {})
                .get("Valve", {})
                .get("Steam", {})
                .get("apps", {})
        )
        app_str = str(app_id)
        if app_str not in apps:
            return True

        current = apps[app_str].get("LaunchOptions", "")
        apps[app_str]["LaunchOptions"] = current.replace(LAUNCH_OPTION, "").strip()

        shutil.copy2(lc, lc.with_suffix(".vdf.bak"))
        lc.write_text(serialize_text(data), encoding="utf-8")
        chown_to_user(lc)
        decky.logger.info(f"[launch_option] removed for app {app_id} in {lc}")
        return True
    except Exception as e:
        decky.logger.error(f"[launch_option] remove error for {app_id}: {e}\n{traceback.format_exc()}")
        return False


def get_status(app_id: int) -> str:
    """Return the current LaunchOptions string for this app from localconfig.vdf."""
    try:
        lc = find_localconfig(app_id)
        if lc is None:
            return "(localconfig.vdf not found)"
        data = parse_text(lc.read_text(encoding="utf-8", errors="replace"))
        apps = (
            data.get("UserLocalConfigStore", {})
                .get("Software", {})
                .get("Valve", {})
                .get("Steam", {})
                .get("apps", {})
        )
        return apps.get(str(app_id), {}).get("LaunchOptions", "(not set)")
    except Exception as e:
        return f"(error: {e})"
