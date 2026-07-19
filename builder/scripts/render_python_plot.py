"""Render explicitly trusted Python/Matplotlib source for the local builder."""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path
import sys
import traceback
from typing import Any

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import numpy as np


MINIMUM_EXTENT = 64
MAXIMUM_EXTENT = 4096
MAXIMUM_SOURCE_BYTES = 100_000


def require_extent(value: Any, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{name} must be an integer")
    if value < MINIMUM_EXTENT or value > MAXIMUM_EXTENT:
        raise ValueError(
            f"{name} must be in [{MINIMUM_EXTENT}, {MAXIMUM_EXTENT}]"
        )
    return value


def execute_plot(source: str, pixel_width: int, pixel_height: int) -> Figure:
    if not source.strip():
        raise ValueError("Plot source must not be empty")
    if len(source.encode("utf-8")) > MAXIMUM_SOURCE_BYTES:
        raise ValueError(
            f"Plot source must contain at most {MAXIMUM_SOURCE_BYTES} UTF-8 bytes"
        )

    plt.close("all")
    matplotlib.rcParams["svg.hashsalt"] = "dans.typesetting.python-plot"
    namespace: dict[str, Any] = {
        "__name__": "__dans_python_plot__",
        "np": np,
        "plt": plt,
    }
    exec(compile(source, "<dans-python-plot>", "exec"), namespace, namespace)
    candidate = namespace.get("figure")
    figure = candidate if isinstance(candidate, Figure) else plt.gcf()
    figure.set_size_inches(pixel_width / 100.0, pixel_height / 100.0, forward=True)
    return figure


def render_svg(source: str, pixel_width: int, pixel_height: int) -> str:
    figure = execute_plot(source, pixel_width, pixel_height)
    output = io.StringIO()
    try:
        figure.savefig(
            output,
            format="svg",
            dpi=100,
            metadata={"Creator": "dans.typesetting", "Date": None},
        )
        return output.getvalue()
    finally:
        plt.close("all")


def render_file(
    source: str,
    output_path: Path,
    pixel_width: int,
    pixel_height: int,
) -> None:
    output_format = output_path.suffix.lower().removeprefix(".")
    if output_format not in {"pdf", "png", "svg"}:
        raise ValueError("Plot output must use a .pdf, .png, or .svg suffix")
    figure = execute_plot(source, pixel_width, pixel_height)
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        figure.savefig(output_path, format=output_format, dpi=100)
    finally:
        plt.close("all")


def render_stdin_request() -> None:
    payload = json.load(sys.stdin)
    if not isinstance(payload, dict):
        raise ValueError("Plot render request must be an object")
    source = payload.get("source")
    if not isinstance(source, str):
        raise ValueError("Plot source must be a string")
    pixel_width = require_extent(payload.get("pixelWidth"), "pixelWidth")
    pixel_height = require_extent(payload.get("pixelHeight"), "pixelHeight")
    sys.stdout.write(render_svg(source, pixel_width, pixel_height))


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    return parser.parse_args()


def main() -> int:
    arguments = parse_arguments()
    if arguments.source is None and arguments.output is None:
        render_stdin_request()
        return 0
    if arguments.source is None or arguments.output is None:
        raise ValueError("--source and --output must be supplied together")
    pixel_width = require_extent(arguments.width, "width")
    pixel_height = require_extent(arguments.height, "height")
    render_file(
        arguments.source.read_text(encoding="utf-8"),
        arguments.output,
        pixel_width,
        pixel_height,
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:  # noqa: BLE001 - the caller needs the full renderer diagnostic.
        traceback.print_exc(file=sys.stderr)
        raise SystemExit(1)
