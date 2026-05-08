/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void:    '#08080E',
        deep:    '#0E0E18',
        card:    '#13131F',
        surface: '#1A1A2A',
        gold:    '#E8A020',
        'gold-hi': '#F5B840',
        'gold-lo': '#A06A10',
        chalk:   '#F0EDE8',
        muted:   '#7A7488',
        dim:     '#3A3650',
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      backgroundImage: {
        'cinema-gradient': 'linear-gradient(to right, #08080E 35%, transparent 70%)',
        'card-overlay':    'linear-gradient(to top, #08080E 0%, transparent 60%)',
        'gold-shine':      'linear-gradient(135deg, #E8A020 0%, #F5B840 50%, #E8A020 100%)',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        pulse_gold: {
          '0%, 100%': { opacity: '0.6' },
          '50%':       { opacity: '1' },
        },
      },
      animation: {
        shimmer:    'shimmer 2.4s linear infinite',
        pulse_gold: 'pulse_gold 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
