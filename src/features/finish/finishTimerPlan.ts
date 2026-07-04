import {
  FINISH_PREP_SECONDS,
  FINISH_SET_COUNT,
  getFinishDipWorkSeconds,
} from '../../domain/finishWorkout'

export interface WorkoutTimerStep {
  phase: 'prep' | 'work' | 'rest'
  seconds: number
  setNumber?: number
  instruction: string
}

export function createTimedSetSteps(
  label: string,
  workSeconds: number,
  restSeconds: number,
): WorkoutTimerStep[] {
  const steps: WorkoutTimerStep[] = [
    {
      phase: 'prep',
      seconds: FINISH_PREP_SECONDS,
      setNumber: 1,
      instruction: `Prepare for ${label}`,
    },
  ]

  for (let setNumber = 1; setNumber <= FINISH_SET_COUNT; setNumber += 1) {
    steps.push({
      phase: 'work',
      seconds: workSeconds,
      setNumber,
      instruction: label,
    })

    if (setNumber < FINISH_SET_COUNT) {
      steps.push({
        phase: 'rest',
        seconds: restSeconds,
        setNumber: setNumber + 1,
        instruction: `Next: set ${setNumber + 1}`,
      })
    }
  }

  return steps
}

export function createDipSteps(roundPlan: number[]): WorkoutTimerStep[] {
  const steps: WorkoutTimerStep[] = [
    {
      phase: 'prep',
      seconds: FINISH_PREP_SECONDS,
      setNumber: 1,
      instruction: `Set 1: ${roundPlan[0]} dips`,
    },
  ]

  roundPlan.forEach((reps, index) => {
    const setNumber = index + 1
    steps.push({
      phase: 'work',
      seconds: getFinishDipWorkSeconds(reps),
      setNumber,
      instruction: `${reps} dips`,
    })
    if (setNumber < roundPlan.length) {
      steps.push({
        phase: 'rest',
        seconds: 60,
        setNumber: setNumber + 1,
        instruction: `Next: ${roundPlan[index + 1]} dips`,
      })
    }
  })

  return steps
}
