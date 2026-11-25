import format from "./format.json";

export type SvgElement = {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  children: SvgElement[];
};
export type Diagram = {
  viewBox: string;
  attrs: Record<string, string>;
  elements: SvgElement[];
  interactive: boolean;
};
const schema = format as {
  namespace: string;
  version: string;
  maxLength: number;
  maxElements: number;
  maxDepth: number;
  attributes: Record<string, string[]>;
  required: Record<string, string[]>;
  children: Record<string, string[]>;
};
const idPattern = /^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/;
const numericPart =
  "[+-]?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+)(?:[eE][+-]?[0-9]+)?";
const numberPattern = new RegExp(`^${numericPart}$`);
const numeric = new Set(
  "refX refY markerWidth markerHeight x y dx dy width height rx ry cx cy r x1 y1 x2 y2 stroke-width font-size opacity fill-opacity stroke-opacity".split(
    " ",
  ),
);
const nonnegative = new Set(
  "markerWidth markerHeight width height rx ry r stroke-width font-size".split(
    " ",
  ),
);
const markerAttributes = ["marker-start", "marker-mid", "marker-end"];
const fail = (message: string): never => {
  throw new Error(message);
};
const number = (value: string) => {
  if (
    !numberPattern.test(value) ||
    !Number.isFinite(Number(value)) ||
    Math.abs(Number(value)) > 1e6
  )
    fail("Use finite SVG coordinates between -1000000 and 1000000.");
  return Number(value);
};
const numbers = (value: string) =>
  value
    .trim()
    .split(/[\s,]+/)
    .map(number);
