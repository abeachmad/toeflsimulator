/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official ETS TOEFL iBT 2026 color scheme (Task 23.1 — Requirement 10.1)
        'ets-navy': '#1a2332',
        'ets-charcoal': '#2d3748',
        'ets-blue': '#3182ce',
        'ets-blue-dark': '#2c5aa0',
        'ets-light-blue': '#63b3ed',
        'ets-green': '#38a169',
        'ets-yellow': '#d69e2e',
        'ets-red': '#e53e3e',
        'ets-gray': '#718096',
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        'mono': ['SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        'xl': '0.875rem',
      },
      boxShadow: {
        'ets': '0 4px 6px -1px rgba(26,35,50,0.4), 0 2px 4px -1px rgba(26,35,50,0.2)',
        'ets-lg': '0 10px 15px -3px rgba(26,35,50,0.4), 0 4px 6px -2px rgba(26,35,50,0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      screens: {
        'xs': '480px',
      },
    },
  },
  plugins: [],
}
