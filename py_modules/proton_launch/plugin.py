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
from .profile import (
    profiles_dir, script_path, legacy_script_path, profile_path, write_profile,
    read_profile, read_profile_full, write_global_profile, read_global_profile,
)
from .launch_option import (
    LAUNCH_OPTION,
    set_launch_option, remove_launch_option, get_status,
    set_launch_option_shortcut, remove_launch_option_shortcut,
    migrate_legacy_shortcut_options, legacy_apps_with_wrapper,
    legacy_wrapper_still_referenced,
)
from .plugin_updater import PluginUpdaterMixin


class Plugin(PluginUpdaterMixin):

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

    SCRIPT_VERSION = "v7"

    def _wrapper_chains(self) -> List[Dict[str, str]]:
        """(env, exec) pairs to chain to — from "wrappers_exec" in the cached
        remote data (lets a new wrapper be added purely from data, no plugin
        release needed), plus any user-defined custom wrapper."""
        chains: List[Dict[str, str]] = []

        try:
            path = self._variables_cache_path()
            if path.is_file():
                data = json.loads(path.read_text(encoding="utf-8"))
                for cat in data.get("variables", []):
                    if cat.get("category") == "wrappers_exec":
                        chains += [
                            {"env": v["env"], "exec": v["exec"]}
                            for v in cat.get("variables", [])
                            if v.get("type") == "exec" and v.get("env") and v.get("exec")
                        ]
        except Exception as e:
            decky.logger.warning(f"[wrapper_chains] remote data read error: {e}")

        try:
            path = self._custom_wrappers_path()
            if path.is_file():
                custom = json.loads(path.read_text(encoding="utf-8"))
                chains += [
                    {"env": w["env"], "exec": w["exec"]}
                    for w in custom
                    if w.get("env") and w.get("exec")
                ]
        except Exception as e:
            decky.logger.warning(f"[wrapper_chains] custom wrapper read error: {e}")

        return chains

    def _wrapper_chains_path(self) -> Path:
        return profiles_dir().parent / "wrapper_chains.conf"

    def _write_wrapper_chains_file(self) -> None:
        """Write the (env, exec) chain list the script reads at every launch.
        Called whenever the underlying data can change (remote data refresh,
        custom wrapper add/remove) — the script's own code never needs to
        change for this, so no "reinstall" is ever required for a wrapper."""
        try:
            home = decky.DECKY_USER_HOME
            lines = []
            for c in self._wrapper_chains():
                exec_path = c["exec"]
                if exec_path == "~":
                    exec_path = home
                elif exec_path.startswith("~/"):
                    exec_path = f"{home}/{exec_path[2:]}"
                lines.append(f"{c['env']}={exec_path}")
            path = self._wrapper_chains_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        except Exception as e:
            decky.logger.error(f"[wrapper_chains] write error: {e}")

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
            self._write_wrapper_chains_file()

            sp = script_path()
            sp.parent.mkdir(parents=True, exist_ok=True)
            sp.write_text(
                "#!/bin/bash\n"
                f"# decky-proton-launch {Plugin.SCRIPT_VERSION} — launch wrapper\n"
                f"# Add '{LAUNCH_OPTION}' to your game launch options\n"
                "LOG=/tmp/proton-launch.log\n"
                "echo \"\" >> \"${LOG}\"\n"
                "echo \"=== $(date) ==\" >> \"${LOG}\"\n"
                "# Try all known env var names for the app ID\n"
                "APPID=\"${SteamAppId:-${STEAM_APPID:-${STEAM_COMPAT_APP_ID:-}}}\"\n"
                "echo \"[proton-launch] resolved APPID=${APPID}\" >> \"${LOG}\"\n"
                "PROFILE=\"${HOME}/.config/decky-proton-launch/profiles/${APPID}.env\"\n"
                "GLOBAL_PROFILE=\"${HOME}/.config/decky-proton-launch/profiles/_global.env\"\n"
                "if [ -f \"${GLOBAL_PROFILE}\" ]; then\n"
                "    echo \"[proton-launch] APPLYING global commands\" >> \"${LOG}\"\n"
                "    grep '^export ' \"${GLOBAL_PROFILE}\" >> \"${LOG}\"\n"
                "    source \"${GLOBAL_PROFILE}\"\n"
                "fi\n"
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
                "# Chain to a wrapper (lsfg, fgmod, custom...) if its toggle is on —\n"
                "# read at every launch from a small file, never baked into this script.\n"
                "CHAINS=\"${HOME}/.config/decky-proton-launch/wrapper_chains.conf\"\n"
                "if [ -f \"${CHAINS}\" ]; then\n"
                "    while IFS='=' read -r WRAPPER_ENV WRAPPER_EXEC || [ -n \"${WRAPPER_ENV}\" ]; do\n"
                "        [ -z \"${WRAPPER_ENV}\" ] && continue\n"
                "        if [ \"${!WRAPPER_ENV}\" = \"1\" ] && [ -x \"${WRAPPER_EXEC}\" ]; then\n"
                "            echo \"[proton-launch] chaining ${WRAPPER_EXEC}\" >> \"${LOG}\"\n"
                "            exec \"${WRAPPER_EXEC}\" \"$@\"\n"
                "        fi\n"
                "    done < \"${CHAINS}\"\n"
                "fi\n"
                "exec \"$@\"\n",
                encoding="utf-8",
            )
            os.chmod(sp, 0o755)
            decky.logger.info(f"[install_script] written to {sp}")
            return True
        except Exception as e:
            decky.logger.error(f"[install_script] {e}\n{traceback.format_exc()}")
            return False

    # ── Profile management ──────────────────────────────────────────────────────

    async def get_game_profile(self, app_id: int) -> Dict[str, Any]:
        env_vars, disabled_globals = read_profile_full(app_id)
        return {"vars": env_vars, "disabled_globals": disabled_globals}

    async def set_game_profile(
        self,
        app_id: int,
        env_vars: Dict[str, str],
        game_name: str,
        disabled_globals: Optional[List[str]] = None,
    ) -> bool:
        try:
            write_profile(app_id, env_vars, game_name, disabled_globals or [])
            decky.logger.info(
                f"[set_game_profile] {app_id} — {len(env_vars)} vars, "
                f"{len(disabled_globals or [])} disabled globals"
            )
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

    # ── Global commands (applied to every game with the wrapper) ───────────────

    async def get_global_profile(self) -> Dict[str, str]:
        return read_global_profile()

    async def set_global_profile(self, env_vars: Dict[str, str]) -> bool:
        try:
            write_global_profile(env_vars)
            decky.logger.info(f"[set_global_profile] {len(env_vars)} vars")
            return True
        except Exception as e:
            decky.logger.error(f"[set_global_profile] {e}")
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

    async def get_wrapper_status(self, app_id: int, is_shortcut: bool) -> bool:
        """Return True if ~/proton-launch %command% is in this game's launch options."""
        try:
            if is_shortcut:
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
                                    if appid_val == app_id:
                                        return LAUNCH_OPTION in lo
                    except Exception as e:
                        decky.logger.warning(f"[get_wrapper_status] shortcuts error {sc_path}: {e}")
                return False
            else:
                return LAUNCH_OPTION in get_status(app_id)
        except Exception as e:
            decky.logger.error(f"[get_wrapper_status] {app_id}: {e}")
            return False

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
            self._write_wrapper_chains_file()
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

    # ── Frontend settings & favorites (backend-persisted — browser localStorage
    # isn't reliable across Decky/Steam sessions on this plugin's frontend) ────

    def _settings_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "ui_settings.json"

    def _favorites_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "favorites.json"

    async def get_ui_settings(self) -> Dict[str, Any]:
        try:
            path = self._settings_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[get_ui_settings] {e}")
        return {}

    async def set_ui_settings(self, data: Dict[str, Any]) -> bool:
        try:
            path = self._settings_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            decky.logger.error(f"[set_ui_settings] {e}")
            return False

    async def get_favorites(self) -> List[Dict[str, Any]]:
        try:
            path = self._favorites_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[get_favorites] {e}")
        return []

    async def set_favorites(self, data: List[Dict[str, Any]]) -> bool:
        try:
            path = self._favorites_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            decky.logger.error(f"[set_favorites] {e}")
            return False

    def _custom_variables_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "custom_variables.json"

    async def get_custom_variables(self) -> List[Dict[str, Any]]:
        try:
            path = self._custom_variables_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[get_custom_variables] {e}")
        return []

    async def set_custom_variables(self, data: List[Dict[str, Any]]) -> bool:
        try:
            path = self._custom_variables_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            return True
        except Exception as e:
            decky.logger.error(f"[set_custom_variables] {e}")
            return False

    def _custom_wrappers_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "custom_wrappers.json"

    async def get_custom_wrappers(self) -> List[Dict[str, Any]]:
        try:
            path = self._custom_wrappers_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            decky.logger.error(f"[get_custom_wrappers] {e}")
        return []

    async def set_custom_wrappers(self, data: List[Dict[str, Any]]) -> bool:
        try:
            path = self._custom_wrappers_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            self._write_wrapper_chains_file()
            return True
        except Exception as e:
            decky.logger.error(f"[set_custom_wrappers] {e}")
            return False

    def _whats_new_path(self) -> Path:
        return Path(decky.DECKY_PLUGIN_SETTINGS_DIR) / "whats_new_seen.json"

    async def get_whats_new_seen_version(self) -> str:
        try:
            path = self._whats_new_path()
            if path.is_file():
                return json.loads(path.read_text(encoding="utf-8")).get("version", "")
        except Exception as e:
            decky.logger.error(f"[get_whats_new_seen_version] {e}")
        return ""

    async def set_whats_new_seen_version(self, version: str) -> bool:
        try:
            path = self._whats_new_path()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps({"version": version}), encoding="utf-8")
            return True
        except Exception as e:
            decky.logger.error(f"[set_whats_new_seen_version] {e}")
            return False

    # ── Lifecycle ───────────────────────────────────────────────────────────────

    async def _main(self):
        decky.logger.info("decky-proton-launch loaded")
        decky.logger.info(f"[_main] DECKY_USER_HOME={decky.DECKY_USER_HOME}")
        decky.logger.info(f"[_main] script installed={script_path().is_file()}")
        try:
            update_info = await self.check_plugin_update_on_load()
            if update_info:
                decky.logger.info(
                    f"[_main] update available: {update_info['latest_version']}"
                )
                await decky.emit("plugin_update_available", update_info)
        except Exception:
            decky.logger.error(f"[_main] update check failed:\n{traceback.format_exc()}")

    async def _unload(self):
        decky.logger.info("decky-proton-launch unloaded")

    async def _uninstall(self):
        """Called after _unload on an actual uninstall (not a plain update).
        Wipes purely-regenerable derived files — the launch script, the
        wrapper chain list, the cached remote catalog — so a reinstall
        starts from a guaranteed-clean state instead of whatever was left
        behind. Never touches the user's actual data (profiles, favorites,
        custom variables/wrappers, settings): all of that survives a
        reinstall untouched."""
        decky.logger.info("decky-proton-launch uninstalling")
        for path in (script_path(), self._wrapper_chains_path(), self._variables_cache_path()):
            try:
                if path.is_file():
                    path.unlink()
                    decky.logger.info(f"[_uninstall] removed {path}")
            except Exception as e:
                decky.logger.error(f"[_uninstall] failed to remove {path}: {e}")

    async def _migration(self):
        decky.logger.info("decky-proton-launch migrations")
        try:
            if not legacy_script_path().is_file():
                return
            decky.logger.info(
                f"[migration] legacy {legacy_script_path()} found — "
                f"relocating wrapper to {script_path()}"
            )
            await self.install_script()
            # Shortcuts can be rewritten directly on disk (proven to stick).
            # Regular Steam games can't — localconfig.vdf is Steam's own live
            # state while it's running, so the frontend has to do those via
            # SteamClient. finalize_wrapper_migration() deletes the legacy
            # script once both sides confirm nothing references it anymore.
            migrate_legacy_shortcut_options()
        except Exception:
            decky.logger.error(f"[migration] exception:\n{traceback.format_exc()}")

    async def get_legacy_wrapper_apps(self) -> List[int]:
        """Steam (non-shortcut) app_ids the frontend still needs to migrate
        live via SteamClient. Empty once nothing needs migrating."""
        if not legacy_script_path().is_file():
            return []
        return legacy_apps_with_wrapper()

    async def finalize_wrapper_migration(self) -> bool:
        """Called by the frontend once it has rewritten every Steam game's
        launch options live. Deletes the legacy ~/proton-launch only once
        nothing references it anymore (Steam apps or shortcuts)."""
        try:
            if not legacy_script_path().is_file():
                return True
            if legacy_wrapper_still_referenced():
                decky.logger.warning(
                    "[migration] legacy launch options remain — keeping ~/proton-launch"
                )
                return False
            legacy_script_path().unlink()
            decky.logger.info(f"[migration] removed legacy {legacy_script_path()}")
            return True
        except Exception as e:
            decky.logger.error(f"[migration] finalize error: {e}\n{traceback.format_exc()}")
            return False
