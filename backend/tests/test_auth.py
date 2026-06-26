"""Tests for backend/auth.py authentication functionality."""

import os
import sqlite3
import tempfile
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def auth_client():
    """Create a test client with isolated test database."""
    # Create temp database
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        test_db = f.name

    try:
        # Patch database path before importing
        with patch.dict(os.environ, {"TEST_DB_PATH": test_db}):
            # Patch the DB_PATH in the db module
            import backend.db as db_module
            original_db_path = db_module.DB_PATH
            db_module.DB_PATH = test_db

            # Initialize DB
            db_module.init_db()

            # Import and create app
            from backend.main import app
            client = TestClient(app)

            yield client

            # Cleanup
            db_module.DB_PATH = original_db_path
    finally:
        try:
            os.unlink(test_db)
        except OSError:
            pass


class TestSignup:
    """Tests for user registration."""

    def test_signup_success(self, auth_client):
        response = auth_client.post(
            "/api/auth/signup",
            json={
                "email": "test@example.com",
                "password": "securepass123",
                "name": "Test User",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"
        assert data["user"]["name"] == "Test User"
        assert "password" not in data["user"]

    def test_signup_duplicate_email(self, auth_client):
        # First signup
        auth_client.post(
            "/api/auth/signup",
            json={"email": "dupe@example.com", "password": "pass123", "name": "First"},
        )

        # Second signup with same email
        response = auth_client.post(
            "/api/auth/signup",
            json={"email": "dupe@example.com", "password": "pass456", "name": "Second"},
        )
        assert response.status_code == 409  # Conflict
        assert "already exists" in response.json()["detail"].lower()

    def test_signup_missing_fields(self, auth_client):
        response = auth_client.post(
            "/api/auth/signup",
            json={"email": "test@example.com"},
        )
        assert response.status_code == 422  # Validation error

    def test_signup_invalid_email(self, auth_client):
        response = auth_client.post(
            "/api/auth/signup",
            json={"email": "not-an-email", "password": "pass123", "name": "Test"},
        )
        # FastAPI validates email format
        assert response.status_code in [400, 422]


class TestLogin:
    """Tests for user login."""

    def test_login_success(self, auth_client):
        # Create user
        auth_client.post(
            "/api/auth/signup",
            json={"email": "login@example.com", "password": "mypassword", "name": "Login Test"},
        )

        # Login
        response = auth_client.post(
            "/api/auth/login",
            json={"email": "login@example.com", "password": "mypassword"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["user"]["email"] == "login@example.com"

    def test_login_wrong_password(self, auth_client):
        # Create user
        auth_client.post(
            "/api/auth/signup",
            json={"email": "wrong@example.com", "password": "correct", "name": "Test"},
        )

        # Login with wrong password
        response = auth_client.post(
            "/api/auth/login",
            json={"email": "wrong@example.com", "password": "incorrect"},
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_nonexistent_user(self, auth_client):
        response = auth_client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "anything"},
        )
        assert response.status_code == 401


class TestMe:
    """Tests for getting current user."""

    def test_me_with_valid_token(self, auth_client):
        # Create and login user
        signup_response = auth_client.post(
            "/api/auth/signup",
            json={"email": "me@example.com", "password": "pass123", "name": "Me Test"},
        )
        token = signup_response.json()["token"]

        # Get current user
        response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        # Response wraps user in {"user": {...}}
        assert data["user"]["email"] == "me@example.com"
        assert data["user"]["name"] == "Me Test"

    def test_me_without_token(self, auth_client):
        response = auth_client.get("/api/auth/me")
        assert response.status_code == 401

    def test_me_with_invalid_token(self, auth_client):
        response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer invalid-token-12345"},
        )
        assert response.status_code == 401


class TestLogout:
    """Tests for user logout."""

    def test_logout_invalidates_token(self, auth_client):
        # Create and login user
        signup_response = auth_client.post(
            "/api/auth/signup",
            json={"email": "logout@example.com", "password": "pass123", "name": "Logout Test"},
        )
        token = signup_response.json()["token"]

        # Verify token works
        me_response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_response.status_code == 200

        # Logout
        logout_response = auth_client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logout_response.status_code == 200

        # Token should no longer work
        me_response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_response.status_code == 401

    def test_logout_without_token(self, auth_client):
        # Logout without token is a no-op (returns 200 with ok:true)
        response = auth_client.post("/api/auth/logout")
        assert response.status_code == 200
        assert response.json()["ok"] is True
