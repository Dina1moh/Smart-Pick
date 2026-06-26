import os
import json

from backend.cache import get_cached, set_cached
from backend.tools.search_tool import (
    detect_source,
    detect_availability,
    filter_relevant_products,
    is_search_page,
)

ACTOR_ID = "apify/e-commerce-scraping-tool"
# REST fallback uses the tilde form of the actor id.
ACTOR_ID_REST = "apify~e-commerce-scraping-tool"

# Map common ISO currency codes / symbols to the display currency the rest of
# the pipeline expects (mirrors search_tool's normalization).
_CURRENCY_DISPLAY = {
    "USD": "$", "US$": "$", "$": "$",
    "GBP": "£", "£": "£",
    "EUR": "€", "€": "€",
    "EGP": "EGP", "AED": "AED", "SAR": "SAR",
    "INR": "₹", "₹": "₹",
}


def _normalize_currency(code) -> str:
    if not code:
        return "$"
    return _CURRENCY_DISPLAY.get(str(code).strip().upper(), str(code).strip() or "$")


def _first(d: dict, *keys):
    """Return the first present, non-None value among the given keys."""
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _to_float(val):
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return float(val)
    try:
        # Strip currency symbols / thousands separators from string prices.
        cleaned = "".join(c for c in str(val) if c.isdigit() or c == ".")
        return float(cleaned) if cleaned else None
    except (ValueError, TypeError):
        return None


def _to_int(val):
    f = _to_float(val)
    return int(f) if f is not None else None


def _coerce_price(val):
    """Return (value, currency_token) from a price in any shape the actor emits.

    Handles numbers, currency strings ("$199.95", "USD 199.95", "199,95 EUR"),
    nested dicts ({"value": .., "currency": ..} / {"amount": ..} / {"price": ..}),
    and lists of any of those (first usable wins). Currency token is None when it
    can't be determined here (caller falls back to other fields)."""
    if val is None:
        return None, None
    if isinstance(val, (int, float)):
        return float(val), None
    if isinstance(val, str):
        return _to_float(val), None
    if isinstance(val, dict):
        num = _to_float(_first(val, "value", "amount", "price", "lowPrice", "min", "current"))
        cur = _first(val, "currency", "priceCurrency", "currencyCode")
        return num, cur
    if isinstance(val, list):
        for v in val:
            num, cur = _coerce_price(v)
            if num is not None:
                return num, cur
    return None, None


def _extract_offers(item: dict) -> dict:
    """Offers may be a dict, a list of offer dicts, or absent."""
    offers = item.get("offers")
    if isinstance(offers, list) and offers:
        return offers[0] if isinstance(offers[0], dict) else {}
    if isinstance(offers, dict):
        return offers
    return {}


def _extract_rating(item: dict):
    """Rating can live at top level or nested under aggregateRating."""
    agg = item.get("aggregateRating")
    if isinstance(agg, dict):
        val = _to_float(_first(agg, "ratingValue", "value", "rating"))
        if val is not None:
            return val
    return _to_float(_first(item, "rating", "stars", "ratingValue", "averageRating"))


def _extract_reviews(item: dict):
    agg = item.get("aggregateRating")
    if isinstance(agg, dict):
        val = _to_int(_first(agg, "reviewCount", "ratingCount", "reviews"))
        if val is not None:
            return val
    return _to_int(_first(item, "reviewCount", "reviewsCount", "ratingCount", "reviews"))


def _extract_brand(item: dict) -> str:
    brand = item.get("brand")
    if isinstance(brand, dict):
        # This actor returns brand as {"name": ...} or {"slogan": ...}.
        return str(brand.get("name") or brand.get("slogan") or "")
    return str(brand or "")


def _build_content(name, description, brand, offers, item) -> str:
    """Text blob so the downstream LLM-extraction/enrichment fallback still works."""
    parts = [name or ""]
    if brand:
        parts.append(f"Brand: {brand}")
    if description:
        parts.append(str(description))
    price = _first(offers, "price")
    currency = _first(offers, "priceCurrency", "currency")
    if price is not None:
        parts.append(f"Price: {currency or ''} {price}".strip())
    availability = _first(offers, "availability") or _first(item, "availability")
    if availability:
        parts.append(str(availability))
    seller = _first(offers, "seller") or _first(item, "seller", "merchantName")
    if isinstance(seller, dict):
        seller = seller.get("name")
    if seller:
        parts.append(f"Seller: {seller}")
    return " | ".join(str(p) for p in parts if p)


