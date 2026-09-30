# Soul · Mental Compass

A small personal Goal Map. The overview states what Soul means, leads with the Primary goal of the Active Frontier (up to five goals in total, each with one quiet line of orientation), and then shows the three directions. Goals can remain title-only or carry milestones, routines, reminders, notes, and secondary links.

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

The map is one human-readable JSON document in Firestore. Each save uses a revision-checked transaction, so a stale device cannot silently replace a newer map. The Export JSON action downloads a backup; owner-only Import JSON validates it before replacement.

```sh
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
npm run e2e
```
