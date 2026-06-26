"""Tests for backend/main.py API endpoints."""

import os
import tempfile
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from backend.models import Priority, CompareResponse, ProductResult


@pytest.fixture
def api_client():
    """Create a test client with mocked dependencies."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        test_db = f.name

    try:
        import backend.db as db_module
        original_db_path = db_module.DB_PATH
        db_module.DB_PATH = test_db
        db_module.init_db()

        from backend.main import app
        client = TestClient(app)
        yield client

        db_module.DB_PATH = original_db_path
    finally:
        try:
            os.unlink(test_db)
        except OSError:
            pass


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_returns_ok(self, api_client):
        response = api_client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "smartpick-api"


class TestCompareEndpoint:
    """Tests for product comparison endpoint."""

    def test_compare_validates_input(self, api_client):
        # Missing product
        response = api_client.post(
            "/api/compare",
            json={"priority": "lowest_price"},
        )
        assert response.status_code == 422

        # Missing priority
        response = api_client.post(
            "/api/compare",
            json={"product": "iphone 15"},
        )
        assert response.status_code == 422

    def test_compare_valid_priorities(self, api_client):
        # Mock the pipeline to avoid real API calls
        mock_result = CompareResponse(
            product_query="test product",
            priority=Priority.LOWEST_PRICE,
            results=[
                ProductResult(
                    title="Test Product",
                    url="https://example.com/product",
                    price=999.99,
                    stars=4.5,
                    reviews_count=100,
                    source="Amazon",
                )
            ],
            justification="Best match for your query.",
            total_found=1,
        )

        with patch("backend.main.run_comparison", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = mock_result

            # Test each valid priority
            priorities = ["lowest_price", "best_rating", "best_warranty", "fastest_delivery"]
            for priority in priorities:
                response = api_client.post(
                    "/api/compare",
                    json={"product": "test product", "priority": priority},
                )
                # Should not fail validation
                assert response.status_code == 200, f"Failed for priority: {priority}"

    def test_compare_invalid_priority(self, api_client):
        response = api_client.post(
            "/api/compare",
            json={"product": "test", "priority": "invalid"},
        )
        assert response.status_code == 422

    def test_compare_returns_products(self, api_client):
        mock_result = CompareResponse(
            product_query="iphone 15",
            priority=Priority.LOWEST_PRICE,
            results=[
                ProductResult(
                    title="iPhone 15 Pro",
                    url="https://amazon.com/dp/B123",
                    price=999.99,
                    stars=4.8,
                    reviews_count=5000,
                    source="Amazon",
                    delivery="Free shipping",
                    image="https://example.com/img.jpg",
                )
            ],
            justification="Best overall value.",
            total_found=1,
        )

        with patch("backend.main.run_comparison", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = mock_result

            response = api_client.post(
                "/api/compare",
                json={"product": "iphone 15", "priority": "lowest_price"},
            )

            assert response.status_code == 200
            data = response.json()
            assert "results" in data
            assert len(data["results"]) == 1
            assert data["results"][0]["title"] == "iPhone 15 Pro"
            assert "justification" in data

    def test_compare_handles_empty_results(self, api_client):
        mock_result = CompareResponse(
            product_query="nonexistent",
            priority=Priority.LOWEST_PRICE,
            results=[],
            justification="No products found.",
            total_found=0,
        )

        with patch("backend.main.run_comparison", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = mock_result

            response = api_client.post(
                "/api/compare",
                json={"product": "nonexistent product xyz", "priority": "lowest_price"},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["results"] == []

    def test_compare_handles_pipeline_error(self, api_client):
        with patch("backend.main.run_comparison", new_callable=AsyncMock) as mock_run:
            mock_run.side_effect = Exception("Pipeline failed")

            response = api_client.post(
                "/api/compare",
                json={"product": "test", "priority": "lowest_price"},
            )

            assert response.status_code == 500
            assert "failed" in response.json()["detail"].lower()

    def test_compare_empty_product_rejected(self, api_client):
        response = api_client.post(
            "/api/compare",
            json={"product": "   ", "priority": "lowest_price"},
        )
        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()


class TestCorsConfiguration:
    """Tests for CORS settings."""

    def test_cors_allows_localhost(self, api_client):
        response = api_client.options(
            "/api/compare",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        # Should allow the origin
        assert "access-control-allow-origin" in response.headers

    def test_cors_includes_required_headers(self, api_client):
        mock_result = CompareResponse(
            product_query="test",
            priority=Priority.LOWEST_PRICE,
            results=[],
        )

        with patch("backend.main.run_comparison", new_callable=AsyncMock) as mock_run:
            mock_run.return_value = mock_result

            response = api_client.post(
                "/api/compare",
                json={"product": "test", "priority": "lowest_price"},
                headers={"Origin": "http://localhost:3000"},
            )
            # Check CORS headers present
            cors_header = response.headers.get("access-control-allow-origin", "")
            assert "localhost" in cors_header or cors_header == "*"
