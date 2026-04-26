# Pull-up Max

Pull-up Max is a compact, local-first app for one job only:
improving the maximum number of strict pull-ups in one set.

It is not a generic fitness app, not a workout builder, and not a social
product.

## Stack

- Vite
- React
- TypeScript
- Vitest
- ESLint
- Prettier
- `vite-plugin-pwa`
- IndexedDB

No backend, no auth, and no cloud sync.

## Current scope

- `Today`: recommendation, readiness snapshot, weekly volume, and fast
  bodyweight save
- `Workout`: fast logging for `max` and `support` sessions only
- `History`: chronological workout log and optional weight log
- `Progress`: one cycle-based max-rep chart with optional bodyweight overlay,
  plus recent max-attempt history
- `Program`: main movement, cycle planner, editable defaults, embedded exercise
  library, JSON backup, and reset

## Training model

- The app is anchored to one true max-rep pull-up test.
- A Max day is recommended only when:
  - at least 7 days have passed since the last max test
  - and 2 full days have passed since the most recent logged workout
- Support day content is driven by the most recent repeated weak point from Max
  logs.
- Preset workout rows are logged with `Pass` or `Fail` only.
- Preset targets progress conservatively over time.

## Default program

### Max day

- `EMOM pull-up block`
- `Top hold`

### Support day

- Support rows are generated from the most recent Max-day weak point
- Generic fallback uses:
  - `Scapular pull-ups`
  - `Dead hang`

The program stays editable, but the app remains narrowly focused on strict
pull-up max improvement.

## Cycle planning

The cycle is explicit and fixed until you change it.

- choose `Cycle start date`
- choose `Cycle end date`
- or set `Cycle length (days)` directly
- quick presets: `30`, `60`, and `90` days

The app syncs cycle start, end, and length bidirectionally.

## Offline, backup, and persistence

- local-only data storage in IndexedDB
- installable PWA with offline support
- JSON export/import backup
- versioned export format with validation before import
- normalization for legacy backups

## Local development

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

Run lint:

```bash
npm run lint
```

Check formatting:

```bash
npm run format:check
```

Create a production build:

```bash
npm run build
```

## Deployment

This is a static client app. After `npm run build`, deploy the `dist/` folder to
any static host such as:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages

Use HTTPS in production because the app relies on IndexedDB and PWA install
behavior.

## Project structure

```text
src/
  app/          app shell, routing, provider
  components/   reusable UI primitives and charts
  domain/       training logic, defaults, selectors, import/export
  features/     screen-level modules
  lib/          small utilities
  storage/      IndexedDB persistence
  test/         Vitest coverage
```

## Notes

- The default exercise library is preloaded, so the app works without setup.
- Core recommendation and training logic lives in `src/domain`.
- Backup exports currently use schema version `7`.
