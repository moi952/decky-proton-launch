try:
    from .plugin import Plugin
    __all__ = ['Plugin']
except ImportError:
    __all__ = []
