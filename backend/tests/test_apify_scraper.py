"""Tests for backend/tools/apify_scraper.py utilities."""

import pytest
from backend.tools.apify_scraper import (
    _normalize_currency,
    _first,
    _to_float,
    _to_int,
    _coerce_price,
    _extract_offers,
    _extract_rating,
    _extract_reviews,
    _extract_brand,
    _map_item,
)


class TestNormalizeCurrency:
    """Tests for currency normalization."""

    def test_usd_variants(self):
        assert _normalize_currency("USD") == "$"
        assert _normalize_currency("US$") == "$"
        assert _normalize_currency("$") == "$"
        assert _normalize_currency("usd") == "$"

    def test_gbp(self):
        assert _normalize_currency("GBP") == "£"
        assert _normalize_currency("£") == "£"

    def test_eur(self):
        assert _normalize_currency("EUR") == "€"
        assert _normalize_currency("€") == "€"

    def test_egp(self):
        assert _normalize_currency("EGP") == "EGP"

    def test_other_currencies(self):
        assert _normalize_currency("AED") == "AED"
        assert _normalize_currency("SAR") == "SAR"
        assert _normalize_currency("INR") == "₹"

    def test_none_defaults_to_usd(self):
        assert _normalize_currency(None) == "$"
        assert _normalize_currency("") == "$"


class TestFirst:
    """Tests for _first helper."""

    def test_returns_first_present(self):
        d = {"a": None, "b": "value", "c": "other"}
        assert _first(d, "a", "b", "c") == "value"

    def test_returns_none_if_none_present(self):
        d = {"a": None, "b": None}
        assert _first(d, "a", "b", "missing") is None

    def test_handles_empty_dict(self):
        assert _first({}, "a", "b") is None


class TestToFloat:
    """Tests for _to_float conversion."""

    def test_from_int(self):
        assert _to_float(100) == 100.0

    def test_from_float(self):
        assert _to_float(99.99) == 99.99

    def test_from_string(self):
        assert _to_float("199.99") == 199.99

    def test_from_currency_string(self):
        assert _to_float("$1,299.99") == 1299.99

    def test_none_returns_none(self):
        assert _to_float(None) is None

    def test_invalid_returns_none(self):
        assert _to_float("not a number") is None


class TestToInt:
    """Tests for _to_int conversion."""

    def test_from_int(self):
        assert _to_int(100) == 100

    def test_from_float(self):
        assert _to_int(99.9) == 99

    def test_from_string(self):
        assert _to_int("1234") == 1234


class TestCoercePrice:
    """Tests for price coercion from various formats."""

    def test_numeric_price(self):
        value, currency = _coerce_price(199.99)
        assert value == 199.99
        assert currency is None

    def test_string_price(self):
        value, currency = _coerce_price("$299.99")
        assert value == 299.99

    def test_dict_price(self):
        value, currency = _coerce_price({"value": 399.99, "currency": "USD"})
        assert value == 399.99
        assert currency == "USD"

    def test_dict_amount(self):
        value, currency = _coerce_price({"amount": 499.99})
        assert value == 499.99

    def test_list_price(self):
        value, currency = _coerce_price([{"value": 599.99}, {"value": 699.99}])
        assert value == 599.99

    def test_none_price(self):
        value, currency = _coerce_price(None)
        assert value is None
        assert currency is None


class TestExtractOffers:
    """Tests for offers extraction."""

    def test_dict_offers(self):
        item = {"offers": {"price": 199.99, "priceCurrency": "USD"}}
        offers = _extract_offers(item)
        assert offers["price"] == 199.99

    def test_list_offers(self):
        item = {"offers": [{"price": 299.99}, {"price": 399.99}]}
        offers = _extract_offers(item)
        assert offers["price"] == 299.99

    def test_no_offers(self):
        item = {"name": "Product"}
        offers = _extract_offers(item)
        assert offers == {}


class TestExtractRating:
    """Tests for rating extraction from Apify items."""

    def test_aggregate_rating(self):
        item = {"aggregateRating": {"ratingValue": 4.5}}
        assert _extract_rating(item) == 4.5

    def test_top_level_rating(self):
        item = {"rating": 4.2}
        assert _extract_rating(item) == 4.2

    def test_stars_field(self):
        item = {"stars": 4.8}
        assert _extract_rating(item) == 4.8

    def test_no_rating(self):
        item = {"name": "Product"}
        assert _extract_rating(item) is None


class TestExtractReviews:
    """Tests for review count extraction from Apify items."""

    def test_aggregate_review_count(self):
        item = {"aggregateRating": {"reviewCount": 1234}}
        assert _extract_reviews(item) == 1234

    def test_rating_count(self):
        item = {"aggregateRating": {"ratingCount": 5678}}
        assert _extract_reviews(item) == 5678

    def test_top_level_review_count(self):
        item = {"reviewCount": 9012}
        assert _extract_reviews(item) == 9012

    def test_no_reviews(self):
        item = {"name": "Product"}
        assert _extract_reviews(item) is None


class TestExtractBrand:
    """Tests for brand extraction."""

    def test_brand_name(self):
        item = {"brand": {"name": "Apple"}}
        assert _extract_brand(item) == "Apple"

    def test_brand_slogan(self):
        item = {"brand": {"slogan": "Sony"}}
        assert _extract_brand(item) == "Sony"

    def test_string_brand(self):
        item = {"brand": "Samsung"}
        assert _extract_brand(item) == "Samsung"

    def test_no_brand(self):
        item = {"name": "Product"}
        assert _extract_brand(item) == ""


class TestMapItem:
    """Tests for mapping Apify items to pipeline format."""

    def test_maps_complete_item(self, sample_apify_items):
        item = sample_apify_items[0]
        mapped = _map_item(item)

        assert mapped is not None
        assert mapped["title"] == "Apple AirPods Pro (2nd Generation)"
        assert mapped["url"] == "https://www.amazon.com/dp/B0D1XD1ZV3/"
        assert mapped["price"]["value"] == 199.99
        assert mapped["price"]["currency"] == "$"
        assert mapped["stars"] == 4.7
        assert mapped["reviewsCount"] == 15234
        assert mapped["brand"] == "Apple"
        assert mapped["source"] == "Amazon"

    def test_maps_string_price(self, sample_apify_items):
        item = sample_apify_items[1]
        mapped = _map_item(item)

        assert mapped is not None
        assert mapped["price"]["value"] == 349.99

    def test_filters_search_pages(self, sample_apify_items):
        item = sample_apify_items[2]  # Search page URL
        mapped = _map_item(item)
        assert mapped is None

    def test_requires_name_and_url(self):
        assert _map_item({"name": "Test"}) is None
        assert _map_item({"url": "https://example.com"}) is None
        assert _map_item({}) is None

    def test_handles_list_image(self):
        item = {
            "name": "Product",
            "url": "https://www.amazon.com/dp/B123/",
            "image": ["https://img1.jpg", "https://img2.jpg"],
        }
        mapped = _map_item(item)
        assert mapped["thumbnailImage"] == "https://img1.jpg"

    def test_handles_dict_image(self):
        item = {
            "name": "Product",
            "url": "https://www.amazon.com/dp/B123/",
            "image": {"url": "https://img.jpg"},
        }
        mapped = _map_item(item)
        assert mapped["thumbnailImage"] == "https://img.jpg"

    def test_builds_content_blob(self, sample_apify_items):
        item = sample_apify_items[0]
        mapped = _map_item(item)
        assert mapped["content"] is not None
        assert "Apple" in mapped["content"]
        assert "AirPods" in mapped["content"]
