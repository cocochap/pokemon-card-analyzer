# PokeMarket — Pokémon TCG Intelligence Platform

> The Bloomberg Terminal of Pokémon TCG investing.

---

## Architecture

```
pokemon-card-analyzer/
├── apps/
│   ├── web/                  # Next.js 15 frontend (Vercel)
│   ├── api/                  # NestJS backend (Railway)
│   └── ai-service/           # Python FastAPI ML service
├── packages/
│   ├── ui/                   # Shared React components
│   ├── config/               # Shared config
│   └── types/                # Shared TypeScript types
├── infrastructure/
│   ├── docker/               # Docker Compose + Dockerfiles
│   ├── k8s/                  # Kubernetes manifests
│   └── nginx/                # Nginx config
├── .github/workflows/        # CI/CD pipelines
└── turbo.json                # Turborepo config
```

## Stack

| Layer       | Technology                                                   |
|-------------|--------------------------------------------------------------|
| Frontend    | Next.js 15, React 19, TypeScript, TailwindCSS, Framer Motion |
| Charts      | TradingView lightweight-charts, Recharts                     |
| State       | Zustand + TanStack Query                                     |
| Backend     | NestJS 10, PostgreSQL 16, Prisma ORM                         |
| Cache       | Redis 7 (multi-layer: in-memory + Redis)                     |
| Queues      | Bull (Redis-backed)                                          |
| AI/ML       | Python 3.12, FastAPI, Prophet, LightGBM, XGBoost             |
| Auth        | Clerk                                                        |
| Payments    | Stripe                                                       |
| Realtime    | Socket.IO (WebSockets)                                       |
| Infra       | Docker, GitHub Actions CI/CD                                 |
| Deploy      | Vercel (web), Railway (API + AI), Supabase (DB)             |

## Features

- **250,000+ cards** — all sets, EN/JP/FR, all variants (holo, reverse, 1st edition, shadowless, promo)
- **Live market data** — Cardmarket, TCGPlayer, eBay sold prices
- **TradingView-style charts** — candlesticks, volume, MA, RSI
- **AI predictions** — Prophet + LightGBM + XGBoost ensemble (7/30/90 day forecasts)
- **Investment scoring** — 100-point score based on 6 factor categories
- **Portfolio tracker** — cost basis, P&L, ROI, value over time
- **Price alerts** — email + push notifications when conditions trigger
- **Market index** — global, vintage, modern, sealed indices
- **PSA population data** — scarcity intelligence

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- Python 3.12 (for AI service)

### 1. Clone & Install

```bash
git clone https://github.com/your-org/pokemon-card-analyzer
cd pokemon-card-analyzer
pnpm install
```

### 2. Start Infrastructure

```bash
pnpm docker:dev
# Starts: PostgreSQL, Redis
```

### 3. Environment Variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill in your Clerk, Stripe, Pokemon TCG API keys
```

### 4. Database Setup

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed   # Fetches all cards from Pokemon TCG API
```

### 5. Start Development Servers

```bash
pnpm dev
# web:  http://localhost:3000
# api:  http://localhost:3001
# ai:   http://localhost:8000
# docs: http://localhost:3001/api/docs
```

## Database Schema

Key models:
- `PokemonSet` — all TCG sets
- `Card` — every card with full metadata
- `CardPrice` — multi-source price snapshots (Cardmarket, TCGPlayer, eBay)
- `PriceHistory` — time-series price data for charts
- `SaleEvent` — individual sold transactions
- `CardMarketData` — computed metrics (cap, volume, change %, volatility, RSI)
- `CardAiAnalysis` — ML scores and signals
- `PricePrediction` — 7/30/90-day predictions
- `Portfolio` / `PortfolioItem` — user collections
- `Alert` — price alert rules
- `MarketIndex` — global market indices

## API Endpoints

```
GET  /api/v1/cards/search          — Search cards (full-text + filters)
GET  /api/v1/cards/trending        — Trending cards
GET  /api/v1/cards/:id             — Card detail + current prices
GET  /api/v1/cards/:id/price-history — Historical prices for charts
GET  /api/v1/cards/:id/graded-prices — PSA/BGS/CGC graded prices
GET  /api/v1/cards/:id/sales       — Recent eBay sales
GET  /api/v1/market/overview       — Market KPIs
GET  /api/v1/market/ticker         — Live ticker data
GET  /api/v1/market/movers         — Top gainers/losers
GET  /api/v1/market/opportunities  — AI-scored buy opportunities
GET  /api/v1/ai/cards/:id/analysis — Full AI analysis
POST /api/v1/portfolio/items       — Add card to portfolio
GET  /api/v1/portfolio/me          — User portfolio summary
POST /api/v1/alerts                — Create price alert
```

## AI Service

The AI service runs independently at port 8000 and exposes:

```
GET  /api/v1/cards/:id/analysis   — Full analysis (predictions + scores)
POST /api/v1/cards/:id/analyze    — Trigger background re-analysis
GET  /api/v1/market/insights      — Market-wide AI insights
```

**Model Architecture:**
1. **Prophet** (40% weight) — captures seasonality and trend
2. **LightGBM** (35% weight) — gradient boosting on 30+ engineered features
3. **XGBoost** (25% weight) — ensemble diversity

**Investment Score Factors:**
- Momentum (25%) — price and volume trends
- Scarcity (20%) — rarity, PSA population, 1st edition
- Fundamental (20%) — Pokémon popularity, set age
- Social (15%) — watchlist growth, search volume, mentions
- Technical (10%) — RSI, Bollinger bands, volatility
- Liquidity (10%) — sales count, listings, time to sell

## Deployment

### Vercel (Frontend)

```bash
vercel --prod
```

### Railway (API + AI)

```bash
railway up
```

### Environment Variables (Production)

All secrets are managed via GitHub Actions secrets and injected at build/deploy time.

## Monetization

| Tier    | Price    | Features                                        |
|---------|----------|-------------------------------------------------|
| Free    | €0       | 50-card portfolio, 5 alerts, 30d history        |
| Pro     | €14.99/m | AI predictions, unlimited portfolio, 50 alerts  |
| Elite   | €39.99/m | API access, unlimited alerts, real-time WS      |

## License

MIT — see LICENSE
