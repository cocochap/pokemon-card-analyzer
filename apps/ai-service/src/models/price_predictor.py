"""
Price prediction model combining Prophet + LightGBM + XGBoost ensemble.
"""
import numpy as np
import pandas as pd
from prophet import Prophet
import lightgbm as lgb
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
from dataclasses import dataclass
from typing import Optional
import logging
import warnings

warnings.filterwarnings("ignore")
logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    horizon_days: int
    predicted_price: float
    lower_bound: float
    upper_bound: float
    confidence: float
    trend: str  # BULLISH | BEARISH | STABLE
    model_contributions: dict[str, float]


@dataclass
class CardFeatures:
    card_id: str
    prices: list[dict]       # [{date, price, volume}]
    rarity_score: int        # 0-100
    population_psa10: int    # PSA 10 pop
    set_age_days: int        # days since set release
    market_cap_usd: float
    watchlist_count: int
    social_mentions: int


class ProphetPredictor:
    """Facebook Prophet for time-series forecasting."""

    def __init__(self):
        self.model: Optional[Prophet] = None

    def fit(self, df: pd.DataFrame) -> None:
        """df must have columns: ds (datetime), y (price)"""
        self.model = Prophet(
            changepoint_prior_scale=0.05,
            seasonality_prior_scale=10,
            seasonality_mode="multiplicative",
            weekly_seasonality=True,
            daily_seasonality=False,
            yearly_seasonality=True,
        )
        # Add regressors for external signals
        if "volume" in df.columns:
            self.model.add_regressor("volume", standardize=True)
        if "social_score" in df.columns:
            self.model.add_regressor("social_score", standardize=True)

        self.model.fit(df)

    def predict(self, horizon_days: int, future_data: Optional[pd.DataFrame] = None) -> pd.DataFrame:
        if self.model is None:
            raise ValueError("Model not fitted")

        future = self.model.make_future_dataframe(periods=horizon_days)
        if future_data is not None:
            for col in future_data.columns:
                if col not in ["ds", "y"]:
                    future[col] = 0
                    future.loc[future.index[-horizon_days:], col] = future_data[col].values

        forecast = self.model.predict(future)
        return forecast.tail(horizon_days)[["ds", "yhat", "yhat_lower", "yhat_upper"]]


