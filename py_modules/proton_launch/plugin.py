import base64
import re
import os
import shutil
import struct
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import decky


# ─── Image helpers ─────────────────────────────────────────────────────────────

def _image_is_horizontal(path: Path) -> bool:
    """Return True if the image is roughly horizontal (width/height > 1.3).
    Reads only the header bytes — no external dependencies."""
    try:
        data = path.read_bytes()
        ext = path.suffix.lower()

        if ext == ".png":
            # PNG: magic 8 bytes, IHDR chunk 4+4+4+4+4 = width at offset 16, height at 20
            if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
                w, h = struct.unpack(">II", data[16:24])
                return h > 0 and w / h > 1.3

        elif ext in (".jpg", ".jpeg"):
            # JPEG: scan for SOF markers (0xFF 0xC0..0xC3, 0xC5..0xC7, 0xC9..0xCB, 0xCD..0xCF)
            i = 2  # skip SOI marker
            while i + 3 < len(data):
                if data[i] != 0xFF:
                    break
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB):
                    if i + 9 < len(data):
                        h, w = struct.unpack(">HH", data[i + 5:i + 9])
                        return h > 0 and w / h > 1.3
                seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
                i += 2 + seg_len

        elif ext == ".webp":
            if len(data) >= 30 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
                chunk = data[12:16]
                if chunk == b"VP8 " and len(data) >= 30:
                    # Lossy: width/height at bytes 26-29 (14-bit values)
                    raw_w, raw_h = struct.unpack("<HH", data[26:30])
                    w = (raw_w & 0x3FFF) + 1
                    h = (raw_h & 0x3FFF) + 1
                    return h > 0 and w / h > 1.3
                elif chunk == b"VP8L" and len(data) >= 25:
                    # Lossless: signature 0x2F at byte 20, then packed width/height
                    if data[20] == 0x2F:
                        val = struct.unpack_from("<I", data, 21)[0]
                        w = (val & 0x3FFF) + 1
                        h = ((val >> 14) & 0x3FFF) + 1
                        return h > 0 and w / h > 1.3
                elif chunk == b"VP8X" and len(data) >= 30:
                    # Extended: canvas width-1 at bytes 24-26, height-1 at 27-29 (LE 24-bit)
                    w = int.from_bytes(data[24:27], "little") + 1
                    h = int.from_bytes(data[27:30], "little") + 1
                    return h > 0 and w / h > 1.3
    except Exception:
        pass
    # Unknown or unreadable — reject to avoid showing portrait images
    return False


# ─── Text VDF helpers ──────────────────────────────────────────────────────────

def _parse_vdf_text(content: str) -> Dict[str, Any]:
    lines = content.splitlines()
    result: Dict[str, Any] = {}
    stack: List[Dict[str, Any]] = [result]
    pending_key: Optional[str] = None
    for line in lines:
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        if line == "{":
            new_dict: Dict[str, Any] = {}
            if pending_key is not None:
                stack[-1][pending_key] = new_dict
                stack.append(new_dict)
                pending_key = None
        elif line == "}":
            if len(stack) > 1:
                stack.pop()
        else:
            tokens = re.findall(r'"((?:[^"\\]|\\.)*)"', line)
            if len(tokens) >= 2:
                stack[-1][tokens[0]] = tokens[1]
            elif len(tokens) == 1:
                pending_key = tokens[0]
    return result


def _serialize_vdf_text(data: Any, indent: int = 0) -> str:
    tab = "\t" * indent
    lines = []
    if isinstance(data, dict):
        for key, value in data.items():
            escaped_key = key.replace("\\", "\\\\").replace('"', '\\"')
            if isinstance(value, dict):
                lines.append(f'{tab}"{escaped_key}"')
                lines.append(f"{tab}{{")
                lines.append(_serialize_vdf_text(value, indent + 1))
                lines.append(f"{tab}}}")
            else:
                escaped_val = str(value).replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'{tab}"{escaped_key}"\t\t"{escaped_val}"')
    return "\n".join(lines)


