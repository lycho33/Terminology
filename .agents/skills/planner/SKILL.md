---
name: planner
description: Plan a Terminology app change from a rough idea. Interview the user through four knowledge groups, ask for a system-change prediction, and prepare the implementation handoff.
---

# Planner

Read the repository root `AGENTS.md` for routing and the shared task record.
Use this role for a new idea or a material change to an existing requirement.

## Interview

1. Record the rough idea and intended user outcome.
2. Inspect relevant source, tests, and UI conventions. Separate observed behavior
   from design proposals. Do not reveal the expected change diagram before the
   user completes the prediction exercise.
3. Maintain these four groups in the task record:

   | Group | Interview purpose |
   | --- | --- |
   | Known Knowns | Record what the user asked for, including scope and constraints. |
   | Known Unknowns | Resolve decisions the user knows are open. |
   | Unknown Knowns | Present concrete examples to expose unstated expectations. Mark them as assumptions until confirmed. |
   | Unknown Unknowns | Present relevant alternatives, missing cases, or better outcomes the user may not know are possible. Explain the consequence and cite evidence. |

4. Ask one question at a time. Wait for the answer. Use an example or a small
   choice when it makes the question easier to answer.
5. Choose questions that affect behavior, component boundaries, data, UI, or
   validation. Do not ask a fixed number of questions for each group.
6. Update the record after each answer. Stop the interview when enough information
   exists to define the plan. Keep low-impact assumptions visible.

## Plan and prediction exercise

1. State the intended behavior and non-goals. Define observable acceptance
   criteria. Include relevant failure and recovery behavior.
2. Describe the proposed user flow without giving the repository impact answer.
3. Ask: "Which parts of the system must change, and why?" Wait for the user's
   prediction. Ask a focused follow-up only if the reasoning is unclear.
4. Record the prediction before showing the system's answer. If the user elects
   to skip the exercise, record that choice and continue.
5. Trace the relevant execution path in current code. Show a Mermaid diagram of
   the expected changes. Distinguish parts that need edits from dependencies
   that only provide context. Cite file paths and line numbers.
6. Compare the prediction with the evidence. Explain each material difference.
   This is an expected change map. It cannot prove which files will be changed.
7. Finish the plan. Map each acceptance criterion to a test or another observable
   check. Create an ordered list of review scenarios with setup, actions,
   expected results, and acceptance criterion IDs. Include applicable error and
   empty states. Do not invent UI scenarios for work with no visible UI effect.

## Handoff

Save the decisions, criteria, scenario list, source references, and next action
in the shared task record. Resolve material open questions before the handoff.

Read `.agents/skills/implementer/SKILL.md` and start implementation automatically.
Do not ask the user to approve the plan again or say "implement". Return here
only if new evidence requires a material requirement decision.
