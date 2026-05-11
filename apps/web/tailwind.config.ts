import type { Config } from 'tailwindcss'
import { createRequire } from 'module'
const _require = createRequire(import.meta.url)
const tailwindAnimate = _require('tailwindcss-animate')

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Pokémon brand colors
        pokemon: {
          yellow: '#FFCB05',
          blue: '#3D7DCA',
          red: '#CC0000',
          green: '#2E8B57',
          purple: '#7B2D8B',
        },
        // Pokémon type energy colors
        type: {
          fire:     '#FF6B35',
          water:    '#4FC3F7',
          grass:    '#66BB6A',
          electric: '#FFD700',
          psychic:  '#F06292',
          dragon:   '#7E57C2',
          dark:     '#78909C',
          fairy:    '#F48FB1',
          ice:      '#80DEEA',
          fighting: '#EF5350',
          normal:   '#BDBDBD',
          poison:   '#AB47BC',
          ground:   '#A1887F',
          rock:     '#8D6E63',
          bug:      '#9CCC65',
          ghost:    '#7E57C2',
          steel:    '#90A4AE',
          flying:   '#81D4FA',
        },
        // Market colors
        market: {
          bull: '#22C55E',
          bear: '#EF4444',
          neutral: '#94A3B8',
          gold: '#F59E0B',
          platinum: '#E2E8F0',
        },
        // Glass
        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.05)',
          border: 'rgba(255, 255, 255, 0.1)',
          hover: 'rgba(255, 255, 255, 0.08)',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'pokemon-gradient': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'bull-gradient': 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.05) 100%)',
        'bear-gradient': 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.05) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'ticker': 'ticker 30s linear infinite',
        'shimmer': 'shimmer 1.6s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'spin-slow': 'spin 6s linear infinite',
        'holo': 'holo 3s ease-in-out infinite',
        'gradient-shift': 'gradient-shift 3s linear infinite',
        'bounce-in': 'bounce-in 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255, 203, 5, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(255, 203, 5, 0.6)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
        'glass-lg': '0 8px 32px rgba(0, 0, 0, 0.37)',
        glow: '0 0 20px rgba(255, 203, 5, 0.4)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.4)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(255, 203, 5, 0.1)',
      },
    },
  },
  plugins: [tailwindAnimate],
}

export default config
