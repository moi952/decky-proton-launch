import shutil
import traceback
from pathlib import Path
from typing import Optional

import decky

from .vdf import parse_text, serialize_text, read_binary, write_binary
from .steam import get_user_dirs, get_shortcuts_paths


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
            if "%command%" in current:
                # Insert wrapper just before %command% so existing options are preserved
                apps[app_str]["LaunchOptions"] = current.replace("%command%", LAUNCH_OPTION, 1)
            else:
                apps[app_str]["LaunchOptions"] = f"{LAUNCH_OPTION} {current}"
        else:
            apps[app_str]["LaunchOptions"] = LAUNCH_OPTION

        shutil.copy2(lc, lc.with_suffix(".vdf.bak"))
        lc.write_text(serialize_text(data), encoding="utf-8")
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
        decky.logger.info(f"[launch_option] removed for app {app_id} in {lc}")
        return True
    except Exception as e:
        decky.logger.error(f"[launch_option] remove error for {app_id}: {e}\n{traceback.format_exc()}")
        return False


def set_launch_option_shortcut(app_id: int) -> bool:
    """Write ~/proton-launch %command% to shortcuts.vdf for this non-Steam app."""
    for sc_path in get_shortcuts_paths():
        try:
            raw = sc_path.read_bytes()
            nodes, _ = read_binary(raw, 0)
            modified = False

            new_top = []
            for tag, key, children in nodes:
                if tag == 0x00 and key.lower() == "shortcuts":
                    new_children = []
                    for etag, ekey, efields in children:
                        if etag != 0x00:
                            new_children.append((etag, ekey, efields))
                            continue
                        appid_val = None
                        for f in efields:
                            if f[0] == 0x02 and f[1].lower() == "appid":
                                appid_val = f[2] & 0xFFFFFFFF
                        if appid_val == app_id:
                            new_fields = []
                            found_lo = False
                            for f in efields:
                                if f[0] == 0x01 and f[1].lower() == "launchoptions":
                                    found_lo = True
                                    current = f[2]
                                    if LAUNCH_OPTION in current:
                                        new_fields.append(f)
                                    elif current.strip():
                                        if "%command%" in current:
                                            new_val = current.replace("%command%", LAUNCH_OPTION, 1)
                                        else:
                                            new_val = f"{LAUNCH_OPTION} {current}"
                                        new_fields.append((0x01, f[1], new_val))
                                    else:
                                        new_fields.append((0x01, f[1], LAUNCH_OPTION))
                                else:
                                    new_fields.append(f)
                            if not found_lo:
                                new_fields.append((0x01, "LaunchOptions", LAUNCH_OPTION))
                            new_children.append((etag, ekey, new_fields))
                            modified = True
                        else:
                            new_children.append((etag, ekey, efields))
                    new_top.append((tag, key, new_children))
                else:
                    new_top.append((tag, key, children))

            if modified:
                shutil.copy2(sc_path, sc_path.with_suffix(".vdf.bak"))
                sc_path.write_bytes(write_binary(new_top))
                decky.logger.info(f"[launch_option] shortcut set for app {app_id} in {sc_path}")
                return True
        except Exception as e:
            decky.logger.error(f"[launch_option] shortcut set error for {app_id} in {sc_path}: {e}\n{traceback.format_exc()}")
    return False


def remove_launch_option_shortcut(app_id: int) -> bool:
    """Remove ~/proton-launch %command% from shortcuts.vdf for this non-Steam app."""
    for sc_path in get_shortcuts_paths():
        try:
            raw = sc_path.read_bytes()
            nodes, _ = read_binary(raw, 0)
            modified = False

            new_top = []
            for tag, key, children in nodes:
                if tag == 0x00 and key.lower() == "shortcuts":
                    new_children = []
                    for etag, ekey, efields in children:
                        if etag != 0x00:
                            new_children.append((etag, ekey, efields))
                            continue
                        appid_val = None
                        for f in efields:
                            if f[0] == 0x02 and f[1].lower() == "appid":
                                appid_val = f[2] & 0xFFFFFFFF
                        if appid_val == app_id:
                            new_fields = []
                            for f in efields:
                                if f[0] == 0x01 and f[1].lower() == "launchoptions":
                                    new_val = f[2].replace(LAUNCH_OPTION, "").strip()
                                    new_fields.append((0x01, f[1], new_val))
                                    modified = True
                                else:
                                    new_fields.append(f)
                            new_children.append((etag, ekey, new_fields))
                        else:
                            new_children.append((etag, ekey, efields))
                    new_top.append((tag, key, new_children))
                else:
                    new_top.append((tag, key, children))

            if modified:
                shutil.copy2(sc_path, sc_path.with_suffix(".vdf.bak"))
                sc_path.write_bytes(write_binary(new_top))
                decky.logger.info(f"[launch_option] shortcut removed for app {app_id} in {sc_path}")
                return True
        except Exception as e:
            decky.logger.error(f"[launch_option] shortcut remove error for {app_id}: {e}\n{traceback.format_exc()}")
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
