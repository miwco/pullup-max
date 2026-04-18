# Pull-up Max

Pull-up Max is a mobile-first, offline-first web app for one job only: helping a lifter improve the maximum number of strict pull-ups in a single set.

It is not a generic fitness app, not a workout builder, and not a training social product. The recommendation engine is anchored to recent max-rep tests, then refined by recent session density plus optional fatigue, joint pain, and repeated failure-point signals.

## Stack

- Vite
- React
- TypeScript
- Vitest
- ESLint
- Prettier
- `vite-plugin-pwa`
- IndexedDB

No backend, no auth, no SSR.

## Product flow

- `Today`: current phase, next workout recommendation, days since last max test, and a one-tap path to logging
- `Log Workout`: fast session logging for max, support, recovery, and deload sessions
- `History`: max trend, recent workouts, support volume trend, cycle best, and all-time best
- `Exercise Library`: editable default exercise list with add, edit, archive, restore, and delete
- `Settings`: main movement, cycle date, recovery sensitivities, support method preferences, backup, and reset
- `Cycle Summary`: rolling 3-month overview with counts, deload periods, and a concise cycle readout

## Recommendation behavior

The engine is intentionally conservative:

- one bad max session does not trigger a deload
- rising max results prevent unnecessary deloading
- stable results stay in normal training unless fatigue clearly rises
- deloads require repeated decline or stagnation plus supporting stress signals
- repeated failure-point reports shift support emphasis only after pattern repetition

Pure business logic lives in `src/domain`. UI components consume computed state but do not contain training rules.

## Local development

### Install

```bash
npm install
```

### Run the app

```bash
npm run dev
```

### Run tests

```bash
npm run test
```

### Lint

```bash
npm run lint
```

### Format

```bash
npm run format
```

### Production build

```bash
npm run build
```

## Deployment

This is a static client app. After `npm run build`, deploy the `dist/` folder to any static host.

Typical choices:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Because the app uses PWA installability and IndexedDB, production hosting should use HTTPS.

## Backup and restore

- Export uses a versioned JSON bundle.
- Import validates the bundle structure before replacing local data.
- All persistence is local to the device/browser unless the user exports the backup manually.

## Project structure

```text
src/
  app/          app shell, routing, context
  components/   reusable UI primitives
  domain/       types, defaults, selectors, recommendation engine, import/export
  features/     screen-level modules
  lib/          small utilities
  storage/      IndexedDB repository
  test/         Vitest coverage for domain logic
```

## Notes

- Default data includes a pull-up-focused exercise library, so the app works immediately without manual setup.
- The app is designed to stay useful even when the user only logs date, session type, and max reps on max days.
- Install the PWA from the browser prompt or browser menu for the best phone experience.
