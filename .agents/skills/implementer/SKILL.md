---
name: implementer
description: Implement a Terminology plan with repository patterns and tests against its acceptance criteria. Create or update the PR and a validated explain-diff-html report, then prepare UI review.
---

# Implementer

Read the repository root `AGENTS.md` and the current task record. Start
automatically after the Planner completes its plan and prediction exercise.
Do not add another plan approval step.

## Implement the plan

1. Check the current branch, working tree, comparison base, and plan. Preserve
   unrelated user changes. Do not include unrelated changes in the PR.
2. Trace the relevant behavior through source and tests. Find a suitable existing
   pattern and record a source example before using it.
3. If no suitable pattern exists, add the smallest useful pattern. Record why it
   was needed, where it lives, and when future changes should follow it. Use an
   existing relevant document or the task record. Avoid a new abstraction for a
   single use unless the behavior needs it.
4. Implement the planned behavior. Record differences from the plan. Resolve
   routine code choices directly. Return to the Planner for a material change
   to scope, behavior, or acceptance criteria.

## Verify the intended result

1. Add or update tests for changed app behavior. Choose assertions from the plan's
   observable acceptance criteria, not from the structure of the implementation.
2. Map every acceptance criterion to specific tests and results in the task
   record. Add regression coverage for corrected defects. Include applicable
   failure, empty, and recovery cases.
3. Use existing test conventions. Inspect `tests/test_api.py`,
   `frontend/tests/`, and relevant `frontend/e2e/*.spec.mjs` files.
4. Run the relevant tests and required checks. Use `.github/workflows/e2e.yml`
   and `frontend/package.json` to find current commands. Follow
   `docs/e2e-testing.md` for browser tests and setup. Use the isolated wrapper:

   ```sh
   npm run test:e2e --prefix frontend -- --project=chromium --grep '<scenario pattern>'
   ```

5. Distinguish real service tests from simulated responses. Record exact commands,
   results, and evidence paths. A skipped or blocked test is not a pass.
6. Correct failures within scope and repeat affected checks. Do not weaken a test
   or change acceptance criteria to hide a defect. For instruction-only changes,
   validate instructions and links; do not add app tests that only match text.

## PR and HTML

1. Review the complete intended diff against the recorded base. Update the change
   diagram to show the completed implementation. Explain material differences
   from the user's prediction and the Planner's expected map.
2. Commit and push the scoped changes. Create a PR, or update the existing PR for
   the task. Verify the base so prior branch work does not enter the new PR by
   accident. Explain behavior and validation evidence. Do not merge or deploy.
3. Use the installed `explain-diff-html` skill. The user's configured path is
   `/Users/lydiacho/.codex/skills/explain-diff-html/SKILL.md`. If it is absent,
   search the available skill catalog for the same skill. This helper is not a
   fourth workflow role. Read and follow its full instructions.
4. Generate the report from the actual diff and surrounding source. Save it
   outside the repository with the current local date. Include the actual change
   diagram and verification limits. Run the helper's validator and fix errors.
   Follow its browser inspection instructions. Do not claim interactions passed
   unless they were exercised.
5. Record the PR URL, commit, HTML path, validation results, and ordered scenario
   list. Report unavailable external tools without claiming the PR or HTML was
   created. Continue independent work, including available UI verification.

## Handoff and correction

Read `.agents/skills/ui-verifier/SKILL.md` and start with its first pending
scenario. If there is no visible UI effect, record the evidence for that result.

For a defect from the UI Verifier, preserve the scenario ID and user feedback.
Correct the defect, add or update its regression test, repeat affected checks,
and update the PR and HTML. Invalidate affected review evidence. Return to the
same scenario for review before proceeding to the next one.
