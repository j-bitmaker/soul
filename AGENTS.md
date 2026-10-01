# Soul project guide

This repository contains a single-user public Goal Map. Keep the product a calm mental compass, not a task manager.

## Commands

- Install: `npm ci`
- Develop: `npm run dev`
- Test: `npm test`
- Coverage: `npm run test:coverage`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`
- Browser tests: `npm run e2e`

## Domain rules

- `Soul` and the three global clusters have fixed IDs and cannot be ordinary goals or Frontier items.
- The overview shows only Soul and the three directions (Cards or Orbit). Each direction card lists its goals that are neither queued nor archived: Active-lane goals first (marked with a dot), then the rest. There are no Active Frontier or Queue sections on the overview.
- A direction or goal page lists all its goals in one scrolling list, never in pages, in an automatic order: Active goals and the rest first, then the Queue, then the Archive (owner only). The old `visibleChildIds` field stays in the data but the UI no longer uses it.
- A goal is in the Active lane (at most five; the first is the Primary), in the Queue, or in neither; there are no Primary/Active/Maintain status labels. The owner sets the lane with Priority on the goal page in Edit mode.
- The owner edits in place, without a mode: name, meaning, current state, target, note, labels (also on the overview cards), milestones, reminders, and new goals (also on each direction card) are changed where they are shown. The Edit mode and its dialog are for the heavier actions (full editor, merge, archive, delete, priority select).
- The three directions can be shown as Cards (default) or as an Orbit: a ring around Soul with two-way lines to Soul and clockwise arrows from each direction to the next. The choice is remembered in the browser only; the Orbit is a view, never data.
- Goals and directions can carry free-form labels (small pills). Routines are no longer a separate category; old data migrates into labels on load.
- Keep optional details optional. A title is enough to create a goal.
- Preserve data when moving, archiving, importing, or merging goals. Never silently overwrite a newer remote revision.
- Deleting a goal is explicit, permanent, and always confirmed (prefer archiving). It removes the goal with everything nested under it, its Active or Queue entry, and every link to it, so no reference is left dangling.
- The entire map, including notes, is publicly readable. Firebase rules must authorize writes by the owner's UID.
- The Firestore rules accept only the top-level keys `schemaVersion`, `revision`, `nodes`, and `frontier`, and they are not deployed by CI. Keep new data inside `nodes` and `frontier` entries and never bump `schemaVersion` without deploying the rules.

## Definition of done

Run test, coverage, lint, typecheck, build, and browser smoke checks. Review the code and security rules before committing. Verify the deployed GitHub Pages URL on desktop and mobile.

## Remote workflow

- The owner preauthorizes ordinary pushes to this repository, including its existing CI and GitHub Pages workflow. No separate push approval is needed for Soul.
- Deploy every change automatically, without asking, unless the owner says otherwise (for example "don't deploy" or "only on the branch"). Once the Definition of done checks pass, merge the change into `main` (for example through a pull request), watch the "Verify and deploy" workflow until it finishes, and report its result. If the workflow fails, find the cause and fix it, or say what is blocking. Deploying never requires a force push or a rewrite of `main`.
- If the sandbox cannot reach the deployed site, say the live check was not done instead of reporting it as verified.
- Force pushes and remote history rewrites still require explicit approval.