# ─── Binary VDF (shortcuts.vdf) — round-trip ──────────────────────────────────

def _bvdf_read(data: bytes, pos: int) -> Tuple[List, int]:
    nodes = []
    length = len(data)
    while pos < length:
        tag = data[pos]
        pos += 1
        if tag == 0x08:
            return nodes, pos
        nul = data.index(b"\x00", pos)
        key = data[pos:nul].decode("utf-8", errors="replace")
        pos = nul + 1
        if tag == 0x00:
            children, pos = _bvdf_read(data, pos)
            nodes.append((0x00, key, children))
        elif tag == 0x01:
            nul = data.index(b"\x00", pos)
            value = data[pos:nul].decode("utf-8", errors="replace")
            pos = nul + 1
            nodes.append((0x01, key, value))
        elif tag == 0x02:
            value = struct.unpack("<i", data[pos:pos + 4])[0]
            pos += 4
            nodes.append((0x02, key, value))
        elif tag == 0x07:
            value = struct.unpack("<Q", data[pos:pos + 8])[0]
            pos += 8
            nodes.append((0x07, key, value))
        else:
            decky.logger.warning(f"[bvdf] unknown tag {tag:#04x} at pos {pos - 1}")
            return nodes, pos
    return nodes, pos


# ─── Path helpers ──────────────────────────────────────────────────────────────

def _get_steam_path() -> Path:
    return Path(decky.DECKY_USER_HOME) / ".local" / "share" / "Steam"


def _get_steam_roots() -> List[Path]:
    """Return all candidate Steam root directories (deduped)."""
    home = Path(decky.DECKY_USER_HOME)
    candidates = [
        home / ".local" / "share" / "Steam",
        home / ".steam" / "steam",
        home / ".steam" / "root",
        home / ".steam" / "debian-installation",
        Path("/usr/share/steam"),
    ]
    seen: List[Path] = []
    for c in candidates:
        try:
            resolved = c.resolve()
            if resolved not in [s.resolve() for s in seen] and c.is_dir():
                seen.append(c)
        except Exception:
            pass
    return seen


def _get_user_dirs() -> List[Path]:
    userdata = _get_steam_path() / "userdata"
    if not userdata.is_dir():
        return []
    dirs = [d for d in userdata.iterdir() if d.is_dir() and d.name.isdigit() and int(d.name) > 0]
    dirs.sort(key=lambda d: int(d.name))
    return dirs


def _get_all_steamapps_dirs() -> List[Path]:
    """Return all Steam library steamapps directories (internal + SD card, etc.)."""
    dirs: List[Path] = []
    main = _get_steam_path() / "steamapps"
    if main.is_dir():
        dirs.append(main)
    lf = main / "libraryfolders.vdf"
    if lf.is_file():
        try:
            data = _parse_vdf_text(lf.read_text(encoding="utf-8", errors="ignore"))
            folders = data.get("libraryfolders", {})
            for entry in folders.values():
                if isinstance(entry, dict):
                    path = entry.get("path", "")
                    if path:
                        candidate = Path(path) / "steamapps"
                        if candidate.is_dir() and candidate not in dirs:
                            dirs.append(candidate)
        except Exception:
            pass
    return dirs


def _get_shortcuts_paths() -> List[Path]:
    return [
        d / "config" / "shortcuts.vdf"
        for d in _get_user_dirs()
        if (d / "config" / "shortcuts.vdf").is_file()
    ]


def _get_shortcut_name(appid: int) -> str:
    """Look up the display name of a non-Steam shortcut by its appid."""
    for path in _get_shortcuts_paths():
        try:
            raw = path.read_bytes()
            nodes, _ = _bvdf_read(raw, 0)
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
                        if appid_val == appid and name:
                            return name
        except Exception:
            continue
    return ""


# ─── Profile / script helpers ─────────────────────────────────────────────────

def _profiles_dir() -> Path:
    return Path(decky.DECKY_USER_HOME) / ".config" / "decky-proton-launch" / "profiles"


def _script_path() -> Path:
    return Path(decky.DECKY_USER_HOME) / "proton-launch"


