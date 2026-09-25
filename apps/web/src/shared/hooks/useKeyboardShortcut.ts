'use client';

import { useEffect } from 'react';

export interface ShortcutOptions {
  metaOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  preventDefault?: boolean;
  ignoreInputs?: boolean;
}

export function useKeyboardShortcut(
  key: string,
  callback: (e: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const {
    metaOrCtrl = false,
    shift = false,
    alt = false,
    preventDefault = true,
    ignoreInputs = true,
  } = options;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (ignoreInputs) {
        const target = e.target as HTMLElement;
        const tagName = target?.tagName?.toLowerCase();
        const isEditable =
          target?.isContentEditable ||
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select';
        
        // Allow escape even in inputs
        if (isEditable && e.key.toLowerCase() !== 'escape') {
          return;
        }
      }

      const keyMatches = e.key.toLowerCase() === key.toLowerCase();
      const metaOrCtrlMatches = metaOrCtrl ? e.metaKey || e.ctrlKey : true;
      const shiftMatches = shift ? e.shiftKey : !e.shiftKey;
      const altMatches = alt ? e.altKey : !e.altKey;

      if (keyMatches && metaOrCtrlMatches && shiftMatches && altMatches) {
        if (preventDefault) {
          e.preventDefault();
        }
        callback(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, metaOrCtrl, shift, alt, preventDefault, ignoreInputs]);
}
