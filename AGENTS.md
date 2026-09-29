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
- Show at most five direct goals in a focused context. Active Frontier has at most five entries and one Primary.
- Keep optional details optional. A title is enough to create a goal.
- Preserve data when moving, archiving, importing, or merging goals. Never silently overwrite a newer remote revision.
- The entire map, including notes, is publicly readable. Firebase rules must authorize writes by the owner's UID.

## Definition of done

Run test, coverage, lint, typecheck, build, and browser smoke checks. Review the code and security rules before committing. Verify the deployed GitHub Pages URL on desktop and mobile.
