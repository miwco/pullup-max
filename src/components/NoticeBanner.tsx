interface NoticeBannerProps {
  message: string
  tone: 'info' | 'error' | 'success'
  onDismiss: () => void
}

export function NoticeBanner({ message, tone, onDismiss }: NoticeBannerProps) {
  return (
    <div className={`notice notice--${tone}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" className="notice__dismiss" onClick={onDismiss}>
        Close
      </button>
    </div>
  )
}
