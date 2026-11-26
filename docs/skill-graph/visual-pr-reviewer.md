# Visual PR reviewer

- Goal: Review open Terminology PRs from a panel beside the Codex chat.
- Approved brief: [Visual PR reviewer](https://chatgpt.com/space/page_3900e27b03188191bbef9dda92158b60).
- Branch: codex/visual-pr-reviewer.
- Comparison base: feature/skill-graph-orcehstration at 849986f9331766618ed9f9fe738ab692217a2cf2.
- Pilot: [PR #14](https://github.com/lycho33/Terminology/pull/14) at cfc2d1054619f4bcd0fbb6afa278f2985fa5891c.
- Delivery: [Draft PR #15](https://github.com/lycho33/Terminology/pull/15).
- Implementation commit: 9500584f82832344eb768e91ebfeb64fd259b4.
- Current role: UI Verifier. Current scenario: SC-1. Next action: record the user's review of the PR picker.

## Decisions

- GitHub supplies the PR list, linked issue, and diff. Use the description when there is no linked issue. Limit the list to active PRs, including drafts.
- Use stable components and show the changed parts. Map changed or new behaviors to tests. Mark each missing test and each known coverage gap.
- Use fixed values from test inputs. Capture visible steps with the browser test. Mark the revision tested.
- Send the notes that the reviewer selects. Use an explicit send action.
- The approved plan describes the expected workflow. The user did not record a separate system-change prediction.

## Expected and actual flow

~~~mermaid
flowchart LR
    chat["Codex chat"] -->|"opens loopback URL"| picker["Open PR picker"]
    github["GitHub"] -->|"PR list, linked issue, diff"| picker
    picker -->|"selected PR and revision"| view["Behavior list and component map"]
    view -->|"selected test"| steps["Fixture walkthrough"]
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

## Acceptance evidence

| ID | Expected result | Result |
| --- | --- | --- |
| AC-1 | The Codex panel shows open PRs and drafts. Select a PR. | Live GitHub and Chromium showed draft #14 plus open #13 and #12. Unit tests check paging and filtering. |
| AC-2 | Show intent, changed components, behaviors, associated tests, and test gaps. | Chromium opened #14 and showed its description, changed components, and test gaps. Unit tests check linked-issue preference. A separate live request drafted a report for #13. |
| AC-3 | Show the test path, concrete values, source, screenshots, and the tested revision. | Chromium passed SC-6 with isolated Neo4j. Preview, Cancel, and Save had screenshots. The browser check also ran SC-6 from the panel. |
| AC-4 | Send the selected notes to the reviewed PR revision. | The browser check intercepted the send and received one selected note. The other note remained local. Server tests verify the request, stale revision response, and duplicate submission ID. Live posting remains unverified. |

## Ordered user review

| ID | Criteria | Setup and actions | Expected result | Automated evidence | User review |
| --- | --- | --- | --- | --- | --- |
| SC-1 | AC-1 | Open the panel in Codex and select draft PR #14. | The list contains open PRs and drafts. The panel opens PR #14. | 01-open-pull-requests.png. Live GitHub and Chromium pass. | Pending |
| SC-2 | AC-2, AC-3 | Open the edit behavior. Select SC-6. Step through Preview, Cancel, and Save. | See the components, source, gaps, and label sequence Browser, Client, Browser. | 02-test-walkthrough.png. Isolated test and panel pass. | Pending |
| SC-3 | AC-4 | Save two notes. Select one, view the preview, and send it. | The selected note appears in the preview and submission. The other stays local. | 03-preview-selected-notes.png and simulated-submission.json. Simulated pass. | Pending |

## Commands and artifacts

- node --test reviewer/reviewer.test.mjs
- node --check reviewer/public/app.mjs
- npm run test:e2e --prefix frontend -- --project=chromium --grep 'SC-6 SVG:' from a temporary copy of PR #14
- REVIEWER_URL and TERMINOLOGY_REPO set for node reviewer/pilot.browser.mjs
- Pilot run: /private/tmp/terminology-pr14-pilot.Mnmvk4/frontend/e2e-artifacts/run-Y0M54W
- Browser evidence: /private/tmp/terminology-reviewer-verification
- Explanation HTML: /private/tmp/2026-11-26-explanation-visual-pr-reviewer.html
- The HTML validator passed. Headless Chromium rendered the report and exercised all five quiz interactions.

The browser check uses real GitHub reads. It simulates submission. Live
posting to PR #14 remains unverified.
