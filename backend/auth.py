"""Self-contained email/password authentication for SmartPick.

Stdlib-only: passwords are hashed with ``hashlib.pbkdf2_hmac`` using a unique
per-user salt, and sessions use opaque random tokens (``secrets.token_urlsafe``)
stored in the ``sessions`` table. No external auth dependencies required.
"""

import hashlib
import hmac
import re
import secrets
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from backend.db import get_connection, init_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PBKDF2_ITERATIONS = 240_000
_MIN_PASSWORD_LEN = 6


# --------------------------------------------------------------------------- #
# Schemas
# --------------------------------------------------------------------------- #
class SignupRequest(BaseModel):
    name: Optional[str] = None
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class PublicUser(BaseModel):
    id: int
    name: Optional[str] = None
    email: str


class AuthResponse(BaseModel):
    token: str
    user: PublicUser


class MeResponse(BaseModel):
    user: PublicUser


# --------------------------------------------------------------------------- #
# Helpers (plain functions so they stay testable / reusable)
# --------------------------------------------------------------------------- #
def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _hash_password(password: str, salt: str) -> str:
    derived = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    )
    return derived.hex()


def _verify_password(password: str, salt: str, expected_hash: str) -> bool:
    candidate = _hash_password(password, salt)
    return hmac.compare_digest(candidate, expected_hash)


def _public_user(row: sqlite3.Row) -> PublicUser:
    return PublicUser(id=row["id"], name=row["name"], email=row["email"])


def _create_session(conn: sqlite3.Connection, user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    conn.execute(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
        (token, user_id, _now_iso()),
    )
    return token


def _bearer_token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization[7:].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return token


def get_current_user(authorization: Optional[str] = Header(default=None)) -> PublicUser:
    """FastAPI dependency that resolves the bearer token to a user."""
    token = _bearer_token(authorization)
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT users.id, users.name, users.email
            FROM sessions
            JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return _public_user(row)


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@router.post("/signup", response_model=AuthResponse)
def signup(body: SignupRequest) -> AuthResponse:
    init_db()
    email = _normalize_email(body.email)
    name = (body.name or "").strip() or None

    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Please enter a valid email address")
    if len(body.password) < _MIN_PASSWORD_LEN:
        raise HTTPException(
            status_code=422,
            detail=f"Password must be at least {_MIN_PASSWORD_LEN} characters",
        )

    salt = secrets.token_hex(16)
    password_hash = _hash_password(body.password, salt)

    conn = get_connection()
    try:
        existing = conn.execute(
            "SELECT id FROM users WHERE email = ?", (email,)
        ).fetchone()
        if existing is not None:
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        cursor = conn.execute(
            """
            INSERT INTO users (name, email, password_hash, salt, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, email, password_hash, salt, _now_iso()),
        )
        user_id = int(cursor.lastrowid)
        token = _create_session(conn, user_id)
        conn.commit()
    finally:
        conn.close()

    return AuthResponse(
        token=token, user=PublicUser(id=user_id, name=name, email=email)
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    init_db()
    email = _normalize_email(body.email)

    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, name, email, password_hash, salt FROM users WHERE email = ?",
            (email,),
        ).fetchone()

        if row is None or not _verify_password(body.password, row["salt"], row["password_hash"]):
            raise HTTPException(status_code=401, detail="Incorrect email or password")

        token = _create_session(conn, row["id"])
        conn.commit()
        user = _public_user(row)
    finally:
        conn.close()

    return AuthResponse(token=token, user=user)


@router.get("/me", response_model=MeResponse)
def me(user: PublicUser = Depends(get_current_user)) -> MeResponse:
    return MeResponse(user=user)


@router.post("/logout")
def logout(authorization: Optional[str] = Header(default=None)) -> dict:
    """Invalidate the current session token (no-op if it is unknown)."""
    try:
        token = _bearer_token(authorization)
    except HTTPException:
        return {"ok": True}

    conn = get_connection()
    try:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
