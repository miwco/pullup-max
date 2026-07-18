interface NoticeBannerProps {
  actionLabel?: string
  onAction?: () => void
  message: string
  tone: 'info' | 'error' | 'success'
  onDismiss: () => void
}

export function NoticeBanner({
  actionLabel,
  message,
  tone,
  onAction,
  onDismiss,
}: NoticeBannerProps) {
  return (
    <div className={`notice notice--${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <div className="notice__actions">
        {actionLabel && onAction ? (
          <button type="button" className="notice__action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
        <button type="button" className="notice__dismiss" onClick={onDismiss}>
          Close
        </button>
      </div>
    </div>
  )
}
