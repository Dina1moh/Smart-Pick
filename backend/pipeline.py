import asyncio
import os
import json
import math
import requests

from backend.models import Priority, ProductResult, CompareResponse


def log(msg: str):
    print(msg, flush=True)


def get_search_products():
    """Return the search_products implementation selected by the SCRAPER env var.

    SCRAPER=apify  -> backend.tools.apify_scraper.search_products (default)
    SCRAPER=tavily -> backend.tools.search_tool.search_products
    """
    scraper = os.getenv("SCRAPER", "apify").strip().lower()
    if scraper == "tavily":
        from backend.tools.search_tool import search_products as fn
        log("[SmartPick] Scraper backend: tavily")
        return fn
    # Default to Apify for any other / unset value.
    from backend.tools.apify_scraper import search_products as fn
    log("[SmartPick] Scraper backend: apify")
    return fn


def call_openrouter(messages: list[dict], max_tokens: int = 2048) -> str:
    """Direct OpenRouter API call."""
    response = requests.post(
        url="https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {os.getenv('OPENROUTER_API_KEY')}",
            "Content-Type": "application/json",
        },
        json={
            "model": os.getenv("OPENROUTER_MODEL", "qwen/qwen3-235b-a22b"),
            "messages": messages,
            "max_tokens": max_tokens,
        },
    )
    data = response.json()
    return data["choices"][0]["message"]["content"]


async def run_comparison(
    product: str,
    priority: Priority,
    category_override: str | None = None,
    emit=None,
) -> CompareResponse:
    """Run the SmartPick CrewAI crew and assemble the comparison response.

    The crew (Search -> Review -> Ranking agents backed by deterministic tools)
    runs in a worker thread because CrewAI's ``kickoff()`` is blocking. ``emit``
    is an optional ``emit(event, data)`` callback used to stream live agent
    progress; it is called from the worker thread.
    """
    emit = emit or (lambda *args, **kwargs: None)

    log(f"\n{'='*60}")
    log(f"[SmartPick] Starting crew: '{product}' | Priority: {priority.value}")
    log(f"{'='*60}")

    # Lazy import keeps CrewAI (and litellm) out of the import path for callers
    # that only need the API surface (e.g. mocked tests).
    from backend.crew import run_smartpick_crew

    state: dict = {}
    justification = await asyncio.to_thread(
        run_smartpick_crew, product, priority, category_override, state, emit
    )

    products = state.get("products", [])
    ranked = state.get("ranked", [])

    if not products or not ranked:
        return CompareResponse(
            product_query=product,
            priority=priority,
            justification=(
                justification
                or "No products found. Try a different search term."
            ),
        )

    # Category: user override wins, else infer from the first product's breadcrumb.
    category = category_override.strip() if category_override else None
    if category:
        log(f"[SmartPick] Category selected by user: {category}")
    else:
        for p in products:
            if p.get("breadCrumbs"):
                parts = p["breadCrumbs"].split(" › ")
                category = parts[-1] if len(parts) > 1 else parts[0]
                break
        log(f"[SmartPick] Category detected: {category}")

    log(f"[SmartPick] Done! Top pick: {str(ranked[0].get('title', ''))[:60]}")

    results = []
    for i, p in enumerate(ranked[:5]):
        price_data = p.get("price", {})
        if isinstance(price_data, dict):
            price_val = price_data.get("value")
            currency = price_data.get("currency", "$")
        else:
            price_val = price_data if isinstance(price_data, (int, float)) else None
            currency = "$"

        results.append(ProductResult(
            title=p.get("title", "Unknown"),
            url=p.get("url", ""),
            price=price_val,
            currency=currency,
            stars=p.get("stars"),
            reviews_count=p.get("reviewsCount") or 0,
            quality_score=p.get("quality_score", 0.0),
            delivery=p.get("delivery") or p.get("fastestDelivery"),
            warranty=p.get("returnPolicy"),
            image=p.get("thumbnailImage"),
            in_stock=p.get("inStock", True),
            rank=i + 1,
            source=p.get("source", ""),
        ))

    return CompareResponse(
        product_query=product,
        priority=priority,
        category=category,
        top_pick=results[0] if results else None,
        results=results,
        justification=justification,
        total_found=len(results),
    )


