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
- A goal is in the Active lane (at most five; the first is the Primary), in the Queue, or in neither; there are no Primary/Active/Maintain status labels. The owner changes it right on the overview: the marker at the end of a goal's row opens a menu to put the goal in or out of focus, move it up or down among goals of the same standing (in focus, queued, or neither), or send it to the Queue. A full Active lane refuses a sixth goal. The goal page has the same lane as a Priority select.
- There is no Edit mode: when the owner is signed in, every tool is simply there. Name, meaning, current state, target, note, labels (also on the overview cards and on Soul), milestones, reminders, and new goals (also on each direction card) are changed where they are shown; the goal page has buttons for the full editor dialog, merge, archive, and delete. Owner tools are never sticky or fixed and never capture touch gestures (no `touch-action: none`), so scrolling a page is never hindered.
- Each direction has a Warmth from 0 to 10 (how alive it is; the colder, the more it needs attention; whole numbers, directions only, stored as `warmth` inside the direction's node, so no rules or schema change). It sets the direction's palette, and the colder the louder: 0-2 Cold is coral red with the strongest frame, a thick top band, a soft glow, and a small "Needs attention" flag; 3-4 Cooling is orange and amber with a firmer frame; 5 Alive is neutral grey-blue; 6-7 Warm is almost neutral with a little green; 8-10 Very Warm is a calm muted green with no frame and no glow. The palette applies on the card, in the Orbit (node, value badge, arrows, and a panel under the diagram), and on the direction's page and the pages of its goals; a direction with no value keeps its own colour. The owner sets it by tapping one of eleven steps (nothing to drag, so scrolling is never hindered; tapping the chosen step clears it). The directions keep the same order at every width, desktop or phone, whatever their warmth: the colours and the flag alone show what needs attention. Every palette colour must keep 4.5:1 contrast on white.
- A goal can be tagged with one colour from a fixed palette of ten (red, orange, gold, green, teal, blue, indigo, violet, pink, slate), stored as `color` on the goal's node (goals only, never Soul or a direction; no rules or schema change). The owner picks it on the overview: one tap on the dot at the start of the goal's row, one tap on a colour (the dot is a quiet dashed ring until a colour is chosen; tapping the chosen colour again, or "No color", clears it). The palette is plain buttons, never a drag or a slider, so scrolling is never hindered. The colour shows as a dot on the cards, a band on a direction's list, and a dot on the goal's page, where the owner can change it too. A merged goal keeps its own colour or takes the other goal's when it has none.
- The three directions can be shown as Cards (default) or as an Orbit: a ring around Soul with two-way lines to Soul and clockwise arrows from each direction to the next. The choice is remembered in the browser only; the Orbit is a view, never data.
- Soul, directions, and goals can carry free-form labels (small pills); Soul's are shown centred under its meaning. In a direction card's footer the "Add a goal" field comes first and the direction's labels below it; the add buttons there are a soft forest green with just a "+" (no word) and the label pills a soft indigo, so they read as different things (labels keep 4.5:1 contrast). Soul's name and meaning stay fixed. Routines are no longer a separate category; old data migrates into labels on load.
- Keep optional details optional. A title is enough to create a goal.
- Preserve data when moving, archiving, importing, or merging goals. Never silently overwrite a newer remote revision.
- Deleting a goal is explicit, permanent, and always confirmed (prefer archiving). The owner can delete with one tap on a goal's row on the overview cards, from the goal page, and from the Archive. It removes the goal with everything nested under it, its Active or Queue entry, and every link to it, so no reference is left dangling.
- The entire map, including notes, is publicly readable. Firebase rules must authorize writes by the owner's UID.
- The Firestore rules accept only the top-level keys `schemaVersion`, `revision`, `nodes`, and `frontier`, and they are not deployed by CI. Keep new data inside `nodes` and `frontier` entries and never bump `schemaVersion` without deploying the rules.

## Definition of done

Run test, coverage, lint, typecheck, build, and browser smoke checks. Review the code and security rules before committing. Verify the deployed GitHub Pages URL on desktop and mobile.

## Remote workflow

- The owner preauthorizes ordinary pushes to this repository, including its existing CI and GitHub Pages workflow. No separate push approval is needed for Soul.
- Deploy every change automatically, without asking, unless the owner says otherwise (for example "don't deploy" or "only on the branch"). Once the Definition of done checks pass, merge the change into `main` (for example through a pull request), watch the "Verify and deploy" workflow until it finishes, and report its result. If the workflow fails, find the cause and fix it, or say what is blocking. Deploying never requires a force push or a rewrite of `main`.
- If the sandbox cannot reach the deployed site, say the live check was not done instead of reporting it as verified.
- Force pushes and remote history rewrites still require explicit approval.
