import logging
import os
import sys

# Set up logging for this script
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger("build123d").setLevel(logging.WARNING)  # Too noisy at INFO level

# Pyodide runs on Emscripten, which does not provide every POSIX-only function of
# the `os` module. Some pure-Python dependencies import them unconditionally at
# import time (e.g. platformdirs>=4.14 does `from os import geteuid`, pulled in by
# build123d -> threejs_materials -> platformdirs), which otherwise breaks every
# playground run with an ImportError. There is no real uid/gid in the browser, so
# alias the missing functions to Pyodide's closest equivalents (or 0 as a last
# resort) to keep those imports working.
if sys.platform == "emscripten":
    for _name, _fallback in (("geteuid", "getuid"), ("getegid", "getgid")):
        if not hasattr(os, _name):
            setattr(os, _name, getattr(os, _fallback, lambda: 0))

import micropip

# Fetch and run the upstream OCP.wasm bootstrap for build123d and its dependencies.
# This ensures we automatically stay up-to-date with the upstream bootstrap logic.
from pyodide.http import pyfetch

response = await pyfetch(
    "https://raw.githubusercontent.com/yeicor/OCP.wasm/master/build123d/bootstrap.py"
)
bootstrap_code = await response.string()
exec(bootstrap_code)

# Get the build123d version from the global scope (set by the caller)
# Default to "stable" if not provided
build123d_version = globals().get("_pg_build123d_version", "stable")

# Get the debug flag from the global scope (set by the caller)
# Default to False if not provided
debug = globals().get("_pg_debug", False)

# Get the constraints from the global scope (set by the caller)
# Default to None if not provided
constraints = globals().get("_pg_constraints", None)

# Get the local yacv_server wheel URL from the global scope (set by the caller)
# Default to None if not provided (will install from PyPI instead)
yacv_wheel_url = globals().get("_pg_yacv_wheel_url", None)


async def mocked_hook():
    # Install the yacv_server package, which is the main server for the OCP.wasm playground.
    if yacv_wheel_url:
        # Install from a local wheel URL (used during development/testing)
        logger.info("Installing yacv_server from local wheel: %s", yacv_wheel_url)
        await micropip.install(
            yacv_wheel_url,
            pre=True,
            reinstall=True,
            constraints=constraints.split("\n") if constraints else None,
        )
    else:
        await micropip.install(
            "yacv_server",
            pre=True,
            reinstall=True,
            constraints=constraints.split("\n") if constraints else None,
        )

    # Preinstall the font-fetcher package and install its hook to automatically download any requested font.
    await micropip.install(
        "font-fetcher",
        pre=True,
        reinstall=True,
        constraints=constraints.split("\n") if constraints else None,
    )

    from font_fetcher.ocp import install_ocp_font_hook

    install_ocp_font_hook()


# b3d-live: build123d eagerly imports `threejs_materials` from its glTF/3MF
# exporter, but the preview never uses those exporters: yacv_server builds the
# GLB itself. The real wheel is ~90 MB and installing/unpacking it in the
# Pyodide filesystem is the single largest bootstrap cost (~40% of it), so
# satisfy the dependency with a tiny stub instead. `export_gltf` still writes a
# valid GLB, it just cannot inject full PBR materials.
if sys.platform == "emscripten":
    micropip.add_mock_package(
        "threejs-materials",
        "1.2.5",
        modules={
            "threejs_materials": (
                "class PbrProperties:\n"
                "    def __init__(self, *args, **kwargs):\n"
                "        self.args = args\n"
                "        self.kwargs = kwargs\n"
                "\n"
                "def inject_materials(*args, **kwargs):\n"
                "    pass\n"
            )
        },
    )

# b3d-live: stub metadata-only / non-core dependencies that dominate the
# install step (build123d 0.13 never imports sympy, and scikit-learn/IPython are
# only used by optional features). This removes ~10 MB of wheels and ~25% of the
# bootstrap time. The stubs raise clear errors if the corresponding feature is
# used; `repr(shape)` falls back to a plain object repr.
if sys.platform == "emscripten":
    micropip.add_mock_package(
        "sympy",
        "1.14.0",
        modules={
            "sympy": (
                "def __getattr__(name):\n"
                "    raise RuntimeError('sympy is not installed in the b3d-live sandbox')\n"
            )
        },
    )
    micropip.add_mock_package(
        "ipython",
        "9.12.0",
        modules={
            "IPython": "__path__ = []\n",
            "IPython.lib": "__path__ = []\n",
            "IPython.lib.pretty": (
                "class RepresentationPrinter:\n"
                "    pass\n"
                "\n"
                "def pretty(obj):\n"
                "    return object.__repr__(obj)\n"
            ),
            "IPython.display": "class HTML:\n    def __init__(self, *args, **kwargs): pass\n",
        },
    )
    micropip.add_mock_package(
        "scikit-learn",
        "1.8.0",
        modules={
            "sklearn": "__path__ = []",
            "sklearn.cluster": (
                "class DBSCAN:\n"
                "    def __init__(self, *args, **kwargs):\n"
                "        raise RuntimeError('scikit-learn is not available in the b3d-live sandbox')\n"
            ),
        },
    )

await bootstrap(
    build123d_version,
    debug=debug,
    constraints=constraints.split("\n") if constraints else None,
    mocked_hook=mocked_hook,
)

# b3d-live: micropip's mock for `lib3mf` (added by the bootstrap to satisfy
# build123d's metadata) shadows the real WebAssembly `lib3mf` package with an
# empty name, which breaks `from lib3mf import Lib3MF` in build123d.mesher.
# Re-register the real package before anything imports build123d.
if sys.platform == "emscripten":
    import importlib.util as _b3d_live_ilu

    if not getattr(sys.modules.get("lib3mf"), "__file__", None):
        sys.modules.pop("lib3mf", None)
        for _b3d_live_path in sys.path:
            _b3d_live_dir = os.path.join(_b3d_live_path, "lib3mf")
            _b3d_live_init = os.path.join(_b3d_live_dir, "__init__.py")
            if os.path.isfile(_b3d_live_init):
                _b3d_live_spec = _b3d_live_ilu.spec_from_file_location(
                    "lib3mf", _b3d_live_init, submodule_search_locations=[_b3d_live_dir]
                )
                _b3d_live_mod = _b3d_live_ilu.module_from_spec(_b3d_live_spec)
                sys.modules["lib3mf"] = _b3d_live_mod
                _b3d_live_spec.loader.exec_module(_b3d_live_mod)
                break

# Preimport the yacv_server package to ensure it is available in the global scope, and mock the ocp_vscode package.
from yacv_server import *

micropip.add_mock_package(
    "ocp-vscode",
    "3.4.0",
    modules={"ocp_vscode": "from yacv_server import *; show_object = show"},
)
show_object = show