def compute_quality_scores(products: list[dict]) -> list[dict]:
    """Pure math scoring - no LLM call needed."""
    for p in products:
        stars = p.get("stars") or 0
        reviews = p.get("reviewsCount") or 0
        breakdown = p.get("starsBreakdown", {})
        one_star_ratio = breakdown.get("1star", 0.05) if breakdown else 0.05

        if stars > 0 and reviews > 0:
            p["quality_score"] = round(stars * math.log(reviews + 1) * (1 - one_star_ratio), 2)
        else:
            p["quality_score"] = 0.0

    return products


def rank_products(products: list[dict], priority: Priority) -> list[dict]:
    """Sort products by priority - pure Python, no LLM.
    Products with ratings/reviews are always preferred over those without."""

    # Separate products with data vs without
    with_data = []
    without_data = []
    for p in products:
        if not p.get("title"):
            continue
        has_stars = p.get("stars") is not None and p.get("stars", 0) > 0
        has_price = isinstance(p.get("price"), dict) and p["price"].get("value") is not None
        if has_stars or has_price:
            with_data.append(p)
        else:
            without_data.append(p)

    def sort_key(p: dict):
        price_data = p.get("price", {})
        price = price_data.get("value", 9999) if isinstance(price_data, dict) else 9999
        quality = p.get("quality_score", 0)
        reviews = p.get("reviewsCount") or 0

        if priority == Priority.LOWEST_PRICE:
            return (price, -quality)
        elif priority == Priority.BEST_RATING:
            return (-quality, -reviews)
        elif priority == Priority.BEST_WARRANTY:
            has_policy = 0 if p.get("returnPolicy") else 1
            return (has_policy, -quality)
        elif priority == Priority.FASTEST_DELIVERY:
            delivery = p.get("fastestDelivery") or p.get("delivery") or "zzz"
            return (delivery, -quality)
        return (-quality,)

    # Sort each group, then combine (products with data first)
    with_data.sort(key=sort_key)
    without_data.sort(key=sort_key)
    return with_data + without_data


def generate_justification(
    top_products: list[dict],
    priority: Priority,
    query: str,
) -> str:
    """Direct OpenRouter call for the justification.

    Used as the deterministic fallback when the ranking agent doesn't return a
    usable justification (e.g. an LLM hiccup). Synchronous — callers run it from
    the crew worker thread.
    """
    priority_label = priority.value.replace("_", " ")
    products_text = ""
    for i, p in enumerate(top_products[:5]):
        price_data = p.get("price", {})
        price_str = f"${price_data.get('value', 'N/A')}" if isinstance(price_data, dict) else "N/A"
        products_text += (
            f"#{i+1}: {p.get('title', '')[:80]} | "
            f"Price: {price_str} | Stars: {p.get('stars', 'N/A')} | "
            f"Reviews: {p.get('reviewsCount', 0)} | Score: {p.get('quality_score', 0)}\n"
        )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a shopping advisor. Write a 2-3 sentence justification explaining "
                "why the #1 product is the best pick. Be specific about numbers. Be concise. "
                "Do NOT use markdown or bullet points. Just plain sentences."
            ),
        },
        {
            "role": "user",
            "content": (
                f"User searched: '{query}' with priority: '{priority_label}'\n\n"
                f"Top products:\n{products_text}\n"
                f"Explain why #1 is the best choice for '{priority_label}'."
            ),
        },
    ]

    try:
        result = call_openrouter(messages, max_tokens=300)
        return result.strip()
    except Exception as e:
        log(f"[SmartPick] LLM error: {e}")
        return "This product ranks highest based on your selected priority."
