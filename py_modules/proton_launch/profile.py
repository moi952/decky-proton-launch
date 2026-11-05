import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

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
        # A free-text variable left blank (e.g. an optional DLL path) must not
        # export an empty string — some programs treat that as a bad value
        # rather than as unset.
        if not value.strip():
            continue
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
        # A free-text variable left blank (e.g. an optional DLL path) must not
        # export an empty string — some programs treat that as a bad value
        # rather than as unset.
        if not value.strip():
            continue
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


def apply_vars_to_profile(
    app_id: int,
    new_vars: Dict[str, str],
    game_name: str = "",
    overwrite: bool = False,
) -> Dict[str, object]:
    """Merges new_vars into one game's profile without touching its other
    exports. A key the game already has with a different value is left alone
    unless overwrite is set — it comes back in "skipped" so the caller can
    offer to replace it. "previous" records what each applied key held
    before (None when it was absent), which is what an undo needs."""
    path = profile_path(app_id)
    existed = path.is_file()
    env_vars, disabled = read_profile_full(app_id)
    applied: List[str] = []
    unchanged: List[str] = []
    skipped: List[str] = []
    previous: Dict[str, object] = {}
    for key, value in new_vars.items():
        if not value.strip():
            continue
        current = env_vars.get(key)
        if current == value:
            unchanged.append(key)
        elif current is not None and not overwrite:
            skipped.append(key)
        else:
            previous[key] = current
            env_vars[key] = value
            applied.append(key)
    if applied:
        # An "unset KEY" line sourced after the export would cancel it.
        disabled = [k for k in disabled if k not in applied]
        write_profile(app_id, env_vars, game_name or _extract_game_name(path) or str(app_id), disabled)
    return {
        "applied": applied,
        "unchanged": unchanged,
        "skipped": skipped,
        "previous": previous,
        "created": bool(applied) and not existed,
    }


def remove_vars_from_profile(
    app_id: int,
    keys: List[str],
    expected: Optional[Dict[str, str]] = None,
) -> Dict[str, object]:
    """Strips keys from one game's profile. With expected, a key whose value
    no longer matches (edited by hand since it was applied) is kept, so a
    removal never wipes something the user changed on purpose. The profile
    file is deleted once nothing is left in it."""
    path = profile_path(app_id)
    if not path.is_file():
        return {"removed": [], "kept": [], "deleted": False}
    env_vars, disabled = read_profile_full(app_id)
    removed: List[str] = []
    kept: List[str] = []
    for key in keys:
        if key not in env_vars:
            continue
        if expected is not None and key in expected and env_vars[key] != expected[key]:
            kept.append(key)
            continue
        del env_vars[key]
        removed.append(key)
    if not removed:
        return {"removed": [], "kept": kept, "deleted": False}
    if env_vars or disabled:
        write_profile(app_id, env_vars, _extract_game_name(path) or str(app_id), disabled)
        return {"removed": removed, "kept": kept, "deleted": False}
    path.unlink()
    return {"removed": removed, "kept": kept, "deleted": True}


def read_all_profiles() -> Dict[str, Dict[str, str]]:
    """appid (string) -> that game's own exports, for every per-game profile."""
    result: Dict[str, Dict[str, str]] = {}
    if profiles_dir().is_dir():
        for path in profiles_dir().glob("*.env"):
            if path.stem.isdigit():
                result[path.stem] = _parse_env_file(path)[0]
    return result


def real_commands(env_vars: Dict[str, str], global_vars: Dict[str, str]) -> Dict[str, str]:
    """A per-game export whose value is byte-identical to what the global
    profile already exports for that key isn't a genuine per-game
    configuration — it's either a leftover duplicate from the old
    GameDetailView bug, or a value the user deliberately pinned to match
    global, and there's no way to tell those apart. Rather than guessing
    and deleting the export (that used to run as an automatic migration
    on every load and silently wiped a real per-game command that
    happened to coincide with an active global value), this is a
    read-only view used only for "is this game really configured"
    purposes — the profile file itself is never touched, so nothing is
    ever lost."""
    return {
        k: v for k, v in env_vars.items()
        if not (k in global_vars and global_vars[k] == v)
    }
