"""Geometry helpers."""

import math


def area_circle(radius: float) -> float:
    """Compute the area of a circle.

    Parameters
    ----------
    radius : float
        Radius of the circle.

    Returns
    -------
    float
        Area of the circle.
    """
    return math.pi * radius ** 2


def perimeter_rectangle(width: float, height: float) -> float:
    """Compute the perimeter of a rectangle."""
    return 2 * (width + height) 