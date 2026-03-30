from pathlib import Path
from typing import List

import decky

from .vdf import parse_text, read_binary


def get_steam_path() -> Path:
    return Path(decky.DECKY_USER_HOME) / ".local" / "share" / "Steam"


def get_steam_roots() -> List[Path]:
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


def get_user_dirs() -> List[Path]:
    userdata = get_steam_path() / "userdata"
    if not userdata.is_dir():
        return []
    dirs = [d for d in userdata.iterdir() if d.is_dir() and d.name.isdigit() and int(d.name) > 0]
    dirs.sort(key=lambda d: int(d.name))
    return dirs


def get_all_steamapps_dirs() -> List[Path]:
    """Return all Steam library steamapps directories (internal + SD card, etc.)."""
    dirs: List[Path] = []
    main = get_steam_path() / "steamapps"
    if main.is_dir():
        dirs.append(main)
    lf = main / "libraryfolders.vdf"
    if lf.is_file():
        try:
            data = parse_text(lf.read_text(encoding="utf-8", errors="ignore"))
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


def get_shortcuts_paths() -> List[Path]:
    return [
        d / "config" / "shortcuts.vdf"
        for d in get_user_dirs()
        if (d / "config" / "shortcuts.vdf").is_file()
    ]


def get_shortcut_name(appid: int) -> str:
    """Look up the display name of a non-Steam shortcut by its appid."""
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
                        if appid_val == appid and name:
                            return name
        except Exception:
            continue
    return ""
