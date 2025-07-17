def _increment(y: int) -> int:
    """Private helper that just adds one."""
    return y + 1


def foo(x: int) -> int:
    """Increment *x* by 1 and return it.

    A deliberately trivial function used across the demo to illustrate
    symbol resolution and call graph extraction. Internally delegates to
    ``_increment`` so the indexer captures a CALL edge within the same file.
    """
    return _increment(x)
