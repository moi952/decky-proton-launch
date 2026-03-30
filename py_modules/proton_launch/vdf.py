import re
import struct
from typing import Any, Dict, List, Optional, Tuple

import decky


def parse_text(content: str) -> Dict[str, Any]:
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


def serialize_text(data: Any, indent: int = 0) -> str:
    tab = "\t" * indent
    lines = []
    if isinstance(data, dict):
        for key, value in data.items():
            escaped_key = key.replace("\\", "\\\\").replace('"', '\\"')
            if isinstance(value, dict):
                lines.append(f'{tab}"{escaped_key}"')
                lines.append(f"{tab}{{")
                lines.append(serialize_text(value, indent + 1))
                lines.append(f"{tab}}}")
            else:
                escaped_val = str(value).replace("\\", "\\\\").replace('"', '\\"')
                lines.append(f'{tab}"{escaped_key}"\t\t"{escaped_val}"')
    return "\n".join(lines)


def read_binary(data: bytes, pos: int) -> Tuple[List, int]:
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
            children, pos = read_binary(data, pos)
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
