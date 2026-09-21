import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import boosters, catalog, wallet


settings = get_settings()


app = FastAPI(
    title="TCG Game API",
    version="0.3.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.37:3000",
        settings.frontend_origin,
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
    ],
)


@app.middleware("http")
async def add_server_timing(
    request: Request,
    call_next,
):
    start = time.perf_counter()

    response = await call_next(request)

    elapsed_ms = (
        time.perf_counter()
        - start
    ) * 1000

    response.headers[
        "X-Process-Time-Ms"
    ] = f"{elapsed_ms:.1f}"

    return response


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "tcg-fastapi",
        "media": settings.card_media_base_url,
    }


app.include_router(catalog.router)
app.include_router(wallet.router)
app.include_router(boosters.router)