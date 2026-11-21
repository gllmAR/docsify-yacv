# docsify-yacv e2e

## Live build123d

```build123d height=321 title='Bracket demo'
from build123d import *

with BuildPart() as part:
    Box(10, 20, 30)
    # use `show()` to display the result
    Cylinder(3, 30, mode=Mode.SUBTRACT)

show(part)
```

## Static models

```yacv autoplay=false edgeWidth=2
assets/cube.glb
assets/second.glb#name=second
```

## Inline tag

<yacv height="240" title="Tag model" version="dev" debug constraints="numpy<2;packaging>=24">

<script type="text/x-python">
from build123d import *

with BuildPart() as tag_part:
    Sphere(5)

show(tag_part)
</script>

</yacv>

## External source

<yacv src="examples/bracket.py" code="show" height="222" title="External source"></yacv>

## Asset-only tag

<yacv models="assets/one.glb, assets/two.glb" height="180" autoplay="false"></yacv>

## Hidden code

```build123d code=hide height="200"
from build123d import *
show(Box(1, 2, 3))
```
