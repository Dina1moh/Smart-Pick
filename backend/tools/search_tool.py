import os
import re
import json
from tavily import TavilyClient
from backend.cache import get_cached, set_cached

STORES = [
    {"name": "Amazon", "domain": "amazon.com"},
    {"name": "Amazon Egypt", "domain": "amazon.eg"},
    {"name": "noon", "domain": "noon.com"},
]


def search_products(query: str, max_per_store: int = 15) -> str:
    """
    Search for products across multiple e-commerce stores using Tavily.
    Gets up to 20 results per store, filters accessories, returns relevant products.
    """
    cached = get_cached(query)
    if cached is not None:
        return json.dumps(cached)

    print(f"[Search] Searching {len(STORES)} stores for: '{query}'", flush=True)
    client = TavilyClient(api_key=os.getenv("TAVILY_API_KEY", ""))

    all_items = []

    for store in STORES:
        try:
            # Simpler query that works across different e-commerce sites
            search_query = f'{query} price site:{store["domain"]}'
            # Tavily caps max_results at 20 per call, so 20 is the effective max.
            results = client.search(
                query=search_query,
                search_depth="advanced",
                max_results=min(max_per_store, 20),
                include_answer=False,
                include_images=True,
                include_raw_content=True,
            )
            store_items = parse_tavily_results(results.get("results", []), query, store["name"])

            # Attach images
            images = results.get("images", [])
            for i, item in enumerate(store_items):
                if i < len(images) and not item.get("thumbnailImage"):
                    img = images[i]
                    item["thumbnailImage"] = img if isinstance(img, str) else img.get("url", "")

            print(f"[Search]   {store['name']}: {len(store_items)} results", flush=True)
            all_items.extend(store_items)
        except Exception as e:
            print(f"[Search]   {store['name']}: ERROR - {e}", flush=True)
            continue

    # Strict filtering: remove accessories
    filtered = filter_relevant_products(all_items, query)
    print(f"[Search] Total: {len(all_items)} raw -> {len(filtered)} after filtering", flush=True)

    # Cache results
    set_cached(query, filtered)

    return json.dumps(filtered)


# Backward compatibility alias
search_amazon = search_products


def parse_tavily_results(results: list[dict], query: str, source: str = "") -> list[dict]:
    """Parse Tavily search results into product format."""
    items = []

    for r in results:
        title = r.get("title", "")
        url = r.get("url", "")
        content = r.get("content", "")
        image = r.get("image", None) or r.get("thumbnail", None)

        if not title or not url:
            continue

        # Skip search-results / listing pages (e.g. amazon.com/s?k=...) so only
        # real product detail pages flow downstream.
        if is_search_page(url):
            continue

        detected_source = source if source else detect_source(url)

        full_text = content + " " + title
        price, currency = extract_price(full_text)
        stars = extract_rating(full_text)
        reviews_count = extract_reviews(full_text)
        delivery = extract_delivery(full_text)
        in_stock = detect_availability(full_text)

        items.append({
            "title": title,
            "url": url,
            "asin": "",
            "price": {"value": price, "currency": currency} if price else {},
            "listPrice": None,
            "stars": stars,
            "starsBreakdown": {},
            "reviewsCount": reviews_count,
            "delivery": delivery,
            "fastestDelivery": None,
            "returnPolicy": None,
            "inStock": in_stock,
            "brand": "",
            "breadCrumbs": "",
            "thumbnailImage": image,
            "features": [],
            "source": detected_source,
        })

    return items


def detect_source(url: str) -> str:
    """Detect retailer from URL."""
    url_lower = url.lower()
    for store in STORES:
        if store["domain"] in url_lower:
            return store["name"]
    return "Other"


# Markers that indicate a real product DETAIL page. If any is present we never
# treat the URL as a search/listing page (these override the search patterns
# below, since product URLs sometimes carry query strings too).
_PRODUCT_URL_RE = re.compile(
    r'(?:/dp/|/gp/product/|/itm/|/ip/|/product/|/pd/|/-/a-\d|\.p\?|/p/[\w-]+/-/)',
    re.IGNORECASE,
)

# Patterns that indicate a search-results / category-listing page rather than a
# single product. The reported bad case is Amazon's "/s?k=..." search URL.
_SEARCH_PAGE_RE = re.compile(
    r'(?:'
    r'/s\?'              # Amazon search results (/s?k=...)
    r'|/s/ref='          # Amazon search ref
    r'|[?&]k='           # Amazon keyword param
    r'|[?&]q='           # generic query param
    r'|[?&]query='
    r'|[?&]searchterm'   # Target / generic
    r'|[?&]search='
    r'|/sch/'            # eBay search
    r'|/b/'              # eBay browse
    r'|/search'          # Walmart / generic search path
    r'|/browse'          # Walmart browse
    r'|searchpage'       # Best Buy searchpage.jsp
    r'|/p/pl\?'          # Newegg product list
    r'|productlist'      # Newegg
    r')',
    re.IGNORECASE,
)


