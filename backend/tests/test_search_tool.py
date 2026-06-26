"""Tests for backend/tools/search_tool.py utilities."""

import pytest
from backend.tools.search_tool import (
    detect_source,
    detect_availability,
    extract_price,
    extract_rating,
    extract_reviews,
    extract_delivery,
    is_search_page,
    filter_relevant_products,
)


class TestDetectSource:
    """Tests for retailer detection from URLs.
    
    Note: The STORES list in search_tool.py currently includes:
    Amazon, Amazon Egypt, and noon. Other stores return "Other".
    """

    def test_amazon(self):
        assert detect_source("https://www.amazon.com/dp/B09WNK39JN/") == "Amazon"
        assert detect_source("https://www.amazon.com/product/test") == "Amazon"

    def test_amazon_egypt(self):
        assert detect_source("https://www.amazon.eg/dp/B09WNK39JN/") == "Amazon Egypt"
        assert detect_source("https://amazon.eg/product/test") == "Amazon Egypt"

    def test_noon(self):
        assert detect_source("https://www.noon.com/product/12345") == "noon"
        assert detect_source("https://noon.com/egypt-en/product/N12345") == "noon"

    def test_unknown_stores(self):
        # Stores not in the STORES list return "Other"
        assert detect_source("https://www.ebay.com/itm/123456789") == "Other"
        assert detect_source("https://www.walmart.com/ip/Product/123") == "Other"
        assert detect_source("https://www.bestbuy.com/site/product/123.p") == "Other"
        assert detect_source("https://www.unknown-store.com/product") == "Other"

    def test_case_insensitive(self):
        assert detect_source("https://WWW.AMAZON.COM/DP/B123/") == "Amazon"
        assert detect_source("https://www.NOON.com/product/123") == "noon"


class TestIsSearchPage:
    """Tests for search/listing page detection."""

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.amazon.com/apple-macbook-pro-13/s?k=apple+macbook+pro+13",
            "https://www.amazon.com/s?k=iphone",
            "https://www.amazon.com/s/ref=nb_sb_noss?keywords=laptop",
            "https://www.ebay.com/sch/i.html?_nkw=iphone",
            "https://www.walmart.com/search?q=ps5",
            "https://www.bestbuy.com/site/searchpage.jsp?st=ipad",
            "https://www.target.com/s?searchTerm=airpods",
            "https://www.newegg.com/p/pl?d=rtx+4090",
            "https://example.com/products?q=test",
            "https://example.com/items?query=laptop",
        ],
    )
    def test_detects_search_pages(self, url):
        assert is_search_page(url) is True

    @pytest.mark.parametrize(
        "url",
        [
            "https://www.amazon.com/dp/B09WNK39JN/",
            "https://www.amazon.com/gp/product/B09WNK39JN",
            "https://www.ebay.com/itm/123456789",
            "https://www.walmart.com/ip/PlayStation-5/123",
            "https://www.bestbuy.com/site/apple-ipad/6418599.p?skuId=6418599",
            "https://www.target.com/p/apple-airpods/-/A-54191097",
        ],
    )
    def test_allows_product_pages(self, url):
        assert is_search_page(url) is False

    def test_empty_url(self):
        assert is_search_page("") is True
        assert is_search_page(None) is True


class TestDetectAvailability:
    """Tests for stock availability detection."""

    @pytest.mark.parametrize(
        "text",
        [
            "This product is out of stock",
            "Currently unavailable",
            "Temporarily unavailable",
            "SOLD OUT",
            "Not available",
            "This item is no longer available",
            "غير متوفر",  # Arabic
            "غير متاح",  # Arabic
            "agotado",  # Spanish
            "rupture de stock",  # French
            "ausverkauft",  # German
        ],
    )
    def test_detects_unavailable(self, text):
        assert detect_availability(text) is False

    @pytest.mark.parametrize(
        "text",
        [
            "In stock - ready to ship",
            "Available for delivery",
            "Ships from Amazon",
            "Add to cart",
            "Buy now",
            "",
        ],
    )
    def test_detects_available(self, text):
        assert detect_availability(text) is True

    def test_empty_text(self):
        assert detect_availability("") is True
        assert detect_availability(None) is True


class TestExtractPrice:
    """Tests for price extraction from text."""

    def test_usd_symbol_before(self):
        value, currency = extract_price("Price: $1,299.99")
        assert value == 1299.99
        assert currency == "$"

    def test_usd_code(self):
        value, currency = extract_price("USD 999.00")
        assert value == 999.00
        assert currency == "$"

    def test_gbp(self):
        value, currency = extract_price("£899.99")
        assert value == 899.99
        assert currency == "£"

    def test_eur(self):
        value, currency = extract_price("€1,199.00")
        assert value == 1199.00
        assert currency == "€"

    def test_egp(self):
        value, currency = extract_price("EGP 54,999")
        assert value == 54999.0
        assert currency == "EGP"

    def test_price_after_number(self):
        value, currency = extract_price("1,299 EUR")
        assert value == 1299.0
        assert currency == "€"

    def test_price_keyword(self):
        value, currency = extract_price("price: 599")
        assert value == 599.0

    def test_no_price(self):
        value, currency = extract_price("No price information")
        assert value is None

    def test_filters_unrealistic_prices(self):
        value, _ = extract_price("$0.50")  # Too low
        assert value is None


class TestExtractRating:
    """Tests for star rating extraction."""

    def test_out_of_five_format(self):
        assert extract_rating("4.5 out of 5 stars") == 4.5

    def test_slash_format(self):
        assert extract_rating("4.7/5") == 4.7

    def test_stars_suffix(self):
        assert extract_rating("4.3 stars") == 4.3

    def test_rating_prefix(self):
        assert extract_rating("Rating: 4.8") == 4.8

    def test_star_symbol(self):
        assert extract_rating("★ 4.2") == 4.2

    def test_no_rating(self):
        assert extract_rating("No rating available") is None

    def test_invalid_rating(self):
        assert extract_rating("6.0 stars") is None  # > 5
        assert extract_rating("0.5 stars") is None  # < 1


