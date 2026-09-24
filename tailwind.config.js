/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'theme-bg-primary': 'var(--bg-primary)',
        'theme-bg-surface': 'var(--bg-surface)',
        'theme-bg-card': 'var(--bg-card)',
        'theme-border': 'var(--border-color)',
        'theme-text-main': 'var(--text-main)',
        'theme-text-muted': 'var(--text-muted)',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
