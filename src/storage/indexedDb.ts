import { createSeedData } from '../domain/defaults'
import { normalizeAppData } from '../domain/normalization'
import { withComputedRecommendation } from '../domain/selectors'
import type {
  AppData,
  FinishWorkoutDraft,
  WorkoutLogDraft,
} from '../domain/types'
import { todayDateString } from '../lib/date'

const DATABASE_NAME = 'pullup-max-db'
const DATABASE_VERSION = 8
const CURRENT_WORKOUT_DRAFT_ID = 'current-workout'
const CURRENT_FINISH_WORKOUT_DRAFT_ID = 'current-finish-workout'

const STORE_NAMES = {
  athleteProfile: 'athleteProfile',
  settings: 'settings',
  exercises: 'exercises',
  bodyweightEntries: 'bodyweightEntries',
  greaseGrooveEntries: 'greaseGrooveEntries',
  sessions: 'sessions',
  exerciseEntries: 'exerciseEntries',
  maxTests: 'maxTests',
  presetProgressions: 'presetProgressions',
  programTemplate: 'programTemplate',
  finishWorkout: 'finishWorkout',
  workoutDrafts: 'workoutDrafts',
} as const

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionToPromise(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAMES.athleteProfile)) {
        database.createObjectStore(STORE_NAMES.athleteProfile, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.settings)) {
        database.createObjectStore(STORE_NAMES.settings)
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.exercises)) {
        database.createObjectStore(STORE_NAMES.exercises, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.bodyweightEntries)) {
        database.createObjectStore(STORE_NAMES.bodyweightEntries, {
          keyPath: 'id',
        })
      }

      if (
        !database.objectStoreNames.contains(STORE_NAMES.greaseGrooveEntries)
      ) {
        database.createObjectStore(STORE_NAMES.greaseGrooveEntries, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.sessions)) {
        database.createObjectStore(STORE_NAMES.sessions, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.exerciseEntries)) {
        database.createObjectStore(STORE_NAMES.exerciseEntries, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.maxTests)) {
        database.createObjectStore(STORE_NAMES.maxTests, {
          keyPath: 'id',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.presetProgressions)) {
        database.createObjectStore(STORE_NAMES.presetProgressions, {
          keyPath: 'presetKey',
        })
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.programTemplate)) {
        database.createObjectStore(STORE_NAMES.programTemplate)
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.finishWorkout)) {
        database.createObjectStore(STORE_NAMES.finishWorkout)
      }

      if (!database.objectStoreNames.contains(STORE_NAMES.workoutDrafts)) {
        database.createObjectStore(STORE_NAMES.workoutDrafts, {
          keyPath: 'id',
        })
      }

      if (database.objectStoreNames.contains('recommendationState')) {
        database.deleteObjectStore('recommendationState')
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadStoredAppData(today = todayDateString()) {
  const database = await openDatabase()
  const transaction = database.transaction(
    Object.values(STORE_NAMES),
    'readonly',
  )

  try {
    const [
      athleteProfile,
      settings,
      exercises,
      bodyweightEntries,
      greaseGrooveEntries,
      sessions,
      exerciseEntries,
      maxTests,
      presetProgressions,
      programTemplate,
      finishWorkout,
    ] = await Promise.all([
      requestToPromise(
        transaction
          .objectStore(STORE_NAMES.athleteProfile)
          .get('athlete-default'),
      ),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.settings).get('current'),
      ),
      requestToPromise(transaction.objectStore(STORE_NAMES.exercises).getAll()),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.bodyweightEntries).getAll(),
      ),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.greaseGrooveEntries).getAll(),
      ),
      requestToPromise(transaction.objectStore(STORE_NAMES.sessions).getAll()),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.exerciseEntries).getAll(),
      ),
      requestToPromise(transaction.objectStore(STORE_NAMES.maxTests).getAll()),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.presetProgressions).getAll(),
      ),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.programTemplate).get('current'),
      ),
      requestToPromise(
        transaction.objectStore(STORE_NAMES.finishWorkout).get('current'),
      ),
    ])

    return normalizeAppData(
      {
        athleteProfile,
        settings,
        exercises,
        bodyweightEntries,
        greaseGrooveEntries,
        sessions,
        exerciseEntries,
        maxTests,
        presetProgressions,
        programTemplate,
        finishWorkout,
      },
      today,
    )
  } finally {
    database.close()
  }
}

