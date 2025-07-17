"""Bar utilities building upon foo."""

from .foo import foo


def double_foo(x: int) -> int:
    """Return twice the result of ``foo(x)``.

    Example
    -------
    >>> double_foo(3)
    8
    """
    return foo(x) * 2


def triple_foo(x: int) -> int:
    """Return three times the result of ``foo(x)`` by reusing ``double_foo``.

    Demonstrates nested calls within the same module, giving the graph a
    diamond shape: triple_foo → double_foo → foo → _increment.
    """
    return double_foo(x) + foo(x)


def _format_greeting(name: str) -> str:
    """Helper to format greeting; used by Greeter to create an extra CALL node."""
    return f"Hello, {name}!"


class Greeter:
    """Simple greeter class demonstrating a class definition."""

    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        """Return a friendly greeting."""
        return _format_greeting(self.name) 