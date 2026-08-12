from pathlib import Path
from typing import Dict, List, Tuple

import decky


def plugin_config_dir() -> Path:
    return Path(decky.DECKY_USER_HOME) / ".config" / "decky-proton-launch"


def profiles_dir() -> Path:
    return plugin_config_dir() / "profiles"


def script_path() -> Path:
    return plugin_config_dir() / "proton-launch"


# Pre-#24 location — the wrapper used to be written straight into $HOME.
# Kept only for migration (see Plugin._migration): detect it, relocate it,
# then remove it once no launch option still points at it.
def legacy_script_path() -> Path:
    return Path(decky.DECKY_USER_HOME) / "proton-launch"


def profile_path(app_id: int) -> Path:
    return profiles_dir() / f"{app_id}.env"


# Leading underscore keeps it out of get_configured_apps()'s digit-stem scan.
def global_profile_path() -> Path:
    return profiles_dir() / "_global.env"


def sanitize_comment(text: str) -> str:
    """Remove characters that would break a bash comment line."""
    return "".join(c if c.isprintable() and c not in ("\n", "\r", "#") else "_" for c in text)


def _parse_env_file(path: Path) -> Tuple[Dict[str, str], List[str]]:
    """Parse `export KEY='value'` lines and `unset KEY` (disabled global) lines."""
    if not path.is_file():
        return {}, []
    env_vars: Dict[str, str] = {}
    disabled_keys: List[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("export "):
            rest = line[len("export "):]
            if "=" not in rest:
                continue
            key, _, raw = rest.partition("=")
            raw = raw.strip()
            if raw.startswith("'") and raw.endswith("'"):
                raw = raw[1:-1].replace("'\\''", "'")
            env_vars[key.strip()] = raw
        elif line.startswith("unset "):
            key = line[len("unset "):].strip()
            if key:
                disabled_keys.append(key)
    return env_vars, disabled_keys


def write_profile(
    app_id: int,
    env_vars: Dict[str, str],
    game_name: str,
    disabled_global_keys: List[str] = None,
) -> None:
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
    if disabled_global_keys:
        lines.append("")
        lines.append("# commands disabled for this game (active in global commands)")
        for key in disabled_global_keys:
            lines.append(f"unset {key}")
    profile_path(app_id).write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_profile(app_id: int) -> Dict[str, str]:
    env_vars, _ = _parse_env_file(profile_path(app_id))
    return env_vars


def read_profile_full(app_id: int) -> Tuple[Dict[str, str], List[str]]:
    return _parse_env_file(profile_path(app_id))


def write_global_profile(env_vars: Dict[str, str]) -> None:
    profiles_dir().mkdir(parents=True, exist_ok=True)
    lines = [
        "#!/bin/bash",
        "# decky-proton-launch — global commands (applied to every wrapped game)",
        "",
    ]
    for key, value in env_vars.items():
        safe_val = value.replace("'", "'\\''")
        lines.append(f"export {key}='{safe_val}'")
    global_profile_path().write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_global_profile() -> Dict[str, str]:
    env_vars, _ = _parse_env_file(global_profile_path())
    return env_vars
