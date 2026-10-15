import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing with Escape/backdrop while something is in progress. */
  dismissible?: boolean;
}

/**
 * Built on the native <dialog> element: focus is trapped and restored by the
 * browser, Escape closes it, and the rest of the page becomes inert.
 */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel">
          <header className="dialog__header">
            <h2 id={titleId} className="dialog__title">
              {title}
            </h2>
            {dismissible && (
              <button type="button" className="icon-btn icon-btn--ghost icon-btn--md" onClick={onClose} aria-label="Close">
                <X aria-hidden="true" size={20} />
              </button>
            )}
          </header>
          {description && (
            <div id={descId} className="dialog__description">
              {description}
            </div>
          )}
          {children && <div className="dialog__body">{children}</div>}
          {footer && <footer className="dialog__footer">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
