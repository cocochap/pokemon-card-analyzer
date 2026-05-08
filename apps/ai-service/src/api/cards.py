"""AI endpoints for card analysis and predictions."""
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import Optional
import asyncpg
import logging

from src.models.price_predictor import EnsemblePredictor, CardFeatures
from src.services.investment_scorer import InvestmentScorer, ScoringInput
from src.utils.database import get_db_connection
from src.utils.cache import cache_response

logger = logging.getLogger(__name__)
router = APIRouter()


class AnalysisResponse(BaseModel):
    card_id: str
    investment_score: int
    rarity_score: int
    liquidity_score: int
    risk_level: int
    trend_direction: str
    confidence_score: float
    key_insight: str
    bullish_signals: list[str]
    bearish_signals: list[str]
    predicted_roi_30d: float
    predicted_roi_90d: float
    predictions: list[dict]
    model_version: str
    current_price: float


@router.get("/{card_id}/analysis", response_model=AnalysisResponse)
@cache_response(ttl=300)
async def analyze_card(card_id: str, request: Request):
    """Run full AI analysis on a card."""
    try:
        async with get_db_connection() as conn:
            card_data = await _fetch_card_data(conn, card_id)
            if not card_data:
                raise HTTPException(status_code=404, detail="Card not found")

            price_history = await _fetch_price_history(conn, card_id)
            if len(price_history) < 14:
                raise HTTPException(
                    status_code=422,
                    detail="Insufficient price history for analysis (need 14+ days)",
                )

        # Build features
        features = CardFeatures(
            card_id=card_id,
            prices=price_history,
            rarity_score=card_data["rarity_score"],
            population_psa10=card_data["population_psa10"] or 0,
            set_age_days=card_data["set_age_days"],
            market_cap_usd=card_data["market_cap_usd"] or 0,
            watchlist_count=card_data["watchlist_count"],
            social_mentions=card_data["social_mentions"],
        )

        # Scoring
        scoring_input = _build_scoring_input(card_data, price_history)
        scorer = InvestmentScorer()
        score_result = scorer.score(scoring_input)

        # Price predictions
        predictor = EnsemblePredictor()
        predictor.fit(features)
        predictions = predictor.predict(features, horizons=[7, 30, 90])

        current_price = price_history[-1]["price"] if price_history else 0

        # Determine overall trend
        pred_30d = next((p for p in predictions if p.horizon_days == 30), None)
        trend = pred_30d.trend if pred_30d else "STABLE"

        # Confidence = mean of prediction confidences
        confidence = sum(p.confidence for p in predictions) / len(predictions) if predictions else 0.5

        return AnalysisResponse(
            card_id=card_id,
            investment_score=score_result.investment_score,
            rarity_score=score_result.rarity_score,
            liquidity_score=score_result.liquidity_score,
            risk_level=score_result.risk_level,
            trend_direction=trend,
            confidence_score=round(confidence, 4),
            key_insight=score_result.key_insight,
            bullish_signals=score_result.bullish_signals,
            bearish_signals=score_result.bearish_signals,
            predicted_roi_30d=score_result.predicted_roi_30d,
            predicted_roi_90d=score_result.predicted_roi_90d,
            predictions=[
                {
                    "horizonDays": p.horizon_days,
                    "predictedPrice": p.predicted_price,
                    "lowerBound": p.lower_bound,
                    "upperBound": p.upper_bound,
                    "confidence": p.confidence,
                }
                for p in predictions
            ],
            model_version="ensemble-v1.2",
            current_price=float(current_price),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analysis failed for card {card_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.post("/{card_id}/analyze")
async def trigger_analysis(card_id: str, background_tasks: BackgroundTasks):
    """Trigger async re-analysis of a card."""
    background_tasks.add_task(_run_background_analysis, card_id)
    return {"status": "queued", "card_id": card_id}


async def _run_background_analysis(card_id: str):
    """Background task to analyze and persist results."""
    try:
        async with get_db_connection() as conn:
            card_data = await _fetch_card_data(conn, card_id)
            price_history = await _fetch_price_history(conn, card_id)

            if not card_data or len(price_history) < 14:
                return

            features = CardFeatures(
                card_id=card_id,
                prices=price_history,
                rarity_score=card_data["rarity_score"],
                population_psa10=card_data["population_psa10"] or 0,
                set_age_days=card_data["set_age_days"],
                market_cap_usd=card_data["market_cap_usd"] or 0,
                watchlist_count=card_data["watchlist_count"],
                social_mentions=card_data["social_mentions"],
            )

            scoring_input = _build_scoring_input(card_data, price_history)
            scorer = InvestmentScorer()
            score_result = scorer.score(scoring_input)

            predictor = EnsemblePredictor()
            predictor.fit(features)
            predictions = predictor.predict(features, horizons=[7, 30, 90])

            current_price = price_history[-1]["price"] if price_history else 0
            pred_30d = next((p for p in predictions if p.horizon_days == 30), None)
            trend = pred_30d.trend if pred_30d else "STABLE"
            confidence = sum(p.confidence for p in predictions) / len(predictions)

            # Persist to DB
            await conn.execute("""
                INSERT INTO "CardAiAnalysis" (
                    "cardId", "investmentScore", "rarityScore", "liquidityScore",
                    "riskLevel", "predictedRoi30d", "predictedRoi90d",
                    "trendDirection", "confidenceScore", "bullishSignals",
                    "bearishSignals", "keyInsight", "modelVersion", "analyzedAt", "updatedAt"
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
                ON CONFLICT ("cardId") DO UPDATE SET
                    "investmentScore"=$2, "rarityScore"=$3, "liquidityScore"=$4,
                    "riskLevel"=$5, "predictedRoi30d"=$6, "predictedRoi90d"=$7,
                    "trendDirection"=$8, "confidenceScore"=$9, "bullishSignals"=$10,
                    "bearishSignals"=$11, "keyInsight"=$12, "modelVersion"=$13, "updatedAt"=NOW()
            """,
                card_id,
                score_result.investment_score,
                score_result.rarity_score,
                score_result.liquidity_score,
                score_result.risk_level,
                score_result.predicted_roi_30d,
                score_result.predicted_roi_90d,
                trend,
                float(confidence),
                score_result.bullish_signals,
                score_result.bearish_signals,
                score_result.key_insight,
                "ensemble-v1.2",
            )

            # Save predictions
            for pred in predictions:
                await conn.execute("""
                    INSERT INTO "PricePrediction" (
                        "analysisId", "horizonDays", "predictedPrice",
                        "lowerBound", "upperBound", "confidence", "modelName", "createdAt"
                    )
                    SELECT id, $2, $3, $4, $5, $6, $7, NOW()
                    FROM "CardAiAnalysis" WHERE "cardId" = $1
                """,
                    card_id, pred.horizon_days, pred.predicted_price,
                    pred.lower_bound, pred.upper_bound, pred.confidence, "ensemble-v1.2",
                )

            logger.info(f"Analysis completed for card {card_id} — score: {score_result.investment_score}")

    except Exception as e:
        logger.error(f"Background analysis failed for {card_id}: {e}", exc_info=True)


async def _fetch_card_data(conn, card_id: str) -> dict | None:
    row = await conn.fetchrow("""
        SELECT
            c.id, c.rarity, c."setId", c."nationalPokedexNumbers",
            c."variant", c."language",
            s."releaseDate",
            EXTRACT(EPOCH FROM (NOW() - s."releaseDate")) / 86400 AS set_age_days,
            COALESCE(pp."population", 0) AS population_psa10,
            COALESCE(pm."watchlists", 0) AS watchlist_count,
            COALESCE(pm."socialMentions", 0) AS social_mentions,
            COALESCE(cmd."marketCap", 0) AS market_cap_usd,
            CASE c.rarity
                WHEN 'CROWN_RARE' THEN 10
                WHEN 'HYPER_RARE' THEN 9
                WHEN 'SPECIAL_ILLUSTRATION_RARE' THEN 9
                WHEN 'ILLUSTRATION_RARE' THEN 8
                WHEN 'RARE_SECRET' THEN 8
                WHEN 'RARE_RAINBOW' THEN 7
                WHEN 'RARE_ULTRA' THEN 7
                WHEN 'RARE_HOLO_VSTAR' THEN 6
                WHEN 'RARE_HOLO_VMAX' THEN 6
                WHEN 'RARE_HOLO_V' THEN 5
                WHEN 'RARE_HOLO' THEN 5
                WHEN 'RARE' THEN 4
                WHEN 'UNCOMMON' THEN 3
                WHEN 'COMMON' THEN 2
                ELSE 3
            END AS rarity_score
        FROM "Card" c
        JOIN "PokemonSet" s ON s.id = c."setId"
        LEFT JOIN "PsaPopulation" pp ON pp."cardId" = c.id AND pp.company = 'PSA' AND pp.grade = 10
        LEFT JOIN "PopularityMetric" pm ON pm."cardId" = c.id
        LEFT JOIN "CardMarketData" cmd ON cmd."cardId" = c.id
        WHERE c.id = $1
        LIMIT 1
    """, card_id)
    return dict(row) if row else None


async def _fetch_price_history(conn, card_id: str) -> list[dict]:
    rows = await conn.fetch("""
        SELECT
            DATE("recordedAt") AS date,
            AVG(price) AS price,
            COALESCE(SUM(1), 0) AS volume
        FROM "PriceHistory"
        WHERE "cardId" = $1 AND source = 'cardmarket'
        GROUP BY DATE("recordedAt")
        ORDER BY date ASC
        LIMIT 730
    """, card_id)
    return [{"date": str(r["date"]), "price": float(r["price"]), "volume": int(r["volume"])} for r in rows]


def _build_scoring_input(card_data: dict, price_history: list[dict]) -> ScoringInput:
    if not price_history:
        return ScoringInput(**{f: 0 for f in ScoringInput.__dataclass_fields__})

    prices = [p["price"] for p in price_history]
    current = prices[-1]

    def pct_change(days: int) -> float:
        if len(prices) < days + 1:
            return 0.0
        past = prices[-(days + 1)]
        return ((current - past) / (past + 1e-8)) * 100

    import numpy as np
    returns = np.diff(prices) / (np.array(prices[:-1]) + 1e-8)
    vol_30d = float(np.std(returns[-30:]) * np.sqrt(365)) if len(returns) >= 30 else 0.5

    # RSI 14
    def rsi(series, period=14):
        if len(series) < period:
            return 50.0
        deltas = np.diff(series)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)
        avg_g = np.mean(gains[-period:])
        avg_l = np.mean(losses[-period:])
        if avg_l == 0:
            return 100.0
        return 100 - 100 / (1 + avg_g / avg_l)

    volumes = [p.get("volume", 0) for p in price_history]

    return ScoringInput(
        price_change_7d=pct_change(7),
        price_change_30d=pct_change(30),
        price_change_90d=pct_change(90),
        price_change_1y=pct_change(365),
        volatility_30d=vol_30d,
        rsi_14=rsi(prices),
        volume_7d=sum(volumes[-7:]),
        volume_30d=sum(volumes[-30:]),
        volume_avg_90d=sum(volumes[-90:]) / 90 if len(volumes) >= 90 else sum(volumes) / len(volumes),
        rarity_rank=card_data.get("rarity_score", 3),
        population_psa9=0,
        population_psa10=card_data.get("population_psa10", 0),
        total_print_run=None,
        set_age_days=int(card_data.get("set_age_days", 0)),
        is_vintage=card_data.get("set_age_days", 0) > 7300,  # 20 years
        is_first_edition=card_data.get("variant") == "FIRST_EDITION",
        is_shadowless=card_data.get("variant") == "SHADOWLESS",
        is_promo=card_data.get("variant") == "PROMO",
        pokemon_popularity=50,
        watchlist_growth_7d=0.0,
        search_volume_7d=card_data.get("watchlist_count", 0) * 10,
        social_mentions_7d=card_data.get("social_mentions", 0),
        ebay_sold_count_30d=int(sum(volumes[-30:])),
        listings_count=max(1, int(card_data.get("watchlist_count", 10))),
        avg_days_to_sell=7.0,
    )
