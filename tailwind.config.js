/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        arcade: {
          bg: '#0a0e1a',
          panel: '#0f1626',
          cyan: '#22d3ee',
          purple: '#a855f7',
          green: '#34d399',
          amber: '#f59e0b',
          pink: '#ec4899',
        },
      },
      fontFamily: {
        mono: ['"Press Start 2P"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        neon: '0 0 20px rgba(34,211,238,0.35)',
        'neon-purple': '0 0 20px rgba(168,85,247,0.35)',
      },
      keyframes: {
        flicker: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.85' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        flicker: 'flicker 3s infinite',
        scan: 'scan 6s linear infinite',
      },
    },
  },
  plugins: [],
};