export async function persistAppData(appData: AppData) {
  const database = await openDatabase()
  const transaction = database.transaction(
    Object.values(STORE_NAMES),
    'readwrite',
  )

  const athleteProfileStore = transaction.objectStore(
    STORE_NAMES.athleteProfile,
  )
  const settingsStore = transaction.objectStore(STORE_NAMES.settings)
  const exercisesStore = transaction.objectStore(STORE_NAMES.exercises)
  const bodyweightEntriesStore = transaction.objectStore(
    STORE_NAMES.bodyweightEntries,
  )
  const greaseGrooveEntriesStore = transaction.objectStore(
    STORE_NAMES.greaseGrooveEntries,
  )
  const sessionsStore = transaction.objectStore(STORE_NAMES.sessions)
  const exerciseEntriesStore = transaction.objectStore(
    STORE_NAMES.exerciseEntries,
  )
  const maxTestsStore = transaction.objectStore(STORE_NAMES.maxTests)
  const presetProgressionsStore = transaction.objectStore(
    STORE_NAMES.presetProgressions,
  )
  const programTemplateStore = transaction.objectStore(
    STORE_NAMES.programTemplate,
  )
  const finishWorkoutStore = transaction.objectStore(STORE_NAMES.finishWorkout)

  athleteProfileStore.clear()
  settingsStore.clear()
  exercisesStore.clear()
  bodyweightEntriesStore.clear()
  greaseGrooveEntriesStore.clear()
  sessionsStore.clear()
  exerciseEntriesStore.clear()
  maxTestsStore.clear()
  presetProgressionsStore.clear()
  programTemplateStore.clear()
  finishWorkoutStore.clear()

  athleteProfileStore.put(appData.athleteProfile)
  settingsStore.put(appData.settings, 'current')
  appData.exercises.forEach((exercise) => exercisesStore.put(exercise))
  appData.bodyweightEntries.forEach((entry) =>
    bodyweightEntriesStore.put(entry),
  )
  appData.greaseGrooveEntries.forEach((entry) =>
    greaseGrooveEntriesStore.put(entry),
  )
  appData.sessions.forEach((session) => sessionsStore.put(session))
  appData.exerciseEntries.forEach((entry) => exerciseEntriesStore.put(entry))
  appData.maxTests.forEach((maxTest) => maxTestsStore.put(maxTest))
  appData.presetProgressions.forEach((state) =>
    presetProgressionsStore.put(state),
  )
  programTemplateStore.put(appData.programTemplate, 'current')
  finishWorkoutStore.put(appData.finishWorkout, 'current')

  await transactionToPromise(transaction)
  database.close()
}

function upsertArrayDiff<T extends { id: string }>(
  store: IDBObjectStore,
  prev: readonly T[],
  next: readonly T[],
) {
  if ((prev as unknown) === (next as unknown)) return

  const prevMap = new Map(prev.map((item) => [item.id, item]))
  const nextMap = new Map(next.map((item) => [item.id, item]))

  for (const [id, item] of nextMap) {
    if (prevMap.get(id) !== item) {
      store.put(item)
    }
  }

  for (const id of prevMap.keys()) {
    if (!nextMap.has(id)) {
      store.delete(id)
    }
  }
}

function upsertPresetDiff(
  store: IDBObjectStore,
  prev: AppData['presetProgressions'],
  next: AppData['presetProgressions'],
) {
  if ((prev as unknown) === (next as unknown)) return

  const prevMap = new Map(prev.map((item) => [item.presetKey, item]))
  const nextMap = new Map(next.map((item) => [item.presetKey, item]))

  for (const [key, item] of nextMap) {
    if (prevMap.get(key) !== item) {
      store.put(item)
    }
  }

  for (const key of prevMap.keys()) {
    if (!nextMap.has(key)) {
      store.delete(key)
    }
  }
}

