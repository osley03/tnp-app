import { useEffect } from 'react';
const classes = {reducedMotion: 'tnp-reduced-motion', largerText: 'tnp-large-text', enhancedContrast: 'tnp-enhanced-contrast', readableContent: 'tnp-readable-content', keyboardFocus: 'tnp-keyboard-focus'};
export function AccessibilityPreferences() {
  useEffect(() => {
    const apply = () => {
      try {
        const settings = JSON.parse(localStorage.getItem('tnp-admin-accessibility-settings') || '{}');
        for (const [key, name] of Object.entries(classes)) document.documentElement.classList.toggle(name, settings[key] === true);
      } catch { /* Invalid or unavailable browser storage leaves safe defaults. */ }
    };
    apply(); window.addEventListener('storage', apply);
    return () => window.removeEventListener('storage', apply);
  }, []);
  return null;
}
