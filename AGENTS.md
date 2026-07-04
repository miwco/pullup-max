# AGENTS.md

## Goal
Build and maintain a small local-first app for one purpose only:
- increase the user's max strict pull-ups in one set

Do not turn this into a generic fitness app.

## Stack
- Vite
- React
- TypeScript
- Vitest
- ESLint
- Prettier
- vite-plugin-pwa
- IndexedDB
- no backend
- no auth

## Product constraints
- mobile-first
- compact UI
- offline-first
- local-only data
- JSON export/import backup
- fast logging
- minimal taps
- simple charts
- minimal dependencies

Do not add:
- social features
- nutrition/calorie tracking
- generic workout-builder flows
- bodybuilding templates
- account systems
- cloud sync in v1

## Core rule
The program is anchored by one true max-rep pull-up test.

A true max test is allowed only if:
- at least 7 days have passed since the last max test, and
- 2 full days have passed since the most recent logged workout of any kind

"No workout" means none of:
- max session
- support session
- recovery session
- bands
- hangs
- mobility logged as workout

If the freshness rule is not satisfied:
- do not recommend a max test

## Recommendation priority
Primary inputs:
- recent max reps
- max-test dates
- recent session counts
- most recent workout date

Secondary inputs:
- fatigue
- elbow pain
- shoulder pain
- failure point

If secondary inputs are missing, the app must still work well.

## Trend rules
Use these exact rules.

### Rising
- latest max > current baseline max

### Stable
- one max test may be 1 rep below baseline
- the next max test must return to at least baseline
- example: 12 -> 11 -> 12 = stable

### Falling
- two max tests in a row below baseline
- example: 12 -> 11 -> 11 = falling
- example: 12 -> 11 -> 10 = falling

Do not invent a different trend system unless necessary.

## Deload rules
Be patient.

Do not deload:
- after one bad session
- while progress is still happening
- after one brief dip that returns to baseline

Use this order:
1. continue
2. reduce support stress
3. increase band-assisted work
4. soft deload
5. recovery deload

## Deload levels
### volume_reduction
Trigger:
- stable trend + rising fatigue across repeated exposures
Action:
- reduce support volume about 30-40%

### soft_deload
Trigger:
- falling trend + elevated fatigue
Action:
- reduce hard bodyweight work
- use more band-assisted work
- postpone or soften next max test

### recovery_deload
Trigger:
- falling trend + moderate/high joint pain
Action:
- no true max test
- easy band work
- hangs/scap work only if appropriate
- gradual return

## Phases
Use as states, not fixed calendar blocks.

### Build
- early cycle
- low exposure
- build tolerance
- clean volume, bands, hangs, scap work

### Develop
- regular exposure established
- more specific support work
- density, ladders, clusters, weak-point work

### Peak
- performance built
- reduce nonessential volume
- keep work specific and fresh

### Deload
- entered only when triggered by rules above

## Failure-point mapping
Shift emphasis only if the same failure point repeats across 2-3 max tests.

- start -> scapular pull-up, dead hang, active hang, band-assisted from dead hang, bottom-pause pull-up
- middle -> band-assisted full-range, cluster block, mid-pause pull-up, negative pull-up, density block
- finish -> top hold, top-half pull-up, band-assisted finish reps, short clusters
- grip/hang -> dead hang, active hang, moderate hanging volume
- general endurance -> density, ladders, clusters, band-assisted higher-rep work

## Default exercise list
- Pull-up
- Band-assisted pull-up
- Density pull-up block
- Ladder pull-up block
- Cluster pull-up block
- Dead hang
- Active hang
- Scapular pull-up
- Top hold
- Negative pull-up
- Bottom-pause pull-up
- Mid-pause pull-up
- Top-half pull-up

## Required screens
- Today
- Log Workout
- Workout history within Progress
- Exercise Library
- Settings / Rules
- Cycle Summary

Do not add major sections unless clearly needed.

## Optional Finish workout
The Finish tab is a fixed optional full-body accessory workout after the core
pull-up session. It is not a generic workout builder and must remain isolated
from max-test freshness, pull-up recommendations, phases, trends, and deloads.

- Back extension: 3 timed sets, starting at 45 seconds, with 105 seconds rest
- Ab exercise: fixed label, 3 timed sets, starting at 45 seconds, with 105
  seconds rest; the user chooses their preferred abdominal movement
- Dips: 10-set EMOM, starting at 2 reps, progressing two higher-rep sets at a
  time; work time is max(10 seconds, reps * 3)
- Squat jumps: starting at 10 reps, without an exercise timer
- Default rest between exercises: 120 seconds
- Timed exercises use a 10-second prep only before their first set
- There is no rest timer after the final exercise
- Rest defaults are user-editable and persisted
- Each exercise progresses independently after a pass; a fail preserves that
  exercise's next target

## Graph
Include a lightweight line chart:
- x-axis: date
- y-axis: max reps
- default view: current 3-month cycle
- clearly show cycle start, today, and cycle end

## Training load
Use "training load" in the UI rather than "volume points" because the score
combines work and small fatigue adjustments.

- passed exercises use a 1.00 fatigue factor
- failed exercises use a 1.08 fatigue factor
- clean max attempts use a 1.00 quality factor
- hard max attempts use a 1.05 quality factor
- very hard max attempts use a 1.10 quality factor
- max attempts must count in both workout and weekly load totals
- unscorable legacy entries display "Not scored", never a misleading zero
- weekly targets follow recent completed weeks and current cycle phase
- Build is slightly above baseline, Develop holds baseline, and Peak reduces it

## Greasing the groove
- GG is optional, very easy pull-up practice at about 40-60% of the current max
- log each mini-set separately with reps only
- each GG rep contributes 0.2 training-load points
- GG contributes to weekly training load and counts as pull-up work for max-day freshness
- GG does not count as a max or support session and does not appear as a full workout-history card

## Data and persistence
- use IndexedDB
- support JSON export/import
- validate imported data
- version export format

## Architecture
- keep business logic separate from UI
- keep recommendation logic in pure functions
- use explicit names
- prefer small modules
- prefer boring, reliable code
- avoid overengineering

Suggested structure:
- src/app
- src/features
- src/domain
- src/storage
- src/components
- src/lib
- src/test

## Tests
Write tests for:
- trend classification
- 2-full-day max-test freshness rule
- max-session-due logic
- phase selection
- deload selection
- failure-point mapping
- recommendation scenarios
- import/export validation

## UI rules
- dense but readable
- no oversized cards
- no dashboard fluff
- no fake gamification
- calm, practical, compact, fast

## Working style
Before adding features:
- check if they directly improve the max-pull-up workflow
- choose the simpler implementation
- keep v1 narrow
- do not create lasagna code
