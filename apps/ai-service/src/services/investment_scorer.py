"""
Investment scoring engine for Pokémon TCG cards.
Produces a 0-100 score based on multiple signals.
"""
import numpy as np
import pandas as pd
from dataclasses import dataclass
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class ScoringInput:
    # Price signals
    price_change_7d: float    # percent
    price_change_30d: float
    price_change_90d: float
    price_change_1y: float
    volatility_30d: float     # annualized std dev
    rsi_14: float             # 0-100

    # Volume signals
    volume_7d: float
    volume_30d: float
    volume_avg_90d: float

    # Scarcity signals
    rarity_rank: int          # 1=common, 10=ultra rare
    population_psa9: int
    population_psa10: int
    total_print_run: Optional[int]

    # Fundamental signals
    set_age_days: int
    is_vintage: bool          # before 2003
    is_first_edition: bool
    is_shadowless: bool
    is_promo: bool
    pokemon_popularity: int   # 1-100 Pokémon national popularity score

    # Market signals
    watchlist_growth_7d: float    # percent growth in watchlists
    search_volume_7d: float
    social_mentions_7d: int
    ebay_sold_count_30d: int

    # Liquidity
    listings_count: int
    avg_days_to_sell: float


@dataclass
class ScoringResult:
    investment_score: int    # 0-100
    rarity_score: int        # 0-100
    liquidity_score: int     # 0-100
    momentum_score: int      # 0-100
    risk_level: int          # 0-100 (higher = more risky)
    bullish_signals: list[str]
    bearish_signals: list[str]
    key_insight: str
    predicted_roi_30d: float
    predicted_roi_90d: float


