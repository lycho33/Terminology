const namespace = "http://www.w3.org/2000/svg";
const zero = [0, 0];

function svg(tag, attributes, ...children) {
  const node = document.createElementNS(namespace, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}

function motion(tag, attributes, from, to, reducedMotion) {
  const node = svg(tag, attributes);
  if (!reducedMotion) {
    for (const [name, value] of Object.entries(to)) {
      if (value !== from[name]) {
        node.append(svg("animate", {
          attributeName: name, from: from[name], to: value, dur: "460ms", fill: "freeze",
        }));
      }
    }
  }
  return node;
}

const view = ({ zoom = 1, pan = zero } = {}) => {
  const [x, y] = pan;
  return { x, y, width: 520 * zoom, height: 200 * zoom };
};

const endpoints = ({ client = zero, server = zero } = {}) => ({
  x1: 190 + client[0], y1: 100 + client[1], x2: 330 + server[0], y2: 100 + server[1],
});

export function connectedDiagram(frame, previous, reducedMotion) {
  const canvas = svg("svg", { viewBox: "0 0 520 200", class: "ui-diagram-canvas", role: "img",
    "aria-label": (frame.variant === "browser" ? "Browser" : frame.variant === "unicode" ? "Client café & tea" : "Client") + " to Server" });
  const fromView = view(previous);
  const toView = view(frame);
  const viewport = motion("svg", { ...toView, viewBox: "0 0 520 200", overflow: "visible" },
    fromView, toView, reducedMotion);
  viewport.append(
    svg("defs", {}, svg("marker", {
      id: "ui-replay-arrow", viewBox: "0 0 10 10", refX: 10, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto",
    }, svg("path", { d: "M 0 0 L 10 5 L 0 10 Z", fill: "#334155" }))),
    motion("line", { ...endpoints(frame), stroke: "#334155", "stroke-width": 2,
      "marker-end": "url(#ui-replay-arrow)" }, endpoints(previous), endpoints(frame), reducedMotion));
  for (const [id, startX, label] of [
    ["client", 30, frame.variant === "browser" ? "Browser" : frame.variant === "unicode" ? "Client café & tea" : "Client"],
    ["server", 330, "Server"],
  ]) {
    const [x, y] = frame[id] ?? zero;
    const [previousX, previousY] = previous?.[id] ?? zero;
    const node = svg("g", { class: "ui-diagram-shape", "data-shape": id, "data-focused": frame.focus === id });
    const shape = { x: startX + x, y: 60 + y };
    const beforeShape = { x: startX + previousX, y: 60 + previousY };
    node.append(
      motion("rect", { ...shape, width: 160, height: 80, rx: 10 }, beforeShape, shape, reducedMotion),
      motion("text", { x: shape.x + 80, y: shape.y + 46, "text-anchor": "middle" },
        { x: beforeShape.x + 80, y: beforeShape.y + 46 },
        { x: shape.x + 80, y: shape.y + 46 }, reducedMotion));
    node.lastChild.append(label);
    viewport.append(node);
  }
  canvas.append(viewport);
  return canvas;
}
