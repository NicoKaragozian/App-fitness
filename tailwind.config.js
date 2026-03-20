/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: '#0e0e0e',
        'surface-low': '#131313',
        'surface-container': '#1a1a1a',
        'surface-high': '#202020',
        'surface-bright': '#2c2c2c',
        'surface-variant': '#262626',
        primary: '#f3ffca',
        secondary: '#6a9cff',
        tertiary: '#ff7439',
        'on-surface': '#e8e4e4',
        'on-surface-variant': '#adaaaa',
        'outline-variant': '#484847',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Lexend', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['3.5rem', { lineHeight: '1', letterSpacing: '-0.02em' }],
        'display-md': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'headline-lg': ['1.75rem', { lineHeight: '1.2' }],
        'headline-md': ['1.25rem', { lineHeight: '1.3' }],
        'label-sm': ['0.6875rem', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm: '0.125rem',
        md: '0.375rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}
