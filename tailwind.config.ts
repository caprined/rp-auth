import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: '#121212',
        surface1: '#1a1a1a',
        surface2: '#242424',
        border1: '#2e2e2e',
        borderStrong: '#3a3a3a',
        textPrimary: '#eaeaea',
        textSecondary: '#9a9a9a',
        textMuted: '#6b6b6b',
        accentFrom: '#b45925',
        accentTo: '#4a230c',
        success: '#4a7c3a',
        danger: '#a13a3a',
      },
    },
  },
  plugins: [],
};

export default config;