def is_search_page(url: str) -> bool:
    """True when the URL is a search-results / category-listing page rather than
    a single product detail page. Product-detail markers take precedence so real
    product URLs are never misclassified."""
    if not url:
        return True
    if _PRODUCT_URL_RE.search(url):
        return False
    return _SEARCH_PAGE_RE.search(url) is not None


# Phrases that clearly signal a product is not purchasable. English plus a few
# obvious localized equivalents (Arabic for amazon.eg/noon, Spanish, French,
# German) so non-US listings are caught too. Order/specificity doesn't matter
# since we only need a single hit.
_UNAVAILABLE_PATTERNS = [
    r'out of stock',
    r'currently unavailable',
    r'temporarily unavailable',
    r'sold out',
    r'not available',
    r'no longer available',
    r'unavailable',
    r'back\s*order(?:ed)?',
    r'discontinued',
    # Arabic
    r'غير متوفر',
    r'غير متاح',
    r'نفذت الكمية',
    # Spanish
    r'agotado',
    r'no disponible',
    # French
    r'rupture de stock',
    r'indisponible',
    # German
    r'nicht verf\u00fcgbar',
    r'ausverkauft',
]

_UNAVAILABLE_RE = re.compile("|".join(_UNAVAILABLE_PATTERNS), re.IGNORECASE)


def detect_availability(text: str) -> bool:
    """Return False only when the text contains a clear unavailability signal.

    Availability is treated as the default: if no explicit out-of-stock phrase
    is present (i.e. availability is unknown), we keep the product in-stock to
    avoid over-filtering legitimate listings.
    """
    if not text:
        return True
    return _UNAVAILABLE_RE.search(text) is None


# Currency token (symbol or ISO-ish code) -> normalized display currency.
# Longer/more specific tokens must come first so the regex alternation
# prefers e.g. "US$" over "$" and "EGP" over "$".
_CURRENCY_MAP = {
    "us$": "$", "usd": "$", "$": "$",
    "gbp": "£", "£": "£",
    "eur": "€", "€": "€",
    "egp": "EGP", "ج.م": "EGP",
    "aed": "AED", "sar": "SAR",
    "inr": "₹", "₹": "₹",
}

# Symbols can sit flush against digits; codes need a word boundary.
_PRICE_SYMBOLS = r'US\$|\$|£|€|₹|ج\.م'
_PRICE_CODES = r'USD|GBP|EUR|EGP|AED|SAR|INR'
_PRICE_NUMBER = r'(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)'


def _normalize_currency(token: str) -> str:
    return _CURRENCY_MAP.get(token.strip().lower(), "$")


def _parse_number(num_str: str) -> float | None:
    try:
        return float(num_str.replace(",", ""))
    except ValueError:
        return None


def extract_price(text: str) -> tuple[float | None, str]:
    """Extract a (value, currency) pair from text content.

    Handles prices written with a currency symbol or code on either side of the
    number (e.g. "$1,299.00", "USD 1,299", "1,299 EGP", "54999 ج.م", "999$"),
    plus a bare number following a price keyword. Returns the detected currency
    so non-USD stores (e.g. amazon.eg in EGP) render correctly instead of being
    dropped because they lack a literal "$".
    """
    candidates: list[tuple[float, str]] = []

    # Tier 1: currency token immediately before the number.
    before = rf'(?<![\w])({_PRICE_SYMBOLS}|{_PRICE_CODES})\s*{_PRICE_NUMBER}'
    for m in re.finditer(before, text, re.IGNORECASE):
        val = _parse_number(m.group(2))
        if val is not None:
            candidates.append((val, _normalize_currency(m.group(1))))

    # Tier 2: currency token immediately after the number.
    after = rf'{_PRICE_NUMBER}\s*({_PRICE_SYMBOLS}|{_PRICE_CODES})(?![\w])'
    for m in re.finditer(after, text, re.IGNORECASE):
        val = _parse_number(m.group(1))
        if val is not None:
            candidates.append((val, _normalize_currency(m.group(2))))

    # Tier 3: bare number right after a strong price keyword (assume USD).
    # Only "price"/"cost" are used here; weaker words like "now"/"only"/"for"
    # match years, stock counts, etc. and produce false positives.
    keyword = rf'(?:price|cost)\s*:?\s*\$?\s*{_PRICE_NUMBER}'
    for m in re.finditer(keyword, text, re.IGNORECASE):
        val = _parse_number(m.group(1))
        if val is not None:
            candidates.append((val, "$"))

    # First plausible candidate wins (tiers are searched in priority order, and
    # finditer preserves left-to-right text order within each tier, so the main
    # listing price is normally picked over later mentions).
    for val, currency in candidates:
        if 1 < val < 10_000_000:
            return val, currency
    return None, "$"


