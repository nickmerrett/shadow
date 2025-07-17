"""Algebra utilities."""

from typing import Tuple
import math


def solve_quadratic(a: float, b: float, c: float) -> Tuple[complex, complex]:
    """Solve ax^2 + bx + c = 0 and return its (possibly complex) roots."""
    discriminant = b ** 2 - 4 * a * c
    sqrt_disc = math.sqrt(discriminant) if discriminant >= 0 else math.sqrt(-discriminant) * 1j
    root1 = (-b + sqrt_disc) / (2 * a)
    root2 = (-b - sqrt_disc) / (2 * a)
    return root1, root2 