class InvestmentScorer:
    """
    Multi-factor investment scoring model.
    Weights tuned on historical Pokémon card performance.
    """

    # Factor weights (must sum to 1.0)
    WEIGHTS = {
        "momentum": 0.25,
        "scarcity": 0.20,
        "fundamental": 0.20,
        "social": 0.15,
        "technical": 0.10,
        "liquidity": 0.10,
    }

    def score(self, inp: ScoringInput) -> ScoringResult:
        # Individual factor scores
        momentum = self._momentum_score(inp)
        scarcity = self._scarcity_score(inp)
        fundamental = self._fundamental_score(inp)
        social = self._social_score(inp)
        technical = self._technical_score(inp)
        liquidity = self._liquidity_score(inp)

        # Weighted investment score
        raw_score = (
            momentum * self.WEIGHTS["momentum"]
            + scarcity * self.WEIGHTS["scarcity"]
            + fundamental * self.WEIGHTS["fundamental"]
            + social * self.WEIGHTS["social"]
            + technical * self.WEIGHTS["technical"]
            + liquidity * self.WEIGHTS["liquidity"]
        )

        investment_score = int(np.clip(raw_score, 0, 100))
        rarity_score = int(np.clip(scarcity, 0, 100))
        liquidity_score = int(np.clip(liquidity, 0, 100))
        momentum_score = int(np.clip(momentum, 0, 100))
        risk_level = self._risk_level(inp)

        # Predicted ROI (simple momentum-based)
        predicted_roi_30d = self._predict_roi(inp, 30)
        predicted_roi_90d = self._predict_roi(inp, 90)

        # Signal extraction
        bullish_signals, bearish_signals = self._extract_signals(inp, momentum, scarcity, social, technical)
        key_insight = self._generate_insight(inp, investment_score, bullish_signals, bearish_signals)

        return ScoringResult(
            investment_score=investment_score,
            rarity_score=rarity_score,
            liquidity_score=liquidity_score,
            momentum_score=momentum_score,
            risk_level=risk_level,
            bullish_signals=bullish_signals[:5],
            bearish_signals=bearish_signals[:5],
            key_insight=key_insight,
            predicted_roi_30d=round(predicted_roi_30d, 4),
            predicted_roi_90d=round(predicted_roi_90d, 4),
        )

    def _momentum_score(self, inp: ScoringInput) -> float:
        """Price momentum across multiple timeframes."""
        score = 50.0

        # Short-term momentum (7d)
        if inp.price_change_7d > 20:
            score += 15
        elif inp.price_change_7d > 10:
            score += 10
        elif inp.price_change_7d > 5:
            score += 5
        elif inp.price_change_7d < -20:
            score -= 15
        elif inp.price_change_7d < -10:
            score -= 10
        elif inp.price_change_7d < -5:
            score -= 5

        # Medium-term momentum (30d)
        if inp.price_change_30d > 30:
            score += 12
        elif inp.price_change_30d > 15:
            score += 8
        elif inp.price_change_30d > 5:
            score += 4
        elif inp.price_change_30d < -30:
            score -= 12
        elif inp.price_change_30d < -15:
            score -= 8

        # Long-term momentum (1y)
        if inp.price_change_1y > 100:
            score += 10
        elif inp.price_change_1y > 50:
            score += 6
        elif inp.price_change_1y < -50:
            score -= 8

        # Volume momentum
        if inp.volume_7d > inp.volume_avg_90d * 2:
            score += 10  # Volume surge
        elif inp.volume_7d > inp.volume_avg_90d * 1.5:
            score += 5

        return float(np.clip(score, 0, 100))

    def _scarcity_score(self, inp: ScoringInput) -> float:
        """Rarity and scarcity signal."""
        score = inp.rarity_rank * 10  # 10-100 base

        # PSA 10 population bonus (fewer = more scarce)
        if inp.population_psa10 < 10:
            score = min(100, score + 20)
        elif inp.population_psa10 < 50:
            score = min(100, score + 12)
        elif inp.population_psa10 < 200:
            score = min(100, score + 5)
        elif inp.population_psa10 > 5000:
            score = max(0, score - 10)

        # Vintage premium
        if inp.is_vintage:
            score = min(100, score + 15)
        if inp.is_first_edition:
            score = min(100, score + 20)
        if inp.is_shadowless:
            score = min(100, score + 15)
        if inp.is_promo:
            score = min(100, score + 10)

        return float(np.clip(score, 0, 100))

    def _fundamental_score(self, inp: ScoringInput) -> float:
        """Fundamental value based on Pokémon and set characteristics."""
        score = 40.0

        # Pokémon popularity
        score += inp.pokemon_popularity * 0.3

        # Set maturity (older sets = more collectible)
        years_old = inp.set_age_days / 365
        if years_old > 20:
            score += 20
        elif years_old > 10:
            score += 12
        elif years_old > 5:
            score += 6
        elif years_old < 1:
            score -= 5  # Too new, unpredictable

        # Recent FOMO: new cards can be inflated
        if inp.set_age_days < 90 and inp.price_change_7d > 30:
            score -= 10  # Potential bubble

        return float(np.clip(score, 0, 100))

    def _social_score(self, inp: ScoringInput) -> float:
        """Social buzz and demand signal."""
        score = 30.0

        # Watchlist growth
        if inp.watchlist_growth_7d > 50:
            score += 30
        elif inp.watchlist_growth_7d > 20:
            score += 20
        elif inp.watchlist_growth_7d > 10:
            score += 10
        elif inp.watchlist_growth_7d < -20:
            score -= 15

        # Search volume
        if inp.search_volume_7d > 10000:
            score += 15
        elif inp.search_volume_7d > 1000:
            score += 8

        # Social mentions
        if inp.social_mentions_7d > 500:
            score += 15
        elif inp.social_mentions_7d > 100:
            score += 8
        elif inp.social_mentions_7d > 20:
            score += 4

        return float(np.clip(score, 0, 100))

    def _technical_score(self, inp: ScoringInput) -> float:
        """Technical analysis signals (RSI, Bollinger, etc.)."""
        score = 50.0

        # RSI
        if inp.rsi_14 < 30:
            score += 20  # Oversold — buy signal
        elif inp.rsi_14 < 40:
            score += 10
        elif inp.rsi_14 > 70:
            score -= 15  # Overbought — caution
        elif inp.rsi_14 > 80:
            score -= 25

        # Volatility penalty
        if inp.volatility_30d > 1.5:
            score -= 15  # Very volatile
        elif inp.volatility_30d > 1.0:
            score -= 8

        return float(np.clip(score, 0, 100))

    def _liquidity_score(self, inp: ScoringInput) -> float:
        """How easily can you buy/sell this card?"""
        score = 20.0

        # eBay sales
        if inp.ebay_sold_count_30d > 100:
            score += 40
        elif inp.ebay_sold_count_30d > 50:
            score += 25
        elif inp.ebay_sold_count_30d > 20:
            score += 15
        elif inp.ebay_sold_count_30d > 5:
            score += 8
        elif inp.ebay_sold_count_30d == 0:
            score -= 10

        # Active listings
        if inp.listings_count > 200:
            score += 25
        elif inp.listings_count > 50:
            score += 15
        elif inp.listings_count > 10:
            score += 8
        elif inp.listings_count < 3:
            score -= 15

        # Time to sell
        if inp.avg_days_to_sell < 3:
            score += 10
        elif inp.avg_days_to_sell > 30:
            score -= 15

        return float(np.clip(score, 0, 100))

    def _risk_level(self, inp: ScoringInput) -> int:
        """Risk from 0 (safe) to 100 (very risky)."""
        risk = 30

        # Volatility increases risk
        risk += min(30, inp.volatility_30d * 20)

        # Thin market increases risk
        if inp.ebay_sold_count_30d < 5:
            risk += 20
        if inp.listings_count < 5:
            risk += 15

        # Recent crash increases risk
        if inp.price_change_30d < -30:
            risk += 20

        # Overbought increases risk
        if inp.rsi_14 > 75:
            risk += 15

        # New set — uncertain
        if inp.set_age_days < 60:
            risk += 10

        return int(np.clip(risk, 0, 100))

    def _predict_roi(self, inp: ScoringInput, horizon_days: int) -> float:
        """Simple momentum-based ROI prediction."""
        # Blend short-term and long-term momentum
        short_mom = inp.price_change_7d / 100
        mid_mom = inp.price_change_30d / 100

        weeks = horizon_days / 7
        monthly = horizon_days / 30

        # Decay momentum over time
        decay = 0.7 ** (horizon_days / 30)
        roi = (short_mom * 0.4 + mid_mom * 0.6) * decay * (horizon_days / 30)

        # Cap at reasonable bounds
        return float(np.clip(roi, -0.8, 3.0))

    def _extract_signals(
        self,
        inp: ScoringInput,
        momentum: float,
        scarcity: float,
        social: float,
        technical: float,
    ) -> tuple[list[str], list[str]]:
        bullish = []
        bearish = []

        # Momentum signals
        if inp.price_change_7d > 15:
            bullish.append(f"Strong short-term momentum: +{inp.price_change_7d:.1f}% in 7 days")
        if inp.price_change_30d > 20:
            bullish.append(f"Sustained 30-day growth: +{inp.price_change_30d:.1f}%")
        if inp.volume_7d > inp.volume_avg_90d * 2:
            bullish.append("Volume surge — 2× above 90-day average")
        if inp.price_change_7d < -15:
            bearish.append(f"Short-term price drop: {inp.price_change_7d:.1f}% in 7 days")
        if inp.price_change_30d < -20:
            bearish.append(f"Prolonged 30-day decline: {inp.price_change_30d:.1f}%")

        # Technical signals
        if inp.rsi_14 < 30:
            bullish.append(f"Oversold — RSI at {inp.rsi_14:.1f}, potential reversal")
        if inp.rsi_14 > 70:
            bearish.append(f"Overbought — RSI at {inp.rsi_14:.1f}, correction risk")
        if inp.volatility_30d > 1.5:
            bearish.append(f"High volatility ({inp.volatility_30d:.2f} annualized)")

        # Scarcity signals
        if inp.population_psa10 < 50:
            bullish.append(f"Ultra low PSA 10 population: {inp.population_psa10} copies")
        if inp.is_first_edition:
            bullish.append("1st Edition — premium collectible")
        if inp.is_vintage:
            bullish.append("Vintage card (pre-2003) — strong collector demand")
        if inp.population_psa10 > 5000:
            bearish.append(f"High PSA 10 supply ({inp.population_psa10}) — may limit upside")

        # Social signals
        if inp.watchlist_growth_7d > 30:
            bullish.append(f"Watchlist growth +{inp.watchlist_growth_7d:.0f}% this week")
        if inp.social_mentions_7d > 200:
            bullish.append(f"High social buzz: {inp.social_mentions_7d} mentions this week")

        # Liquidity signals
        if inp.ebay_sold_count_30d < 3:
            bearish.append("Very low trading volume — illiquid market")
        if inp.listings_count < 5:
            bearish.append("Limited supply on market — hard to find")

        return bullish, bearish

    def _generate_insight(
        self,
        inp: ScoringInput,
        score: int,
        bullish: list[str],
        bearish: list[str],
    ) -> str:
        if score >= 80:
            return (
                f"Strong buy opportunity with score {score}/100. "
                f"{'First Edition vintage card' if inp.is_first_edition else 'Key card'} "
                f"showing momentum backed by {'rising social interest and ' if inp.social_mentions_7d > 100 else ''}"
                f"low PSA 10 population of {inp.population_psa10}."
            )
        elif score >= 65:
            return (
                f"Above-average investment opportunity (score {score}/100). "
                f"Monitor for entry point — RSI at {inp.rsi_14:.0f} and "
                f"{inp.price_change_30d:+.1f}% 30-day performance."
            )
        elif score >= 50:
            return (
                f"Neutral to slightly positive outlook (score {score}/100). "
                f"{'High volatility warrants caution. ' if inp.volatility_30d > 1.0 else ''}"
                f"Best suited for collectors rather than short-term investors."
            )
        else:
            return (
                f"Below-average investment profile (score {score}/100). "
                f"Multiple bearish signals: {', '.join(bearish[:2]) if bearish else 'weak market conditions'}."
            )