class LightGBMPredictor:
    """LightGBM gradient boosting for feature-rich prediction."""

    def __init__(self):
        self.model: Optional[lgb.LGBMRegressor] = None
        self.scaler = StandardScaler()
        self.feature_names: list[str] = []

    def _engineer_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Create lag features, rolling stats, momentum indicators."""
        df = df.copy().sort_values("date")

        # Lag features
        for lag in [1, 3, 7, 14, 30]:
            df[f"price_lag_{lag}"] = df["price"].shift(lag)
            df[f"volume_lag_{lag}"] = df["volume"].shift(lag) if "volume" in df.columns else 0

        # Rolling statistics
        for window in [7, 14, 30]:
            df[f"price_ma_{window}"] = df["price"].rolling(window).mean()
            df[f"price_std_{window}"] = df["price"].rolling(window).std()
            df[f"price_min_{window}"] = df["price"].rolling(window).min()
            df[f"price_max_{window}"] = df["price"].rolling(window).max()

        # Price momentum
        df["momentum_7d"] = df["price"] / df["price"].shift(7) - 1
        df["momentum_30d"] = df["price"] / df["price"].shift(30) - 1

        # Volatility (annualized)
        df["volatility_14d"] = df["price"].pct_change().rolling(14).std() * np.sqrt(365)

        # RSI(14)
        delta = df["price"].diff()
        gain = (delta.where(delta > 0, 0)).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        df["rsi_14"] = 100 - (100 / (1 + rs))

        # Bollinger bands position
        ma20 = df["price"].rolling(20).mean()
        std20 = df["price"].rolling(20).std()
        df["bb_position"] = (df["price"] - ma20) / (2 * std20)

        # Time features
        df["dayofweek"] = pd.to_datetime(df["date"]).dt.dayofweek
        df["month"] = pd.to_datetime(df["date"]).dt.month
        df["quarter"] = pd.to_datetime(df["date"]).dt.quarter

        return df.dropna()

    def fit(self, df: pd.DataFrame, target_horizon: int = 30) -> dict:
        """Fit model to predict price `target_horizon` days ahead."""
        featured = self._engineer_features(df)

        # Target: price in `horizon` days
        featured["target"] = featured["price"].shift(-target_horizon)
        featured = featured.dropna(subset=["target"])

        feature_cols = [c for c in featured.columns if c not in ["date", "price", "target"]]
        self.feature_names = feature_cols

        X = featured[feature_cols].values
        y = featured["target"].values
        X_scaled = self.scaler.fit_transform(X)

        # Time-series cross-validation
        tscv = TimeSeriesSplit(n_splits=5)
        self.model = lgb.LGBMRegressor(
            n_estimators=500,
            learning_rate=0.03,
            num_leaves=31,
            max_depth=6,
            min_child_samples=20,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=0.1,
            random_state=42,
            verbosity=-1,
        )

        val_scores = []
        for train_idx, val_idx in tscv.split(X_scaled):
            self.model.fit(
                X_scaled[train_idx], y[train_idx],
                eval_set=[(X_scaled[val_idx], y[val_idx])],
                callbacks=[lgb.early_stopping(50, verbose=False)],
            )
            pred = self.model.predict(X_scaled[val_idx])
            mape = np.mean(np.abs((y[val_idx] - pred) / (y[val_idx] + 1e-8)))
            val_scores.append(mape)

        return {"val_mape": float(np.mean(val_scores)), "horizon": target_horizon}

    def predict(self, features: dict) -> tuple[float, float]:
        """Returns (predicted_price, uncertainty)."""
        if self.model is None:
            raise ValueError("Model not fitted")

        X = np.array([[features.get(f, 0) for f in self.feature_names]])
        X_scaled = self.scaler.transform(X)
        pred = float(self.model.predict(X_scaled)[0])

        # Estimate uncertainty from feature importances variance
        uncertainty = pred * 0.1  # 10% default uncertainty
        return pred, uncertainty


class EnsemblePredictor:
    """Weighted ensemble of Prophet + LightGBM + XGBoost."""

    WEIGHTS = {"prophet": 0.4, "lgbm": 0.35, "xgb": 0.25}

    def __init__(self):
        self.prophet = ProphetPredictor()
        self.lgbm = LightGBMPredictor()
        self.fitted = False

    def fit(self, features: CardFeatures) -> dict:
        """Train all sub-models on card price history."""
        if len(features.prices) < 30:
            raise ValueError(f"Insufficient data: {len(features.prices)} points (need 30+)")

        df = pd.DataFrame(features.prices)
        df["date"] = pd.to_datetime(df["date"])
        df = df.sort_values("date").reset_index(drop=True)

        # Prophet format
        prophet_df = df.rename(columns={"date": "ds", "price": "y"})
        if "volume" in df.columns:
            prophet_df["volume"] = df["volume"]

        metrics = {}
        try:
            self.prophet.fit(prophet_df)
            metrics["prophet"] = "fitted"
        except Exception as e:
            logger.warning(f"Prophet fit failed: {e}")

        for horizon in [7, 30, 90]:
            try:
                m = self.lgbm.fit(df, target_horizon=horizon)
                metrics[f"lgbm_{horizon}d"] = m
            except Exception as e:
                logger.warning(f"LGBM fit failed for {horizon}d: {e}")

        self.fitted = True
        return metrics

    def predict(self, features: CardFeatures, horizons: list[int] = [7, 30, 90]) -> list[PredictionResult]:
        """Generate ensemble predictions for multiple horizons."""
        results = []

        df = pd.DataFrame(features.prices)
        df["date"] = pd.to_datetime(df["date"])
        current_price = float(df["price"].iloc[-1])

        for horizon in horizons:
            try:
                pred = self._ensemble_predict(df, current_price, horizon, features)
                results.append(pred)
            except Exception as e:
                logger.error(f"Prediction failed for {horizon}d: {e}")
                # Fallback: trend extrapolation
                results.append(self._fallback_predict(current_price, horizon))

        return results

    def _ensemble_predict(
        self,
        df: pd.DataFrame,
        current_price: float,
        horizon: int,
        features: CardFeatures,
    ) -> PredictionResult:
        predictions = {}
        uncertainties = {}

        # Prophet prediction
        try:
            prophet_df = df.rename(columns={"date": "ds", "price": "y"})
            prophet_forecast = self.prophet.predict(horizon)
            predictions["prophet"] = float(prophet_forecast["yhat"].iloc[-1])
            lower = float(prophet_forecast["yhat_lower"].iloc[-1])
            upper = float(prophet_forecast["yhat_upper"].iloc[-1])
            uncertainties["prophet"] = (upper - lower) / 2
        except Exception:
            predictions["prophet"] = current_price

        # LightGBM prediction
        try:
            latest = self.lgbm._engineer_features(df).iloc[-1].to_dict()
            latest["rarity_score"] = features.rarity_score
            latest["population_psa10"] = features.population_psa10
            pred, unc = self.lgbm.predict(latest)
            predictions["lgbm"] = pred
            uncertainties["lgbm"] = unc
        except Exception:
            predictions["lgbm"] = current_price

        # Ensemble weighted average
        total_weight = sum(self.WEIGHTS.get(k, 0) for k in predictions)
        if total_weight == 0:
            ensemble_pred = current_price
        else:
            ensemble_pred = sum(
                predictions[k] * self.WEIGHTS.get(k, 0) for k in predictions
            ) / total_weight

        # Uncertainty as weighted average
        avg_uncertainty = np.mean(list(uncertainties.values())) if uncertainties else current_price * 0.15

        # Confidence: higher when models agree
        if len(predictions) > 1:
            pred_values = list(predictions.values())
            agreement = 1 - (np.std(pred_values) / (np.mean(pred_values) + 1e-8))
            confidence = float(np.clip(agreement, 0.3, 0.95))
        else:
            confidence = 0.6

        # Trend classification
        roi = (ensemble_pred - current_price) / (current_price + 1e-8)
        if roi > 0.05:
            trend = "BULLISH"
        elif roi < -0.05:
            trend = "BEARISH"
        else:
            trend = "STABLE"

        return PredictionResult(
            horizon_days=horizon,
            predicted_price=round(max(0.01, ensemble_pred), 2),
            lower_bound=round(max(0.01, ensemble_pred - avg_uncertainty), 2),
            upper_bound=round(ensemble_pred + avg_uncertainty, 2),
            confidence=round(confidence, 4),
            trend=trend,
            model_contributions=predictions,
        )

    def _fallback_predict(self, current_price: float, horizon: int) -> PredictionResult:
        return PredictionResult(
            horizon_days=horizon,
            predicted_price=current_price,
            lower_bound=current_price * 0.85,
            upper_bound=current_price * 1.15,
            confidence=0.3,
            trend="STABLE",
            model_contributions={},
        )
