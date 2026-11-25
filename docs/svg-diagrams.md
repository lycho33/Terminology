# SVG diagrams

Paste SVG into the Diagram field. Select Preview before saving. After saving,
the term opens with the diagram preview. Select Code to inspect or copy the
source. Select Edit on the term to change the source.

## Ordinary SVG preview

The [Docker image example](skill-graph/examples/docker-image.svg) can be pasted
without changes. It supports save, preview, zoom, pan, and reset. Comments,
source formatting, dimensions, and accessibility labels stay in the stored text.
The app does not add interaction metadata or serialize the preview back to SVG.

Supported drawing elements include rectangles, circles, ellipses, lines, paths,
polygons, polylines, text, nested groups, and local arrow markers. Groups can
inherit presentation attributes such as font family, weight, fill, and stroke.
SVG transform functions and path curves are supported for display.

- Use an `svg` root with `xmlns="http://www.w3.org/2000/svg"` and a `viewBox`
  with positive dimensions. Root width and height may be included.
- Comments are allowed. Titles and descriptions may have IDs. Accessibility
  labels are retained in the preview, with IDs scoped to the viewer instance.
- Use named, hexadecimal, RGB, or HSL colors. Font family lists are allowed.
- Use finite numeric coordinates from -1000000 to 1000000. Use at most 500
  elements, 20 nested levels, and 100000 UTF-16 source units.
- This is a supported subset of SVG, not support for every SVG feature. The
  format excludes scripts, event handlers, external resources, links, embedded
  HTML, stylesheets, style attributes, declarations, and processing instructions.
  Dimensions use numeric SVG units. Gradients, filters, images, and `use`
  elements are not supported in this version.

The complete element and attribute lists are in
[`format.json`](../frontend/src/diagram/format.json). Both validators use this
file. Keep their value checks and `tests/fixtures/svg-cases.json` in agreement.

## Optional shape movement

No interaction metadata is needed for saving or viewing a diagram. Dragging an
ordinary diagram moves the entire view. It does not move an individual shape.
The app enables shape movement only when the complete version 1 interaction
format is present. The [connected-shapes example](skill-graph/examples/connected-shapes.svg)
uses that format:

- The SVG root has `data-diagram-version="1"`.
- Each movable shape is a direct child `g` with a unique `id`,
  `data-node="true"`, and `transform="translate(x y)"`.
- Each group has one nonempty `title` and one nonempty `desc`. These supply the
  details shown when the shape is selected.
- Each group contains at least one rectangle, circle, or ellipse. It may also
  contain text labels. Shapes and labels move together.
- A straight `line` directly under the root identifies its groups with
  `data-source` and `data-target`, and includes `x1`, `y1`, `x2`, and `y2`.
  The line cannot have an additional transform. Each endpoint follows the
  temporary offset of its named group. Optional local markers follow the line.
- The root contains only these groups and lines, plus optional `defs`, `title`,
  and `desc`. Nested drawing groups, rotated groups, unmarked groups, or broken
  source/target metadata disable shape movement for the whole diagram.

Incomplete interaction metadata does not reject an otherwise supported SVG.
The app falls back to viewing it. It does not guess shape boundaries or
connections. Invalid SVG content, such as an external marker reference, still
produces an error.

## Controls and persistence

Use the plus and minus buttons to change the scale. Use the copy icon to copy
the source. These icons have accessible names and tooltips. The controls share
one row with Code/Preview and Reset. Help text appears below the image.
The controls and code input follow the app light/dark theme. Drag the background to pan. For
an ordinary SVG, drag anywhere to pan. Reset view restores the initial view.
For annotated diagrams, drag a shape to move it temporarily, or select it for
details. Tab focuses each movable group; arrow keys move it by 10 SVG units.
Enter or Space shows its details.

All movement is temporary. It does not change the source or database value.
Switching to Code and back, changing source, or reopening resets the preview.
Copy SVG copies the entered or saved source. If copying fails, Code view remains
available for manual selection and copying.

The Diagram field is optional. Clear it to remove the saved diagram. Validation
errors preserve the input for correction. The API validates supplied nonempty
values before a write and reports `INVALID_SVG` on the `diagram` field.
Legacy plain text remains readable in Code view and requires replacement or
clearing before an edit can be saved. No stored data is automatically migrated.

## Implementation pattern

`DiagramField` owns Code/Preview and copying. The parser validates passive SVG
content and separately decides whether shape movement is available.
`DiagramViewer` renders approved React elements and keeps temporary view state.
No raw pasted markup is inserted into the document. Marker and accessibility
references are scoped together so multiple previews do not share IDs.

The original source remains the persistence value. Keep the existing TermNode,
HTTP payload, and database queries as string contracts. The API Docker image
includes the shared format file and must be rebuilt when the format changes.
