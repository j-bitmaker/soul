# Soul · Mental Compass

A small personal Goal Map. The overview states what Soul means (Soul can carry labels, shown as pills under its meaning) and shows the three directions (as Cards, or as an Orbit: a ring around Soul with arrows to Soul and from each direction to the next; the choice is remembered in the browser). Each direction has a Warmth from 0 to 10, how alive it is (the colder, the more it needs attention): the owner taps one of eleven steps on its card (or in the Orbit, or on its page), and the direction takes on a palette that gets louder as it cools. 8-10 Very Warm is a calm muted green with no frame or glow, 6-7 Warm is almost neutral, 5 Alive is grey-blue, 3-4 Cooling is amber and orange with a firmer frame, and 0-2 Cold is coral red with the strongest frame and a small "Needs attention" flag. The directions keep the same order at every width, on a phone too. Each direction card lists its goals that are neither queued nor archived, with their labels; goals in focus come first, marked with a dot. When signed in as owner there is no Edit switch: everything is editable where it is shown. On each card row the owner can add a label, delete the goal (always after a confirmation), and open the priority menu from the dot to put the goal in or out of focus, move it up or down, or send it to the Queue; each card also has an "Add a goal" line. A direction or goal page shows all its goals in one scrolling list (the rest, then the Queue, then the Archive for the owner). A goal is in the Active lane (at most five, the first is the Primary), in the Queue, or in neither; the goal page has the same Priority as a select, plus the full editor, merge, archive, and delete. Names, meanings, current state, targets, notes, labels, milestones, and reminders are edited right where they are shown. Goals can remain title-only or carry milestones, free-form labels (small pills), reminders, notes, and secondary links. A goal can be archived (kept, hidden) or deleted for good after a confirmation that counts what goes with it.

## Run locally

```sh
npm ci
npm run dev
```

Without Firebase settings, the app runs as a clearly labeled local preview. Preview edits stay in that browser. For a connected setup, copy `.env.example` to `.env.local` and fill the Firebase web configuration and owner UID. Never commit `.env.local`.

## Firebase setup

1. Create a Firebase project on the Spark plan and register a Web app. Copy its web configuration into `.env.local` and the matching GitHub Actions secrets named in `.env.example`.
2. Enable Cloud Firestore and Firebase Authentication with Email/Password. In Authentication, create one owner user and copy its UID into `VITE_FIREBASE_OWNER_UID`. The app has no registration form.
3. In Firestore, create `config/owner` with a string field `uid` set to that same UID. The document is private under `firestore.rules`.
4. Deploy `firestore.rules` with the Firebase CLI (`firebase deploy --only firestore:rules --project PROJECT_ID`) or paste the rules into the Firestore Rules editor. Verify that an unauthenticated browser can read `maps/public` but cannot write it.
5. Sign in as owner in the deployed app, make a first edit, and save. That creates `maps/public` from the 15 provisional goals. Export the JSON immediately as an initial backup.

The entire map, including notes, is publicly readable. Keep private thoughts elsewhere.

## GitHub Pages

Create a public `soul` repository, push this project to `main`, and set Pages **Build and deployment** to **GitHub Actions**. Configure the five `VITE_FIREBASE_*` Actions secrets before pushing. The workflow checks lint, types, tests, and build before publishing. Its build refuses missing Firebase settings.

The PWA uses `/soul/` as its base path. If the repository name changes, update `base`, `start_url`, and `scope` in `vite.config.ts`.

## Data and checks

The map is one human-readable JSON document in Firestore. Each save uses a revision-checked transaction, so a stale device cannot silently replace a newer map. The Export JSON action downloads a backup; owner-only Import JSON validates it before replacement. Maps saved by earlier versions (routines, Primary/Active/Maintain statuses) load as labels and an ordered Frontier without changing anything until the owner saves; export a backup before the first save.

```sh
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
npm run e2e
```
