/**
 * The wordmark is pure type: "Let Her Cook" set tight in the display serif,
 * with a small burner mark — two concentric rings — standing in for the dot of
 * a stovetop dial. No illustration to download, crisp at any size.
 */
export function BurnerMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="burner">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      <BurnerMark size={size === 'lg' ? 34 : size === 'sm' ? 18 : 22} />
      <span className="wordmark__text">Let Her Cook</span>
    </span>
  );
}
