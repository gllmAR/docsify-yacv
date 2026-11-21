"""A bracket, loaded from a separate .py file."""

from build123d import *

with BuildPart() as bracket:
    Box(30, 12, 4)
    with Locations((0, 0, 4)):
        Cylinder(2, 10, mode=Mode.ADD)

show(bracket)
