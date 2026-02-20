/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'app-bg': '#ffffff',
        'app-bg-alt': '#ffffff',
        'app-bg-subtle': '#fafafa',
        'app-border': 'rgba(26, 26, 26, 0.12)',
        'app-text': '#1a1a1a',
        'app-muted': 'rgba(26, 26, 26, 0.52)',
        'app-accent': '#1a1a1a',
        'app-accent-hover': '#404040',
        'app-dark': '#1a1a1a',
        'app-light-gray': 'rgba(26, 26, 26, 0.35)',
        'app-link': '#1a1a1a',
        'app-danger': '#dc2626',
        'app-success': '#16a34a',
        'team-green': '#14532d',
        'team-green-light': '#dcfce7',
        'team-blue': '#1e40af',
        'team-blue-light': '#dbeafe',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', '"Courier New"', 'monospace'],
      },
      maxWidth: {
        'app': '960px',
      },
      letterSpacing: {
        'label': '0.15em',
        'button': '0.08em',
      },
    },
  },
  plugins: [],
}
