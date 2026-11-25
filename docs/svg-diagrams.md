# SVG diagrams

Paste SVG into the Diagram field. Select Preview to inspect it before saving.
After saving, the term opens with the diagram preview. Select Code to inspect or
copy the source. Select Edit on the term to change the source.

Start with [the complete example](skill-graph/examples/connected-shapes.svg).
This app supports the following version 1 format. It does not accept arbitrary
SVG exported by other tools without adapting it to this format.

## Format

- Use an `svg` root with `xmlns="http://www.w3.org/2000/svg"`, a positive-sized
  `viewBox`, and `data-diagram-version="1"`.
- Put each movable shape in a direct child `g`. Give it a unique `id`,
  `data-node="true"`, and `transform="translate(x y)"`.
- Include one nonempty `title` and one nonempty `desc` directly inside each group.
  The app shows these as plain text when the group is selected.
- Groups can contain rectangles, circles, ellipses, and text. A group must contain
  at least one rectangle, circle, or ellipse. Labels move with their group.
- Put a straight `line` directly under the root. Give it `data-source` and
  `data-target` matching group IDs, plus `x1`, `y1`, `x2`, and `y2` coordinates.
- Put arrow markers in `defs`. Each marker has a unique ID, a `viewBox`, `refX`,
  `refY`, positive `markerWidth` and `markerHeight`, and `orient="auto"`.
  Reference it from a line with `marker-end="url(#marker-id)"`.
- Arrow marker paths use straight segments (`M`, `L`, `H`, `V`, `Z`, or their
  lowercase forms). Curved connectors and automatic route planning are not part
  of this format. Endpoint movement preserves the original attachment offset.
- Use named or hexadecimal colors. Font families are `sans-serif`, `serif`, or
  `monospace`. Use `start`, `middle`, or `end` for `text-anchor`.
- Use finite coordinates from -1000000 to 1000000. Use at most 500 elements and
  100000 source characters. IDs start with a letter and contain up to 64 letters,
  digits, underscores, or hyphens.
- The supported format excludes scripts, event attributes, links, external
  resources, stylesheets, HTML, comments, declarations, and processing instructions.
  Use the namespace attribute on the SVG root. Paste the SVG without code fences.

The complete attribute and element lists are in
[`format.json`](../frontend/src/diagram/format.json). Both validators use this
file. When changing the format, update both value validators and the shared
accept/reject cases in `tests/fixtures/svg-cases.json`.

## Interaction

- Use Zoom in and Zoom out to change the scale.
- Drag the background to move the view.
- Drag a shape to move it and its labels. The connected endpoints follow.
- Click a shape to show its title and description. Dragging does not open details.
- Use Tab to focus controls and shapes. Use Enter or Space to select a shape.
  Use arrow keys to move a focused shape by 10 SVG units.
- Reset view restores the original positions and scale and closes details.

Movement is temporary. It does not change the editable source or database value.
Switching to Code and back, changing source, or reopening the term resets the
preview. Copy SVG always copies the entered or saved source. A clipboard failure
shows the code so it can be copied manually.

## Saving and errors

The Diagram field is optional. Clear it to remove the saved diagram. A nonempty
value must use the supported format. Validation errors keep the entered code
available for correction. The API also checks supplied nonempty values before
writing them. It reports `INVALID_SVG` on the `diagram` field.

Valid source is stored without trimming or rewriting it. Temporary view changes
are never serialized into the source. The existing diagram string property is
used; no new database field is required.

An old plain-text diagram remains available in Code view. Replace it with valid
SVG or clear it before submitting an edit that includes that value. No stored
content is automatically migrated or deleted.

## Implementation pattern

`DiagramField` owns Code/Preview and copying. `DiagramViewer` owns temporary
position and view state. The format parser returns a bounded element model;
React creates elements from that model. No raw pasted markup is inserted into
the document. Marker IDs are scoped to the viewer instance.

Use this shared field for create, edit, and saved views. Keep future persistent
changes in the source value and temporary interactions in the viewer. Keep
`TermNode`, HTTP payloads, and persistence queries as string-based contracts.

The Docker API image includes the shared format file. Rebuild that image after
changing the format. The browser build imports it directly.
