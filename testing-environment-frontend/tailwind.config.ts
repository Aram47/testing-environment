import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--color-border) / <alpha-value>)',
        page: 'rgb(var(--color-page) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        elevated: 'rgb(var(--color-elevated) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        brand: 'rgb(var(--color-brand) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        code: 'rgb(var(--color-code-bg) / <alpha-value>)',
      },
      boxShadow: {
        soft: '0 10px 35px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
