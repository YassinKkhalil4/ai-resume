import type { Config } from 'tailwindcss'

// Cool neutral ramp. Replaces Tailwind's slate/gray so every existing
// `slate-*` / `gray-*` utility in the app picks up one calibrated palette.
const neutral = {
  50: '#f7f8fa',
  100: '#eff1f4',
  200: '#e1e5ea',
  300: '#cbd1d9',
  400: '#8e98a5',
  500: '#68717d',
  600: '#4b535e',
  700: '#363d46',
  800: '#232830',
  900: '#14171c',
  950: '#0b0d10',
}

// Rolefit brand blue (kept from the logo), calibrated: one accent, no gradients.
const accent = {
  50: '#eef3ff',
  100: '#dde7ff',
  200: '#c0d1ff',
  300: '#94b0ff',
  400: '#6a8cf7',
  500: '#4268e8',
  600: '#2c4fd6',
  700: '#2441b0',
  800: '#213a8a',
  900: '#1f336d',
  950: '#141f47',
}

const config: Config = {
  darkMode: 'class',
  // Touch devices fire :hover on tap; only apply hover styles where hover exists.
  future: { hoverOnlyWhenSupported: true },
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        slate: neutral,
        gray: neutral,
        blue: accent,
        primary: neutral[900],
        accent: accent[600],
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Shape lock: controls 10px, inner panels 12px, cards 16px, chips stay pill (rounded-full).
      borderRadius: {
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
        '3xl': '16px',
      },
      // Motion curves: Tailwind's built-in ease-out is too weak to feel intentional.
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
      // Shadows are tinted to the near-black ink, never pure black.
      boxShadow: {
        sm: '0 1px 2px rgb(11 13 16 / 0.05)',
        DEFAULT: '0 1px 3px rgb(11 13 16 / 0.07), 0 1px 2px rgb(11 13 16 / 0.04)',
        md: '0 4px 12px -4px rgb(11 13 16 / 0.1), 0 1px 2px rgb(11 13 16 / 0.04)',
        lg: '0 12px 28px -12px rgb(11 13 16 / 0.16)',
        xl: '0 20px 44px -16px rgb(11 13 16 / 0.2)',
        '2xl': '0 28px 60px -20px rgb(11 13 16 / 0.26)',
      },
    },
  },
  plugins: []
}
export default config