export function translation(value: string): [number, number] {
  const match = new RegExp(
    `^translate\\(\\s*(${numericPart})(?:\\s*,\\s*|\\s+)(${numericPart})\\s*\\)$`,
  ).exec(value);
  if (!match) return fail("Use translate(x y) for each movable shape group.");
  return [number(match[1]), number(match[2])];
}
function validateTransform(value: string) {
  const parts = Array.from(
    value.matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)/g),
  );
  if (
    !parts.length ||
    value
      .replace(/(matrix|translate|scale|rotate|skewX|skewY)\([^()]*\)/g, "")
      .replace(/[\s,]/g, "")
  )
    fail("Use SVG transform functions with numeric values.");
  const counts: Record<string, number[]> = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  };
  for (const part of parts)
    if (!counts[part[1]].includes(numbers(part[2]).length))
      fail("Check the number of SVG transform values.");
}
const enums: Record<string, string[]> = {
  "text-anchor": ["start", "middle", "end"],
  "font-style": ["normal", "italic", "oblique"],
  "stroke-linecap": ["butt", "round", "square"],
  "stroke-linejoin": ["miter", "round", "bevel"],
  "fill-rule": ["nonzero", "evenodd"],
  markerUnits: ["strokeWidth", "userSpaceOnUse"],
  role: ["img", "presentation", "none", "group"],
  "dominant-baseline": [
    "auto",
    "middle",
    "central",
    "hanging",
    "text-before-edge",
    "text-after-edge",
    "alphabetic",
  ],
};
export function parseDiagram(source: string): Diagram | null {
  if (source === "") return null;
  if (source.length > schema.maxLength)
    fail("Use at most 100000 SVG source characters.");
  if (/<!|<\?/.test(source.replace(/<!--[\s\S]*?-->/g, "")))
    fail("Paste SVG without declarations or processing instructions.");
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror"))
    fail("Enter complete, well-formed SVG code.");
  const root = document.documentElement;
  if (root.localName !== "svg" || root.namespaceURI !== schema.namespace)
    fail('Use an SVG root with xmlns="http://www.w3.org/2000/svg".');
  if (root.querySelectorAll("*").length + 1 > schema.maxElements)
    fail("Use at most 500 SVG elements.");
  const ids = new Set<string>(),
    markers = new Set<string>();
  const references: string[] = [];
  const visit = (el: Element, parent?: string, depth = 0): SvgElement => {
    const tag = el.localName;
    if (depth > schema.maxDepth) fail("Use at most 20 nested SVG levels.");
    if (
      el.namespaceURI !== schema.namespace ||
      !Object.hasOwn(schema.attributes, tag) ||
      (parent && !schema.children[parent]?.includes(tag))
    )
      fail(`Unsupported SVG element: ${tag}.`);
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "xmlns" && attr.value === schema.namespace) continue;
      if (attr.namespaceURI || !schema.attributes[tag].includes(attr.name))
        fail(`Unsupported SVG attribute: ${attr.name}.`);
      attrs[attr.name] = attr.value;
    }
    for (const key of schema.required[tag] ?? [])
      if (!(key in attrs)) fail(`The ${tag} element needs ${key}.`);
    for (const [key, value] of Object.entries(attrs)) {
      if (numeric.has(key)) {
        const n = number(value);
        if (nonnegative.has(key) && n < 0)
          fail(`Use a nonnegative value for ${key}.`);
        if (key.endsWith("opacity") && (n < 0 || n > 1))
          fail("Use opacity from 0 to 1.");
      } else if (key === "viewBox") {
        const parts = numbers(value);
        if (parts.length !== 4 || parts[2] <= 0 || parts[3] <= 0)
          fail('Use viewBox="x y width height" with positive dimensions.');
      } else if (["id", "data-source", "data-target"].includes(key)) {
        if (!idPattern.test(value)) fail("Use a valid SVG identifier.");
      } else if (key === "transform") validateTransform(value);
      else if (
        ["fill", "stroke"].includes(key) &&
        !/^(?:#[0-9a-fA-F]{3,8}|[A-Za-z]+|(?:rgb|hsl)a?\([0-9.,%+\s-]+\))$/.test(
          value,
        )
      )
        fail("Use a named, hexadecimal, RGB, or HSL color.");
      else if (markerAttributes.includes(key)) {
        if (value === "none") continue;
        const id = /^url\(#([^()\s]+)\)$/.exec(value)?.[1];
        if (!id || !idPattern.test(id))
          fail("Use a local arrow marker reference.");
        references.push(id!);
      } else if (
        key === "d" &&
        (!value.trim() || !/^[MmLlHhVvZzCcSsQqTtAa0-9eE+.,\s-]+$/.test(value))
      )
        fail("Use SVG path commands and numeric coordinates.");
      else if (key === "points" && numbers(value).length % 2 !== 0)
        fail("Use x,y coordinate pairs for points.");
      else if (key === "stroke-dasharray" && value !== "none") {
        if (numbers(value).some((n) => n < 0))
          fail("Use nonnegative dash lengths.");
      } else if (key === "font-family" && !/^[A-Za-z0-9 ,_'"-]+$/.test(value))
        fail("Use font names separated by commas.");
      else if (
        key === "font-weight" &&
        !/^(?:normal|bold|bolder|lighter|[1-9]00)$/.test(value)
      )
        fail("Use a supported font weight.");
      else if (
        key === "orient" &&
        !["auto", "auto-start-reverse"].includes(value)
      )
        number(value);
      else if (
        key === "preserveAspectRatio" &&
        !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(
          value,
        )
      )
        fail("Use a supported SVG aspect ratio.");
      else if (Object.hasOwn(enums, key) && !enums[key].includes(value))
        fail(`Unsupported SVG ${key} value.`);
    }
    if (attrs.id) {
      if (ids.has(attrs.id))
        fail(`Duplicate ID: ${attrs.id}. Use unique SVG IDs.`);
      ids.add(attrs.id);
      if (tag === "marker") markers.add(attrs.id);
    }
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("");
    if (!["title", "desc", "text"].includes(tag) && text.trim())
      fail("Put visible text in a text element.");
    return {
      tag,
      attrs,
      text,
      children: Array.from(el.children).map((c) => visit(c, tag, depth + 1)),
    };
  };
  const parsed = visit(root);
  if (references.some((id) => !markers.has(id)))
    fail("The SVG references a missing arrow marker.");
  return {
    viewBox: parsed.attrs.viewBox,
    attrs: parsed.attrs,
    elements: parsed.children,
    interactive: canMoveShapes(parsed),
  };
}

// Interaction is optional. Never infer a shape or connection from visual proximity.
function canMoveShapes(root: SvgElement): boolean {
  if (root.attrs["data-diagram-version"] !== schema.version) return false;
  const groups = root.children.filter((el) => el.tag === "g");
  if (
    !groups.length ||
    root.children.some(
      (el) => !["g", "line", "defs", "title", "desc"].includes(el.tag),
    )
  )
    return false;
  for (const group of groups) {
    if (!group.attrs.id || group.attrs["data-node"] !== "true") return false;
    try {
      translation(group.attrs.transform ?? "");
    } catch {
      return false;
    }
    if (
      group.children.some(
        (el) =>
          !["rect", "circle", "ellipse", "text", "title", "desc"].includes(
            el.tag,
          ),
      )
    )
      return false;
    if (
      !group.children.some((el) =>
        ["rect", "circle", "ellipse"].includes(el.tag),
      )
    )
      return false;
    for (const label of ["title", "desc"]) {
      const found = group.children.filter((el) => el.tag === label);
      if (found.length !== 1 || !found[0].text.trim()) return false;
    }
  }
  const ids = new Set(groups.map((el) => el.attrs.id));
  return root.children
    .filter((el) => el.tag === "line")
    .every(
      (line) =>
        !line.attrs.transform &&
        ids.has(line.attrs["data-source"]) &&
        ids.has(line.attrs["data-target"]) &&
        ["x1", "y1", "x2", "y2"].every((key) => key in line.attrs),
    );
}
export function diagramError(source: string): string | null {
  try {
    parseDiagram(source);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Check the SVG diagram.";
  }
}
