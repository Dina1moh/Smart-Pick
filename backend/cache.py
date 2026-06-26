import json
import hashlib
import time
from pathlib import Path

CACHE_DIR = Path(__file__).parent / ".cache"
CACHE_TTL = 3600  # 1 hour


def _cache_key(query: str) -> str:
    return hashlib.md5(query.lower().strip().encode()).hexdigest()


def get_cached(query: str) -> list[dict] | None:
    """Return cached products for query if fresh, else None."""
    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"{_cache_key(query)}.json"

    if not cache_file.exists():
        return None

    data = json.loads(cache_file.read_text())
    if time.time() - data.get("timestamp", 0) > CACHE_TTL:
        cache_file.unlink()
        return None

    print(f"[Cache] HIT for '{query}' ({len(data['products'])} products)", flush=True)
    return data["products"]


def set_cached(query: str, products: list[dict]) -> None:
    """Cache products for query. Don't cache empty results."""
    if not products:
        return
    CACHE_DIR.mkdir(exist_ok=True)
    cache_file = CACHE_DIR / f"{_cache_key(query)}.json"

    data = {
        "query": query,
        "timestamp": time.time(),
        "products": products,
    }
    cache_file.write_text(json.dumps(data))
    print(f"[Cache] STORED '{query}' ({len(products)} products)", flush=True)


def clear_cache() -> None:
    """Clear all cached results."""
    if CACHE_DIR.exists():
        for f in CACHE_DIR.glob("*.json"):
            f.unlink()
        print("[Cache] Cleared all cache", flush=True)
