const LAST_BACKUP_AT_KEY = 'pullup-max:last-backup-at'
export const BACKUP_STALE_AFTER_DAYS = 14

export interface BackupFreshness {
  ageDays: number | null
  isDue: boolean
  label: string
}

export function readLastBackupAt() {
  try {
    return window.localStorage.getItem(LAST_BACKUP_AT_KEY)
  } catch {
    return null
  }
}

export function recordBackupCreated(at = new Date().toISOString()) {
  try {
    window.localStorage.setItem(LAST_BACKUP_AT_KEY, at)
  } catch {
    // Backup creation still succeeds when localStorage metadata is unavailable.
  }

  return at
}

export function getBackupFreshness(
  lastBackupAt: string | null,
  now = new Date(),
): BackupFreshness {
  if (!lastBackupAt) {
    return {
      ageDays: null,
      isDue: true,
      label: 'No backup yet',
    }
  }

  const backupTime = new Date(lastBackupAt).getTime()
  if (!Number.isFinite(backupTime)) {
    return {
      ageDays: null,
      isDue: true,
      label: 'Backup date unavailable',
    }
  }

  const ageDays = Math.max(
    0,
    Math.floor((now.getTime() - backupTime) / (24 * 60 * 60 * 1000)),
  )

  return {
    ageDays,
    isDue: ageDays >= BACKUP_STALE_AFTER_DAYS,
    label:
      ageDays === 0
        ? 'Backed up today'
        : `Last backup ${ageDays} day${ageDays === 1 ? '' : 's'} ago`,
  }
}