class TestExtractReviews:
    """Tests for review count extraction."""

    def test_reviews_suffix(self):
        assert extract_reviews("1,234 reviews") == 1234

    def test_ratings_suffix(self):
        assert extract_reviews("5,678 ratings") == 5678

    def test_customer_reviews(self):
        assert extract_reviews("892 customer reviews") == 892

    def test_parentheses_format(self):
        assert extract_reviews("(2,345 reviews)") == 2345

    def test_global_ratings(self):
        assert extract_reviews("10,000 global ratings") == 10000

    def test_no_reviews(self):
        assert extract_reviews("No reviews yet") is None


class TestExtractDelivery:
    """Tests for delivery info extraction."""

    def test_free_shipping(self):
        assert extract_delivery("Free shipping") is not None
        assert "free" in extract_delivery("Free shipping").lower()

    def test_free_delivery(self):
        result = extract_delivery("Free delivery")
        assert result is not None

    def test_delivery_date(self):
        result = extract_delivery("Delivery by Dec 25")
        assert result is not None

    def test_two_day_shipping(self):
        result = extract_delivery("2-day shipping")
        assert result is not None

    def test_no_delivery_info(self):
        assert extract_delivery("Product description only") is None


class TestFilterRelevantProducts:
    """Tests for accessory filtering."""

    def test_filters_accessories_with_enough_products(self):
        # Need enough products so fallback doesn't trigger (>= 3 after filtering)
        products = [
            {"title": "iPhone 15 Pro Max 256GB", "price": {"value": 1199.00, "currency": "$"}},
            {"title": "iPhone 15 Pro 128GB", "price": {"value": 999.00, "currency": "$"}},
            {"title": "iPhone 15 Plus", "price": {"value": 899.00, "currency": "$"}},
            {"title": "iPhone 15 128GB", "price": {"value": 799.00, "currency": "$"}},
            {"title": "iPhone 15 Case - Clear", "price": {"value": 15.99, "currency": "$"}},  # Accessory
        ]
        filtered = filter_relevant_products(products, "iphone 15")
        titles = [p["title"].lower() for p in filtered]
        # Case should be filtered out (low price triggers accessory heuristic)
        assert not any("case" in t for t in titles)

    def test_keeps_main_products(self, sample_products):
        filtered = filter_relevant_products(sample_products, "iphone 15")
        assert len(filtered) >= 1
        assert any("iphone 15 pro" in p["title"].lower() for p in filtered)

    def test_filters_for_prefix_with_enough_products(self):
        # Need >= 3 products to avoid fallback behavior
        products = [
            {"title": "For iPhone 15 Screen Protector", "price": {"value": 9.99, "currency": "$"}},
            {"title": "iPhone 15 Pro Max", "price": {"value": 1199.00, "currency": "$"}},
            {"title": "iPhone 15 Pro", "price": {"value": 999.00, "currency": "$"}},
            {"title": "iPhone 15", "price": {"value": 799.00, "currency": "$"}},
        ]
        filtered = filter_relevant_products(products, "iphone 15")
        assert len(filtered) >= 3
        # "For iPhone" product should be filtered
        assert not any(p["title"].lower().startswith("for iphone") for p in filtered)

    def test_price_sanity_check_with_enough_products(self):
        # Need >= 3 legitimately priced products to avoid fallback
        products = [
            {"title": "MacBook Pro 14 Knockoff", "price": {"value": 50.00, "currency": "$"}},  # Too cheap
            {"title": "MacBook Pro 14 M3", "price": {"value": 1999.00, "currency": "$"}},
            {"title": "MacBook Pro 14 M3 Pro", "price": {"value": 2499.00, "currency": "$"}},
            {"title": "MacBook Pro 16 M3 Max", "price": {"value": 3499.00, "currency": "$"}},
        ]
        filtered = filter_relevant_products(products, "macbook pro")
        assert len(filtered) >= 3
        # All filtered products should have reasonable prices
        assert all(p["price"]["value"] > 100 for p in filtered)

    def test_fallback_when_too_few_remain(self):
        # When filtering leaves < 3 products, should fallback to priced items
        products = [
            {"title": "iPhone Case", "price": {"value": 15.00, "currency": "$"}},
            {"title": "iPhone Charger", "price": {"value": 20.00, "currency": "$"}},
        ]
        filtered = filter_relevant_products(products, "iphone")
        # Should fall back rather than return empty (resilience clause)
        assert len(filtered) > 0

    def test_limits_results_to_twelve(self):
        # Create many products
        products = [
            {"title": f"Product {i}", "price": {"value": 100 + i, "currency": "$"}}
            for i in range(20)
        ]
        filtered = filter_relevant_products(products, "product")
        assert len(filtered) <= 12

    def test_non_usd_prices_not_filtered_by_price(self):
        # Non-USD prices (like EGP) shouldn't trigger price sanity check
        products = [
            {"title": "iPhone 15", "price": {"value": 50, "currency": "EGP"}},  # 50 EGP is valid
            {"title": "iPhone 15 Pro", "price": {"value": 60000, "currency": "EGP"}},
            {"title": "iPhone 15 Plus", "price": {"value": 55000, "currency": "EGP"}},
        ]
        filtered = filter_relevant_products(products, "iphone 15")
        # All should be kept since EGP prices aren't compared to USD thresholds
        assert len(filtered) == 3