def _extract_price_from_ai_summary(ai_summary: str) -> tuple:
    """Extract price from AI summary text."""
    import re
    if not ai_summary:
        return None, None
    
    # Patterns for various price formats in AI summary
    patterns = [
        r'(?:price|priced at|costs?|for|at)\s*[:\s]*([€$£₹]|EGP|USD|EUR|GBP|AED|SAR)?\s*([\d,]+(?:\.\d{2})?)',
        r'([€$£₹]|EGP|USD|EUR|GBP|AED|SAR)\s*([\d,]+(?:\.\d{2})?)',
        r'([\d,]+(?:\.\d{2})?)\s*([€$£₹]|EGP|USD|EUR|GBP|AED|SAR)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, ai_summary, re.IGNORECASE)
        if match:
            groups = match.groups()
            for g in groups:
                if g and re.match(r'^[\d,]+(?:\.\d{2})?$', str(g).replace(',', '')):
                    price_str = str(g).replace(',', '')
                    try:
                        price_val = float(price_str)
                        # Find currency in groups
                        currency = None
                        for gr in groups:
                            if gr and re.match(r'^[€$£₹]|EGP|USD|EUR|GBP|AED|SAR$', str(gr), re.IGNORECASE):
                                currency = str(gr).upper()
                                break
                        return price_val, currency
                    except ValueError:
                        continue
    return None, None


def _map_item(item: dict) -> dict | None:
    """Map a single Apify dataset item to the pipeline's product dict shape."""
    if not isinstance(item, dict):
        return None

    name = _first(item, "name", "title", "productName")
    url = _first(item, "url", "link", "productUrl")
    if not name or not url:
        return None

    # Skip search-results / listing pages (e.g. amazon.com/s?k=...); we only want
    # real product detail pages.
    if is_search_page(str(url)):
        return None

    # Get AI summary - may contain useful price/rating info
    ai_summary = _first(item, "aiSummary", "ai_summary", "summary", "aiAnalysis")
    
    offers = _extract_offers(item)
    # Price can be numeric, a currency string ("$199.95"), or a nested dict.
    price_val, price_cur = _coerce_price(_first(offers, "price", "lowPrice", "highPrice"))
    if price_val is None:
        price_val, price_cur = _coerce_price(
            _first(item, "price", "lowPrice", "currentPrice", "priceRange")
        )
    
    # Try additionalProperties for price
    if price_val is None:
        extra = item.get("additionalProperties") or {}
        if isinstance(extra, dict):
            price_val, price_cur = _coerce_price(
                _first(extra, "price", "salePrice", "currentPrice", "regularPrice")
            )
    
    # Try to extract from AI summary if price not found
    if price_val is None and ai_summary:
        price_val, price_cur = _extract_price_from_ai_summary(str(ai_summary))
        if price_val:
            print(f"[Apify] Extracted price {price_val} from AI summary", flush=True)
    
    currency = _normalize_currency(
        price_cur
        or _first(offers, "priceCurrency", "currency")
        or _first(item, "currency", "priceCurrency")
    )

    stars = _extract_rating(item)
    reviews_count = _extract_reviews(item)
    brand = _extract_brand(item)
    image = _first(item, "image", "imageUrl", "thumbnail", "thumbnailImage")
    if isinstance(image, list):
        image = image[0] if image else None
    if isinstance(image, dict):
        image = image.get("url")

    description = _first(item, "description", "snippet") or ""
    # Include AI summary in description for better data extraction
    if ai_summary and str(ai_summary) not in description:
        description = f"{description} {ai_summary}".strip()
    
    delivery = _first(offers, "shippingDetails", "delivery") or _first(
        item, "delivery", "shipping", "shippingInfo"
    )
    if isinstance(delivery, dict):
        delivery = delivery.get("description") or delivery.get("name")
    delivery = str(delivery) if delivery else None

    category = _first(item, "category", "breadCrumbs", "breadcrumbs")
    if not category:
        # This actor nests a coarse category under additionalProperties.
        extra = item.get("additionalProperties")
        if isinstance(extra, dict):
            category = extra.get("productType") or extra.get("category")
    if isinstance(category, list):
        category = " › ".join(str(c) for c in category if c)
    category = str(category) if category else ""

    # Availability: only mark out-of-stock on a clear unavailability signal.
    availability_text = _first(offers, "availability") or _first(item, "availability") or ""
    content = _build_content(name, description, brand, offers, item)
    in_stock = detect_availability(f"{availability_text} {content}")

    source = detect_source(str(url))

    return {
        "title": str(name),
        "url": str(url),
        "asin": "",
        "price": {"value": price_val, "currency": currency} if price_val else {},
        "listPrice": None,
        "stars": stars,
        "starsBreakdown": {},
        "reviewsCount": reviews_count,
        "delivery": delivery,
        "fastestDelivery": None,
        "returnPolicy": None,
        "inStock": in_stock,
        "brand": brand,
        "breadCrumbs": category,
        "thumbnailImage": image,
        "features": [],
        "source": source,
        # Text blob retained so the existing LLM extraction/enrichment fallback
        # can fill any gaps the structured fields above leave behind.
        "content": content,
        "full_content": content,
    }


def _run_attr(run, snake: str, camel: str):
    """Read a field from an actor run that may be a pydantic model
    (apify-client >= 2/3) or a plain dict (older clients / REST)."""
    if run is None:
        return None
    # pydantic models expose snake_case attributes
    val = getattr(run, snake, None)
    if val is not None:
        return val
    if isinstance(run, dict):
        return run.get(camel) or run.get(snake)
    # last resort: dump pydantic model to a dict
    dump = getattr(run, "model_dump", None)
    if callable(dump):
        d = dump()
        return d.get(snake) or d.get(camel)
    return None


def _run_actor(query: str, max_per_store: int) -> list[dict]:
    """Run the Apify actor and return raw dataset items."""
    token = os.getenv("APIFY_API_KEY", "")
    if not token:
        print("[Apify] ERROR - APIFY_API_KEY not set", flush=True)
        return []

    max_products = min(max_per_store, 20)
    run_input = {
        "keyword": query,
        "marketplaces": [
            "www.amazon.com",
            "www.noon.com",
            "www.amazon.eg",
        ],
        "maxProductResults": max_products,
        "scrapeMode": "BROWSER",
        "scrapeModeSearchEngine": "Products",
        "additionalProperties": True,
        "additionalPropertiesSearchEngine": True,
        "additionalReviewProperties": True,
        "scrapeInfluencerProducts": False,
        "scrapeReviewsDelivery": False,
        "fieldsToAnalyze": [
            "image",
            "url",
            "name",
            "offers",
            "brand",
            "description",
            "additionalProperties",
        ],
    }

    try:
        from apify_client import ApifyClient

        print(f"[Apify] Running actor '{ACTOR_ID}' for: '{query}' on 3 marketplaces", flush=True)
        client = ApifyClient(token)
        # NOTE: in apify-client >= 2, .call() returns a pydantic `Run` model,
        # NOT a dict. Accessing run.get(...) raises AttributeError, so we must
        # read fields via attributes (run.default_dataset_id / run.status).
        run = client.actor(ACTOR_ID).call(run_input=run_input)
        if not run:
            print("[Apify] ERROR - actor run returned no metadata", flush=True)
            return []

        status = _run_attr(run, "status", "status")
        if status and status != "SUCCEEDED":
            print(f"[Apify] WARNING - actor run status is '{status}'", flush=True)

        dataset_id = _run_attr(run, "default_dataset_id", "defaultDatasetId")
        if not dataset_id:
            print(
                "[Apify] ERROR - could not resolve dataset id from run "
                f"(type={type(run).__name__})",
                flush=True,
            )
            return []

        items = list(client.dataset(dataset_id).iterate_items())
        print(
            f"[Apify] Actor run {status or '?'} -> dataset {dataset_id} "
            f"({len(items)} item(s))",
            flush=True,
        )
        return items
    except ImportError:
        print("[Apify] apify-client not installed; using REST fallback", flush=True)
        return _run_actor_rest(query, run_input, token)
    except Exception as e:
        print(f"[Apify] ERROR - actor call failed: {type(e).__name__}: {e}", flush=True)
        return []


def _run_actor_rest(query: str, run_input: dict, token: str) -> list[dict]:
    """REST fallback when apify-client isn't available."""
    import requests

    url = (
        f"https://api.apify.com/v2/acts/{ACTOR_ID_REST}/"
        f"run-sync-get-dataset-items?token={token}"
    )
    try:
        print(f"[Apify] REST run-sync for: '{query}'", flush=True)
        resp = requests.post(url, json=run_input, timeout=300)
        resp.raise_for_status()
        items = resp.json()
        return items if isinstance(items, list) else []
    except Exception as e:
        print(f"[Apify] ERROR - REST call failed: {e}", flush=True)
        return []


def search_products(query: str, max_per_store: int = 20) -> str:
    """
    Search for products via the Apify 'apify/e-commerce-scraping-tool' actor
    (Search Engine Products mode). Drop-in replacement for the Tavily
    search_products: returns a JSON string list of product dicts in the
    pipeline's expected shape.
    """
    cached = get_cached(query)
    if cached is not None:
        return json.dumps(cached)

    raw_items = _run_actor(query, max_per_store)
    print(f"[Apify] Actor returned {len(raw_items)} raw item(s)", flush=True)
    
    # Debug: print first item's keys and AI summary if present
    if raw_items:
        first = raw_items[0]
        print(f"[Apify] Sample item keys: {list(first.keys())}", flush=True)
        ai_summary = first.get("aiSummary") or first.get("ai_summary") or first.get("summary")
        if ai_summary:
            print(f"[Apify] AI Summary: {str(ai_summary)[:500]}", flush=True)

    if not raw_items:
        # Empty here means the actor returned nothing OR the call failed
        # (errors are logged above) -- e.g. exhausted Apify credit, a quota/
        # billing limit, or a transient outage. Rather than surfacing a bogus
        # "No products found" to the user in those cases, fall back to the
        # Tavily multi-store scraper so normal searches keep returning results.
        print(
            "[Apify] No raw items from actor (run failed or no matches); "
            "falling back to Tavily scraper. Check [Apify] logs above for errors.",
            flush=True,
        )
        try:
            from backend.tools.search_tool import search_products as tavily_search

            # tavily_search handles its own caching under the same query key.
            return tavily_search(query, max_per_store)
        except Exception as e:
            print(f"[Apify] Tavily fallback failed: {e}; returning empty list", flush=True)
            return "[]"

    mapped = []
    for item in raw_items:
        m = _map_item(item)
        if m is not None:
            mapped.append(m)

    priced = sum(1 for m in mapped if m.get("price"))
    rated = sum(1 for m in mapped if m.get("stars"))
    print(
        f"[Apify] Mapped {len(mapped)}/{len(raw_items)} product(s) "
        f"({priced} priced, {rated} rated)",
        flush=True,
    )

    if not mapped:
        print(
            "[Apify] No products mapped (items lacked name/url); "
            "returning empty list",
            flush=True,
        )
        return "[]"

    filtered = filter_relevant_products(mapped, query)
    # Never let relevance filtering drop the entire scrape. If it removes
    # everything, keep the priced items (or all mapped items) so a valid scrape
    # still surfaces ranked products instead of "No products found".
    if not filtered and mapped:
        priced_items = [m for m in mapped if m.get("price")]
        filtered = priced_items or mapped
        print(
            "[Apify] relevance filter removed all products; falling back to "
            f"{len(filtered)} priced/mapped item(s)",
            flush=True,
        )
    print(
        f"[Apify] Total: {len(mapped)} mapped -> {len(filtered)} after "
        f"accessory/relevance filtering",
        flush=True,
    )

    set_cached(query, filtered)
    return json.dumps(filtered)


# Backward-compatibility alias mirroring search_tool.
search_amazon = search_products
