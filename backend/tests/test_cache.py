"""Tests for backend/cache.py caching functionality."""

import json
import time
from pathlib import Path
from unittest.mock import patch

import pytest
from backend.cache import get_cached, set_cached, clear_cache


class TestSetAndGetCached:
    """Tests for caching read/write operations."""

    def test_set_and_get(self, temp_cache_dir):
        with patch("backend.cache.CACHE_DIR", Path(temp_cache_dir)):
            products = [{"name": "Test Product", "price": 99.99}]
            set_cached("iphone 15", products)
            result = get_cached("iphone 15")

            assert result is not None
            assert result == products

    def test_get_nonexistent_returns_none(self, temp_cache_dir):
        with patch("backend.cache.CACHE_DIR", Path(temp_cache_dir)):
            result = get_cached("nonexistent query xyz")
            assert result is None

    def test_does_not_cache_empty_results(self, temp_cache_dir):
        with patch("backend.cache.CACHE_DIR", Path(temp_cache_dir)):
            # Empty products list
            set_cached("empty query", [])
            result = get_cached("empty query")
            assert result is None

            # None products
            set_cached("none query", None)
            result = get_cached("none query")
            assert result is None

    def test_cache_normalizes_query(self, temp_cache_dir):
        with patch("backend.cache.CACHE_DIR", Path(temp_cache_dir)):
            products = [{"name": "Test"}]
            set_cached("iPhone 15", products)

            # Should find with different case/spacing
            assert get_cached("iphone 15") is not None
            assert get_cached("  IPHONE 15  ") is not None

    def test_cache_expiration(self, temp_cache_dir):
        with patch("backend.cache.CACHE_DIR", Path(temp_cache_dir)):
            # Set shorter TTL for test
            with patch("backend.cache.CACHE_TTL", 0.1):  # 100ms
                products = [{"name": "Test"}]
                set_cached("expire query", products)

                # Should exist immediately
                assert get_cached("expire query") is not None

                # Wait for expiration
                time.sleep(0.2)

                # Should be expired
                assert get_cached("expire query") is None

    def test_cache_file_structure(self, temp_cache_dir):
        cache_path = Path(temp_cache_dir)
        with patch("backend.cache.CACHE_DIR", cache_path):
            products = [{"name": "Test", "price": 100}]
            set_cached("structure query", products)

            # Find the cache file
            files = list(cache_path.glob("*.json"))
            assert len(files) == 1

            # Verify file contents
            with open(files[0]) as f:
                cached = json.load(f)
                assert "timestamp" in cached
                assert "products" in cached
                assert "query" in cached
                assert cached["products"] == products


class TestClearCache:
    """Tests for cache clearing."""

    def test_clears_all_files(self, temp_cache_dir):
        cache_path = Path(temp_cache_dir)
        with patch("backend.cache.CACHE_DIR", cache_path):
            # Create multiple cache entries
            set_cached("query1", [{"name": "A"}])
            set_cached("query2", [{"name": "B"}])
            set_cached("query3", [{"name": "C"}])

            # Verify files exist
            assert len(list(cache_path.glob("*.json"))) == 3

            # Clear cache
            clear_cache()

            # Verify all cleared
            assert len(list(cache_path.glob("*.json"))) == 0

    def test_clear_empty_cache_dir(self, temp_cache_dir):
        cache_path = Path(temp_cache_dir)
        with patch("backend.cache.CACHE_DIR", cache_path):
            # Should not raise error on empty dir
            clear_cache()

    def test_clear_nonexistent_dir(self, temp_cache_dir):
        nonexistent = Path(temp_cache_dir) / "nonexistent"
        with patch("backend.cache.CACHE_DIR", nonexistent):
            # Should not raise error
            clear_cache()
