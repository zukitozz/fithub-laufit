import type { Config } from 'tailwindcss'

// Identidad LAUFIT: negro, rojo (#D10F15, tomado del logo) y blanco.
const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      colors: {
        laufit: {
          50: '#fef2f2',
          100: '#fde3e4',
          200: '#fbc9cb',
          300: '#f59ea1',
          400: '#ec5f65',
          500: '#e0262d',
          600: '#d10f15',
          700: '#a80b10',
          800: '#7f0a0e',
          900: '#4d0609',
        },
        ink: {
          50: '#f6f6f7',
          100: '#e8e8ea',
          200: '#d0d0d4',
          300: '#a8a8af',
          400: '#76767f',
          500: '#52525a',
          600: '#3a3a41',
          700: '#26262c',
          800: '#17171b',
          900: '#0b0b0d',
        },
      },
      boxShadow: {
        soft: '0 18px 40px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
}

export default config
