"""A small L-bracket used by the docsify-yacv demo.

Everything here is plain build123d and runs unchanged in the browser playground.
"""

from build123d import *

with BuildPart() as bracket:
    # Base plate (40 x 24 x 5, centered on the XY plane)
    Box(40, 24, 5)

    # Upright, sitting on the back edge of the plate
    with Locations((0, 9.5, 14.5)):
        Box(40, 5, 24)

    # Mounting holes in the base
    with Locations((-14, -6, 0), (14, -6, 0)):
        Hole(3)

    # Lightening cut in the upright
    with Locations((0, 9.5, 18)):
        Box(26, 6, 9, mode=Mode.SUBTRACT)

    # Rounded vertical corners
    fillet(bracket.edges().filter_by(Axis.Z), radius=2)

bracket.part.color = (0.25, 0.55, 0.85, 1)
show(bracket)
