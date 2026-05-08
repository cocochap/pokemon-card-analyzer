"""PokeMarket AI Service — price prediction & market intelligence."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from src.api.cards import router as cards_router
from src.api.market import router as market_router
from src.api.health import router as health_router
from src.services.model_registry import ModelRegistry
from src.utils.database import engine, Base
from src.utils.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: load pre-trained models
    registry = ModelRegistry()
    await registry.load_models()
    app.state.model_registry = registry
    yield
    # Shutdown: clean up
    pass


app = FastAPI(
    title="PokeMarket AI Service",
    description="ML-powered price predictions and market analysis for Pokémon TCG",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, settings.API_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
Instrumentator().instrument(app).expose(app)

# Routers
app.include_router(health_router, prefix="/health", tags=["health"])
app.include_router(cards_router, prefix="/api/v1/cards", tags=["cards"])
app.include_router(market_router, prefix="/api/v1/market", tags=["market"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
