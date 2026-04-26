import { createSeedData } from '../domain/defaults'
import { normalizeAppData } from '../domain/normalization'
import { withComputedRecommendation } from '../domain/selectors'
import type { AppData } from '../domain/types'
import { todayDateString } from '../lib/date'

const DATABASE_NAME = 'pullup-max-db'
const DATABASE_VERSION = 5

const STORE_NAMES = {
  athleteProfile: 'athleteProfile',
  settings: 'settings',
  exercises: 'exercises',
  bodyweightEntries: 'bodyweightEntries',
  sessions: 'sessions',
  exerciseEntries: 'exerciseEntries',
  maxTests: 'maxTests',
  presetProgressions: 'presetProgressions',
  programTemplate: 'programTemplate',
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
      sessions,
      exerciseEntries,
      maxTests,
      presetProgressions,
      programTemplate,
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
    ])

    return normalizeAppData(
      {
        athleteProfile,
        settings,
        exercises,
        bodyweightEntries,
        sessions,
        exerciseEntries,
        maxTests,
        presetProgressions,
        programTemplate,
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

  athleteProfileStore.clear()
  settingsStore.clear()
  exercisesStore.clear()
  bodyweightEntriesStore.clear()
  sessionsStore.clear()
  exerciseEntriesStore.clear()
  maxTestsStore.clear()
  presetProgressionsStore.clear()
  programTemplateStore.clear()

  athleteProfileStore.put(appData.athleteProfile)
  settingsStore.put(appData.settings, 'current')
  appData.exercises.forEach((exercise) => exercisesStore.put(exercise))
  appData.bodyweightEntries.forEach((entry) =>
    bodyweightEntriesStore.put(entry),
  )
  appData.sessions.forEach((session) => sessionsStore.put(session))
  appData.exerciseEntries.forEach((entry) => exerciseEntriesStore.put(entry))
  appData.maxTests.forEach((maxTest) => maxTestsStore.put(maxTest))
  appData.presetProgressions.forEach((state) =>
    presetProgressionsStore.put(state),
  )
  programTemplateStore.put(appData.programTemplate, 'current')

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
