import type { Instruction } from '../../types/recipe';

export function StepList({
  steps,
  done,
  onToggle,
  current
}: {
  steps: Instruction[];
  done?: Set<string>;
  onToggle?: (id: string) => void;
  current?: string | null;
}) {
  let n = 0;
  let lastGroup: string | null = null;
  return (
    <ol className="steps">
      {steps.map((s) => {
        n++;
        const heading = s.group && s.group !== lastGroup ? s.group : null;
        lastGroup = s.group;
        const isDone = done?.has(s.id) ?? false;
        return (
          <li key={s.id} className={`step ${isDone ? 'is-done' : ''} ${current === s.id ? 'is-current' : ''}`} data-step={n}>
            {heading && <h3 className="steps__group-title">{heading}</h3>}
            <div className="step__row">
              <span className="step__num" aria-hidden="true">
                {n}
              </span>
              <div className="step__body">
                <p className="step__text">{s.text}</p>
                {onToggle && (
                  <label className="step__check">
                    <input type="checkbox" checked={isDone} onChange={() => onToggle(s.id)} />
                    <span>{isDone ? 'Done' : 'Mark step done'}</span>
                  </label>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
