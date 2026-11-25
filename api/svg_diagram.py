"""Validate the bounded, declarative diagram format without rewriting source."""

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
ID = re.compile(r"[A-Za-z][A-Za-z0-9_-]{0,63}\Z")
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"
TRANSLATE = re.compile(rf"translate\(\s*({NUMBER})(?:\s*,\s*|\s+)({NUMBER})\s*\)\Z")
NUMERIC = set(
    "refX refY markerWidth markerHeight x y width height rx ry cx cy r x1 y1 x2 y2 stroke-width font-size".split()
)
POSITIVE = {"markerWidth", "markerHeight", "width", "height", "r", "font-size"}


def invalid():
    raise PydanticCustomError(
        "invalid_svg",
        "Use the supported SVG diagram format. Check shapes and connections.",
    )


def number(value):
    if not re.fullmatch(NUMBER, value):
        invalid()
    result = float(value)
    if not math.isfinite(result) or abs(result) > 1_000_000:
        invalid()
    return result


def validate_svg(source: str) -> str:
    if source == "":
        return source
    if len(source) > FORMAT["maxLength"] or re.search(r"<!|<\?", source):
        invalid()
    try:
        root = ET.fromstring(source)
    except (ET.ParseError, ValueError):
        invalid()
    ns = "{" + FORMAT["namespace"] + "}"
    if root.tag != ns + "svg":
        invalid()
    elements = list(root.iter())
    if len(elements) > FORMAT["maxElements"]:
        invalid()
    ids, nodes, markers = set(), set(), set()
    lines = []

    def visit(el, parent=None):
        if not isinstance(el.tag, str) or not el.tag.startswith(ns):
            invalid()
        tag = el.tag[len(ns) :]
        if tag not in FORMAT["attributes"]:
            invalid()
        if parent is not None and tag not in FORMAT["children"].get(parent, []):
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
                    key in POSITIVE
                    and n <= 0
                    or key in {"rx", "ry", "stroke-width"}
                    and n < 0
                ):
                    invalid()
            elif key == "viewBox":
                parts = re.split(r"[\s,]+", value.strip())
                if len(parts) != 4:
                    invalid()
                numbers = [number(p) for p in parts]
                if numbers[2] <= 0 or numbers[3] <= 0:
                    invalid()
            elif key in {"id", "data-source", "data-target"}:
                if not ID.fullmatch(value):
                    invalid()
            elif key == "transform":
                match = TRANSLATE.fullmatch(value)
                if not match:
                    invalid()
                for part in match.groups():
                    number(part)
            elif key in {"fill", "stroke"}:
                if not re.fullmatch(r"(?:#[0-9a-fA-F]{3,8}|[A-Za-z]+)", value):
                    invalid()
            elif key == "marker-end":
                if not re.fullmatch(r"url\(#[A-Za-z][A-Za-z0-9_-]{0,63}\)", value):
                    invalid()
            elif key == "d":
                if not value.strip() or not re.fullmatch(
                    r"[MmLlHhVvZz0-9eE+.,\s-]+", value
                ):
                    invalid()
            elif key == "font-family" and value not in {
                "sans-serif",
                "serif",
                "monospace",
            }:
                invalid()
            elif key == "text-anchor" and value not in {"start", "middle", "end"}:
                invalid()
            elif key == "orient" and value != "auto":
                invalid()
            elif key == "data-node" and value != "true":
                invalid()
            elif key == "data-diagram-version" and value != FORMAT["version"]:
                invalid()
        if "id" in el.attrib:
            identifier = el.attrib["id"]
            if identifier in ids:
                invalid()
            ids.add(identifier)
            (nodes if tag == "g" else markers).add(identifier)
        if tag == "g":
            if any(
                len(el.findall(ns + label)) != 1
                or not (el.find(ns + label).text or "").strip()
                for label in ("title", "desc")
            ):
                invalid()
            if not any(
                c.tag in {ns + "rect", ns + "circle", ns + "ellipse"} for c in el
            ):
                invalid()
        if tag == "line":
            lines.append(el)
        for child in el:
            if (child.tail or "").strip():
                invalid()
            visit(child, tag)

    visit(root)
    if not nodes:
        invalid()
    for line in lines:
        if line.get("data-source") not in nodes or line.get("data-target") not in nodes:
            invalid()
        marker = line.get("marker-end")
        if marker and marker[5:-1] not in markers:
            invalid()
    return source