def _profile_path(app_id: int) -> Path:
    return _profiles_dir() / f"{app_id}.env"


def _sanitize_comment(text: str) -> str:
    """Remove characters that would break a bash comment line."""
    return "".join(c if c.isprintable() and c not in ("\n", "\r", "#") else "_" for c in text)


def _write_profile_file(app_id: int, env_vars: Dict[str, str], game_name: str) -> None:
    _profiles_dir().mkdir(parents=True, exist_ok=True)
    safe_name = _sanitize_comment(game_name)
    lines = [
        "#!/bin/bash",
        f"# decky-proton-launch — {safe_name} (appid: {app_id})",
        "",
    ]
    for key, value in env_vars.items():
        # Single-quote value; escape embedded single quotes
        safe_val = value.replace("'", "'\\''")
        lines.append(f"export {key}='{safe_val}'")
    _profile_path(app_id).write_text("\n".join(lines) + "\n", encoding="utf-8")


def _read_profile_file(app_id: int) -> Dict[str, str]:
    path = _profile_path(app_id)
    if not path.is_file():
        return {}
    env_vars: Dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line.startswith("export "):
            continue
        rest = line[len("export "):]
        if "=" not in rest:
            continue
        key, _, raw = rest.partition("=")
        # Strip surrounding single quotes and unescape '\\'' → '
        raw = raw.strip()
        if raw.startswith("'") and raw.endswith("'"):
            raw = raw[1:-1].replace("'\\''", "'")
        env_vars[key.strip()] = raw
    return env_vars


def _chown_to_user(path: Path) -> None:
    """Set ownership to the actual Steam Deck user (owner of DECKY_USER_HOME)."""
    try:
        home_stat = Path(decky.DECKY_USER_HOME).stat()
        os.chown(path, home_stat.st_uid, home_stat.st_gid)
    except Exception as e:
        decky.logger.warning(f"[chown] {path}: {e}")


# ─── localconfig.vdf launch option helpers ────────────────────────────────────

LAUNCH_OPTION = "~/proton-launch %command%"


def _find_localconfig_for_app(app_id: int) -> Optional[Path]:
    """Return the localconfig.vdf that contains this app_id, or None."""
    for user_dir in _get_user_dirs():
        lc = user_dir / "config" / "localconfig.vdf"
        if not lc.is_file():
            continue
        try:
            data = _parse_vdf_text(lc.read_text(encoding="utf-8", errors="replace"))
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
    # If not found in any, return the first available localconfig
    for user_dir in _get_user_dirs():
        lc = user_dir / "config" / "localconfig.vdf"
        if lc.is_file():
            return lc
    return None


def _set_launch_option(app_id: int) -> bool:
    """Write ~/proton-launch %command% to localconfig.vdf for this app."""
    lc = _find_localconfig_for_app(app_id)
    if lc is None:
        decky.logger.error(f"[launch_option] no localconfig.vdf found for app {app_id}")
        return False
    try:
        content = lc.read_text(encoding="utf-8", errors="replace")
        data = _parse_vdf_text(content)

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

        # Write back — backup first
        backup = lc.with_suffix(".vdf.bak")
        shutil.copy2(lc, backup)
        lc.write_text(_serialize_vdf_text(data), encoding="utf-8")
        _chown_to_user(lc)
        decky.logger.info(f"[launch_option] set for app {app_id} in {lc}")
        return True
    except Exception as e:
        decky.logger.error(f"[launch_option] set error for {app_id}: {e}\n{traceback.format_exc()}")
        return False


def _remove_launch_option(app_id: int) -> bool:
    """Remove ~/proton-launch %command% from localconfig.vdf for this app."""
    lc = _find_localconfig_for_app(app_id)
    if lc is None:
        return True  # Nothing to remove
    try:
        content = lc.read_text(encoding="utf-8", errors="replace")
        data = _parse_vdf_text(content)

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
        new_val = current.replace(LAUNCH_OPTION, "").strip()
        apps[app_str]["LaunchOptions"] = new_val

        backup = lc.with_suffix(".vdf.bak")
        shutil.copy2(lc, backup)
        lc.write_text(_serialize_vdf_text(data), encoding="utf-8")
        _chown_to_user(lc)
        decky.logger.info(f"[launch_option] removed for app {app_id} in {lc}")
        return True
    except Exception as e:
        decky.logger.error(f"[launch_option] remove error for {app_id}: {e}\n{traceback.format_exc()}")
        return False


