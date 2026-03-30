import os
from pathlib import Path
from typing import Dict

import decky


def profiles_dir() -> Path:
    return Path(decky.DECKY_USER_HOME) / ".config" / "decky-proton-launch" / "profiles"


def script_path() -> Path:
    return Path(decky.DECKY_USER_HOME) / "proton-launch"


def profile_path(app_id: int) -> Path:
    return profiles_dir() / f"{app_id}.env"


def chown_to_user(path: Path) -> None:
    """Set ownership to the actual Steam Deck user (owner of DECKY_USER_HOME)."""
    try:
        home_stat = Path(decky.DECKY_USER_HOME).stat()
        os.chown(path, home_stat.st_uid, home_stat.st_gid)
    except Exception as e:
        decky.logger.warning(f"[chown] {path}: {e}")


def sanitize_comment(text: str) -> str:
    """Remove characters that would break a bash comment line."""
    return "".join(c if c.isprintable() and c not in ("\n", "\r", "#") else "_" for c in text)


def write_profile(app_id: int, env_vars: Dict[str, str], game_name: str) -> None:
    profiles_dir().mkdir(parents=True, exist_ok=True)
    safe_name = sanitize_comment(game_name)
    lines = [
        "#!/bin/bash",
        f"# decky-proton-launch — {safe_name} (appid: {app_id})",
        "",
    ]
    for key, value in env_vars.items():
        safe_val = value.replace("'", "'\\''")
        lines.append(f"export {key}='{safe_val}'")
    profile_path(app_id).write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_profile(app_id: int) -> Dict[str, str]:
    path = profile_path(app_id)
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
        raw = raw.strip()
        if raw.startswith("'") and raw.endswith("'"):
            raw = raw[1:-1].replace("'\\''", "'")
        env_vars[key.strip()] = raw
    return env_vars
