import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { X, Sun, ChevronLeft, ChevronRight, Timer, TimerOff } from 'lucide-react';
import { useLibrary } from '../lib/storage/LibraryContext';
import { IngredientList } from '../components/recipes/IngredientList';
import { ServingScaler } from '../components/recipes/ServingScaler';
import { useScale } from './RecipePage';
import { usePageTitle } from '../lib/usePageTitle';
import { NotFound } from './NotFound';
import { courseStyle } from '../lib/courseColors';
import { formatMinutes } from '../lib/parsing/quantity';

/**
 * A calmer, bigger view for the stove. Checkmarks and timers here live only in
 * memory — leaving cooking mode resets them and never changes the saved recipe.
 */
export function CookingPage() {
  const { id } = useParams();
  const { recipes, status } = useLibrary();
  const recipe = recipes.find((r) => r.id === id);
  const scale = useScale(recipe);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());
  const [doneSteps, setDoneSteps] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');
  const wake = useWakeLock();
  const timer = useTimer();
  usePageTitle(recipe ? `Cooking: ${recipe.title}` : null);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  const toggleIngredient = useCallback((iid: string) => {
    setCheckedIngredients((s) => {
      const n = new Set(s);
      if (n.has(iid)) n.delete(iid);
      else n.add(iid);
      return n;
    });
  }, []);

  if (status === 'loading') return <div className="page"><p className="loading-line" role="status">Opening the recipe…</p></div>;
  if (!recipe) return <NotFound what="recipe" />;

  const steps = recipe.instructions;
  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(steps.length - 1, i));
    setCurrent(next);
    stepRefs.current[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const toggleStep = (sid: string, index: number) => {
    setDoneSteps((s) => {
      const n = new Set(s);
      if (n.has(sid)) n.delete(sid);
      else {
        n.add(sid);
        if (index === current && index < steps.length - 1) setTimeout(() => goTo(index + 1), 150);
      }
      return n;
    });
  };

  return (
    <div className="cook" style={courseStyle(recipe.course)}>
      <header className="cook__bar">
        <Link to={`/recipes/${recipe.id}`} className="icon-btn icon-btn--ghost icon-btn--lg" aria-label="Exit cooking mode">
          <X size={24} aria-hidden="true" />
        </Link>
        <h1 className="cook__title">{recipe.title}</h1>
        {wake.supported && (
          <button type="button" className={`cook__wake ${wake.active ? 'is-on' : ''}`} aria-pressed={wake.active} onClick={wake.toggle}>
            <Sun size={18} aria-hidden="true" />
            <span>{wake.active ? 'Screen stays on' : 'Keep screen on'}</span>
          </button>
        )}
      </header>

      {timer.remaining != null && (
        <div className={`cook__timer ${timer.remaining === 0 ? 'is-done' : ''}`} role="timer" aria-live="off">
          <Timer size={20} aria-hidden="true" />
          <span className="cook__timer-time">{timer.remaining === 0 ? 'Time’s up' : timer.label}</span>
          <button type="button" className="text-button" onClick={timer.stop}>
            <TimerOff size={16} aria-hidden="true" /> {timer.remaining === 0 ? 'Dismiss' : 'Stop timer'}
          </button>
        </div>
      )}
      <p className="visually-hidden" aria-live="assertive">
        {timer.remaining === 0 ? 'Timer finished.' : ''}
      </p>

      <div className="cook__tabs" role="tablist" aria-label="Cooking sections">
        <button type="button" role="tab" id="tab-ing" aria-controls="panel-ing" aria-selected={tab === 'ingredients'} onClick={() => setTab('ingredients')}>
          Ingredients <span className="cook__tab-count">{checkedIngredients.size}/{recipe.ingredients.length}</span>
        </button>
        <button type="button" role="tab" id="tab-steps" aria-controls="panel-steps" aria-selected={tab === 'steps'} onClick={() => setTab('steps')}>
          Steps <span className="cook__tab-count">{doneSteps.size}/{steps.length}</span>
        </button>
      </div>

      <div className="cook__layout">
        <section id="panel-ing" role="tabpanel" aria-labelledby="tab-ing" className={`cook__panel cook__ingredients ${tab === 'ingredients' ? 'is-active' : ''}`}>
          <div className="section-head">
            <h2 className="section-title">Ingredients</h2>
            <ServingScaler original={scale.original} value={scale.value} onChange={scale.setValue} />
          </div>
          {recipe.ingredients.length ? (
            <IngredientList ingredients={recipe.ingredients} factor={scale.factor} checked={checkedIngredients} onToggle={toggleIngredient} />
          ) : (
            <p className="muted">This recipe has no ingredients listed.</p>
          )}
          <button type="button" className="btn btn--primary btn--lg btn--block cook__to-steps" onClick={() => setTab('steps')}>
            <span className="btn__label">On to the steps</span>
          </button>
        </section>

        <section id="panel-steps" role="tabpanel" aria-labelledby="tab-steps" className={`cook__panel cook__steps ${tab === 'steps' ? 'is-active' : ''}`}>
          <h2 className="section-title">Steps</h2>
          {steps.length ? (
            <ol className="cook-steps">
              {steps.map((s, i) => {
                const isDone = doneSteps.has(s.id);
                const showGroup = s.group && s.group !== steps[i - 1]?.group;
                return (
                  <li
                    key={s.id}
                    ref={(el) => (stepRefs.current[i] = el)}
                    className={`cook-step ${i === current ? 'is-current' : ''} ${isDone ? 'is-done' : ''}`}
                    aria-current={i === current ? 'step' : undefined}
                    onClick={() => setCurrent(i)}
                  >
                    {showGroup && <h3 className="steps__group-title">{s.group}</h3>}
                    <div className="cook-step__row">
                      <span className="step__num" aria-hidden="true">
                        {i + 1}
                      </span>
                      <div className="cook-step__body">
                        <p className="cook-step__text">
                          <span className="visually-hidden">Step {i + 1}: </span>
                          {s.text}
                        </p>
                        <div className="cook-step__actions">
                          <label className="step__check">
                            <input type="checkbox" checked={isDone} onChange={() => toggleStep(s.id, i)} />
                            <span>{isDone ? 'Done' : 'Mark done'}</span>
                          </label>
                          {s.timerMinutes != null && (
                            <button type="button" className="btn btn--secondary btn--sm" onClick={(e) => { e.stopPropagation(); timer.start(s.timerMinutes!); }}>
                              <span className="btn__icon" aria-hidden="true">
                                <Timer size={16} />
                              </span>
                              <span className="btn__label">Start {formatMinutes(s.timerMinutes)} timer</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted">This recipe has no steps listed.</p>
          )}
          {steps.length > 1 && (
            <div className="cook__nav">
              <button type="button" className="btn btn--secondary btn--lg" onClick={() => goTo(current - 1)} disabled={current === 0}>
                <span className="btn__icon" aria-hidden="true"><ChevronLeft size={20} /></span>
                <span className="btn__label">Previous</span>
              </button>
              <span className="cook__progress">
                Step {current + 1} of {steps.length}
              </span>
              <button type="button" className="btn btn--primary btn--lg" onClick={() => goTo(current + 1)} disabled={current >= steps.length - 1}>
                <span className="btn__label">Next step</span>
                <span className="btn__icon" aria-hidden="true"><ChevronRight size={20} /></span>
              </button>
            </div>
          )}
          {recipe.notes && (
            <aside className="cook__notes">
              <h2 className="section-title section-title--small">Notes</h2>
              <p className="notes-text">{recipe.notes}</p>
            </aside>
          )}
        </section>
      </div>
    </div>
  );
}

/** Keeps the screen awake while cooking, where the browser supports it. */
function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  const [active, setActive] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);
  const wanted = useRef(false);

  const acquire = useCallback(async () => {
    try {
      lock.current = await navigator.wakeLock.request('screen');
      setActive(true);
      lock.current.addEventListener('release', () => setActive(false));
    } catch {
      setActive(false);
    }
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (wanted.current && document.visibilityState === 'visible') void acquire();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock.current?.release().catch(() => undefined);
    };
  }, [acquire]);

  const toggle = async () => {
    if (active) {
      wanted.current = false;
      await lock.current?.release().catch(() => undefined);
      setActive(false);
    } else {
      wanted.current = true;
      await acquire();
    }
  };
  return { supported, active, toggle };
}

function useTimer() {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const chimed = useRef(false);

  useEffect(() => {
    if (endAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [endAt]);

  const remaining = endAt == null ? null : Math.max(0, Math.ceil((endAt - now) / 1000));

  useEffect(() => {
    if (remaining === 0 && !chimed.current) {
      chimed.current = true;
      chime();
      navigator.vibrate?.([300, 150, 300]);
    }
  }, [remaining]);

  const start = (minutes: number) => {
    chimed.current = false;
    setNow(Date.now());
    setEndAt(Date.now() + minutes * 60_000);
  };
  const stop = () => setEndAt(null);
  const label =
    remaining == null ? '' : `${Math.floor(remaining / 3600) ? `${Math.floor(remaining / 3600)}:` : ''}${String(Math.floor((remaining % 3600) / 60)).padStart(Math.floor(remaining / 3600) ? 2 : 1, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  return { remaining, label, start, stop };
}

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.32);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    /* sound is a nicety */
  }
}
