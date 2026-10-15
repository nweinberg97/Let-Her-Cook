/**
 * The Let Her Cook mark: a pot with three ribbons of steam in the brand
 * colors and a heart on the front. Same artwork as public/favicon.svg, so the
 * app icon, browser tab and wordmark always match.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect width="64" height="64" rx="15" fill="#B0381F" />
      <g fill="none" strokeLinecap="round" strokeWidth="4.4">
        <path d="M21.5 22.5c-3.6-3.3 3.6-6.2 0-9.8" stroke="#F2AE2E" />
        <path d="M32 21.5c-3.6-3.3 3.6-6.8 0-10.5" stroke="#FFFBF3" />
        <path d="M42.5 22.5c-3.6-3.3 3.6-6.2 0-9.8" stroke="#F0768A" />
      </g>
      <rect x="9" y="27" width="46" height="6" rx="3" fill="#FFFBF3" />
      <path d="M13 34h38v9a10 10 0 0 1-10 10H23a10 10 0 0 1-10-10z" fill="#FFFBF3" />
      <rect x="5" y="36" width="10" height="5" rx="2.5" fill="#FFFBF3" />
      <rect x="49" y="36" width="10" height="5" rx="2.5" fill="#FFFBF3" />
      <path d="M32 48.5c-3.2-2.3-5.6-4.3-5.6-6.6a2.9 2.9 0 0 1 5.6-1.1 2.9 2.9 0 0 1 5.6 1.1c0 2.3-2.4 4.3-5.6 6.6z" fill="#E2543A" />
    </svg>
  );
}

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      <LogoMark size={size === 'lg' ? 44 : size === 'sm' ? 26 : 32} />
      <span className="wordmark__text">Let Her Cook</span>
    </span>
  );
}
