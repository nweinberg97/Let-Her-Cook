import type { ReactNode } from 'react';

/**
 * Walla the Koala — Let ’Em Cook's mascot and logo. A chef-hatted koala in an
 * orange apron. Drawn as inline SVG so she's crisp at any size and needs no
 * downloads. `LogoMark` is the app-icon tile (same art as public/favicon.svg).
 */

const GREY = '#AEB9C7';
const FACE = '#BCC6D2';
const PINK = '#F6C3CF';
const CHEEK = '#F59AAE';
const NOSE = '#3A3F4B';
const EYE = '#262A33';
const APRON = '#FF7A3D';

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <rect width="64" height="64" rx="16" fill={APRON} />
      <WallaHead />
    </svg>
  );
}

/** Head + chef hat in a 64×64 box. */
function WallaHead() {
  return (
    <>
      <circle cx="12.5" cy="34" r="11" fill={GREY} />
      <circle cx="51.5" cy="34" r="11" fill={GREY} />
      <circle cx="13.5" cy="35" r="6.5" fill={PINK} />
      <circle cx="50.5" cy="35" r="6.5" fill={PINK} />
      <ellipse cx="32" cy="41.5" rx="20" ry="18.5" fill="#C3CCD7" />
      <rect x="19.5" y="17" width="25" height="8.5" rx="3" fill="#F4EEE5" />
      <circle cx="23" cy="13" r="6.8" fill="#fff" />
      <circle cx="41" cy="13" r="6.8" fill="#fff" />
      <circle cx="32" cy="9.5" r="8.3" fill="#fff" />
      <ellipse cx="23.5" cy="40" rx="2.6" ry="2.9" fill={EYE} />
      <ellipse cx="40.5" cy="40" rx="2.6" ry="2.9" fill={EYE} />
      <ellipse cx="18.5" cy="48" rx="3.4" ry="2.2" fill={CHEEK} opacity=".85" />
      <ellipse cx="45.5" cy="48" rx="3.4" ry="2.2" fill={CHEEK} opacity=".85" />
      <path d="M32 41.5c4.6 0 6.3 3.3 6.3 6.1 0 3.6-2.8 6.1-6.3 6.1s-6.3-2.5-6.3-6.1c0-2.8 1.7-6.1 6.3-6.1z" fill={NOSE} />
    </>
  );
}

export function WallaHeadMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="walla-head">
      <WallaHead />
    </svg>
  );
}

/** Full-body Walla. `wave` swaps the spoon for a waving paw. */
export function Walla({ size = 160, pose = 'spoon' }: { size?: number; pose?: 'spoon' | 'wave' }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 200 230" aria-hidden="true" className="walla">
      <ellipse cx="78" cy="214" rx="20" ry="11" fill="#8E9AAB" />
      <ellipse cx="122" cy="214" rx="20" ry="11" fill="#8E9AAB" />
      <path d="M52 168c0-30 21-48 48-48s48 18 48 48v20c0 18-14 28-48 28s-48-10-48-28z" fill={GREY} />
      <path d="M68 140h64v50c0 12-10 20-32 20s-32-8-32-20z" fill={APRON} />
      <path d="M68 140c-6-6-10-14-10-22M132 140c6-6 10-14 10-22" stroke={APRON} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M100 186c-7-5-12-9-12-14a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 5-5 9-12 14z" fill="#FFF6EC" />
      <path d="M74 152h52" stroke="#FFB48A" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="55" cy="170" rx="13" ry="17" fill={GREY} transform="rotate(20 55 170)" />
      {pose === 'spoon' ? (
        <>
          <ellipse cx="145" cy="170" rx="13" ry="17" fill={GREY} transform="rotate(-20 145 170)" />
          <path d="M150 168l20-46" stroke="#C98B4E" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="172" cy="116" rx="8" ry="11" fill="#D99A5B" transform="rotate(24 172 116)" />
          <circle cx="147" cy="172" r="8" fill="#9AA6B6" />
        </>
      ) : (
        <g className="walla__wave">
          <ellipse cx="160" cy="132" rx="13" ry="20" fill={GREY} transform="rotate(35 160 132)" />
          <circle cx="170" cy="117" r="9" fill="#9AA6B6" />
        </g>
      )}
      <circle cx="46" cy="76" r="30" fill={GREY} />
      <circle cx="154" cy="76" r="30" fill={GREY} />
      <circle cx="48" cy="78" r="18" fill={PINK} />
      <circle cx="152" cy="78" r="18" fill={PINK} />
      <ellipse cx="100" cy="92" rx="54" ry="50" fill={FACE} />
      <rect x="68" y="42" width="64" height="22" rx="7" fill="#F4EEE5" />
      <circle cx="78" cy="34" r="17" fill="#fff" />
      <circle cx="122" cy="34" r="17" fill="#fff" />
      <circle cx="100" cy="24" r="21" fill="#fff" />
      <path d="M84 50v10M100 50v10M116 50v10" stroke="#E4DCD0" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="78" cy="94" rx="6" ry="7" fill={EYE} />
      <ellipse cx="122" cy="94" rx="6" ry="7" fill={EYE} />
      <circle cx="80" cy="91" r="2.2" fill="#fff" />
      <circle cx="124" cy="91" r="2.2" fill="#fff" />
      <ellipse cx="66" cy="112" rx="9" ry="6" fill={CHEEK} opacity=".75" />
      <ellipse cx="134" cy="112" rx="9" ry="6" fill={CHEEK} opacity=".75" />
      <path d="M100 96c11 0 15 8 15 15 0 9-7 15-15 15s-15-6-15-15c0-7 4-15 15-15z" fill={NOSE} />
      <ellipse cx="95" cy="104" rx="4" ry="2.5" fill="#fff" opacity=".35" />
      <path d="M92 131c4 4 12 4 16 0" stroke={NOSE} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Walla with a speech bubble — used for greetings and empty states. */
export function WallaSays({ children, size = 120, pose = 'spoon' }: { children: ReactNode; size?: number; pose?: 'spoon' | 'wave' }) {
  return (
    <div className="walla-says">
      <Walla size={size} pose={pose} />
      <div className="walla-says__bubble">{children}</div>
    </div>
  );
}

export function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      <LogoMark size={size === 'lg' ? 48 : size === 'sm' ? 30 : 36} />
      <span className="wordmark__text">let ’em cook</span>
    </span>
  );
}
