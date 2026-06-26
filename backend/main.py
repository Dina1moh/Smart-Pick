import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

os.environ.setdefault("OPENAI_API_KEY", os.getenv("OPENROUTER_API_KEY", ""))
os.environ.setdefault("OPENAI_API_BASE", os.getenv("OPENAI_API_BASE", "https://openrouter.ai/api/v1"))

import asyncio
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from backend.auth import router as auth_router
from backend.db import init_db
from backend.models import CompareRequest, CompareResponse, Priority
from backend.pipeline import run_comparison

# Sentinel pushed onto the SSE queue to signal the producer has finished.
_STREAM_DONE = object()

app = FastAPI(
    title="SmartPick API",
    description="AI-powered product comparison using multi-agent system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


app.include_router(auth_router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "smartpick-api"}


@app.post("/api/compare", response_model=CompareResponse)
async def compare_products(request: CompareRequest):
    if not request.product.strip():
        raise HTTPException(status_code=400, detail="Product name cannot be empty")

    try:
        result = await run_comparison(
            request.product,
            request.priority,
            request.category,
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Comparison failed: {str(e)}"
        )


@app.get("/api/compare/stream")
async def compare_products_stream(
    product: str,
    priority: Priority,
    category: str | None = None,
):
    """Server-Sent Events stream of the comparison run.

    Emits ``stage`` events as each CrewAI agent (search/review/ranking) makes
    progress, a final ``result`` event with the full CompareResponse, or an
    ``error`` event. Consumed by the frontend via EventSource.
    """
    if not product.strip():
        raise HTTPException(status_code=400, detail="Product name cannot be empty")

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    # Called from the crew worker thread -> hop back onto the event loop.
    def emit(event: str, data: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, (event, data))

    async def produce() -> None:
        try:
            result = await run_comparison(product, priority, category, emit=emit)
            emit("result", result.model_dump(mode="json"))
        except Exception as e:  # noqa: BLE001 - surface as an SSE error event
            emit("error", {"detail": f"Comparison failed: {str(e)}"})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, _STREAM_DONE)

    async def event_stream():
        producer = asyncio.create_task(produce())
        try:
            while True:
                item = await queue.get()
                if item is _STREAM_DONE:
                    break
                event, data = item
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
        finally:
            if not producer.done():
                producer.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
