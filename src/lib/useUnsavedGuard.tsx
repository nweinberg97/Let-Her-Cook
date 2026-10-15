import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';

/**
 * Warns before leaving a page with unsaved edits — both in-app navigation and
 * closing the tab. Call `allowNavigation()` right before navigating away on
 * purpose (after a successful save, or a confirmed cancel).
 */
export function useUnsavedGuard(dirty: boolean, message = 'Your changes haven’t been saved.') {
  const dirtyRef = useRef(dirty);
  const bypass = useRef(false);
  dirtyRef.current = dirty;

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }: { currentLocation: { pathname: string }; nextLocation: { pathname: string } }) =>
        !bypass.current && dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
      []
    )
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (bypass.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const allowNavigation = useCallback(() => {
    bypass.current = true;
  }, []);

  const dialog = (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      title="Leave without saving?"
      description={<p>{message} If you leave now, they’ll be lost.</p>}
      confirmLabel="Leave without saving"
      danger
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  );
  return { dialog, allowNavigation };
}
