import re
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


_NAME_RE = re.compile(r"#\s*decky-proton-launch\s+—\s+(.*)\s+\(appid: \d+\)")


def _extract_game_name(path: Path) -> str:
    """Best-effort read of a profile's own header comment, so rewriting it
    doesn't need the game's display name passed back in."""
    try:
        for line in path.read_text(encoding="utf-8").splitlines()[:3]:
            m = _NAME_RE.match(line.strip())
            if m:
                return m.group(1)
    except Exception:
        pass
    return ""


def remove_env_keys_from_profiles(env_keys: List[str]) -> None:
    """Strips the given env vars from every profile that currently exports
    them (global + per-game) — deleting a custom variable/wrapper's
    definition only ever removed it from the list backing its toggle row;
    it never touched a profile that had already exported it, leaving that
    export stuck forever with no toggle left to turn it off."""
    keys = set(env_keys)
    if not keys:
        return

    global_vars = read_global_profile()
    if keys & global_vars.keys():
        write_global_profile(
            {k: v for k, v in global_vars.items() if k not in keys}
        )

    if not profiles_dir().is_dir():
        return
    for path in profiles_dir().glob("*.env"):
        if not path.stem.isdigit():
            continue
        env_vars, disabled_globals = _parse_env_file(path)
        if not (keys & env_vars.keys()):
            continue
        app_id = int(path.stem)
        filtered = {k: v for k, v in env_vars.items() if k not in keys}
        name = _extract_game_name(path) or str(app_id)
        write_profile(app_id, filtered, name, disabled_globals)
