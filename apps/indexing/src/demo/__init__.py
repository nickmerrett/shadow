"""Top-level demo package used for CodeGraph examples."""

from .foo import foo  # re-export common util
from .bar import double_foo, Greeter

__all__ = ["foo", "double_foo", "Greeter", "package"] 