def extract_rating(text: str) -> float | None:
    """Extract star rating from text."""
    patterns = [
        r'(\d\.\d)\s*out of\s*5',
        r'(\d\.\d)\s*/\s*5',
        r'(\d\.\d)\s*stars?',
        r'(?:rating|rated)[:\s]+(\d\.\d)',
        r'★\s*(\d\.\d)',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                rating = float(match.group(1))
                if 1.0 <= rating <= 5.0:
                    return rating
            except ValueError:
                continue
    return None


def extract_reviews(text: str) -> int | None:
    """Extract review count from text."""
    patterns = [
        r'(\d{1,6}(?:,\d{3})*)\s*(?:reviews|ratings|customer reviews)',
        r'(?:reviews?|ratings?)[:\s]+(\d{1,6}(?:,\d{3})*)',
        r'\((\d{1,6}(?:,\d{3})*)\s*(?:reviews|ratings)\)',
        r'(\d{1,6}(?:,\d{3})*)\s*global ratings',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1).replace(",", ""))
            except ValueError:
                continue
    return None


def extract_delivery(text: str) -> str | None:
    """Extract delivery info from text."""
    patterns = [
        r'(free\s+(?:shipping|delivery))',
        r'(deliver(?:y|ed)\s+(?:by\s+)?(?:\w+\s+\d{1,2}))',
        r'(arrives?\s+(?:by\s+)?(?:\w+,?\s+\w+\s+\d{1,2}))',
        r'(get it (?:by )?\w+,? \w+ \d{1,2})',
        r'((?:2|next|same)[\s-]day (?:shipping|delivery))',
        r'(ships? (?:free|in \d+ day))',
        r'(free \d+-day (?:shipping|delivery))',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def filter_relevant_products(products: list[dict], query: str) -> list[dict]:
    """
    Strict filtering to remove accessories and keep only the actual product.
    Uses multiple heuristics to distinguish the main product from add-ons.
    """
    query_lower = query.lower().strip()
    query_words = set(query_lower.split())

    # Core product keywords from the query (words > 2 chars)
    core_words = {w for w in query_words if len(w) > 2}

    # Accessory indicators: if these appear in title, it's likely an accessory
    accessory_patterns = [
        r'\bcase\b', r'\bcover\b', r'\bprotector\b', r'\bscreen protector\b',
        r'\bcharger\b', r'\bcable\b', r'\badapter\b', r'\bstand\b',
        r'\bmount\b', r'\bholder\b', r'\bsleeve\b', r'\bskin\b',
        r'\bdecal\b', r'\bsticker\b', r'\bstrap\b', r'\bband\b',
        r'\bdock\b', r'\bhub\b', r'\bdongle\b', r'\bstylus\b',
        r'\bcleaning\b', r'\bcloth\b', r'\bkit\b', r'\breplacement\b',
        r'\btempered glass\b', r'\bfilm\b', r'\bpouch\b', r'\bbag\b',
        r'\bwallet\b', r'\barmband\b', r'\bcar mount\b', r'\btripod\b',
        r'\blens\b', r'\bpen\b', r'\bmouse pad\b', r'\bkeyboard cover\b',
    ]

    # Phrases that strongly indicate it's FOR a product, not the product itself
    for_patterns = [
        r'^for\s+',
        r'^compatible\s+with\s+',
        r'^fits?\s+',
        r'^designed\s+for\s+',
        r'^works?\s+with\s+',
    ]

    relevant = []
    for product in products:
        title = product.get("title", "").lower()
        if not title:
            continue

        is_accessory = False

        # Check "for product" patterns - strongest signal
        for pattern in for_patterns:
            if re.match(pattern, title):
                is_accessory = True
                break

        if not is_accessory:
            # Check if title contains accessory keywords
            for pattern in accessory_patterns:
                if re.search(pattern, title):
                    # Make sure the accessory keyword isn't part of the original query
                    match = re.search(pattern, title)
                    matched_word = match.group(0) if match else ""
                    if matched_word not in query_lower:
                        is_accessory = True
                        break

        if not is_accessory:
            # Price sanity check: if searching expensive products and price is suspiciously low
            price_data = product.get("price", {})
            price = price_data.get("value") if isinstance(price_data, dict) else None
            currency = price_data.get("currency", "$") if isinstance(price_data, dict) else "$"
            expensive_products = {
                "phone": 150, "laptop": 200, "macbook": 500, "iphone": 200,
                "samsung galaxy": 150, "ipad": 200, "tablet": 100, "tv": 100,
                "monitor": 80, "camera": 80, "console": 100, "playstation": 150,
                "xbox": 150, "nintendo": 100, "airpods": 50, "headphones": 30,
                "watch": 50, "fold": 300, "pixel": 150, "galaxy": 150,
            }
            # The min-price thresholds above are in USD, so only apply this
            # accessory heuristic to USD-priced items. Non-USD prices (e.g. EGP)
            # have very different magnitudes and must not be compared directly.
            if price and currency == "$":
                for product_kw, min_price in expensive_products.items():
                    if product_kw in query_lower and price < min_price:
                        is_accessory = True
                        break

        if not is_accessory:
            relevant.append(product)

    # Resilience: never let relevance filtering wipe out a non-empty scrape.
    # If we filtered down to too few (or zero) products while the scraper did
    # return items, fall back to the unfiltered set (prefer priced items) so the
    # user still gets ranked results instead of "No products found".
    if len(relevant) < 3 and len(products) > len(relevant):
        priced = [p for p in products if isinstance(p.get("price"), dict) and p["price"].get("value") is not None]
        fallback = priced or products
        return fallback[:12]

    return relevant[:12]
