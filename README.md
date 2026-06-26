# SmartPick — AI-Powered Product Comparison

> SmartPick eliminates the friction of manual product comparison. Enter one query, pick a priority, and get a ranked list with a plain-language AI justification — sourced live from Amazon, Amazon Egypt, and noon.

**SmartPick is not an e-commerce store.** It is an AI shopping assistant. No transactions are processed; every result links directly to the retailer's product page.

---

## Table of Contents

1. [Overview](#overview)
2. [User Stories](#user-stories)
3. [Supported Stores](#supported-stores)
4. [Architecture](#architecture)
5. [Tech Stack](#tech-stack)
6. [Project Structure](#project-structure)
7. [Quick Start](#quick-start)
8. [Environment Variables](#environment-variables)
9. [API Reference](#api-reference)
10. [AI Pipeline](#ai-pipeline)
11. [Data Quality & Filtering](#data-quality--filtering)
12. [Authentication](#authentication)
13. [Caching](#caching)
14. [Frontend Pages & Components](#frontend-pages--components)
15. [Testing](#testing)
16. [Deployment](#deployment)
17. [Risks & Known Limitations](#risks--known-limitations)
18. [Roadmap](#roadmap)
19. [License](#license)

---

## Overview

| Segment | Pain Point | SmartPick Solution |
|---|---|---|
| Students | Hunt for cheapest price across 6+ tabs, land on sponsored results | "Lowest Price" priority — one search, cheapest first |
| Professionals | Decision fatigue reconciling specs and reviews across many sites | "Best Rating" priority — quality-scored, review-weighted ranking |
| General Consumers | Worry about overpaying or buying an accessory by mistake | Accessory filter + AI justification block |

---

## User Stories

<details>
<summary><strong>US-01 · Lowest Price (Must Have)</strong></summary>

**As a student, I want to find the lowest price for a product so that I can save money without browsing multiple websites.**

Acceptance Criteria:
- Single search bar accepts any product name
- Priority card "Lowest Price" selectable before searching
- Results ranked cheapest-first across Amazon, Amazon Egypt, and noon
- Price displayed prominently on every result card
- Out-of-stock and price-less products excluded from results
- Only direct product pages shown (no search-result URLs)
</details>

<details>
<summary><strong>US-02 · Best Rating (Must Have)</strong></summary>

**As a professional, I want to compare product ratings across stores so that I can make a confident purchase decision in under a minute.**

Acceptance Criteria:
- Priority card "Best Rating" selectable
- Star rating and review count shown on each product card
- AI top-pick card highlights the single best choice
- Plain-language justification explains why the top pick was chosen
- Alternative results shown alongside the top pick
</details>

<details>
<summary><strong>US-03 · Clean Results (Must Have)</strong></summary>

**As a user, I want to see only real, in-stock products so that I don't click through to unavailable or irrelevant listings.**

Acceptance Criteria:
- 28+ regex patterns remove accessories (cases, chargers, cables, screen protectors, etc.)
- "For / Compatible with / Fits" prefix titles removed
- Price sanity check per category (e.g. iPhone ≥ $200, MacBook ≥ $500)
- Multi-language out-of-stock detection: English, Arabic, Spanish, French, German
- Amazon `/s?k=`, eBay `/sch/`, Walmart `/search` URLs blocked
- Each result card shows a direct buy link to the product page
</details>

<details>
<summary><strong>US-04 · Authentication (Should Have)</strong></summary>

**As a returning user, I want to register and sign in with email and password so that I can have a persistent, personal experience.**

Acceptance Criteria:
- Signup accepts optional name, email, and password (min 6 chars)
- Duplicate email returns HTTP 409 with a clear error message
- Login returns an opaque 32-byte session token stored in `localStorage`
- `GET /api/auth/me` returns current user while token is valid
- `POST /api/auth/logout` deletes the session; subsequent `/me` calls return 401
</details>

<details>
<summary><strong>US-05 · Performance (Should Have)</strong></summary>

**As a user, I want results quickly so that I don't abandon the search out of frustration.**

Acceptance Criteria:
- Cached results (1-hour TTL) return in < 500 ms
- Animated 10-step loading pipeline shown during live search
- Fresh search completes within 30 seconds
- Empty-result cache never served (resilience: fallback to priced items)
- `AbortController` cancels in-flight requests on page navigation
</details>

<details>
<summary><strong>US-06 · Fastest Delivery (Could Have)</strong></summary>

**As a user, I want to filter by fastest delivery so that I can receive a product before a deadline.**

Acceptance Criteria:
- Priority card "Fastest Delivery" selectable
- Delivery text extracted and shown per product
- Results ranked by delivery speed ascending, quality score as tiebreaker
</details>

<details>
<summary><strong>US-07 · Side-by-Side Compare (Could Have)</strong></summary>

**As a user, I want to compare products side-by-side so that I can evaluate attribute differences at a glance.**

Acceptance Criteria:
- `/compare` route accessible from results page
- Price, rating, delivery, warranty, and source shown per product
- Best value per row highlighted
</details>

<details>
<summary><strong>US-08 · Search History (Could Have)</strong></summary>

**As a returning user, I want to view my search history so that I can re-run a previous comparison without retyping.**

Acceptance Criteria:
- `/history` shows previous searches with product name, date, and priority
- Re-run button executes the same search
- Individual searches removable; "Clear all" available
</details>

---

## Supported Stores

| Store | Domain | Region |
|---|---|---|
| Amazon | `amazon.com` | Global |
| Amazon Egypt | `amazon.eg` | Egypt |
| noon | `noon.com` | MENA |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js 16 Frontend                      │
│                                                              │
│  SearchBar → PrioritySelector → POST /api/compare            │
│        ResultsClient (AbortController-managed fetch)         │
│  TopRecommendation | AlternativeCard | ProductDetailClient   │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTP
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python 3.13)              │
│                                                              │
│  POST /api/compare ──► run_comparison()                      │
│                                                              │
│  Step 1  Cache check (MD5 key, 1-hour TTL)                  │
│  Step 2  Scrape: Apify actor → amazon.com, noon.com,        │
│          amazon.eg (max 20 results each)                     │
│  Step 3  URL filter: reject search/listing pages             │
│  Step 4  Accessory filter: 28 patterns + price sanity        │
│  Step 5  Price enrich: offers → item → AI summary → LLM      │
│  Step 6  Availability filter: multi-language OOS detection   │
│  Step 7  Quality score: stars × log(reviews+1) × (1-1★%)    │
│  Step 8  Rank by priority (top 5 returned)                   │
│  Step 9  Justification: OpenRouter → Qwen3-235B (2–3 sent.) │
│  Step 10 Cache & return CompareResponse                      │
│                                                              │
│  ┌──────────────┐  ┌────────────┐  ┌────────────────────┐   │
│  │  Apify Actor │  │  Tavily    │  │  OpenRouter / LLM  │   │
│  │  (default)   │  │ (fallback) │  │  (justification)   │   │
│  └──────────────┘  └────────────┘  └────────────────────┘   │
│                                                              │
│  Auth: /api/auth/* — SQLite + PBKDF2 + opaque tokens        │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 (App Router, Turbopack) | SSR, file-based routing, image optimisation |
| Styling | Tailwind CSS v4 | Utility-first responsive design |
| Icons | Lucide React | Consistent SVG icon set |
| Backend | FastAPI + Python 3.13 | Async REST API, Pydantic v2 validation |
| Scraper (default) | Apify `e-commerce-scraping-tool` | Structured product data from 3 marketplaces |
| Scraper (fallback) | Tavily API | Web-search fallback when Apify returns 0 items |
| Agents | CrewAI (sequential crew) | Orchestrates Search → Review → Ranking agents with deterministic tools |
| LLM | OpenRouter → Qwen3-235B-A22B | Drives the crew + generates the justification |
| Cache | File-based JSON (1-hour TTL) | Eliminates duplicate API calls |
| Auth | SQLite + PBKDF2-HMAC-SHA256 | Stdlib-only email/password session auth |
| Containerisation | Docker + docker-compose | Single-command reproducible deployment |
| Testing | pytest + pytest-asyncio + pytest-cov | 169 cases, 80% coverage, all external mocked |

---

## Project Structure

```
smart-pick/
├── backend/
│   ├── agents/
│   │   ├── search_agent.py       CrewAI search agent builder
│   │   ├── review_agent.py       CrewAI review agent builder
│   │   └── ranking_agent.py      CrewAI ranking agent builder
│   ├── crew.py                   CrewAI crew + deterministic tools + streaming
│   ├── tools/
│   │   ├── search_tool.py        Tavily multi-store scraper + filtering
│   │   └── apify_scraper.py      Apify actor integration + data mapping
│   ├── tests/
│   │   ├── conftest.py           Shared fixtures
│   │   ├── test_api.py           API endpoint tests
│   │   ├── test_apify_scraper.py Apify data mapping tests
│   │   ├── test_auth.py          Authentication tests
│   │   ├── test_cache.py         Cache system tests
│   │   ├── test_models.py        Pydantic model tests
│   │   └── test_search_tool.py   Search utility tests
│   ├── .cache/                   JSON cache (gitignored)
│   ├── .data/                    users.db SQLite (gitignored)
│   ├── main.py                   FastAPI app entry point
│   ├── pipeline.py               run_comparison() — core logic
│   ├── models.py                 Pydantic models + Priority enum
│   ├── auth.py                   Auth routes + PBKDF2 hashing
│   ├── db.py                     SQLite init + connection helper
│   ├── cache.py                  File-based JSON cache
│   ├── pytest.ini                Test configuration
│   └── requirements.txt          Python dependencies
├── frontend/
│   ├── app/
│   │   ├── page.tsx              Home — hero, search, discover
│   │   ├── results/page.tsx      Results page (?q=&priority=)
│   │   ├── product/[id]/page.tsx Product detail
│   │   ├── compare/page.tsx      Side-by-side compare
│   │   ├── history/page.tsx      Search history
│   │   ├── about/page.tsx        About SmartPick
│   │   ├── login/page.tsx        Login form
│   │   ├── signup/page.tsx       Signup form
│   │   ├── layout.tsx            Root layout
│   │   └── globals.css           Tailwind base styles
│   ├── components/               18 React components (see below)
│   ├── lib/                      api.ts, auth.ts, derive.ts, …
│   ├── .env.local                NEXT_PUBLIC_API_URL
│   └── package.json
├── docker-compose.yml
├── Makefile
├── run.sh                        Start both services locally
└── .env                          API keys (not committed)
```

---

## Quick Start

### Prerequisites

- Docker Desktop with Docker Compose

### 1. Configure environment

Create `.env` in the project root:

```env
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=qwen/qwen3-235b-a22b
TAVILY_API_KEY=your_tavily_key
APIFY_API_KEY=your_apify_key
SCRAPER=apify
```

Create `frontend/.env.local` for local frontend runs:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 2. Build and run with Docker Compose

```bash
docker compose up --build
```

Docker Compose builds and starts both services:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

To stop the project:

```bash
docker compose down
```

### Manual fallback

Use this only when Docker is unavailable:

```bash
make install
make run
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for LLM calls |
| `OPENROUTER_MODEL` | No | Default: `qwen/qwen3-235b-a22b` |
| `OPENAI_API_KEY` | No | Auto-mapped from `OPENROUTER_API_KEY` at startup |
| `OPENAI_API_BASE` | No | Default: `https://openrouter.ai/api/v1` |
| `APIFY_API_KEY` | Yes* | Required when `SCRAPER=apify` (default) |
| `TAVILY_API_KEY` | Yes* | Required when `SCRAPER=tavily` or as Apify fallback |
| `SCRAPER` | No | `apify` (default) or `tavily` |
| `NEXT_PUBLIC_API_URL` | No | Frontend → backend URL, default `http://localhost:8000` |

---

## API Reference

### `GET /health`

```json
{ "status": "ok", "service": "smartpick-api" }
```

---

### `POST /api/compare`

Compare products by priority. No authentication required.

**Request body:**

```json
{
  "product": "iPhone 15 Pro Max",
  "priority": "lowest_price"
}
```

| Priority value | Ranking logic |
|---|---|
| `lowest_price` | Price ascending; quality score as tiebreaker |
| `best_rating` | Quality score descending, then review count |
| `best_warranty` | Products with return policy first, then quality |
| `fastest_delivery` | Delivery string ascending, then quality |

**Response:**

```json
{
  "product_query": "iPhone 15 Pro Max",
  "priority": "lowest_price",
  "category": "Smartphones",
  "top_pick": {
    "title": "Apple iPhone 15 Pro Max 256GB",
    "url": "https://www.amazon.com/dp/B0CHX2F5QT/",
    "price": 1099.00,
    "currency": "$",
    "stars": 4.7,
    "reviews_count": 8423,
    "quality_score": 38.4,
    "delivery": "Free delivery",
    "warranty": null,
    "image": "https://...",
    "in_stock": true,
    "rank": 1,
    "source": "Amazon"
  },
  "results": [ /* top 5 ProductResult objects */ ],
  "justification": "The Apple iPhone 15 Pro Max from Amazon offers the best value…",
  "total_found": 5
}
```

**Errors:**

| Code | Cause |
|---|---|
| `400` | Empty `product` field |
| `422` | Invalid `priority` value or malformed body |
| `500` | Pipeline failure (check backend logs) |

---

### Auth Endpoints (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/signup` | None | Register with name, email, password |
| `POST` | `/api/auth/login` | None | Login; returns session token |
| `GET` | `/api/auth/me` | Bearer token | Get current user |
| `POST` | `/api/auth/logout` | Bearer token | Invalidate session |

**Signup / Login response:**

```json
{
  "token": "abc123...",
  "user": { "id": 1, "name": "Ahmed", "email": "ahmed@example.com" }
}
```

**Auth errors:**

| Code | Cause |
|---|---|
| `401` | Bad credentials or invalid/expired token |
| `409` | Email already registered |
| `422` | Invalid email format or password < 6 chars |

---

## AI Pipeline

Every uncached query runs through 10 stages:

| # | Stage | Detail |
|---|---|---|
| 1 | Cache check | MD5 of lowercased query; return JSON if < 1 hour old |
| 2 | Scrape | Apify actor queries amazon.com, noon.com, amazon.eg (max 20 results each) |
| 3 | URL filter | Reject search/listing pages; whitelist product-detail URLs |
| 4 | Accessory filter | 28 regex patterns + "For/Compatible with" prefix + USD price sanity |
| 5 | Price enrich | `offers.price` → `item.price` → `additionalProperties` → `aiSummary` regex → LLM |
| 6 | Availability filter | Drop items where `inStock == False` (multi-language) |
| 7 | Quality score | `stars × log(reviewsCount + 1) × (1 − oneStarRatio)` |
| 8 | Rank | Sort by priority; products with data ranked before those without |
| 9 | Justification | OpenRouter HTTP call → Qwen3-235B → 2–3 sentence explanation |
| 10 | Cache & respond | Store filtered list as JSON; return top 5 as `CompareResponse` |

### Quality Score Formula

```
quality_score = stars × log(reviewsCount + 1) × (1 − oneStarRatio)
```

| Component | Purpose |
|---|---|
| `stars` | Average rating (1–5); higher is better |
| `log(reviewsCount + 1)` | Rewards more reviews with diminishing returns; `+1` prevents `log(0)` |
| `(1 − oneStarRatio)` | Penalises products with high 1-star percentage |

**Example:**

```
Product A: 4.5★, 5000 reviews, 3% one-star
  → 4.5 × log(5001) × 0.97 = 4.5 × 8.52 × 0.97 ≈ 37.2

Product B: 5.0★, 8 reviews, 0% one-star
  → 5.0 × log(9) × 1.0 = 5.0 × 2.19 × 1.0 ≈ 11.0
```

Product A wins — more reviews evidence beats a perfect rating on 8 data points.

### Price Extraction Layers

Applied in order; first successful layer wins:

1. `offers.price` — structured Apify offers object
2. `item.price` / `item.lowPrice` / `item.currentPrice` — top-level item fields
3. `additionalProperties.price` — nested extra attributes from actor
4. `aiSummary` field — regex: `$999`, `price: 1,299`, `EGP 54,000`, etc.
5. LLM batch extraction — OpenRouter call over raw page text

### Scraper Selection

Set via `SCRAPER` environment variable:

| Value | Behaviour |
|---|---|
| `apify` (default) | Calls Apify `e-commerce-scraping-tool` actor on 3 marketplaces |
| `tavily` | Calls Tavily search API with `site:` operator on same 3 domains |

If Apify returns 0 items (e.g. credit exhaustion), the pipeline automatically falls back to Tavily.

**Apify actor input:**

```json
{
  "keyword": "<query>",
  "marketplaces": ["www.amazon.com", "www.noon.com", "www.amazon.eg"],
  "maxProductResults": 20,
  "scrapeMode": "BROWSER",
  "scrapeModeSearchEngine": "Products",
  "additionalProperties": true,
  "additionalPropertiesSearchEngine": true,
  "additionalReviewProperties": true,
  "fieldsToAnalyze": ["image", "url", "name", "offers", "brand", "description", "additionalProperties"]
}
```

---

## Data Quality & Filtering

### Accessory Removal

28 regex patterns detect accessories by title keyword:

```
\bcase\b  \bcover\b  \bprotector\b  \bscreen protector\b  \bcharger\b
\bcable\b  \badapter\b  \bstand\b  \bmount\b  \bholder\b  \bsleeve\b
\bskin\b  \bdecal\b  \bsticker\b  \bstrap\b  \bband\b  \bdock\b
\bhub\b  \bdongle\b  \bstylus\b  \bcleaning\b  \bcloth\b  \bkit\b
\breplacement\b  \btempered glass\b  \bpouch\b  \bwallet\b
```

Prefix patterns also removed: `^for\s+`, `^compatible with\s+`, `^fits?\s+`, `^designed for\s+`.

**USD price sanity thresholds per category (examples):**

| Category | Min price |
|---|---|
| iPhone, Samsung Galaxy | $200 |
| Laptop, MacBook | $500 |
| iPad, Tablet | $200 |
| PlayStation, Xbox | $150 |
| AirPods | $50 |
| Headphones | $30 |

> **Resilience rule:** If filtering removes all products from a valid scrape, the system falls back to priced items (or all mapped items) to ensure users always receive results.

### URL Filtering

`is_search_page(url)` rejects listing/search URLs:

| Pattern | Example |
|---|---|
| Amazon `/s?k=` | `amazon.com/s?k=iphone` |
| Amazon `/s/ref=` | `amazon.com/s/ref=nb_sb_noss` |
| eBay `/sch/` | `ebay.com/sch/i.html?_nkw=…` |
| Walmart `/search` | `walmart.com/search?q=…` |
| Best Buy `searchpage.jsp` | `bestbuy.com/site/searchpage.jsp?st=…` |
| Generic `?q=` / `?query=` | `example.com/products?q=laptop` |

Product-detail markers (`/dp/`, `/gp/product/`, `/itm/`, `/ip/`, `.p?`) whitelist real pages regardless.

### Stock Detection

Out-of-stock strings detected across multiple languages:

| Language | Phrases |
|---|---|
| English | "out of stock", "unavailable", "sold out", "no longer available" |
| Arabic | "غير متوفر", "غير متاح" |
| Spanish | "agotado" |
| French | "rupture de stock" |
| German | "ausverkauft" |

---

## Authentication

SmartPick uses a stdlib-only email/password auth system — no external auth dependencies.

**Password hashing:** PBKDF2-HMAC-SHA256, 240,000 iterations, random 16-byte hex salt per user.

**Sessions:** `secrets.token_urlsafe(32)` opaque tokens stored in `backend/.data/users.db` (SQLite `sessions` table). Deleted on logout.

**Frontend:** Token and user stored in `localStorage` (`smartpick_token`, `smartpick_user`). The `useAuth()` hook exposes `user`, `login()`, `logout()`, `signup()` reactively. Product comparison does **not** require authentication.

> **Known limitation:** Tokens have no automatic TTL expiry beyond explicit logout. TTL enforcement is planned.

---

## Caching

| Detail | Value |
|---|---|
| Location | `backend/.cache/*.json` |
| TTL | 3600 seconds (1 hour) |
| Key | MD5 hash of `query.lower().strip()` |
| Empty results | Never cached |
| Hit log | `[Cache] HIT for 'query' (N products)` |

```bash
make cache-clear   # delete all cached files
```

---

## Frontend Pages & Components

### Pages

| Route | Description |
|---|---|
| `/` | Home — hero, search bar, priority selector, recent searches, discover sections |
| `/results?q=&priority=` | Search results — top pick + alternatives |
| `/product/[id]` | Product detail — sentiment, pros/cons, AI insights, similar products |
| `/compare` | Side-by-side attribute comparison |
| `/history` | Previous searches (localStorage) |
| `/about` | About SmartPick and the AI workflow |
| `/login` | Email + password login |
| `/signup` | Registration form |

### Components

| Component | Role |
|---|---|
| `SearchBar` | Search input with animated placeholder; submits to `/results` |
| `PrioritySelector` | 4 priority cards with hover, scale, active glow |
| `ResultsClient` | Manages `/api/compare` fetch with `AbortController`; renders results |
| `TopRecommendation` | Hero card for the AI top pick + justification block |
| `AlternativeCard` | Compact card for each alternative result |
| `ProductDetailClient` | Full detail view: sentiment bars, pros/cons, AI insights, similar slider |
| `CompareClient` | Side-by-side comparison table |
| `AgentPipeline` | Animated 10-step loading progress shown during live search |
| `Navbar` | Sticky glassmorphic nav with auth-aware login/user state |
| `LivingBackground` | Three large blurred floating gradient blobs |
| `MouseGlow` | Soft glow that follows the cursor |
| `StoreBadge` | Retailer pill: Amazon, noon, Amazon Egypt |
| `StarRating` | Visual star display |
| `RecentSearches` | Up to 5 pill chips from localStorage; click to re-run |
| `DiscoverSections` | Trending and Popular Categories on the home page |
| `HistoryClient` | Lists previous searches with re-run and delete actions |
| `Footer` | Site footer |
| `AbortErrorSilencer` | Dev-only: suppresses benign `AbortError` in the Next.js dev overlay |

---

## Testing

```
backend/tests/
├── conftest.py            Shared fixtures (temp DB, temp cache dir, sample data)
├── test_api.py            API endpoint tests (10 cases)
├── test_apify_scraper.py  Apify data mapping tests (46 cases)
├── test_auth.py           Authentication tests (12 cases)
├── test_cache.py          Cache system tests (9 cases)
├── test_models.py         Pydantic model tests (15 cases)
└── test_search_tool.py    Search utility tests (~77 cases)
```

**Total: 169 test cases · 80% overall coverage · 98% auth module coverage**

All external services (Apify, Tavily, OpenRouter) are fully mocked — no real API calls in tests.

### Run commands

```bash
make test                          # All suites
make test-cov                      # With HTML coverage report
make test-file FILE=test_auth.py   # Single suite
```

Or manually:

```bash
cd backend
source venv/bin/activate
python -m pytest tests/ -v
python -m pytest tests/ -v --cov=backend --cov-report=term-missing
```

---

## Deployment

### Local development

```bash
make run          # Start backend :8000 + frontend :3000
make backend      # Backend only
make frontend     # Frontend only
make install      # Install all Python + npm dependencies
make cache-clear  # Delete cached search results
make clean        # Remove caches, __pycache__, .next, node_modules
```

### Docker

```bash
make docker       # docker compose up --build
make docker-stop  # docker compose down
make build        # Build frontend for production
```

- Backend image: `python:3.13-slim`
- Frontend: multi-stage build with `output: standalone`
- Cache volume persists across container restarts

---

## Risks & Known Limitations

| Risk | Impact | Mitigation |
|---|---|---|
| Apify credit exhaustion | High | Automatic Tavily fallback |
| Missing price / rating fields | Medium | 4-layer price extraction + AI summary parsing |
| Search latency (10–25 s fresh) | Medium | 1-hour cache + parallel batch extraction + loading animation |
| Accessories appearing in results | Medium | 28-pattern filter + per-category USD price sanity thresholds |
| Auth tokens have no TTL expiry | Low | Deleted on logout; TTL enforcement planned |
| Agent modules unused in production | Low | `search/review/ranking_agent.py` exist but `pipeline.py` uses direct Python |

---

## Roadmap

### Near Term
- Fix LLM justification reliability (choices key error on some model responses)
- Auth token TTL-based automatic expiry
- Per-agent token/cost accounting for the CrewAI run

### Medium Term
- Price history tracking and trend chart
- Search history page for authenticated users (currently localStorage only)
- Full Compare page with best-value column highlights

### Long Term
- Price-drop email / push notifications
- Expand to additional MENA marketplaces (Jumia, Souq)
- Mobile app with barcode scan-to-compare

---

