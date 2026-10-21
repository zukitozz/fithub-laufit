import type { Config } from 'tailwindcss'

// Colores: `brand` sale del tema del cliente (variables CSS, ver src/lib/tenant.ts); `danger` es el rojo fijo de errores y estados vencidos.
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
        brand: {
          50: 'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
        },
        danger: {
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
