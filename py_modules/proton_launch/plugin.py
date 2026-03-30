import base64
import json
import os
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

import decky

from .vdf import parse_text, read_binary
from .image import is_horizontal
from .steam import get_steam_roots, get_user_dirs, get_all_steamapps_dirs, get_shortcuts_paths, get_shortcut_name
from .profile import profiles_dir, script_path, profile_path, chown_to_user, write_profile, read_profile
from .launch_option import (
    LAUNCH_OPTION,
    set_launch_option, remove_launch_option, get_status,
    set_launch_option_shortcut, remove_launch_option_shortcut,
)


class Plugin:

    async def ping(self) -> str:
        decky.logger.info("[ping] pong")
        return "pong"

    # ── Game discovery ──────────────────────────────────────────────────────────

    async def get_games(self) -> List[Dict[str, Any]]:
        decky.logger.info("[get_games] starting")
        try:
            games: List[Dict[str, Any]] = []
            seen: set = set()

            for steamapps in get_all_steamapps_dirs():
                for acf in steamapps.glob("appmanifest_*.acf"):
                    try:
                        data = parse_text(acf.read_text(encoding="utf-8", errors="ignore"))
                        state = data.get("AppState", {})
                        appid_str = state.get("appid", "")
                        name = state.get("name", "")
                        if appid_str and name:
                            appid = int(appid_str)
                            if appid not in seen:
                                seen.add(appid)
                                games.append({"appid": appid, "name": name, "is_shortcut": False})
                    except Exception as e:
                        decky.logger.error(f"[get_games] ACF error: {e}")

            for path in get_shortcuts_paths():
                try:
                    raw = path.read_bytes()
                    nodes, _ = read_binary(raw, 0)
                    for tag, key, children in nodes:
                        if tag == 0x00 and key.lower() == "shortcuts":
                            for etag, _, efields in children:
                                if etag != 0x00:
                                    continue
                                appid_val = None
                                name = ""
                                for f in efields:
                                    if f[0] == 0x02 and f[1].lower() == "appid":
                                        appid_val = f[2] & 0xFFFFFFFF
                                    if f[0] == 0x01 and f[1].lower() in ("appname", "name"):
                                        name = f[2]
                                if appid_val is not None and name and appid_val not in seen:
                                    seen.add(appid_val)
                                    games.append({"appid": appid_val, "name": name, "is_shortcut": True})
                except Exception as e:
                    decky.logger.error(f"[get_games] shortcuts error: {e}")

            games.sort(key=lambda g: g["name"].lower())
            decky.logger.info(f"[get_games] {len(games)} games")
            return games
        except Exception:
            decky.logger.error(f"[get_games] exception:\n{traceback.format_exc()}")
            return []

    # ── Script management ───────────────────────────────────────────────────────

    SCRIPT_VERSION = "v4"

    async def is_script_installed(self) -> str:
        """Return 'current', 'outdated', or 'missing'."""
        path = script_path()
        if not path.is_file():
            return "missing"
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
            if f"# decky-proton-launch {Plugin.SCRIPT_VERSION}" in content:
                return "current"
            if "# decky-proton-launch" in content:
                return "outdated"
            return "missing"
        except Exception:
            return "missing"

    async def install_script(self) -> bool:
        try:
            pd = profiles_dir()
            pd.mkdir(parents=True, exist_ok=True)
            chown_to_user(pd)
            chown_to_user(pd.parent)

            sp = script_path()
            sp.write_text(
                "#!/bin/bash\n"
                f"# decky-proton-launch {Plugin.SCRIPT_VERSION} — launch wrapper\n"
                "# Add '~/proton-launch %command%' to your game launch options\n"
                "LOG=/tmp/proton-launch.log\n"
                "echo \"\" >> \"${LOG}\"\n"
                "echo \"=== $(date) ==\" >> \"${LOG}\"\n"
                "# Try all known env var names for the app ID\n"
                "APPID=\"${SteamAppId:-${STEAM_APPID:-${STEAM_COMPAT_APP_ID:-}}}\"\n"
                "echo \"[proton-launch] resolved APPID=${APPID}\" >> \"${LOG}\"\n"
                "PROFILE=\"${HOME}/.config/decky-proton-launch/profiles/${APPID}.env\"\n"
                "echo \"[proton-launch] looking for profile: ${PROFILE}\" >> \"${LOG}\"\n"
                "if [ -n \"${APPID}\" ] && [ -f \"${PROFILE}\" ]; then\n"
                "    echo \"[proton-launch] APPLYING profile for appid=${APPID}\" >> \"${LOG}\"\n"
                "    grep '^export ' \"${PROFILE}\" >> \"${LOG}\"\n"
                "    source \"${PROFILE}\"\n"
                "else\n"
                "    echo \"[proton-launch] no profile found (appid=${APPID})\" >> \"${LOG}\"\n"
                "fi\n"
                "# Export any KEY=VALUE args passed before the actual command\n"
                "while [[ \"$1\" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; do\n"
                "    echo \"[proton-launch] exporting arg: $1\" >> \"${LOG}\"\n"
                "    export \"$1\"\n"
                "    shift\n"
                "done\n"
                "# Chain ~/lsfg wrapper if enabled in profile\n"
                "if [ \"${__LSFG}\" = \"1\" ] && [ -x \"${HOME}/lsfg\" ]; then\n"
                "    echo \"[proton-launch] chaining ~/lsfg\" >> \"${LOG}\"\n"
                "    exec \"${HOME}/lsfg\" \"$@\"\n"
                "fi\n"
                "# Chain ~/fgmod/fgmod wrapper if enabled in profile\n"
                "if [ \"${__FGMOD}\" = \"1\" ] && [ -x \"${HOME}/fgmod/fgmod\" ]; then\n"
                "    echo \"[proton-launch] chaining ~/fgmod/fgmod\" >> \"${LOG}\"\n"
                "    exec \"${HOME}/fgmod/fgmod\" \"$@\"\n"
                "fi\n"
                "exec \"$@\"\n",
                encoding="utf-8",
            )
            os.chmod(sp, 0o755)
            chown_to_user(sp)
            decky.logger.info(f"[install_script] written to {sp}")
            return True
        except Exception as e:
            decky.logger.error(f"[install_script] {e}\n{traceback.format_exc()}")
            return False

    # ── Profile management ──────────────────────────────────────────────────────

    async def get_game_profile(self, app_id: int) -> Dict[str, str]:
        return read_profile(app_id)

    async def set_game_profile(self, app_id: int, env_vars: Dict[str, str], game_name: str) -> bool:
        try:
            write_profile(app_id, env_vars, game_name)
            chown_to_user(profile_path(app_id))
            decky.logger.info(f"[set_game_profile] {app_id} — {len(env_vars)} vars")
            if not app_id >> 25:
                set_launch_option(app_id)
            return True
        except Exception as e:
            decky.logger.error(f"[set_game_profile] {app_id}: {e}")
            return False

    async def delete_game_profile(self, app_id: int) -> bool:
        try:
            path = profile_path(app_id)
            if path.is_file():
                path.unlink()
            if not app_id >> 25:
                remove_launch_option(app_id)
            decky.logger.info(f"[delete_game_profile] {app_id}")
            return True
        except Exception as e:
            decky.logger.error(f"[delete_game_profile] {app_id}: {e}")
            return False

    # ── Quick wrapper management (no profile required) ──────────────────────────

    async def add_launch_option(self, app_id: int, is_shortcut: bool) -> Dict[str, Any]:
        """Add ~/proton-launch %command% directly to a game's launch options.
        Returns {success: bool, needs_restart: bool}."""
        try:
            if is_shortcut:
                ok = set_launch_option_shortcut(app_id)
            else:
                ok = set_launch_option(app_id)
            return {"success": ok, "needs_restart": ok}
        except Exception as e:
            decky.logger.error(f"[add_launch_option] {app_id}: {e}")
            return {"success": False, "needs_restart": False}

    async def remove_launch_option_only(self, app_id: int, is_shortcut: bool) -> bool:
        """Remove ~/proton-launch %command% from a game's launch options (keeps profile)."""
        try:
            if is_shortcut:
                return remove_launch_option_shortcut(app_id)
            else:
                return remove_launch_option(app_id)
        except Exception as e:
            decky.logger.error(f"[remove_launch_option_only] {app_id}: {e}")
            return False

    async def get_wrapper_app_ids(self) -> List[int]:
        """Return all app_ids that have ~/proton-launch %command% in launch options."""
        try:
            result: List[int] = []

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
                    for app_str, app_data in apps.items():
                        if app_str.isdigit() and LAUNCH_OPTION in app_data.get("LaunchOptions", ""):
                            result.append(int(app_str))
                except Exception as e:
                    decky.logger.warning(f"[get_wrapper_app_ids] localconfig error {lc}: {e}")

            for sc_path in get_shortcuts_paths():
                try:
                    raw = sc_path.read_bytes()
                    nodes, _ = read_binary(raw, 0)
                    for tag, key, children in nodes:
                        if tag == 0x00 and key.lower() == "shortcuts":
                            for etag, _, efields in children:
                                if etag != 0x00:
                                    continue
                                appid_val = None
                                lo = ""
                                for f in efields:
                                    if f[0] == 0x02 and f[1].lower() == "appid":
                                        appid_val = f[2] & 0xFFFFFFFF
                                    elif f[0] == 0x01 and f[1].lower() == "launchoptions":
                                        lo = f[2]
                                if appid_val is not None and LAUNCH_OPTION in lo:
                                    result.append(appid_val)
                except Exception as e:
                    decky.logger.warning(f"[get_wrapper_app_ids] shortcuts error {sc_path}: {e}")

            return result
        except Exception as e:
            decky.logger.error(f"[get_wrapper_app_ids] {e}")
            return []

    async def get_configured_apps(self) -> List[int]:
        try:
            return [
                int(p.stem)
                for p in profiles_dir().glob("*.env")
                if p.stem.isdigit()
            ]
        except Exception:
            return []

    async def get_configured_apps_status(self) -> List[Dict[str, Any]]:
        try:
            app_ids = [
                int(p.stem)
                for p in profiles_dir().glob("*.env")
                if p.stem.isdigit()
            ]
            if not app_ids:
                return []

            launch_option_map: Dict[int, bool] = {}

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
                    for app_str, app_data in apps.items():
                        if app_str.isdigit():
                            lo = app_data.get("LaunchOptions", "")
                            launch_option_map[int(app_str)] = LAUNCH_OPTION in lo
                except Exception as e:
                    decky.logger.warning(f"[configured_status] localconfig error {lc}: {e}")

            for sc_path in get_shortcuts_paths():
                try:
                    raw = sc_path.read_bytes()
                    nodes, _ = read_binary(raw, 0)
                    for tag, key, children in nodes:
                        if tag == 0x00 and key.lower() == "shortcuts":
                            for etag, _, efields in children:
                                if etag != 0x00:
                                    continue
                                appid_val = None
                                lo = ""
                                for f in efields:
                                    if f[0] == 0x02 and f[1].lower() == "appid":
                                        appid_val = f[2] & 0xFFFFFFFF
                                    elif f[0] == 0x01 and f[1].lower() == "launchoptions":
                                        lo = f[2]
                                if appid_val is not None:
                                    launch_option_map[appid_val] = LAUNCH_OPTION in lo
                except Exception as e:
                    decky.logger.warning(f"[configured_status] shortcuts error {sc_path}: {e}")

            return [
                {"appid": app_id, "has_launch_option": launch_option_map.get(app_id, False)}
                for app_id in app_ids
            ]
        except Exception as e:
            decky.logger.error(f"[get_configured_apps_status] {e}")
            return []

    async def get_script_path(self) -> str:
        return str(script_path())

    # ── Launch log ──────────────────────────────────────────────────────────────

    async def get_launch_log(self, app_id: int = 0) -> str:
        try:
            log_path = Path("/tmp/proton-launch.log")
            if not log_path.is_file():
                return "(no log yet — launch a game first)"
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()

            sessions: List[List[str]] = []
            current: List[str] = []
            for line in lines:
                if line.startswith("=== "):
                    if current:
                        sessions.append(current)
                    current = [line]
                else:
                    current.append(line)
            if current:
                sessions.append(current)

            if not sessions:
                return "(no log yet — launch a game first)"
            if app_id == 0:
                return "\n".join(sessions[-1])

            marker = f"resolved APPID={app_id}"
            for session in reversed(sessions):
                if any(marker in line for line in session):
                    return "\n".join(session)

            return f"(no log found for appid={app_id} — launch the game first)"
        except Exception as e:
            return f"(error reading log: {e})"

    async def get_last_launched_appid(self) -> int:
        try:
            log_path = Path("/tmp/proton-launch.log")
            if not log_path.is_file():
                return 0
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            for line in reversed(lines):
                if "resolved APPID=" in line:
                    appid_str = line.split("resolved APPID=")[-1].strip()
                    if appid_str.isdigit():
                        return int(appid_str)
            return 0
        except Exception:
            return 0

    async def get_launch_option_status(self, app_id: int) -> str:
        return get_status(app_id)

    # ── Running game ────────────────────────────────────────────────────────────

    async def get_running_game(self) -> Dict[str, Any]:
        try:
            for environ_path in Path("/proc").glob("*/environ"):
                try:
                    env_data = environ_path.read_bytes()
                    for var in env_data.split(b"\x00"):
                        if var.startswith(b"SteamAppId="):
                            val = var[11:].decode("utf-8", errors="ignore").strip()
                            if val.isdigit() and int(val) > 0:
                                appid = int(val)
                                name = f"#{appid}"
                                is_shortcut = True
                                acf = next(
                                    (d / f"appmanifest_{appid}.acf" for d in get_all_steamapps_dirs()
                                     if (d / f"appmanifest_{appid}.acf").is_file()),
                                    None,
                                )
                                if acf is not None:
                                    data = parse_text(acf.read_text(encoding="utf-8", errors="ignore"))
                                    name = data.get("AppState", {}).get("name", name)
                                    is_shortcut = False
                                else:
                                    shortcut_name = get_shortcut_name(appid)
                                    if shortcut_name:
                                        name = shortcut_name
                                return {"appid": appid, "name": name, "is_shortcut": is_shortcut}
                except Exception:
                    continue
        except Exception:
            pass
        return {"appid": 0, "name": "", "is_shortcut": False}

    # ── Cover images ────────────────────────────────────────────────────────────

    async def get_shortcut_cover(self, app_id: int) -> str:
        return await self.get_game_cover(app_id)

    async def get_game_cover(self, app_id: int) -> str:
        EXTS = ("jpg", "jpeg", "png", "webp")

        def _read(path: Path) -> Optional[str]:
            if not path.is_file():
                return None
            ext = path.suffix.lstrip(".")
            mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            return f"data:{mime};base64,{encoded}"

        try:
            for user_dir in get_user_dirs():
                grid = user_dir / "config" / "grid"
                if not grid.is_dir():
                    continue
                for suffix in ("", "_header"):
                    for ext in EXTS:
                        result = _read(grid / f"{app_id}{suffix}.{ext}")
                        if result:
                            return result
                for ext in EXTS:
                    path = grid / f"{app_id}_hero.{ext}"
                    if path.is_file() and is_horizontal(path):
                        result = _read(path)
                        if result:
                            return result
                originals = grid / "originals"
                if originals.is_dir():
                    for suffix in ("", "_header"):
                        for ext in EXTS:
                            result = _read(originals / f"{app_id}{suffix}.{ext}")
                            if result:
                                return result

            for steam_root in get_steam_roots():
                app_cache_dir = steam_root / "appcache" / "librarycache" / str(app_id)
                if not app_cache_dir.is_dir():
                    continue
                for name in ("header", "library_header"):
                    for ext in EXTS:
                        path = app_cache_dir / f"{name}.{ext}"
                        if path.is_file() and is_horizontal(path):
                            result = _read(path)
                            if result:
                                return result
                subdirs = sorted(d for d in app_cache_dir.iterdir() if d.is_dir())
                for name in ("header", "library_header"):
                    for subdir in subdirs:
                        for ext in EXTS:
                            path = subdir / f"{name}.{ext}"
                            if path.is_file() and is_horizontal(path):
                                result = _read(path)
                                if result:
                                    return result
                for subdir in subdirs:
                    for img in sorted(subdir.iterdir()):
                        if img.suffix.lower().lstrip(".") in EXTS and img.is_file():
                            if is_horizontal(img):
                                result = _read(img)
                                if result:
                                    return result

            for steam_root in get_steam_roots():
                librarycache = steam_root / "appcache" / "librarycache"
                if not librarycache.is_dir():
                    continue
                for suffix in ("_header", "_library_hero"):
                    for ext in EXTS:
                        path = librarycache / f"{app_id}{suffix}.{ext}"
                        if path.is_file() and is_horizontal(path):
                            result = _read(path)
                            if result:
                                return result
                for ext in EXTS:
                    path = librarycache / f"{app_id}.{ext}"
                    if path.is_file() and is_horizontal(path):
                        result = _read(path)
                        if result:
                            return result

            return ""
        except Exception as e:
            decky.logger.error(f"[get_game_cover] {app_id}: {e}")
            return ""

    async def get_cover_debug_info(self, app_id: int) -> Dict[str, Any]:
        found = []
        missing = []
        grid_suffixes = ("", "_header", "p", "_hero", "_logo")
        cache_suffixes = ("_header", "_library_600x900", "_library_hero", "_logo", "")

        def _add(path: Path, source: str, label: str) -> None:
            entry = {"path": str(path), "source": source, "label": label}
            if path.is_file():
                found.append(entry)
            else:
                missing.append(entry)

        for steam_root in get_steam_roots():
            app_cache_dir = steam_root / "appcache" / "librarycache" / str(app_id)
            for ext in ("jpg", "jpeg", "png", "webp"):
                _add(app_cache_dir / f"header.{ext}", f"librarycache/{app_id}", f"header.{ext}")

        for steam_root in get_steam_roots():
            app_cache_dir = steam_root / "appcache" / "librarycache" / str(app_id)
            if not app_cache_dir.is_dir():
                continue
            for subdir in sorted(d for d in app_cache_dir.iterdir() if d.is_dir()):
                for ext in ("jpg", "jpeg", "png", "webp"):
                    p = subdir / f"library_header.{ext}"
                    _add(p, f"librarycache/{app_id}/{subdir.name}", f"library_header.{ext}")
                for img in sorted(subdir.iterdir()):
                    if img.name.startswith("library_header"):
                        continue
                    if img.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp") and img.is_file():
                        horiz = is_horizontal(img)
                        found.append({"path": str(img), "source": f"librarycache/{app_id}/{subdir.name}", "label": "✓ horiz" if horiz else "portrait"})

        for user_dir in get_user_dirs():
            grid = user_dir / "config" / "grid"
            for suffix in grid_suffixes:
                for ext in ("jpg", "jpeg", "png", "webp"):
                    _add(grid / f"{app_id}{suffix}.{ext}", "grid", f"{suffix or '(none)'}.{ext}")

        for steam_root in get_steam_roots():
            librarycache = steam_root / "appcache" / "librarycache"
            for suffix in cache_suffixes:
                for ext in ("jpg", "jpeg", "png", "webp"):
                    _add(librarycache / f"{app_id}{suffix}.{ext}", "librarycache (flat)", f"{app_id}{suffix}.{ext}")

        return {"found": found, "missing": missing}

    # ── Variables cache ─────────────────────────────────────────────────────────

    def _variables_cache_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "variables_cache.json"

    async def get_variables_cache(self) -> Dict[str, Any]:
        try:
            path = self._variables_cache_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[get_variables_cache] {e}")
        return {}

    async def get_variables_cache_path(self) -> str:
        return str(self._variables_cache_path())

    async def set_variables_cache(self, data: Dict[str, Any]) -> bool:
        try:
            path = self._variables_cache_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            decky.logger.error(f"[set_variables_cache] {e}")
            return False

    async def clear_variables_cache(self) -> bool:
        try:
            path = self._variables_cache_path()
            if path.is_file():
                path.unlink()
            return True
        except Exception as e:
            decky.logger.error(f"[clear_variables_cache] {e}")
            return False

    # ── Lifecycle ───────────────────────────────────────────────────────────────

    async def _main(self):
        decky.logger.info("decky-proton-launch loaded")
        decky.logger.info(f"[_main] DECKY_USER_HOME={decky.DECKY_USER_HOME}")
        decky.logger.info(f"[_main] script installed={script_path().is_file()}")

    async def _unload(self):
        decky.logger.info("decky-proton-launch unloaded")

    async def _migration(self):
        decky.logger.info("decky-proton-launch migrations (nothing to migrate)")
