# Visual PR reviewer

- Goal: Review open Terminology PRs from a panel beside the Codex chat.
- Approved brief: [Visual PR reviewer](https://chatgpt.com/space/page_3900e27b03188191bbef9dda92158b60).
- Branch: codex/visual-pr-reviewer.
- Comparison base: feature/skill-graph-orcehstration at 849986f9331766618ed9f9fe738ab692217a2cf2.
- Pilot: [PR #14](https://github.com/lycho33/Terminology/pull/14) at cfc2d1054619f4bcd0fbb6afa278f2985fa5891c.
- Delivery: [Draft PR #15](https://github.com/lycho33/Terminology/pull/15).
- Initial implementation commit: 9500584f82832344eb768e91ebfeb64fd259b4.
- Current role: UI Verifier. Current scenario: SC-2 at the user's request. Next action: review the code walkthrough with the user.

## Decisions

- GitHub supplies the PR list, linked issue, and diff. Use the description when there is no linked issue. Limit the list to active PRs, including drafts.
- Show an architecture map before PR selection. Use architecture-vision.png as the visual reference. Base the map labels and connections on current source.
- Keep the map in place after PR selection. Highlight the affected components. Show the behaviors and associated tests below the map. Call out missing tests.
- Open a separate walkthrough dialog when the user selects a test. Closing the dialog returns the user to the test list.
- Show the implementation code beside the test inputs and the result of each walkthrough step. Capture visible steps with the browser test and mark the revision tested.
- Send the notes that the reviewer selects. Use an explicit send action.
- The approved plan describes the expected workflow. The user did not record a separate system-change prediction.

## Expected and actual flow

~~~mermaid
flowchart LR
    chat["Codex chat"] -->|"opens loopback URL"| map["Architecture map"]
    github["GitHub"] -->|"open PRs and drafts"| picker["PR picker"]
    map --> picker
    picker -->|"selected PR and revision"| view["Map highlights and behavior list"]
    view -->|"selected test"| steps["Implementation code and test values"]
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

## Acceptance evidence

| ID | Expected result | Result |
| --- | --- | --- |
| AC-1 | The Codex panel starts with an architecture map. Select an open PR or draft below it and see the affected areas. | Chromium confirmed that the map loaded while the live PR list was held. PR #14 highlighted Frontend and API. Unit tests check paging and filtering. |
| AC-2 | Show intent, changed components, behaviors, associated tests, and test gaps. | Chromium opened #14 and showed its description, changed components, test gaps, and test buttons in the behavior list. Unit tests check linked-issue preference. A separate live request drafted a report for #13. |
| AC-3 | Open a test. Show actual code with fixture inputs, results, and browser screenshots where available. | Chromium passed SC-6 with isolated Neo4j. Preview, Cancel, and Save had screenshots. Chromium also checked the code ranges, fixture values in the dialog, and transitions before and after the PATCH and database steps. |
| AC-4 | Send the selected notes to the reviewed PR revision. | The browser check intercepted the send and received one selected note. The other note remained local. Server tests verify the request, stale revision response, and duplicate submission ID. Live posting remains unverified. |

## Ordered user review

| ID | Criteria | Setup and actions | Expected result | Automated evidence | User review |
| --- | --- | --- | --- | --- | --- |
| SC-1 | AC-1 | Open the panel in Codex. Select draft PR #14 below the map. | Architecture appears first. The map highlights the areas changed by PR #14. | 01-architecture-map.png and 01-changed-file-names.png. Live GitHub and Chromium pass. | Earlier screen rejected. Revised screen pending. |
| SC-2 | AC-2, AC-3 | Select SC-6. Step through React, PATCH, and Neo4j from the dialog. | See the implementation code, the tested values, and the label sequence Browser, Client, Browser. | 02-test-walkthrough.png. Isolated test and panel pass. | Pending |
| SC-3 | AC-4 | Save two notes. Select one, view the preview, and send it. | The selected note appears in the preview and submission. The other stays local. | 03-preview-selected-notes.png and simulated-submission.json. Simulated pass. | Pending |

## Commands and artifacts

- node --test reviewer/reviewer.test.mjs
- node --check reviewer/public/app.mjs
- npm run test:e2e --prefix frontend -- --project=chromium --grep 'SC-6 SVG:' from a temporary copy of PR #14
- REVIEWER_URL and TERMINOLOGY_REPO set for node reviewer/pilot.browser.mjs
- Pilot run: /private/tmp/terminology-pr14-pilot.Mnmvk4/frontend/e2e-artifacts/run-Y0M54W
- Browser evidence for SC-1 file labels: /private/tmp/terminology-reviewer-filenames-verification
- Browser evidence for the SC-2 code walkthrough: /private/tmp/terminology-reviewer-code-verification
- Explanation HTML: /private/tmp/2026-11-26-explanation-visual-pr-reviewer.html
- The HTML validator passed. Headless Chromium rendered the report and exercised all five quiz interactions.

The browser check uses real GitHub reads. It simulates submission. Live
posting to PR #14 remains unverified.
