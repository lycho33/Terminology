import format from "./format.json";

export type SvgElement = {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  children: SvgElement[];
};
export type Diagram = { viewBox: string; elements: SvgElement[] };
const schema = format as {
  namespace: string;
  version: string;
  maxLength: number;
  maxElements: number;
  attributes: Record<string, string[]>;
  required: Record<string, string[]>;
  children: Record<string, string[]>;
};
const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const numberPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
const numeric = new Set(
  "refX refY markerWidth markerHeight x y width height rx ry cx cy r x1 y1 x2 y2 stroke-width font-size".split(
    " ",
  ),
);
const positive = new Set([
  "markerWidth",
  "markerHeight",
  "width",
  "height",
  "r",
  "font-size",
]);
const fail = (message: string): never => {
  throw new Error(message);
};
const number = (s: string) => {
  if (
    !numberPattern.test(s) ||
    !Number.isFinite(Number(s)) ||
    Math.abs(Number(s)) > 1e6
  )
    fail("Use finite SVG coordinates between -1000000 and 1000000.");
  return Number(s);
};
export function translation(value: string): [number, number] {
  const numericPart = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
  const match = new RegExp(
    `^translate\\(\\s*(${numericPart})(?:\\s*,\\s*|\\s+)(${numericPart})\\s*\\)$`,
  ).exec(value);
  const parts = match?.slice(1);
  if (!parts || parts.length !== 2)
    return fail("Use translate(x y) for each shape group.");
  return [number(parts[0]), number(parts[1])];
}
export function parseDiagram(source: string): Diagram | null {
  if (source === "") return null;
  if (source.length > schema.maxLength)
    fail("Keep SVG source under 100000 characters.");
  if (/<!|<\?/.test(source))
    fail(
      "Paste SVG without declarations, comments, or processing instructions.",
    );
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  if (document.querySelector("parsererror"))
    fail("Enter complete, well-formed SVG code.");
  const root = document.documentElement;
  if (root.localName !== "svg" || root.namespaceURI !== schema.namespace)
    fail('Use an SVG root with xmlns="http://www.w3.org/2000/svg".');
  if (root.querySelectorAll("*").length + 1 > schema.maxElements)
    fail("Use at most 500 SVG elements.");
  const ids = new Set<string>(),
    nodes = new Set<string>(),
    markers = new Set<string>();
  const lines: SvgElement[] = [];
  const visit = (el: Element, parent?: string): SvgElement => {
    const tag = el.localName;
    if (
      el.namespaceURI !== schema.namespace ||
      !Object.hasOwn(schema.attributes, tag) ||
      (parent && !schema.children[parent]?.includes(tag))
    )
      fail(`Unsupported SVG element: ${tag}. Use the example format.`);
    const attrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === "xmlns" && attr.value === schema.namespace) continue;
      if (attr.namespaceURI || !schema.attributes[tag].includes(attr.name))
        fail(`Unsupported attribute: ${attr.name}. Use the example format.`);
      attrs[attr.name] = attr.value;
    }
    for (const key of schema.required[tag] ?? [])
      if (!(key in attrs)) fail(`The ${tag} element needs ${key}.`);
    for (const [key, value] of Object.entries(attrs)) {
      if (numeric.has(key)) {
        const n = number(value);
        if (
          (positive.has(key) && n <= 0) ||
          (["rx", "ry", "stroke-width"].includes(key) && n < 0)
        )
          fail(`Use a valid positive size for ${key}.`);
      } else if (key === "viewBox") {
        const parts = value
          .trim()
          .split(/[\s,]+/)
          .map(number);
        if (parts.length !== 4 || parts[2] <= 0 || parts[3] <= 0)
          fail('Use viewBox="x y width height" with positive dimensions.');
      } else if (["id", "data-source", "data-target"].includes(key)) {
        if (!idPattern.test(value))
          fail(
            "Use unique IDs beginning with a letter, followed by letters, digits, underscores, or hyphens.",
          );
      } else if (key === "transform") translation(value);
      else if (
        ["fill", "stroke"].includes(key) &&
        !/^(?:#[0-9a-fA-F]{3,8}|[A-Za-z]+)$/.test(value)
      )
        fail("Use a named or hexadecimal color.");
      else if (
        key === "marker-end" &&
        !/^url\(#[A-Za-z][A-Za-z0-9_-]{0,63}\)$/.test(value)
      )
        fail("Use a local arrow marker reference.");
      else if (
        key === "d" &&
        (!value.trim() || !/^[MmLlHhVvZz0-9eE+.,\s-]+$/.test(value))
      )
        fail("Use straight segments for arrow marker paths.");
      else if (
        key === "font-family" &&
        !["sans-serif", "serif", "monospace"].includes(value)
      )
        fail("Use sans-serif, serif, or monospace text.");
      else if (
        key === "text-anchor" &&
        !["start", "middle", "end"].includes(value)
      )
        fail("Use start, middle, or end for text-anchor.");
      else if (key === "orient" && value !== "auto")
        fail('Use orient="auto" on arrow markers.');
      else if (key === "data-node" && value !== "true")
        fail('Use data-node="true" on movable groups.');
      else if (key === "data-diagram-version" && value !== schema.version)
        fail('Use data-diagram-version="1".');
    }
    if (attrs.id) {
      if (ids.has(attrs.id))
        fail(
          `Duplicate ID: ${attrs.id}. Give every shape and marker a unique ID.`,
        );
      ids.add(attrs.id);
      (tag === "g" ? nodes : markers).add(attrs.id);
    }
    const text = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("");
    if (!["title", "desc", "text"].includes(tag) && text.trim())
      fail("Put visible text in a text element.");
    const children = Array.from(el.children).map((c) => visit(c, tag));
    if (tag === "g") {
      for (const label of ["title", "desc"]) {
        const found = children.filter((c) => c.tag === label);
        if (found.length !== 1 || !found[0].text.trim())
          fail("Each shape group needs one title and one description.");
      }
      if (!children.some((c) => ["rect", "circle", "ellipse"].includes(c.tag)))
        fail("Each group needs a rectangle, circle, or ellipse.");
    }
    const result = { tag, attrs, text, children };
    if (tag === "line") lines.push(result);
    return result;
  };
  const parsed = visit(root);
  if (!nodes.size) fail("Add at least one shape group from the example.");
  for (const line of lines) {
    if (
      !nodes.has(line.attrs["data-source"]) ||
      !nodes.has(line.attrs["data-target"])
    )
      fail("Each connection must name an existing source and target shape.");
    const marker = line.attrs["marker-end"];
    if (marker && !markers.has(marker.slice(5, -1)))
      fail("The connection references a missing arrow marker.");
  }
  return { viewBox: parsed.attrs.viewBox, elements: parsed.children };
}
export function diagramError(source: string): string | null {
  try {
    parseDiagram(source);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Check the SVG diagram.";
  }
}