# ─── Plugin ────────────────────────────────────────────────────────────────────

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

            for steamapps in _get_all_steamapps_dirs():
                for acf in steamapps.glob("appmanifest_*.acf"):
                    try:
                        data = _parse_vdf_text(acf.read_text(encoding="utf-8", errors="ignore"))
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

            for path in _get_shortcuts_paths():
                try:
                    raw = path.read_bytes()
                    nodes, _ = _bvdf_read(raw, 0)
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
        path = _script_path()
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
            profiles = _profiles_dir()
            profiles.mkdir(parents=True, exist_ok=True)
            _chown_to_user(profiles)
            _chown_to_user(profiles.parent)

            script = _script_path()
            script.write_text(
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
            os.chmod(script, 0o755)
            _chown_to_user(script)
            decky.logger.info(f"[install_script] written to {script}")
            return True
        except Exception as e:
            decky.logger.error(f"[install_script] {e}\n{traceback.format_exc()}")
            return False

    # ── Profile management ──────────────────────────────────────────────────────

    async def get_game_profile(self, app_id: int) -> Dict[str, str]:
        """Return env vars dict for this game, empty if no profile."""
        return _read_profile_file(app_id)

    async def set_game_profile(self, app_id: int, env_vars: Dict[str, str], game_name: str) -> bool:
        """Write (or overwrite) the profile for this game and set its launch option."""
        try:
            _write_profile_file(app_id, env_vars, game_name)
            _chown_to_user(_profile_path(app_id))
            decky.logger.info(f"[set_game_profile] {app_id} — {len(env_vars)} vars")

            # Also write the launch option to localconfig.vdf (Steam restart required once)
            if not app_id >> 25:  # real Steam app (not a shortcut hash)
                _set_launch_option(app_id)

            return True
        except Exception as e:
            decky.logger.error(f"[set_game_profile] {app_id}: {e}")
            return False

    async def delete_game_profile(self, app_id: int) -> bool:
        """Remove the profile for this game and clean up its launch option."""
        try:
            path = _profile_path(app_id)
            if path.is_file():
                path.unlink()

            if not app_id >> 25:
                _remove_launch_option(app_id)

            decky.logger.info(f"[delete_game_profile] {app_id}")
            return True
        except Exception as e:
            decky.logger.error(f"[delete_game_profile] {app_id}: {e}")
            return False

    async def get_configured_apps(self) -> List[int]:
        """Return list of app_ids that have an active profile."""
        try:
            return [
                int(p.stem)
                for p in _profiles_dir().glob("*.env")
                if p.stem.isdigit()
            ]
        except Exception:
            return []

    async def get_configured_apps_status(self) -> List[Dict[str, Any]]:
        """Return configured apps with whether ~/proton-launch is in their launch options."""
        try:
            app_ids = [
                int(p.stem)
                for p in _profiles_dir().glob("*.env")
                if p.stem.isdigit()
            ]
            if not app_ids:
                return []

            # Build app_id -> has_launch_option map
            launch_option_map: Dict[int, bool] = {}

            # Steam games: read localconfig.vdf
            for user_dir in _get_user_dirs():
                lc = user_dir / "config" / "localconfig.vdf"
                if not lc.is_file():
                    continue
                try:
                    data = _parse_vdf_text(lc.read_text(encoding="utf-8", errors="replace"))
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

            # Non-Steam shortcuts: read shortcuts.vdf (binary VDF)
            for sc_path in _get_shortcuts_paths():
                try:
                    raw = sc_path.read_bytes()
                    nodes, _ = _bvdf_read(raw, 0)
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

            result = []
            for app_id in app_ids:
                result.append({"appid": app_id, "has_launch_option": launch_option_map.get(app_id, False)})

            return result
        except Exception as e:
            decky.logger.error(f"[get_configured_apps_status] {e}")
            return []

    async def get_script_path(self) -> str:
        """Return the absolute path of the launch wrapper script."""
        return str(_script_path())

    async def get_launch_log(self, app_id: int = 0) -> str:
        """Return the last launch session for the given app_id from /tmp/proton-launch.log.
        If app_id is 0, return the most recent session regardless of game."""
        try:
            log_path = Path("/tmp/proton-launch.log")
            if not log_path.is_file():
                return "(no log yet — launch a game first)"
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()

            # Split into sessions (each starts with "=== ")
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

            # Find the most recent session for this app_id
            marker = f"resolved APPID={app_id}"
            for session in reversed(sessions):
                if any(marker in line for line in session):
                    return "\n".join(session)

            return f"(no log found for appid={app_id} — launch the game first)"
        except Exception as e:
            return f"(error reading log: {e})"

    async def get_last_launched_appid(self) -> int:
        """Return the appid of the last game launched through the wrapper, or 0."""
        try:
            log_path = Path("/tmp/proton-launch.log")
            if not log_path.is_file():
                return 0
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            # Search backwards for "resolved APPID=XXXXX"
            for line in reversed(lines):
                if "resolved APPID=" in line:
                    appid_str = line.split("resolved APPID=")[-1].strip()
                    if appid_str.isdigit():
                        return int(appid_str)
            return 0
        except Exception:
            return 0

    async def get_launch_option_status(self, app_id: int) -> str:
        """Return the current LaunchOptions string for this app from localconfig.vdf."""
        try:
            lc = _find_localconfig_for_app(app_id)
            if lc is None:
                return "(localconfig.vdf not found)"
            data = _parse_vdf_text(lc.read_text(encoding="utf-8", errors="replace"))
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

    async def get_running_game(self) -> Dict[str, Any]:
        """Return {appid, name, is_shortcut} of the currently running Steam game, or appid=0."""
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
                                    (d / f"appmanifest_{appid}.acf" for d in _get_all_steamapps_dirs()
                                     if (d / f"appmanifest_{appid}.acf").is_file()),
                                    None,
                                )
                                if acf is not None:
                                    data = _parse_vdf_text(acf.read_text(encoding="utf-8", errors="ignore"))
                                    name = data.get("AppState", {}).get("name", name)
                                    is_shortcut = False
                                else:
                                    shortcut_name = _get_shortcut_name(appid)
                                    if shortcut_name:
                                        name = shortcut_name
                                return {"appid": appid, "name": name, "is_shortcut": is_shortcut}
                except Exception:
                    continue
        except Exception:
            pass
        return {"appid": 0, "name": "", "is_shortcut": False}

    async def get_shortcut_cover(self, app_id: int) -> str:
        """Kept for backward compatibility — delegates to get_game_cover."""
        return await self.get_game_cover(app_id)

    async def get_game_cover(self, app_id: int) -> str:
        """Return a base64 data URL for a game's cover image, or empty string.
        Searches multiple locations in priority order, always preferring horizontal images."""
        EXTS = ("jpg", "jpeg", "png", "webp")

        def _read(path: Path) -> Optional[str]:
            if not path.is_file():
                return None
            ext = path.suffix.lstrip(".")
            mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            return f"data:{mime};base64,{encoded}"

        try:
            # Grid folder — user custom artwork (checked FIRST, takes priority over Steam cache)
            # "" = horizontal (460x215), "_header" = alt horizontal, "_hero" = wide banner
            for user_dir in _get_user_dirs():
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
                    if path.is_file() and _image_is_horizontal(path):
                        result = _read(path)
                        if result:
                            return result
                # boppreh/steamgrid stores originals in grid/originals/
                originals = grid / "originals"
                if originals.is_dir():
                    for suffix in ("", "_header"):
                        for ext in EXTS:
                            result = _read(originals / f"{app_id}{suffix}.{ext}")
                            if result:
                                return result

            # librarycache/{appid}/ — Steam default artwork
            for steam_root in _get_steam_roots():
                app_cache_dir = steam_root / "appcache" / "librarycache" / str(app_id)
                if not app_cache_dir.is_dir():
                    continue

                # Known horizontal filenames directly in librarycache/{appid}/
                for name in ("header", "library_header"):
                    for ext in EXTS:
                        path = app_cache_dir / f"{name}.{ext}"
                        if path.is_file() and _image_is_horizontal(path):
                            result = _read(path)
                            if result:
                                return result

                # Known horizontal filenames in subdirectories
                subdirs = sorted(d for d in app_cache_dir.iterdir() if d.is_dir())
                for name in ("header", "library_header"):
                    for subdir in subdirs:
                        for ext in EXTS:
                            path = subdir / f"{name}.{ext}"
                            if path.is_file() and _image_is_horizontal(path):
                                result = _read(path)
                                if result:
                                    return result

                # Any other horizontal image in subdirectories (ratio check)
                for subdir in subdirs:
                    for img in sorted(subdir.iterdir()):
                        if img.suffix.lower().lstrip(".") in EXTS and img.is_file():
                            if _image_is_horizontal(img):
                                result = _read(img)
                                if result:
                                    return result

            # librarycache flat files — older Steam versions
            for steam_root in _get_steam_roots():
                librarycache = steam_root / "appcache" / "librarycache"
                if not librarycache.is_dir():
                    continue
                for suffix in ("_header", "_library_hero"):
                    for ext in EXTS:
                        path = librarycache / f"{app_id}{suffix}.{ext}"
                        if path.is_file() and _image_is_horizontal(path):
                            result = _read(path)
                            if result:
                                return result
                for ext in EXTS:
                    path = librarycache / f"{app_id}.{ext}"
                    if path.is_file() and _image_is_horizontal(path):
                        result = _read(path)
                        if result:
                            return result

            return ""
        except Exception as e:
            decky.logger.error(f"[get_game_cover] {app_id}: {e}")
            return ""

    async def get_cover_debug_info(self, app_id: int) -> Dict[str, Any]:
        """Return debug info about available cover files for a game."""
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

        # librarycache/{appid}/header.*
        for steam_root in _get_steam_roots():
            app_cache_dir = steam_root / "appcache" / "librarycache" / str(app_id)
            for ext in ("jpg", "jpeg", "png", "webp"):
                _add(app_cache_dir / f"header.{ext}", f"librarycache/{app_id}", f"header.{ext}")

        # librarycache/{appid}/ subdirectories
        for steam_root in _get_steam_roots():
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
                        horizontal = _image_is_horizontal(img)
                        found.append({"path": str(img), "source": f"librarycache/{app_id}/{subdir.name}", "label": "✓ horiz" if horizontal else "portrait"})

        # Grid folder
        for user_dir in _get_user_dirs():
            grid = user_dir / "config" / "grid"
            for suffix in grid_suffixes:
                for ext in ("jpg", "jpeg", "png", "webp"):
                    _add(grid / f"{app_id}{suffix}.{ext}", "grid", f"{suffix or '(none)'}.{ext}")

        # librarycache flat files
        for steam_root in _get_steam_roots():
            librarycache = steam_root / "appcache" / "librarycache"
            for suffix in cache_suffixes:
                for ext in ("jpg", "jpeg", "png", "webp"):
                    _add(librarycache / f"{app_id}{suffix}.{ext}", "librarycache (flat)", f"{app_id}{suffix}.{ext}")

        return {"found": found, "missing": missing}

    # ── Lifecycle ───────────────────────────────────────────────────────────────

    async def _main(self):
        decky.logger.info("decky-proton-launch loaded")
        decky.logger.info(f"[_main] DECKY_USER_HOME={decky.DECKY_USER_HOME}")
        decky.logger.info(f"[_main] script installed={_script_path().is_file()}")

    async def _unload(self):
        decky.logger.info("decky-proton-launch unloaded")

    async def _migration(self):
        decky.logger.info("decky-proton-launch migrations (nothing to migrate)")
