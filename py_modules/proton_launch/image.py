import struct
from pathlib import Path
from typing import Optional, Tuple


def image_dimensions(path: Path) -> Optional[Tuple[int, int]]:
    """Read (width, height) from an image's own header bytes — no external
    dependencies. The file's name/suffix says nothing reliable about its
    real content (some sources dump a portrait capsule into what's
    supposed to be the landscape slot), so callers needing to know a
    file's actual shape must read it, not infer it from where it came
    from."""
    try:
        data = path.read_bytes()
        ext = path.suffix.lower()

        if ext == ".png":
            if len(data) >= 24 and data[:8] == b"\x89PNG\r\n\x1a\n":
                w, h = struct.unpack(">II", data[16:24])
                return (w, h) if h > 0 else None

        elif ext in (".jpg", ".jpeg"):
            i = 2
            while i + 3 < len(data):
                if data[i] != 0xFF:
                    break
                marker = data[i + 1]
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB):
                    if i + 9 < len(data):
                        h, w = struct.unpack(">HH", data[i + 5:i + 9])
                        return (w, h) if h > 0 else None
                seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
                i += 2 + seg_len

        elif ext == ".webp":
            if len(data) >= 30 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
                chunk = data[12:16]
                if chunk == b"VP8 " and len(data) >= 30:
                    raw_w, raw_h = struct.unpack("<HH", data[26:30])
                    w = (raw_w & 0x3FFF) + 1
                    h = (raw_h & 0x3FFF) + 1
                    return (w, h)
                elif chunk == b"VP8L" and len(data) >= 25:
                    if data[20] == 0x2F:
                        val = struct.unpack_from("<I", data, 21)[0]
                        w = (val & 0x3FFF) + 1
                        h = ((val >> 14) & 0x3FFF) + 1
                        return (w, h)
                elif chunk == b"VP8X" and len(data) >= 30:
                    w = int.from_bytes(data[24:27], "little") + 1
                    h = int.from_bytes(data[27:30], "little") + 1
                    return (w, h)
    except Exception:
        pass
    return None


def is_horizontal(path: Path) -> bool:
    """Return True if the image is roughly horizontal (width/height > 1.3)."""
    dims = image_dimensions(path)
    if not dims:
        return False
    w, h = dims
    return w / h > 1.3
