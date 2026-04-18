const DAY_IN_MS = 1000 * 60 * 60 * 24

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function todayDateString(referenceDate = new Date()) {
  const year = referenceDate.getFullYear()
  const month = pad(referenceDate.getMonth() + 1)
  const day = pad(referenceDate.getDate())

  return `${year}-${month}-${day}`
}

export function startOfLocalDay(dateString: string) {
  const [year = 1970, month = 1, day = 1] = dateString.split('-').map(Number)

  return new Date(year, month - 1, day)
}

export function diffInDays(fromDate: string, toDate: string) {
  const diffMs =
    startOfLocalDay(toDate).getTime() - startOfLocalDay(fromDate).getTime()
  return Math.max(0, Math.round(diffMs / DAY_IN_MS))
}

export function addDays(dateString: string, days: number) {
  const date = startOfLocalDay(dateString)
  date.setDate(date.getDate() + days)

  return todayDateString(date)
}

export function formatLongDate(dateString: string) {
  return startOfLocalDay(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatShortDate(dateString: string) {
  return startOfLocalDay(dateString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export function isWithinLastDays(
  targetDate: string,
  days: number,
  referenceDate: string,
) {
  return diffInDays(targetDate, referenceDate) <= days
}

export function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function isIsoDateTime(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value)
}

export function compareDateAsc(left: string, right: string) {
  return startOfLocalDay(left).getTime() - startOfLocalDay(right).getTime()
}
