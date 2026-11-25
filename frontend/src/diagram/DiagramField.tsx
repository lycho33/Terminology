import {
  createElement,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  parseDiagram,
  translation,
  type Diagram,
  type SvgElement,
} from "./svg-format";
import { FiCopy, FiMinus, FiPlus } from "react-icons/fi";
import { ValidationMessages } from "../terms/ValidationMessages";
import "./diagram.css";

type Point = { x: number; y: number };
const zero = { x: 0, y: 0 };
const reactAttributes: Record<string, string> = {
  "stroke-width": "strokeWidth",
  "marker-end": "markerEnd",
  "marker-start": "markerStart",
  "marker-mid": "markerMid",
  "stroke-linecap": "strokeLinecap",
  "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray",
  "stroke-opacity": "strokeOpacity",
  "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule",
  "font-weight": "fontWeight",
  "font-style": "fontStyle",
  "dominant-baseline": "dominantBaseline",
  "font-family": "fontFamily",
  "font-size": "fontSize",
  "text-anchor": "textAnchor",
};

function DiagramViewer({
  diagram,
  renderHeader,
}: {
  diagram: Diagram;
  renderHeader: (controls: ReactNode) => ReactNode;
}) {
  const prefix = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const content = useRef<SVGGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(zero);
  const [offsets, setOffsets] = useState<Record<string, Point>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const gesture = useRef<{
    id?: string;
    pointer: number;
    start: Point;
    screen: Point;
    origin: Point;
    moved: boolean;
  } | null>(null);
  const offsetFor = (id: string): Point =>
    Object.hasOwn(offsets, id) ? offsets[id] : zero;
  const nodes = diagram.interactive
    ? diagram.elements.filter((el) => el.tag === "g")
    : [];
  const chosen = nodes.find((node) => node.attrs.id === selected);
  const point = (
    event: PointerEvent<SVGSVGElement>,
    node: SVGGraphicsElement | null,
  ): Point => {
    const matrix = node?.getScreenCTM();
    if (!matrix) return zero;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  };
  const moveNode = (id: string, delta: Point) =>
    setOffsets((old) => ({ ...old, [id]: delta }));
  const onDown = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = diagram.interactive
      ? (event.target as Element).closest("[data-shape-id]")
      : null;
    const id = target?.getAttribute("data-shape-id") ?? undefined;
    const start = point(event, id ? content.current : svg.current);
    gesture.current = {
      id,
      pointer: event.pointerId,
      start,
      screen: { x: event.clientX, y: event.clientY },
      origin: id ? offsetFor(id) : pan,
      moved: false,
    };
    svg.current?.setPointerCapture(event.pointerId);
    if (target instanceof SVGElement) target.focus({ preventScroll: true });
  };
  const onMove = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (
      Math.hypot(
        event.clientX - current.screen.x,
        event.clientY - current.screen.y,
      ) > 3
    )
      current.moved = true;
    if (!current.moved) return;
    const now = point(event, current.id ? content.current : svg.current);
    const delta = {
      x: current.origin.x + now.x - current.start.x,
      y: current.origin.y + now.y - current.start.y,
    };
    if (current.id) moveNode(current.id, delta);
    else setPan(delta);
  };
  const onUp = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointer !== event.pointerId) return;
    if (!current.moved && current.id) setSelected(current.id);
    gesture.current = null;
    if (svg.current?.hasPointerCapture(event.pointerId))
      svg.current.releasePointerCapture(event.pointerId);
  };
  const reset = () => {
    setZoom(1);
    setPan(zero);
    setOffsets({});
    setSelected(null);
    gesture.current = null;
  };
  const attributes = (attrs: Record<string, string>) => {
    const props: Record<string, string> = {};
    for (const [name, value] of Object.entries(attrs)) {
      let scoped = value;
      if (name === "id") scoped = `${prefix}-${value}`;
      if (
        ["marker-start", "marker-mid", "marker-end"].includes(name) &&
        value !== "none"
      )
        scoped = `url(#${prefix}-${value.slice(5, -1)})`;
      if (["aria-labelledby", "aria-describedby"].includes(name))
        scoped = value
          .trim()
          .split(/\s+/)
          .map((id) => `${prefix}-${id}`)
          .join(" ");
      props[reactAttributes[name] ?? name] = scoped;
    }
    return props;
  };
  const render = (el: SvgElement, key: number): ReactNode => {
    const props: Record<string, unknown> = { ...attributes(el.attrs), key };
    if (diagram.interactive && nodes.includes(el)) {
      const id = el.attrs.id;
      const [x, y] = translation(el.attrs.transform);
      const offset = offsetFor(id);
      props.transform = `translate(${x + offset.x} ${y + offset.y})`;
      props["data-shape-id"] = id;
      props.tabIndex = 0;
      props.role = "button";
      props["aria-label"] =
        `Show details for ${el.children.find((c) => c.tag === "title")?.text}`;
      props["aria-pressed"] = selected === id;
      props.onKeyDown = (event: React.KeyboardEvent<SVGGElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelected(id);
        }
        const delta = {
          ArrowLeft: [-10, 0],
          ArrowRight: [10, 0],
          ArrowUp: [0, -10],
          ArrowDown: [0, 10],
        }[event.key];
        if (delta) {
          event.preventDefault();
          moveNode(id, { x: offset.x + delta[0], y: offset.y + delta[1] });
        }
      };
    }
    if (
      diagram.interactive &&
      el.tag === "line" &&
      diagram.elements.includes(el)
    ) {
      const from = offsetFor(el.attrs["data-source"]);
      const to = offsetFor(el.attrs["data-target"]);
      props.x1 = Number(el.attrs.x1) + from.x;
      props.y1 = Number(el.attrs.y1) + from.y;
      props.x2 = Number(el.attrs.x2) + to.x;
      props.y2 = Number(el.attrs.y2) + to.y;
    }
    return createElement(
      el.tag,
      props,
      el.text || undefined,
      ...el.children.map(render),
    );
  };
  return (
    <>
      {renderHeader(
        <div
          className="diagram__toolbar"
          role="group"
          aria-label="Diagram view controls"
        >
          <button
            type="button"
            className="diagram__icon-button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            disabled={zoom >= 4}
          >
            <FiPlus aria-hidden="true" />
          </button>
          <button
            type="button"
            className="diagram__icon-button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            disabled={zoom <= 0.25}
          >
            <FiMinus aria-hidden="true" />
          </button>
          <span className="diagram__zoom" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset view"
            title="Reset view"
          >
            Reset
          </button>
        </div>,
      )}
      <svg
        {...attributes(diagram.attrs)}
        width="100%"
        height={undefined}
        ref={svg}
        className="diagram__canvas"
        viewBox={diagram.viewBox}
        aria-label={diagram.attrs["aria-label"] ?? "Diagram preview"}
        role="group"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          gesture.current = null;
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
      >
        <g
          ref={content}
          data-viewport="true"
          transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}
        >
          {diagram.elements.map(render)}
        </g>
      </svg>
      <p className="diagram__hint">
        {diagram.interactive
          ? "Drag the background to move the view. Drag a shape to move it temporarily. Select a shape for details; use arrow keys to move a focused shape."
          : "Drag anywhere to move the view. Individual shape movement is not available for this SVG."}
      </p>
      {chosen && (
        <section
          className="diagram__details"
          aria-label="Shape details"
          aria-live="polite"
        >
          <h4>{chosen.children.find((c) => c.tag === "title")?.text}</h4>
          <p>{chosen.children.find((c) => c.tag === "desc")?.text}</p>
        </section>
      )}
    </>
  );
}

