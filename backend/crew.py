"""CrewAI orchestration for SmartPick.

A hybrid crew: three CrewAI agents (Search -> Review -> Ranking) run
sequentially, but the expensive/critical work — scraping, quality scoring and
priority ranking — lives in *deterministic* tools so results stay fast and
reproducible. The LLM's job is to drive the tools and write the final
human-readable justification of the #1 pick.

The crew runs synchronously (CrewAI `kickoff()` is blocking); callers should run
it in a worker thread. Progress is surfaced through an ``emit`` callback so the
API can stream live agent updates to the frontend.
"""

import json
from typing import Callable

from crewai import Agent, Crew, LLM, Process, Task
from crewai.tools import tool

from backend.agents.ranking_agent import build_ranking_agent
from backend.agents.review_agent import build_review_agent
from backend.agents.search_agent import build_search_agent
from backend.models import Priority

# emit(event_name, payload) -> None. Defaults to a no-op for non-streaming calls.
Emit = Callable[[str, dict], None]


def log(msg: str) -> None:
    print(msg, flush=True)


def get_crew_llm() -> LLM:
    """CrewAI LLM bound to OpenRouter (OpenAI-compatible) via litellm.

    litellm routes any ``openrouter/<model>`` slug to OpenRouter using
    ``OPENROUTER_API_KEY``; we also pass the key/base explicitly so the config is
    self-contained.
    """
    import os

    model = os.getenv("OPENROUTER_MODEL", "qwen/qwen3-235b-a22b")
    if not model.startswith("openrouter/"):
        model = f"openrouter/{model}"

    return LLM(
        model=model,
        api_key=os.getenv("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        temperature=0.3,
        max_tokens=512,
    )


def _stage(emit: Emit, agent: str, status: str, message: str) -> None:
    """Push a pipeline progress event (agent = search|review|ranking)."""
    emit("stage", {"agent": agent, "status": status, "message": message})


def _format_top(products: list[dict]) -> str:
    """Compact top-N summary fed to the ranking LLM (keeps token usage small)."""
    lines = []
    for i, p in enumerate(products):
        price = p.get("price", {})
        price_str = (
            f"{price.get('currency', '$')}{price.get('value')}"
            if isinstance(price, dict) and price.get("value") is not None
            else "N/A"
        )
        lines.append(
            f"#{i + 1}: {str(p.get('title', ''))[:80]} | store: {p.get('source', '?')} | "
            f"price: {price_str} | stars: {p.get('stars', 'N/A')} | "
            f"reviews: {p.get('reviewsCount', 0)} | score: {p.get('quality_score', 0)}"
        )
    return "\n".join(lines) if lines else "No products."


def run_smartpick_crew(
    product: str,
    priority: Priority,
    category_override: str | None,
    state: dict,
    emit: Emit,
) -> str:
    """Run the CrewAI crew and return the justification string.

    ``state`` is mutated in place with ``products``, ``scored`` and ``ranked`` so
    the caller can build the final response from authoritative tool output rather
    than parsing LLM text.
    """
    # Imported here (not at module top) to avoid a circular import: pipeline.py
    # imports this module lazily, and we reuse its deterministic helpers.
    from backend.pipeline import (
        compute_quality_scores,
        generate_justification,
        get_search_products,
        rank_products,
    )

    state.setdefault("products", [])
    state.setdefault("scored", [])
    state.setdefault("ranked", [])

    search_products = get_search_products()
    priority_label = priority.value.replace("_", " ")

    # ----- Deterministic tools (closures over shared state + emit) -----------

    @tool("search_marketplaces")
    def search_marketplaces(query: str) -> str:
        """Search major online retailers for a product and return how many
        in-stock listings were found. Call exactly once with the shopper's query."""
        _stage(emit, "search", "active", "Scanning major retailers…")
        raw = search_products(query, max_per_store=20)
        products = json.loads(raw)
        available = [p for p in products if p.get("inStock", True) is not False]
        state["products"] = available
        _stage(emit, "search", "done", f"Found {len(available)} in-stock listings")
        return f"Found {len(available)} in-stock product listings for '{query}'."

    @tool("score_reviews")
    def score_reviews(note: str = "") -> str:
        """Compute a quality score for every product discovered by the search
        step. Call exactly once; no arguments are required."""
        _stage(emit, "review", "active", "Scoring sentiment & quality…")
        scored = compute_quality_scores(state.get("products", []))
        state["scored"] = scored
        rated = sum(1 for p in scored if p.get("quality_score"))
        _stage(emit, "review", "done", f"Scored {len(scored)} products")
        return f"Computed quality scores for {len(scored)} products ({rated} with rating data)."

    @tool("rank_by_priority")
    def rank_by_priority(note: str = "") -> str:
        """Rank the scored products by the shopper's priority and return a compact
        list of the top 5. Call exactly once; no arguments are required."""
        _stage(emit, "ranking", "active", "Ranking the best options…")
        ranked = rank_products(state.get("scored") or state.get("products", []), priority)
        state["ranked"] = ranked
        _stage(emit, "ranking", "done", "Recommendation ready")
        return _format_top(ranked[:5])

    # ----- Agents + tasks -----------------------------------------------------

    llm = get_crew_llm()
    search_agent = build_search_agent(llm, [search_marketplaces])
    review_agent = build_review_agent(llm, [score_reviews])
    ranking_agent = build_ranking_agent(llm, [rank_by_priority])

    search_task = Task(
        description=(
            f"Find products for the shopper's query: '{product}'. "
            "Call the search_marketplaces tool exactly once, passing that query."
        ),
        expected_output="A one-line summary of how many product listings were found.",
        agent=search_agent,
    )
    review_task = Task(
        description=(
            "Call the score_reviews tool exactly once to compute quality scores for "
            "the products that were found."
        ),
        expected_output="A one-line summary of the scoring step.",
        agent=review_agent,
        context=[search_task],
    )
    ranking_task = Task(
        description=(
            f"Call the rank_by_priority tool exactly once to rank the products for the "
            f"priority '{priority_label}'. Using the tool's returned top-5 list, write a "
            f"concise 2-3 sentence justification explaining why the #1 product is the best "
            f"pick for '{priority_label}'. Be specific about price, rating and review "
            "numbers, and name the store. Plain sentences only — no markdown, no bullet lists."
        ),
        expected_output="A 2-3 sentence plain-text justification of the #1 pick.",
        agent=ranking_agent,
        context=[review_task],
    )

    crew = Crew(
        agents=[search_agent, review_agent, ranking_agent],
        tasks=[search_task, review_task, ranking_task],
        process=Process.sequential,
        verbose=False,
    )

    justification = ""
    try:
        result = crew.kickoff()
        justification = str(getattr(result, "raw", result) or "").strip()
    except Exception as e:  # noqa: BLE001 - degrade gracefully, never 500 the crew
        log(f"[SmartPick] Crew error: {e}")

    # ----- Safety nets --------------------------------------------------------
    # Guarantee authoritative results even if an agent skipped its tool (e.g. the
    # model failed to emit a tool call). These reuse the exact same deterministic
    # functions the tools wrap, so output is identical to the agentic path.
    if not state["products"]:
        _stage(emit, "search", "active", "Scanning major retailers…")
        products = json.loads(search_products(product, max_per_store=20))
        state["products"] = [p for p in products if p.get("inStock", True) is not False]
        _stage(emit, "search", "done", f"Found {len(state['products'])} in-stock listings")

    if state["products"] and not state["scored"]:
        state["scored"] = compute_quality_scores(state["products"])

    if state["products"] and not state["ranked"]:
        _stage(emit, "ranking", "active", "Ranking the best options…")
        state["ranked"] = rank_products(state["scored"] or state["products"], priority)
        _stage(emit, "ranking", "done", "Recommendation ready")

    if not justification and state["ranked"]:
        justification = generate_justification(state["ranked"][:5], priority, product)

    return justification
