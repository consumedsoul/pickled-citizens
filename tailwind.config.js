/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'app-bg': '#f3f4f6',
        'app-bg-alt': '#ffffff',
        'app-border': '#e5e7eb',
        'app-text': '#111827',
        'app-muted': '#6b7280',
        'app-accent': '#14532d',
        'app-dark': '#1f2937',
        'app-light-gray': '#9ca3af',
        'app-link': '#263FA9',
      },
      maxWidth: {
        'app': '960px',
      },
    },
  },
  plugins: [],
}
