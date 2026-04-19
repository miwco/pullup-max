# Pull-up Max v3.2

Pull-up Max is a compact, local-first pull-up app built for one job only:
improving the maximum number of strict pull-ups in one set.

It is not a generic fitness app, not a workout builder, not a social product,
and not a media or coaching platform.

## Stack

- Vite
- React
- TypeScript
- Vitest
- ESLint
- Prettier
- `vite-plugin-pwa`
- IndexedDB

No backend, no auth, no cloud sync, no SSR.

## What v3.2 includes

- `Today`: next recommendation, Max readiness, days since last max, days since
  last workout, current baseline max, current phase, weekly volume target, and
  a short explanation
- `Log Workout`: fast logging for `max` and `support` sessions only, with
  editable prefilled workout rows from the default program and an optional video
  link on Max days
- `History`: best maxes, max-session history, recent support volume, and recent
  workouts, including saved Max-day video links and snapped bodyweight when
  available
- `Progress`: variable cycle line chart with cycle start, today, and cycle end
  clearly marked, plus optional bodyweight overlay
- `Exercise Library`: editable built-in exercise list plus custom exercises
- `Settings`: main movement, cycle date, cycle length, sensitivities,
  bodyweight, bands, editable Max/Support default blocks, JSON backup, and
  reset
- `Cycle Summary`: cycle progress, baseline max, cycle best, session counts,
  and concise summary text

## Default program

The app ships with an editable two-session default plan.

### Max day

- Warm-up:
  - Dead hang 20 sec
  - Scapular pull-ups 2 x 5
  - Easy band-assisted pull-ups 2 x 5
  - Easy bodyweight set at about 30 percent of usual max
- Main set:
  - 1 all-out max set of strict pull-ups
- Volume block:
  - EMOM 10 minutes
  - 4 reps every minute by default
- Finisher:
  - Top hold 2 x 20 sec

### Support day

- Main pull-up practice:
  - 6 sets of 3-6 clean reps
  - bodyweight or band-assisted
- Automatic weak-point block from the most recent Max-day failure point:
  - `top`
  - `middle`
  - `start/bottom`
  - `grip`
- Fallback support block when the latest failure point is missing or `not sure`

Every section is editable in Settings. The app stays opinionated, but not rigid.

## Recommendation rules

The app is anchored to one true max-rep pull-up test.

Primary inputs:

- recent max results
- max-session dates
- recent session count
- most recent workout date

Optional modifiers:

- fatigue
- elbow pain
- shoulder pain
- failure point

### Max readiness rule

A Max day is recommended only when:

- 2 full days have passed since the most recent logged workout of any kind
- or more than 5 full days have passed without any logged training

In practice, the app uses the simple two-session rule:

- if `daysSinceLastWorkout >= 3`, recommend `Max`
- otherwise recommend `Support`

If readiness is not satisfied, the app does not recommend a Max day.

### Trend rules

- `rising`: latest max is above the current baseline max
- `stable`: one max test may dip 1 rep below baseline if the next one returns to
  at least baseline
- `falling`: two max tests in a row are below baseline

### Simplified reaction logic

- If Max is ready, recommend `Max`
- If Max is not ready, recommend `Support`
- If the trend is `falling`, keep the same two-session structure but make the
  support recommendation easier and cleaner
- High fatigue or joint pain never creates a separate workout type; it only
  softens the Support-day content

## Cycle phases

The cycle length is editable from `30` to `365` days.

Each active cycle is split into:

- `build`
- `develop`
- `competition-prep`

The recommendation engine keeps the same two-session model, but Support work is
adjusted by phase:

- `build`: cleaner, easier Support bias
- `develop`: normal default behavior
- `competition-prep`: lighter, shorter Support work to stay fresh

## Bodyweight and video review

- Bodyweight is logged from `Today`, not from workout logging
- New Max results automatically snapshot the latest saved bodyweight
- Max results can store one external `http` or `https` video URL for later form
  review
- The app does not upload, embed, or analyze video

## Weekly volume tracking

The app tracks weighted weekly volume so different support exercises can still
roll up into one practical target.

- Pull-up reps count highest
- Band-assisted and partial-range reps count a bit less
- Holds and hangs convert seconds into smaller point values
- Weekly target volume rises gradually by a small margin
- If Max results start falling, the app applies a brake and lowers the current
  weekly target
- `Today` shows completed volume, target volume, and how much is still left for
  the week

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

Write formatting:

```bash
npm run format
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

Use HTTPS in production because the app relies on PWA installation and
IndexedDB.

## Offline, backup, and persistence

- local-only data storage in IndexedDB
- installable PWA with offline support
- JSON export/import backup
- versioned export format with validation before import
- import normalization for legacy v2 backups

## Project structure

```text
src/
  app/          app shell, routing, context
  components/   reusable UI primitives and charts
  domain/       types, defaults, selectors, recommendation engine, import/export
  features/     screen-level modules
  lib/          small utilities
  storage/      IndexedDB persistence
  test/         Vitest coverage for recommendation logic and import/export
```

## Notes

- The default exercise library is preloaded, so the app works without setup.
- Pure training logic lives in `src/domain`; UI files do not contain the core
  recommendation rules.
- Backup exports use schema version `4`.
- Legacy `recovery` and `deload` sessions are normalized to `support` on import.
