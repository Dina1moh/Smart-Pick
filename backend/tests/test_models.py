"""Tests for backend/models.py Pydantic models."""

import pytest
from pydantic import ValidationError
from backend.models import CompareRequest, ProductResult, CompareResponse, Priority


class TestPriority:
    """Tests for Priority enum."""

    def test_valid_priorities(self):
        assert Priority.LOWEST_PRICE.value == "lowest_price"
        assert Priority.BEST_RATING.value == "best_rating"
        assert Priority.BEST_WARRANTY.value == "best_warranty"
        assert Priority.FASTEST_DELIVERY.value == "fastest_delivery"


class TestCompareRequest:
    """Tests for CompareRequest model."""

    def test_valid_request(self):
        request = CompareRequest(product="iphone 15", priority=Priority.LOWEST_PRICE)
        assert request.product == "iphone 15"
        assert request.priority == Priority.LOWEST_PRICE

    def test_all_valid_priorities(self):
        for priority in Priority:
            request = CompareRequest(product="test", priority=priority)
            assert request.priority == priority

    def test_invalid_priority(self):
        with pytest.raises(ValidationError):
            CompareRequest(product="test", priority="invalid")

    def test_empty_product(self):
        request = CompareRequest(product="", priority=Priority.LOWEST_PRICE)
        assert request.product == ""

    def test_priority_from_string(self):
        # Pydantic should coerce string to enum
        request = CompareRequest(product="test", priority="lowest_price")
        assert request.priority == Priority.LOWEST_PRICE


class TestProductResult:
    """Tests for ProductResult model."""

    def test_minimal_product(self):
        product = ProductResult(
            title="Test Product",
            url="https://example.com/product",
        )
        assert product.title == "Test Product"
        assert product.url == "https://example.com/product"
        assert product.price is None  # Default
        assert product.currency == "$"  # Default
        assert product.source == ""  # Default

    def test_full_product(self):
        product = ProductResult(
            title="iPhone 15 Pro Max",
            url="https://amazon.com/dp/B123",
            price=1199.99,
            currency="$",
            stars=4.8,
            reviews_count=5432,
            quality_score=95.5,
            delivery="Free shipping",
            warranty="1 year",
            image="https://example.com/img.jpg",
            in_stock=True,
            rank=1,
            source="Amazon",
        )
        assert product.reviews_count == 5432
        assert product.delivery == "Free shipping"
        assert product.image == "https://example.com/img.jpg"
        assert product.warranty == "1 year"
        assert product.in_stock is True
        assert product.rank == 1

    def test_nullable_fields(self):
        product = ProductResult(
            title="Test",
            url="https://example.com",
            price=None,
            stars=None,
            reviews_count=None,
            delivery=None,
            warranty=None,
            image=None,
        )
        assert product.price is None
        assert product.stars is None
        assert product.delivery is None

    def test_source_field(self):
        product = ProductResult(
            title="Test",
            url="https://walmart.com/ip/123",
            source="Walmart",
        )
        assert product.source == "Walmart"

    def test_default_values(self):
        product = ProductResult(
            title="Test",
            url="https://example.com",
        )
        assert product.source == ""
        assert product.currency == "$"
        assert product.quality_score == 0.0
        assert product.in_stock is True
        assert product.rank == 0
        assert product.reviews_count == 0  # Default is 0


class TestCompareResponse:
    """Tests for CompareResponse model."""

    def test_response_with_products(self):
        product_a = ProductResult(
            title="Product A",
            url="https://example.com/a",
            price=100.00,
            stars=4.5,
            source="Amazon",
        )
        product_b = ProductResult(
            title="Product B",
            url="https://example.com/b",
            price=120.00,
            stars=4.2,
            source="Walmart",
        )
        response = CompareResponse(
            product_query="iphone",
            priority=Priority.LOWEST_PRICE,
            results=[product_a, product_b],
            top_pick=product_a,
            justification="Product A is recommended due to better price.",
            total_found=2,
        )
        assert len(response.results) == 2
        assert response.top_pick.title == "Product A"
        assert response.justification.startswith("Product A")

    def test_empty_response(self):
        response = CompareResponse(
            product_query="nonexistent",
            priority=Priority.BEST_RATING,
            results=[],
            justification="",
        )
        assert response.results == []
        assert response.justification == ""
        assert response.top_pick is None
        assert response.total_found == 0

    def test_response_serialization(self):
        product = ProductResult(
            title="Test",
            url="https://example.com",
            price=99.99,
            stars=4.5,
            reviews_count=100,
            source="Amazon",
        )
        response = CompareResponse(
            product_query="test query",
            priority=Priority.FASTEST_DELIVERY,
            results=[product],
            top_pick=product,
            justification="Best choice",
            total_found=1,
        )

        # Test model_dump (Pydantic v2)
        data = response.model_dump()
        assert data["results"][0]["title"] == "Test"
        assert data["results"][0]["price"] == 99.99
        assert data["justification"] == "Best choice"
        assert data["product_query"] == "test query"
        assert data["priority"] == "fastest_delivery"

    def test_category_optional(self):
        response = CompareResponse(
            product_query="test",
            priority=Priority.LOWEST_PRICE,
            category="Electronics",
        )
        assert response.category == "Electronics"

        response_no_category = CompareResponse(
            product_query="test",
            priority=Priority.LOWEST_PRICE,
        )
        assert response_no_category.category is None
