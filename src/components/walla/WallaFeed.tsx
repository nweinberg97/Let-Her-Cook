import { useEffect, useRef, useState } from 'react';

/**
 * Walla gets a eucalyptus leaf: it drifts in, her eyes go sparkly, she chomps
 * it down one leaf at a time (puffy cheeks, flying crumbs), lets out a tiny
 * burp, then beams with gratitude while little hearts float up.
 *
 * `play` is a counter — bump it to run the scene again. With reduced motion
 * turned on, it skips straight to the happy ending.
 */

type Phase = 'idle' | 'incoming' | 'eating' | 'burp' | 'happy';

const GREY = '#AEB9C7';
const FACE = '#BCC6D2';
const PINK = '#F6C3CF';
const CHEEK = '#F59AAE';
const NOSE = '#3A3F4B';
const EYE = '#262A33';
const APRON = '#FF7A3D';
const LEAF = '#8DB9A2';
const LEAF_EDGE = '#5E8F78';

const BUBBLE: Record<Phase, string> = {
  idle: 'Psst… is that eucalyptus I smell?',
  incoming: 'Is that… for ME?!',
  eating: 'nom nom nom',
  burp: '*burp*  …oh my, excuse me!',
  happy: 'THANK YOU!! You’re the best.'
};

const LEAF_STEP = 7.5;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function WallaFeed({ leaves = 1, play = 0, size = 260 }: { leaves?: number; play?: number; size?: number }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [eaten, setEaten] = useState(0);
  const [chompKey, setChompKey] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (play === 0) {
      setPhase('idle');
      setEaten(0);
      return;
    }
    if (reducedMotion()) {
      setEaten(leaves);
      setPhase('happy');
      return;
    }
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    setEaten(0);
    setPhase('incoming');
    const CHOMP = 950;
    at(1300, () => setPhase('eating'));
    for (let i = 1; i <= leaves; i++) {
      at(1300 + i * CHOMP, () => {
        setEaten(i);
        setChompKey((k) => k + 1);
      });
    }
    const done = 1300 + leaves * CHOMP;
    at(done + 150, () => setPhase('burp'));
    at(done + 1250, () => setPhase('happy'));
    return () => timers.current.forEach(clearTimeout);
  }, [play, leaves]);

  const showSprig = phase === 'incoming' || phase === 'eating';
  const shift = -Math.min(eaten, leaves - 1) * LEAF_STEP;

  return (
    <div className={`walla-feed is-${phase}`} aria-live="polite">
      <p className="walla-feed__bubble" key={phase}>
        {BUBBLE[phase]}
      </p>
      <svg width={size} height={size * 1.15} viewBox="0 0 200 230" role="img" aria-label={`Walla the Koala: ${BUBBLE[phase]}`} className="walla-feed__svg">
        {/* floating hearts */}
        <g className="wf-hearts" aria-hidden="true">
          {[
            [42, 60, 0],
            [160, 52, 0.5],
            [30, 120, 1],
            [172, 118, 1.5]
          ].map(([x, y, d], i) => (
            <path
              key={i}
              className="wf-heart"
              style={{ animationDelay: `${d}s` }}
              transform={`translate(${x} ${y})`}
              d="M0 6c-4-3-7-5.5-7-8.5a3.6 3.6 0 0 1 7-1.2 3.6 3.6 0 0 1 7 1.2c0 3-3 5.5-7 8.5z"
              fill={i % 2 ? APRON : CHEEK}
            />
          ))}
        </g>

        <g className="wf-body">
          {/* feet, body, apron */}
          <ellipse cx="78" cy="214" rx="20" ry="11" fill="#8E9AAB" />
          <ellipse cx="122" cy="214" rx="20" ry="11" fill="#8E9AAB" />
          <path d="M52 168c0-30 21-48 48-48s48 18 48 48v20c0 18-14 28-48 28s-48-10-48-28z" fill={GREY} />
          <path d="M68 140h64v50c0 12-10 20-32 20s-32-8-32-20z" fill={APRON} />
          <path d="M68 140c-6-6-10-14-10-22M132 140c6-6 10-14 10-22" stroke={APRON} strokeWidth="6" strokeLinecap="round" fill="none" />
          <path d="M100 186c-7-5-12-9-12-14a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 5-5 9-12 14z" fill="#FFF6EC" />
          <path d="M74 152h52" stroke="#FFB48A" strokeWidth="3" strokeLinecap="round" />
          {/* belly gets a satisfied pat */}
          <ellipse className="wf-paw-l" cx="55" cy="170" rx="13" ry="17" fill={GREY} transform="rotate(20 55 170)" />
          <g className="wf-paw-r">
            <ellipse cx="145" cy="170" rx="13" ry="17" fill={GREY} transform="rotate(-20 145 170)" />
          </g>

          <g className="wf-head">
            <circle cx="46" cy="76" r="30" fill={GREY} />
            <circle cx="154" cy="76" r="30" fill={GREY} />
            <circle cx="48" cy="78" r="18" fill={PINK} />
            <circle cx="152" cy="78" r="18" fill={PINK} />
            <ellipse cx="100" cy="92" rx="54" ry="50" fill={FACE} />
            {/* chef hat */}
            <rect x="68" y="42" width="64" height="22" rx="7" fill="#F4EEE5" />
            <circle cx="78" cy="34" r="17" fill="#fff" />
            <circle cx="122" cy="34" r="17" fill="#fff" />
            <circle cx="100" cy="24" r="21" fill="#fff" />
            <path d="M84 50v10M100 50v10M116 50v10" stroke="#E4DCD0" strokeWidth="2.5" strokeLinecap="round" />

            {/* eyes: normal / sparkly / blissful */}
            <g className="wf-eyes-normal">
              <ellipse cx="78" cy="94" rx="6" ry="7" fill={EYE} />
              <ellipse cx="122" cy="94" rx="6" ry="7" fill={EYE} />
              <circle cx="80" cy="91" r="2.2" fill="#fff" />
              <circle cx="124" cy="91" r="2.2" fill="#fff" />
            </g>
            <g className="wf-eyes-sparkle">
              <ellipse cx="78" cy="94" rx="9" ry="10" fill={EYE} />
              <ellipse cx="122" cy="94" rx="9" ry="10" fill={EYE} />
              <path d="M81 87l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#fff" />
              <path d="M125 87l1.3 3 3 1.3-3 1.3-1.3 3-1.3-3-3-1.3 3-1.3z" fill="#fff" />
              <circle cx="74" cy="99" r="1.8" fill="#fff" />
              <circle cx="118" cy="99" r="1.8" fill="#fff" />
            </g>
            <g className="wf-eyes-happy" fill="none" stroke={EYE} strokeWidth="4" strokeLinecap="round">
              <path d="M70 97q8-10 16 0" />
              <path d="M114 97q8-10 16 0" />
            </g>

            {/* cheeks: blush, puffed while chewing */}
            <ellipse className="wf-cheek wf-cheek-l" cx="66" cy="112" rx="9" ry="6" fill={CHEEK} opacity=".75" />
            <ellipse className="wf-cheek wf-cheek-r" cx="134" cy="112" rx="9" ry="6" fill={CHEEK} opacity=".75" />

            <path d="M100 96c11 0 15 8 15 15 0 9-7 15-15 15s-15-6-15-15c0-7 4-15 15-15z" fill={NOSE} />
            <ellipse cx="95" cy="104" rx="4" ry="2.5" fill="#fff" opacity=".35" />

            {/* mouth: smile / open / chewing / big grin */}
            <path className="wf-mouth-smile" d="M92 131c4 4 12 4 16 0" stroke={NOSE} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            <g className="wf-mouth-open">
              <ellipse cx="100" cy="134" rx="8" ry="7" fill="#5B2B33" />
              <ellipse cx="100" cy="138" rx="5" ry="3" fill="#F28CA0" />
            </g>
            <path className="wf-mouth-chew" d="M91 132q4.5 4 9 0q4.5 4 9 0" stroke={NOSE} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <g className="wf-mouth-grin">
              <path d="M88 129q12 14 24 0z" fill="#5B2B33" stroke={NOSE} strokeWidth="2.5" strokeLinejoin="round" />
              <path d="M94 135q6 4 12 0" fill="#F28CA0" />
            </g>
            {/* a little leaf stuck to the cheek after the feast */}
            <ellipse className="wf-crumb-stuck" cx="116" cy="125" rx="3.4" ry="2.2" fill={LEAF} transform="rotate(-25 116 125)" />
          </g>
        </g>

        {/* the eucalyptus sprig */}
        {showSprig && (
          <g className="wf-sprig-in">
            <g transform={`translate(${136 + shift} 128)`} className="wf-sprig">
              <path d={`M0 0 L${-leaves * LEAF_STEP - 4} -4`} stroke="#8A7458" strokeWidth="2" strokeLinecap="round" />
              {Array.from({ length: leaves }, (_, k) => {
                const x = -leaves * LEAF_STEP + k * LEAF_STEP;
                const up = k % 2 === 0;
                return (
                  <ellipse
                    key={k}
                    className={`wf-leaf ${k < eaten ? 'is-eaten' : ''}`}
                    cx={x}
                    cy={up ? -7 : 3.5}
                    rx="5.6"
                    ry="4.4"
                    fill={LEAF}
                    stroke={LEAF_EDGE}
                    strokeWidth="1.2"
                    transform={`rotate(${up ? -24 : 24} ${x} ${up ? -7 : 3.5})`}
                  />
                );
              })}
            </g>
          </g>
        )}

        {/* crumbs burst on every bite */}
        {phase === 'eating' && eaten > 0 && (
          <g key={chompKey} className="wf-crumbs" aria-hidden="true">
            {[
              [-14, -10],
              [12, -12],
              [-18, 4],
              [16, 6],
              [0, -16]
            ].map(([dx, dy], i) => (
              <ellipse
                key={i}
                className="wf-crumb"
                cx="100"
                cy="134"
                rx="2.4"
                ry="1.6"
                fill={i % 2 ? LEAF : LEAF_EDGE}
                style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px` }}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
