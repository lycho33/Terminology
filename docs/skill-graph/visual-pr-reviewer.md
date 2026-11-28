# Visual PR reviewer

- Goal: Review open Terminology PRs from a panel beside the Codex chat.
- Approved brief: [Visual PR reviewer](https://chatgpt.com/space/page_3900e27b03188191bbef9dda92158b60).
- Branch: codex/visual-pr-reviewer.
- Comparison base: feature/skill-graph-orcehstration at 849986f9331766618ed9f9fe738ab692217a2cf2.
- Pilot: [PR #14](https://github.com/lycho33/Terminology/pull/14) at cfc2d1054619f4bcd0fbb6afa278f2985fa5891c.
- Delivery: [Draft PR #15](https://github.com/lycho33/Terminology/pull/15).
- Initial implementation commit: 9500584f82832344eb768e91ebfeb64fd259b4.
- Current role: UI Verifier. Current scenario: SC-2 at the user's request. Next action: review the shape motion and UI changes during test playback.

## Decisions

- GitHub supplies the PR list, linked issue, and diff. Use the description when there is no linked issue. Limit the list to active PRs, including drafts.
- Show an architecture map before PR selection. Use architecture-vision.png as the visual reference. Base the map labels and connections on current source.
- Keep the map in place after PR selection. Highlight the affected components. Show the behaviors and associated tests below the map. Call out missing tests.
- Put expandable behaviors and tests in the board sidebar. Selecting a test highlights its related components on the architecture map and opens its walkthrough on the same board.
- Highlight the file for the current implementation excerpt. Let the reviewer show a different excerpt on the map. Show the test inputs, results, and capture evidence on the same board.
- Send the notes that the reviewer selects. Use an explicit send action.
- The approved plan describes the expected workflow. The user did not record a separate system-change prediction.

## Expected and actual flow

~~~mermaid
flowchart LR
    chat["Codex chat"] -->|"opens loopback URL"| map["Architecture map"]
    github["GitHub"] -->|"open PRs and drafts"| picker["PR picker"]
    map --> picker
    picker -->|"selected PR and revision"| view["Map highlights and behavior list"]
    view -->|"selected test"| steps["Map highlights, test values, and UI evidence"]
    runner["Isolated browser runner"] -->|"named screenshots and result"| steps
    view -->|"behavior note"| drafts["Local drafts"]
    steps -->|"step note"| drafts
    drafts -->|"explicit send of selected notes"| github
~~~

The reviewer runs next to Terminology. Its own Node process reads GitHub
with CLI authentication. The fixed SVG report applies to the reviewed PR
head and base. Other revisions use the local Codex CLI to draft a report
from the intent, diff, and source. Those reports carry a draft label.

The screenshot reader uses the Playwright attachment pattern in the PR #14
SVG spec at line 19. It uses the isolated wrapper in docs/e2e-testing.md.
The capture code copies the reviewed commit and adds two calls in the
temporary test. The Save attachment comes from the existing test. The
reviewer checks the tested revision before it displays a screenshot.

Graphify read six PR #14 files. It found the update action at
frontend/src/actions.tsx:92, the mutation hook at frontend/src/hooks.tsx:48,
and the route definition at api/main.py:123. No graph edge joined the
frontend and API in this trial. The reviewer uses explicit source links
for the cross-layer path.

## SC-1 correction

The user rejected the PR picker as the first screen. The corrected screen
draws Frontend, API, and Knowledge graph before the API returns the open
PR list. PR #14 highlights Frontend and API. The browser verified that
Neo4j shows no direct changes. The selected PR shows behavior rows and
test buttons. A test button opens a dialog. Escape closes the dialog and
returns focus to the button.

The user requested file names in the changed-file list. The list label
uses the final part of each path. The browser check verified that
DiagramField.tsx displays by name and opens its full path at the PR head.

## SC-2 correction

The user asked to follow the implementation code with the selected
test's data. The dialog now shows source lines from the PR head next
to each step's input and result. SC-6 traces the saved SVG through the
edit form, Preview, Cancel, the submitted mutation, PATCH validation,
the Neo4j write, and the refreshed view. The fixture changes Client to
Browser. The walkthrough describes intermediate values from the source
and shows snapshots at the browser assertions. The endpoint rejects a
source request with a stale review revision.

The user found the result cramped in an 853 px Codex panel. The walkthrough
now fills the panel. The header has Previous, Next, and a step selector.
The test values sit above the full-width code. Screenshots, components,
and notes open on request. The browser checks layout at 853 px and 390 px.

## Board revision

The user asked for a board with behavior and test navigation beside the
map. Behaviors expand directly in the sidebar. Test selection keeps the
map visible and highlights the related components. For SC-6, the active
fixture label moves from the editor to the HTTP action, API, and graph,
then returns to the saved view. The Preview, Cancel, and Save steps show
browser screenshots. The step values remain fixture examples derived from
the test and source. The map motion does not record runtime calls.

## File highlight and workflow replay

The user asked to see the source file light up on the map while following
the implementation. A selected step marks its first source file. Each
excerpt also has a control that marks its own file. Play workflow advances
the fixture steps and Pause stops playback.

The reviewed SVG creation test opens Create term, fills the name, pastes
the saved SVG fixture, and clicks Preview. The replay uses the exact fixture
from the reviewed revision. It shows the DiagramField textarea passing the
SVG to CreateTermForm. The callback stores it in `newDiagram`
(`frontend/src/terms/Term.tsx:100-103`). DiagramField parses the value while
Code mode is active (`frontend/src/diagram/DiagramField.tsx:305-318`).
Preview changes `mode` (`:347-354`). The render passes `parsed.diagram`
to DiagramViewer (`:371-377`). Each step marks the current component and
source line. The intermediate frames come from the source and fixture.
The isolated browser test supplies the screen capture after Preview and
asserts that the app sends no create request.

The user reported that Next moved the view to the architecture map.
`reviewer/public/app.mjs:502` updates the map and the step, then focuses
the step selector with scroll prevented. The handler no longer scrolls to
the map. `reviewer/pilot.browser.mjs:165` checks exact scroll coordinates
before Next and after the excerpt loads at 853 px and 390 px widths.
Both passed. A direct click in Codex kept the viewport at 545 px.

## Data flow across all PR #14 tests

The user asked for the component and data flow in every test walkthrough.
The PR #14 report has 19 distinct tests and 24 links from behaviors to tests.
This includes four changed regression cases from the CRUD, HTTP validation,
and Neo4j suites that the sidebar did not previously link.
`reviewer/pilot.mjs` supplies ordered handoffs, fixture inputs and results,
source ranges, and named captures. `reviewer/public/app.mjs` shows the active
component, data, and code for each step. The API walkthrough identifies the
mock query and displays the rejection path that stops before the query.
The analyzer requests the same flow fields for other PR drafts.

The reviewer check opened each of the 24 test links and checked every step
for an active component, result, map file, and highlighted source. It also
checked the scroll position and captured the pan step. The isolated runs
passed 15 Chromium tests, three SVG API tests, and one Neo4j integration
test. The browser cases with named captures supplied screenshots. The
reviewer's note submission check used a simulated response.

## Animate the UI during test playback

The user asked to see the UI change in the other UI tests, as in the create
and preview example. All 14 distinct UI cases have a visual frame for each
step. `reviewer/pilot-ui.mjs` supplies frames. A frame can show the form,
code, diagram, validation text, selected shape, view transform, or pending
submit. `reviewer/public/app.mjs` renders the frame in the same step as the
component handoff and source. `reviewer/public/diagram-replay.mjs` moves the
shape and its connector endpoint together.

The animation reconstructs UI states from test fixtures and source. Pointer
movement uses illustrative geometry at the replay's scale. The keyboard step
uses the 10-unit offset from the test. The fixed name prefixes omit generated
suffixes. Named browser captures remain available at asserted checkpoints.
The HTTP and Python tests use data flow without a UI frame.

The browser regression visited all 24 test links. It checked that every
UI step had a frame. It checked moving connector coordinates, the two
shape descriptions, Docker zoom, and Browser → Client → Browser across
edit, cancel, and save. Chromium also confirmed that reduced motion
skips the diagram animation. The five reviewer tests passed.

## Acceptance evidence

| ID | Expected result | Result |
| --- | --- | --- |
| AC-1 | The Codex panel starts with an architecture map. Select an open PR or draft below it and see the affected areas. | Chromium confirmed that the map loaded while the live PR list was held. PR #14 highlighted Frontend and API. Unit tests check paging and filtering. |
| AC-2 | Show intent, changed components, behaviors, associated tests, and test gaps. | Chromium opened #14 and showed its description, changed components, test gaps, and the expandable behavior and test sidebar. Unit tests check linked-issue preference. A separate live request drafted a report for #13. |
| AC-3 | Select a test in the sidebar. Show fixture values and the related path on the board, highlight files, and show code and UI evidence. | Chromium passed SC-6 with isolated Neo4j. Preview, Cancel, and Save had screenshots. Chromium also checked the code ranges, fixture values and component highlights on the board, and transitions before and after the PATCH and database steps. |
| AC-4 | Send the selected notes to the reviewed PR revision. | The browser check intercepted the send and received one selected note. The other note remained local. Server tests verify the request, stale revision response, and duplicate submission ID. Live posting remains unverified. |

## Ordered user review

| ID | Criteria | Setup and actions | Expected result | Automated evidence | User review |
| --- | --- | --- | --- | --- | --- |
| SC-1 | AC-1 | Open the panel in Codex. Select draft PR #14 below the map. | Architecture appears first. The map highlights the areas changed by PR #14. | 01-architecture-map.png and 01-changed-file-names.png. Live GitHub and Chromium pass. | Earlier screen rejected. Revised screen pending. |
| SC-2 | AC-2, AC-3 | Select the create-and-preview test and play the SVG handoffs. Select the edit test to follow React, PATCH, and Neo4j. | See the UI animate with the handoff, source line and fixture result in each UI test. | 02-create-preview-replay.png and 02-test-walkthrough.png. Chromium checked all 24 test links. The isolated browser, SVG API, and Neo4j checks passed. | UI replay pending user review. |
| SC-3 | AC-4 | Save two notes. Select one, view the preview, and send it. | The selected note appears in the preview and submission. The other stays local. | 03-preview-selected-notes.png and simulated-submission.json. Simulated pass. | Pending |

## Commands and artifacts

- node --test reviewer/reviewer.test.mjs
- node --check reviewer/public/app.mjs
- npm run test:e2e --prefix frontend -- --project=chromium --grep 'SC-6 SVG:' from a temporary copy of PR #14
- REVIEWER_URL and TERMINOLOGY_REPO set for node reviewer/pilot.browser.mjs
- Pilot run: /private/tmp/terminology-pr14-pilot.Mnmvk4/frontend/e2e-artifacts/run-Y0M54W
- Browser evidence for SC-1 file labels: /private/tmp/terminology-reviewer-filenames-verification
- Browser evidence for the SC-2 code walkthrough: /private/tmp/terminology-reviewer-component-replay-verification
- SC-2 scroll evidence: /private/tmp/terminology-reviewer-scroll-verification/02-before-next.png and 02-after-next.png
- SC-2 component data flow evidence: /private/tmp/terminology-reviewer-all-flows/02-pan-data-flow.png
- Isolated PR #14 browser report: /private/tmp/terminology-all-review-tests.nqGD0N/frontend/e2e-artifacts/run-jERedE/results.json
- SVG API tests: `.venv/bin/python -m unittest discover -s tests -p test_svg_diagram.py`
- Neo4j integration: `python -m unittest discover -s tests -p test_neo4j_integration.py` from the archived PR head, with `NEO4J_TEST_URI` set to a new disposable loopback container.
- SC-2 UI replay evidence: /private/tmp/terminology-reviewer-ui-motion/02-shape-motion-replay.png
- Explanation HTML: /private/tmp/2026-11-27-explanation-visual-pr-reviewer.html
- The HTML validator passed. Headless Chromium rendered the report and exercised all five quiz interactions.

The browser check uses real GitHub reads. It simulates submission. Live
posting to PR #14 remains unverified.
