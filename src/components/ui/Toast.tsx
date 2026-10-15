import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, kind?: ToastKind, action?: Toast['action']) => void;
  success: (message: string, action?: Toast['action']) => void;
  error: (message: string, action?: Toast['action']) => void;
  info: (message: string, action?: Toast['action']) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (message: string, kind: ToastKind = 'info', action?: Toast['action']) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, kind, message, action }]);
      // Errors stay a little longer so they can be read.
      window.setTimeout(() => dismiss(id), kind === 'error' ? 9000 : action ? 7000 : 4200);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, a) => show(m, 'success', a),
      error: (m, a) => show(m, 'error', a),
      info: (m, a) => show(m, 'info', a)
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Two live regions: polite for confirmations, assertive for errors. */}
      <div className="toasts" aria-live="polite" role="status">
        {toasts
          .filter((t) => t.kind !== 'error')
          .map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
      </div>
      <div className="toasts toasts--errors" aria-live="assertive" role="alert">
        {toasts
          .filter((t) => t.kind === 'error')
          .map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icon = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertTriangle : Info;
  return (
    <div className={`toast toast--${toast.kind}`}>
      <Icon size={20} aria-hidden="true" className="toast__icon" />
      <p className="toast__message">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action!.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className="toast__close" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
