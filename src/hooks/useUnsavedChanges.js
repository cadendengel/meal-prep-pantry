import { useEffect } from 'react';

/**
 * Warn before the tab closes or reloads while edits are pending.
 *
 * This covers closing, reloading and outside navigation. In-app navigation
 * is handled separately, because React Router controls it.
 *
 * @param {boolean} dirty - True when there are unsaved edits
 */
export function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;

    const onBeforeUnload = (event) => {
      event.preventDefault();
      // Browsers ignore custom text now, but a returned value is still
      // what triggers the prompt.
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}

export default useUnsavedChanges;