export async function persistAppDataDiff(prev: AppData, next: AppData) {
  if (prev === next) return

  const database = await openDatabase()
  const transaction = database.transaction(
    Object.values(STORE_NAMES),
    'readwrite',
  )

  transaction.objectStore(STORE_NAMES.athleteProfile).put(next.athleteProfile)
  transaction.objectStore(STORE_NAMES.settings).put(next.settings, 'current')
  transaction
    .objectStore(STORE_NAMES.programTemplate)
    .put(next.programTemplate, 'current')
  if (prev.finishWorkout !== next.finishWorkout) {
    transaction
      .objectStore(STORE_NAMES.finishWorkout)
      .put(next.finishWorkout, 'current')
  }

  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.exercises),
    prev.exercises,
    next.exercises,
  )
  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.bodyweightEntries),
    prev.bodyweightEntries,
    next.bodyweightEntries,
  )
  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.greaseGrooveEntries),
    prev.greaseGrooveEntries,
    next.greaseGrooveEntries,
  )
  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.sessions),
    prev.sessions,
    next.sessions,
  )
  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.exerciseEntries),
    prev.exerciseEntries,
    next.exerciseEntries,
  )
  upsertArrayDiff(
    transaction.objectStore(STORE_NAMES.maxTests),
    prev.maxTests,
    next.maxTests,
  )
  upsertPresetDiff(
    transaction.objectStore(STORE_NAMES.presetProgressions),
    prev.presetProgressions,
    next.presetProgressions,
  )

  await transactionToPromise(transaction)
  database.close()
}

export async function loadOrSeedAppData(today = todayDateString()) {
  const stored = await loadStoredAppData(today)

  if (stored) {
    return withComputedRecommendation(stored, today)
  }

  const seeded = withComputedRecommendation(createSeedData(today), today)
  await persistAppData(seeded)
  return seeded
}

export async function resetAppData(today = todayDateString()) {
  const seeded = withComputedRecommendation(createSeedData(today), today)
  await persistAppData(seeded)
  return seeded
}

export async function replaceAppData(
  nextData: AppData,
  today = todayDateString(),
) {
  const computed = withComputedRecommendation(nextData, today)
  await persistAppData(computed)
  return computed
}

export async function loadWorkoutDraft() {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readonly',
  )

  try {
    return ((await requestToPromise(
      transaction
        .objectStore(STORE_NAMES.workoutDrafts)
        .get(CURRENT_WORKOUT_DRAFT_ID),
    )) ?? null) as WorkoutLogDraft | null
  } finally {
    database.close()
  }
}

export async function persistWorkoutDraft(draft: WorkoutLogDraft) {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readwrite',
  )

  transaction.objectStore(STORE_NAMES.workoutDrafts).put(draft)

  await transactionToPromise(transaction)
  database.close()
}

export async function clearWorkoutDraft() {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readwrite',
  )

  transaction
    .objectStore(STORE_NAMES.workoutDrafts)
    .delete(CURRENT_WORKOUT_DRAFT_ID)

  await transactionToPromise(transaction)
  database.close()
}

export async function loadFinishWorkoutDraft() {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readonly',
  )

  try {
    return ((await requestToPromise(
      transaction
        .objectStore(STORE_NAMES.workoutDrafts)
        .get(CURRENT_FINISH_WORKOUT_DRAFT_ID),
    )) ?? null) as FinishWorkoutDraft | null
  } finally {
    database.close()
  }
}

export async function persistFinishWorkoutDraft(draft: FinishWorkoutDraft) {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readwrite',
  )

  transaction.objectStore(STORE_NAMES.workoutDrafts).put(draft)
  await transactionToPromise(transaction)
  database.close()
}

export async function clearFinishWorkoutDraft() {
  const database = await openDatabase()
  const transaction = database.transaction(
    STORE_NAMES.workoutDrafts,
    'readwrite',
  )

  transaction
    .objectStore(STORE_NAMES.workoutDrafts)
    .delete(CURRENT_FINISH_WORKOUT_DRAFT_ID)
  await transactionToPromise(transaction)
  database.close()
}
