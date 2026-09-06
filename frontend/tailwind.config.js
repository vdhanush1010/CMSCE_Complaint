/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#084325',
          'green-hover': '#06341d',
          yellow: '#EAB308',
          'yellow-hover': '#CA8A04',
          surface: '#f8fafc',
        },
        dept: {
          canteen: '#EA580C',
          transport: '#0284C7',
          hostel: '#7C3AED',
          academic: '#059669',
          sports: '#D97706',
          general: '#475569',
        },
        priority: {
          critical: '#EF4444',
          high: '#F97316',
          medium: '#EAB308',
          low: '#10B981',
        },
        status: {
          submitted: '#64748B',
          analysed: '#8B5CF6',
          assigned: '#3B82F6',
          in_progress: '#0EA5E9',
          resolved: '#10B981',
          closed: '#059669',
          rejected: '#EF4444',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'modal': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
    },
  },
  plugins: [],
}
