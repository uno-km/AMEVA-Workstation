import { useEffect } from 'react';

const NATURE_PALETTES = [
  { primary: '#4caf50', glow: 'rgba(76, 175, 80, 0.3)', bgActive: 'rgba(76, 175, 80, 0.15)' }, // Green
  { primary: '#3b82f6', glow: 'rgba(59, 130, 246, 0.3)', bgActive: 'rgba(59, 130, 246, 0.15)' }, // Blue
  { primary: '#ec4899', glow: 'rgba(236, 72, 153, 0.3)', bgActive: 'rgba(236, 72, 153, 0.15)' }, // Pink
  { primary: '#f97316', glow: 'rgba(249, 115, 22, 0.3)', bgActive: 'rgba(249, 115, 22, 0.15)' }, // Orange
  { primary: '#eab308', glow: 'rgba(234, 179, 8, 0.3)', bgActive: 'rgba(234, 179, 8, 0.15)' }  // Yellow
];

export function useNatureThemeColors(theme: string) {
  useEffect(() => {
    if (theme !== 'nature') {
      // Clean up inline styles when leaving nature theme
      document.body.style.removeProperty('--primary');
      document.body.style.removeProperty('--primary-glow');
      document.body.style.removeProperty('--bg-glass-active');
      return;
    }

    const handleClick = () => {
      const randomPalette = NATURE_PALETTES[Math.floor(Math.random() * NATURE_PALETTES.length)];
      
      // Inject random colors into the body variables so they override the nature theme defaults
      document.body.style.setProperty('--primary', randomPalette.primary);
      document.body.style.setProperty('--primary-glow', randomPalette.glow);
      document.body.style.setProperty('--bg-glass-active', randomPalette.bgActive);
      
      // Add a subtle transition effect so colors smoothly morph
      document.body.style.transition = 'background-color 0.5s ease, --primary 0.5s ease';
    };

    // Add global click listener
    window.addEventListener('click', handleClick);

    // Initial random color
    handleClick();

    return () => {
      window.removeEventListener('click', handleClick);
      document.body.style.removeProperty('--primary');
      document.body.style.removeProperty('--primary-glow');
      document.body.style.removeProperty('--bg-glass-active');
      document.body.style.transition = '';
    };
  }, [theme]);
}