export function DiagramField({
  value,
  onChange,
  disabled = false,
  errors = [],
  errorId,
}: {
  value: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  errors?: string[];
  errorId?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<"code" | "preview">(
    onChange ? "code" : "preview",
  );
  const [copyMessage, setCopyMessage] = useState("");
  const parsed = useMemo(() => {
    try {
      return { diagram: parseDiagram(value), error: null };
    } catch (error) {
      return {
        diagram: null,
        error: error instanceof Error ? error.message : "Check the SVG.",
      };
    }
  }, [value]);
  const messageId = errorId ?? `${id}-error`;
  const messages = [...(parsed.error ? [parsed.error] : []), ...errors];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage("SVG copied.");
    } catch {
      setMode("code");
      setCopyMessage("Copy failed. Select the SVG code and copy it manually.");
    }
  };
  const renderHeader = (viewControls?: ReactNode) => (
    <div className="diagram__header">
      <label htmlFor={id}>Diagram</label>
      <div className="diagram__controls">
        <div
          className="diagram__toolbar"
          role="group"
          aria-label="Diagram display"
        >
          <button
            type="button"
            aria-pressed={mode === "code"}
            onClick={() => setMode("code")}
            disabled={disabled}
          >
            Code
          </button>
          <button
            type="button"
            aria-pressed={mode === "preview"}
            onClick={() => setMode("preview")}
            disabled={disabled}
          >
            Preview
          </button>
          <button
            type="button"
            className="diagram__icon-button"
            onClick={copy}
            disabled={disabled || !value}
            aria-label="Copy SVG"
            title="Copy SVG"
          >
            <FiCopy aria-hidden="true" />
          </button>
        </div>
        {viewControls}
      </div>
    </div>
  );
  return (
    <div className="diagram">
      {mode === "preview" && parsed.diagram ? (
        <DiagramViewer
          key={value}
          diagram={parsed.diagram}
          renderHeader={renderHeader}
        />
      ) : (
        renderHeader()
      )}
      {mode === "code" && (
        <textarea
          id={id}
          className="diagram__code"
          value={value}
          readOnly={!onChange}
          onChange={(e) => {
            onChange?.(e.target.value);
            setCopyMessage("");
          }}
          disabled={disabled}
          aria-invalid={messages.length > 0}
          aria-describedby={messages.length ? messageId : undefined}
          placeholder="Paste SVG code here."
          rows={8}
          spellCheck={false}
        />
      )}
      <ValidationMessages id={messageId} messages={messages} />
      {mode === "preview" && !value && <p>No diagram saved yet.</p>}
      {mode === "preview" && parsed.error && (
        <p>Select Code to inspect, copy, or correct the diagram.</p>
      )}
      {copyMessage && <p role="status">{copyMessage}</p>}
    </div>
  );
}
