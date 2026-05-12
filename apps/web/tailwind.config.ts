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

        // ── PokeScan brand system ──────────────────────────────────
        electric: {
          DEFAULT: '#3B82F6',
          50:  '#EFF6FF',
          100: '#DBEAFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        gold: {
          DEFAULT: '#F59E0B',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        navy: {
          DEFAULT: '#0A1628',
          900: '#020817',
          800: '#060E1E',
          700: '#0A1628',
          600: '#0F2040',
          500: '#162B56',
          400: '#1E3A72',
        },

        // ── Pokémon brand colors ───────────────────────────────────
        pokemon: {
          yellow: '#FFCB05',
          blue:   '#3D7DCA',
          red:    '#CC0000',
          green:  '#2E8B57',
          purple: '#7B2D8B',
        },

        // ── Pokémon type energy colors ─────────────────────────────
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

        // ── Market sentiment ───────────────────────────────────────
        market: {
          bull:     '#22C55E',
          bear:     '#EF4444',
          neutral:  '#94A3B8',
          gold:     '#F59E0B',
          platinum: '#E2E8F0',
        },

        glass: {
          DEFAULT: 'rgba(255, 255, 255, 0.04)',
          border:  'rgba(255, 255, 255, 0.08)',
          hover:   'rgba(255, 255, 255, 0.07)',
        },
      },

      fontFamily: {
        sans:    ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-geist-mono)', 'monospace'],
        display: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },

      backgroundImage: {
        'gradient-radial':    'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':     'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'pokemon-gradient':   'linear-gradient(135deg, #020817 0%, #060E1E 50%, #0A1628 100%)',
        'glass-gradient':     'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        'electric-gradient':  'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 50%, #60A5FA 100%)',
        'gold-gradient':      'linear-gradient(135deg, #B45309 0%, #F59E0B 50%, #FBBF24 100%)',
        'hero-gradient':      'radial-gradient(ellipse at 60% 50%, rgba(59,130,246,0.15) 0%, transparent 60%)',
        'scan-gradient':      'linear-gradient(180deg, transparent 0%, rgba(59,130,246,0.6) 50%, transparent 100%)',
        'bull-gradient':      'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(34,197,94,0.04) 100%)',
        'bear-gradient':      'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.04) 100%)',
      },

      animation: {
        'fade-in':       'fadeIn 0.5s ease-out',
        'slide-up':      'slideUp 0.4s ease-out',
        'slide-down':    'slideDown 0.4s ease-out',
        'slide-in-right':'slideInRight 0.5s ease-out',
        'scale-in':      'scaleIn 0.3s ease-out',
        'pulse-glow':    'pulseGlow 2s ease-in-out infinite',
        'pulse-electric':'pulseElectric 2s ease-in-out infinite',
        'ticker':        'ticker 30s linear infinite',
        'shimmer':       'shimmer 1.6s ease-in-out infinite',
        'float':         'float 3s ease-in-out infinite',
        'float-delayed': 'float 3.5s ease-in-out infinite 0.8s',
        'spin-slow':     'spin 6s linear infinite',
        'holo':          'holo 3s ease-in-out infinite',
        'gradient-shift':'gradient-shift 3s linear infinite',
        'bounce-in':     'bounce-in 0.4s ease-out',
        'scan-beam':     'scanBeam 2s ease-in-out infinite',
        'border-glow':   'borderGlow 2s ease-in-out infinite',
        'card-hover':    'cardHover 0.3s ease-out forwards',
      },

      keyframes: {
        fadeIn:       { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp:      { '0%': { opacity: '0', transform: 'translateY(24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown:    { '0%': { opacity: '0', transform: 'translateY(-24px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(32px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        scaleIn:      { '0%': { opacity: '0', transform: 'scale(0.9)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        pulseGlow:    {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,203,5,0.3)' },
          '50%':       { boxShadow: '0 0 40px rgba(255,203,5,0.6)' },
        },
        pulseElectric: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(59,130,246,0.3), 0 0 40px rgba(59,130,246,0.1)' },
          '50%':       { boxShadow: '0 0 40px rgba(59,130,246,0.7), 0 0 80px rgba(59,130,246,0.2)' },
        },
        ticker:       { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(-50%)' } },
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:        { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        holo:         { '0%': { backgroundPosition: '0% 0%' }, '50%': { backgroundPosition: '100% 100%' }, '100%': { backgroundPosition: '0% 0%' } },
        'gradient-shift': {
          '0%':   { backgroundPosition: '0% center' },
          '50%':  { backgroundPosition: '100% center' },
          '100%': { backgroundPosition: '0% center' },
        },
        'bounce-in': {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '60%':  { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        scanBeam: {
          '0%':   { top: '-2%', opacity: '0' },
          '5%':   { opacity: '1' },
          '95%':  { opacity: '1' },
          '100%': { top: '102%', opacity: '0' },
        },
        borderGlow: {
          '0%, 100%': { borderColor: 'rgba(59,130,246,0.4)' },
          '50%':       { borderColor: 'rgba(59,130,246,0.9)' },
        },
        cardHover: {
          '0%':   { transform: 'rotateY(0deg) rotateX(0deg)' },
          '100%': { transform: 'rotateY(5deg) rotateX(-3deg)' },
        },
      },

      backdropBlur: { xs: '2px' },

      boxShadow: {
        glass:          '0 4px 30px rgba(0,0,0,0.15)',
        'glass-lg':     '0 8px 40px rgba(0,0,0,0.4)',
        'card-premium': '0 30px 70px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
        glow:           '0 0 24px rgba(255,203,5,0.4), 0 0 48px rgba(255,203,5,0.15)',
        'glow-electric':'0 0 24px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2)',
        'glow-gold':    '0 0 24px rgba(245,158,11,0.5), 0 0 60px rgba(245,158,11,0.2)',
        'glow-green':   '0 0 20px rgba(34,197,94,0.4)',
        'glow-red':     '0 0 20px rgba(239,68,68,0.4)',
        'inner-glow':   'inset 0 0 20px rgba(59,130,246,0.1)',
        'scan-active':  '0 0 0 2px rgba(59,130,246,0.6), 0 0 40px rgba(59,130,246,0.3)',
      },
    },
  },
  plugins: [tailwindAnimate],
}

export default config
