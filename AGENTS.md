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
- Show at most five direct goals in a focused context. Active Frontier has at most five entries; the first is the Primary (lead card). Further goals wait in the Queue. Order is priority, set by reordering or dragging; there are no Primary/Active/Maintain status labels.
- Goals and directions can carry free-form labels (small pills). Routines are no longer a separate category; old data migrates into labels on load.
- Keep optional details optional. A title is enough to create a goal.
- Preserve data when moving, archiving, importing, or merging goals. Never silently overwrite a newer remote revision.
- The entire map, including notes, is publicly readable. Firebase rules must authorize writes by the owner's UID.
- The Firestore rules accept only the top-level keys `schemaVersion`, `revision`, `nodes`, and `frontier`, and they are not deployed by CI. Keep new data inside `nodes` and `frontier` entries and never bump `schemaVersion` without deploying the rules.

## Definition of done

Run test, coverage, lint, typecheck, build, and browser smoke checks. Review the code and security rules before committing. Verify the deployed GitHub Pages URL on desktop and mobile.

## Remote workflow

- The owner preauthorizes ordinary pushes to this repository, including its existing CI and GitHub Pages workflow. No separate push approval is needed for Soul.
- Deploy every change automatically, without asking, unless the owner says otherwise (for example "don't deploy" or "only on the branch"). Once the Definition of done checks pass, merge the change into `main` (for example through a pull request), watch the "Verify and deploy" workflow until it finishes, and report its result. If the workflow fails, find the cause and fix it, or say what is blocking. Deploying never requires a force push or a rewrite of `main`.
- If the sandbox cannot reach the deployed site, say the live check was not done instead of reporting it as verified.
- Force pushes and remote history rewrites still require explicit approval.
