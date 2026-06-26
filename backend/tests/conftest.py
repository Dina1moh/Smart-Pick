"""Shared pytest fixtures for SmartPick tests."""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Ensure backend is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Set test environment
os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("TAVILY_API_KEY", "test-key")
os.environ.setdefault("APIFY_API_KEY", "test-key")


@pytest.fixture
def sample_tavily_results():
    """Sample Tavily search results for testing."""
    return [
        {
            "title": "Apple MacBook Pro 14-inch M3 Pro - Amazon.com",
            "url": "https://www.amazon.com/dp/B0CM5JV268/",
            "content": "Apple MacBook Pro 14-inch with M3 Pro chip. Price: $1,999.00. "
            "4.8 out of 5 stars. 1,234 reviews. Free delivery by Dec 25.",
        },
        {
            "title": "MacBook Pro 14 M3 - Best Buy",
            "url": "https://www.bestbuy.com/site/apple-macbook-pro/6534599.p?skuId=6534599",
            "content": "Apple MacBook Pro 14\" M3 Pro. $1,999.99. Rating: 4.7. "
            "2,456 customer reviews. Free 2-day shipping.",
        },
        {
            "title": "Search results for macbook - Amazon",
            "url": "https://www.amazon.com/s?k=macbook+pro",
            "content": "Browse MacBook Pro laptops on Amazon.",
        },
    ]


@pytest.fixture
def sample_apify_items():
    """Sample Apify actor dataset items for testing."""
    return [
        {
            "name": "Apple AirPods Pro (2nd Generation)",
            "url": "https://www.amazon.com/dp/B0D1XD1ZV3/",
            "offers": {"price": 199.99, "priceCurrency": "USD"},
            "aggregateRating": {"ratingValue": 4.7, "reviewCount": 15234},
            "brand": {"name": "Apple"},
            "image": "https://images.amazon.com/airpods.jpg",
            "description": "Active Noise Cancellation, Adaptive Audio.",
        },
        {
            "name": "Sony WH-1000XM5 Headphones",
            "url": "https://www.bestbuy.com/site/sony-headphones/6505727.p",
            "offers": {"price": "$349.99", "priceCurrency": "USD"},
            "rating": 4.5,
            "reviewCount": 8921,
            "brand": {"slogan": "Sony"},
            "image": ["https://images.bestbuy.com/sony.jpg"],
        },
        {
            "name": "Search results page",
            "url": "https://www.amazon.com/s?k=headphones",
            "offers": {},
        },
    ]


@pytest.fixture
def sample_products():
    """Sample products in pipeline format for testing."""
    return [
        {
            "title": "iPhone 15 Pro Max 256GB",
            "url": "https://www.amazon.com/dp/B0CXXXXXXXXX/",
            "price": {"value": 1199.00, "currency": "$"},
            "stars": 4.8,
            "reviewsCount": 5432,
            "delivery": "Free delivery",
            "inStock": True,
            "source": "Amazon",
            "brand": "Apple",
            "breadCrumbs": "Electronics > Cell Phones",
            "thumbnailImage": "https://example.com/iphone.jpg",
        },
        {
            "title": "iPhone 15 Case - Clear",
            "url": "https://www.amazon.com/dp/B0CYYYYYYYY/",
            "price": {"value": 15.99, "currency": "$"},
            "stars": 4.2,
            "reviewsCount": 892,
            "delivery": "Free shipping",
            "inStock": True,
            "source": "Amazon",
        },
        {
            "title": "Samsung Galaxy S24 Ultra",
            "url": "https://www.walmart.com/ip/Samsung-Galaxy-S24/123456",
            "price": {"value": 1299.00, "currency": "$"},
            "stars": 4.6,
            "reviewsCount": 3210,
            "delivery": "2-day shipping",
            "inStock": True,
            "source": "Walmart",
        },
    ]


@pytest.fixture
def temp_cache_dir():
    """Temporary directory for cache testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def test_db_path():
    """Temporary SQLite database for auth testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        yield f.name
    try:
        os.unlink(f.name)
    except OSError:
        pass
