"""Validate supported passive SVG without rewriting the stored source.

Shape metadata is optional. The browser independently decides whether it has
complete enough metadata to enable temporary shape movement.
"""

import json
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from pydantic_core import PydanticCustomError

FORMAT = json.loads(
    (
        Path(__file__).resolve().parents[1] / "frontend/src/diagram/format.json"
    ).read_text()
)
ID = re.compile(r"[A-Za-z_][A-Za-z0-9_.:-]{0,127}\Z")
NUMBER = r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?"
NUMERIC = set(
    "refX refY markerWidth markerHeight x y dx dy width height rx ry cx cy r x1 y1 x2 y2 stroke-width font-size opacity fill-opacity stroke-opacity".split()
)
NONNEGATIVE = set(
    "markerWidth markerHeight width height rx ry r stroke-width font-size".split()
)
TRANSFORM = re.compile(r"(matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)")
TRANSFORM_COUNTS = {
    "matrix": [6],
    "translate": [1, 2],
    "scale": [1, 2],
    "rotate": [1, 3],
    "skewX": [1],
    "skewY": [1],
}
ENUMS = {
    "text-anchor": ["start", "middle", "end"],
    "font-style": ["normal", "italic", "oblique"],
    "stroke-linecap": ["butt", "round", "square"],
    "stroke-linejoin": ["miter", "round", "bevel"],
    "fill-rule": ["nonzero", "evenodd"],
    "markerUnits": ["strokeWidth", "userSpaceOnUse"],
    "role": ["img", "presentation", "none", "group"],
    "dominant-baseline": [
        "auto",
        "middle",
        "central",
        "hanging",
        "text-before-edge",
        "text-after-edge",
        "alphabetic",
    ],
}


def invalid():
    raise PydanticCustomError(
        "invalid_svg", "Use supported SVG elements and attributes. Check the SVG code."
    )


def number(value):
    if not re.fullmatch(NUMBER, value):
        invalid()
    result = float(value)
    if not math.isfinite(result) or abs(result) > 1_000_000:
        invalid()
    return result


def numbers(value):
    return [number(part) for part in re.split(r"[\s,]+", value.strip())]


def validate_svg(source: str) -> str:
    if source == "":
        return source
    # Match JavaScript's UTF-16 length, including non-BMP characters.
    if (
        len(source.encode("utf-16-le", errors="surrogatepass")) // 2
        > FORMAT["maxLength"]
    ):
        invalid()
    if re.search(r"<!|<\?", re.sub(r"<!--[\s\S]*?-->", "", source)):
        invalid()
    try:
        root = ET.fromstring(source)
    except (ET.ParseError, ValueError, UnicodeError):
        invalid()
    ns = "{" + FORMAT["namespace"] + "}"
    if root.tag != ns + "svg" or len(list(root.iter())) > FORMAT["maxElements"]:
        invalid()
    ids, markers, references = set(), set(), []

    def visit(el, parent=None, depth=0):
        if (
            depth > FORMAT["maxDepth"]
            or not isinstance(el.tag, str)
            or not el.tag.startswith(ns)
        ):
            invalid()
        tag = el.tag[len(ns) :]
        if (
            tag not in FORMAT["attributes"]
            or parent is not None
            and tag not in FORMAT["children"].get(parent, [])
        ):
            invalid()
        if set(el.attrib) - set(FORMAT["attributes"][tag]):
            invalid()
        if not set(FORMAT["required"].get(tag, [])).issubset(el.attrib):
            invalid()
        if tag not in {"title", "desc", "text"} and (el.text or "").strip():
            invalid()
        for key, value in el.attrib.items():
            if key in NUMERIC:
                n = number(value)
                if (
                    key in NONNEGATIVE
                    and n < 0
                    or key.endswith("opacity")
                    and not 0 <= n <= 1
                ):
                    invalid()
            elif key == "viewBox":
                parts = numbers(value)
                if len(parts) != 4 or parts[2] <= 0 or parts[3] <= 0:
                    invalid()
            elif key in {"id", "data-source", "data-target"}:
                if not ID.fullmatch(value):
                    invalid()
            elif key == "transform":
                parts = TRANSFORM.findall(value)
                if not parts or re.sub(r"[\s,]", "", TRANSFORM.sub("", value)):
                    invalid()
                if any(
                    len(numbers(args)) not in TRANSFORM_COUNTS[name]
                    for name, args in parts
                ):
                    invalid()
            elif key in {"fill", "stroke"}:
                if not re.fullmatch(
                    r"(?:#[0-9a-fA-F]{3,8}|[A-Za-z]+|(?:rgb|hsl)a?\([0-9.,%+\s-]+\))",
                    value,
                ):
                    invalid()
            elif key in {"marker-start", "marker-mid", "marker-end"}:
                if value == "none":
                    continue
                match = re.fullmatch(r"url\(#([^()\s]+)\)", value)
                if not match or not ID.fullmatch(match[1]):
                    invalid()
                references.append(match[1])
            elif key == "d":
                if not value.strip() or not re.fullmatch(
                    r"[MmLlHhVvZzCcSsQqTtAa0-9eE+.,\s-]+", value
                ):
                    invalid()
            elif key == "points":
                if len(numbers(value)) % 2:
                    invalid()
            elif key == "stroke-dasharray" and value != "none":
                if any(n < 0 for n in numbers(value)):
                    invalid()
            elif key == "font-family":
                if not re.fullmatch(r"[A-Za-z0-9 ,_'\"-]+", value):
                    invalid()
            elif key == "font-weight":
                if not re.fullmatch(r"(?:normal|bold|bolder|lighter|[1-9]00)", value):
                    invalid()
            elif key == "orient" and value not in {"auto", "auto-start-reverse"}:
                number(value)
            elif key == "preserveAspectRatio":
                if not re.fullmatch(
                    r"(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)",
                    value,
                ):
                    invalid()
            elif key in ENUMS and value not in ENUMS[key]:
                invalid()
        if "id" in el.attrib:
            identifier = el.attrib["id"]
            if identifier in ids:
                invalid()
            ids.add(identifier)
            if tag == "marker":
                markers.add(identifier)
        for child in el:
            if (child.tail or "").strip():
                invalid()
            visit(child, tag, depth + 1)

    visit(root)
    if any(identifier not in markers for identifier in references):
        invalid()
    return source
