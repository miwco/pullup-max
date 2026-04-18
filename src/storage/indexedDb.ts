import { createSeedData } from '../domain/defaults'
import { withComputedRecommendation } from '../domain/selectors'
import type { AppData } from '../domain/types'
import { todayDateString } from '../lib/date'

const DATABASE_NAME = 'pullup-max-db'
const DATABASE_VERSION = 1

const STORE_NAMES = {
  athleteProfile: 'athleteProfile',
  settings: 'settings',
  exercises: 'exercises',
  sessions: 'sessions',
  exerciseEntries: 'exerciseEntries',
  maxTests: 'maxTests',
  recommendationState: 'recommendationState',
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

      if (
        !database.objectStoreNames.contains(STORE_NAMES.recommendationState)
      ) {
        database.createObjectStore(STORE_NAMES.recommendationState, {
          keyPath: 'id',
        })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadStoredAppData() {
  const database = await openDatabase()
  const transaction = database.transaction(
    Object.values(STORE_NAMES),
    'readonly',
  )

  try {
    const athleteProfileRequest = requestToPromise(
      transaction
        .objectStore(STORE_NAMES.athleteProfile)
        .get('athlete-default'),
    )
    const settingsRequest = requestToPromise(
      transaction.objectStore(STORE_NAMES.settings).get('current'),
    )
    const exercisesRequest = requestToPromise(
      transaction.objectStore(STORE_NAMES.exercises).getAll(),
    )
    const sessionsRequest = requestToPromise(
      transaction.objectStore(STORE_NAMES.sessions).getAll(),
    )
    const exerciseEntriesRequest = requestToPromise(
      transaction.objectStore(STORE_NAMES.exerciseEntries).getAll(),
    )
    const maxTestsRequest = requestToPromise(
      transaction.objectStore(STORE_NAMES.maxTests).getAll(),
    )
    const recommendationRequest = requestToPromise(
      transaction
        .objectStore(STORE_NAMES.recommendationState)
        .get('recommendation-current'),
    )
    const [
      athleteProfile,
      settings,
      exercises,
      sessions,
      exerciseEntries,
      maxTests,
      recommendationState,
    ] = await Promise.all([
      athleteProfileRequest,
      settingsRequest,
      exercisesRequest,
      sessionsRequest,
      exerciseEntriesRequest,
      maxTestsRequest,
      recommendationRequest,
    ])

    if (!athleteProfile || !settings || !recommendationState) {
      return null
    }

    return {
      athleteProfile,
      settings,
      exercises,
      sessions,
      exerciseEntries,
      maxTests,
      recommendationState,
    } satisfies AppData
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
  const sessionsStore = transaction.objectStore(STORE_NAMES.sessions)
  const exerciseEntriesStore = transaction.objectStore(
    STORE_NAMES.exerciseEntries,
  )
  const maxTestsStore = transaction.objectStore(STORE_NAMES.maxTests)
  const recommendationStore = transaction.objectStore(
    STORE_NAMES.recommendationState,
  )

  athleteProfileStore.clear()
  settingsStore.clear()
  exercisesStore.clear()
  sessionsStore.clear()
  exerciseEntriesStore.clear()
  maxTestsStore.clear()
  recommendationStore.clear()

  athleteProfileStore.put(appData.athleteProfile)
  settingsStore.put(appData.settings, 'current')
  appData.exercises.forEach((exercise) => exercisesStore.put(exercise))
  appData.sessions.forEach((session) => sessionsStore.put(session))
  appData.exerciseEntries.forEach((entry) => exerciseEntriesStore.put(entry))
  appData.maxTests.forEach((maxTest) => maxTestsStore.put(maxTest))
  recommendationStore.put(appData.recommendationState)

  await transactionToPromise(transaction)
  database.close()
}

export async function loadOrSeedAppData(today = todayDateString()) {
  const stored = await loadStoredAppData()

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
