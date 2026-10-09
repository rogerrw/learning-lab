from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import User
from app.security import verify_password
from tests.test_sessions import add_user


def test_sign_up_opens_a_session(client: TestClient, db: Session) -> None:
    response = client.post(
        "/api/users",
        json={
            "display_name": "  Ada   Lovelace ",
            "email": "Ada@school.test",
            "password": "correct-password",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@school.test"
    assert body["display_name"] == "Ada Lovelace"
    assert body["memberships"] == []
    assert "learning_lab_session" in response.cookies

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "ada@school.test"

    user = db.scalar(select(User).where(User.email == "ada@school.test"))
    assert user is not None
    assert user.status == "active"
    assert verify_password("correct-password", user.password_hash)


def test_duplicate_email_does_not_replace_the_account(
    client: TestClient, db: Session
) -> None:
    add_user(db, email="ada@school.test", password="original-password")

    response = client.post(
        "/api/users",
        json={
            "display_name": "Someone else",
            "email": "ada@school.test",
            "password": "another-password",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists."
    assert client.get("/api/me").status_code == 401

    signed_in = client.post(
        "/api/sessions",
        json={"email": "ada@school.test", "password": "original-password"},
    )
    assert signed_in.status_code == 200
    assert signed_in.json()["display_name"] == "School admin"


def test_short_password_is_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/users",
        json={
            "display_name": "Ada Lovelace",
            "email": "ada@school.test",
            "password": "short",
        },
    )

    assert response.status_code == 422
    assert (
        response.json()["detail"][0]["msg"]
        == "Value error, Use at least 8 characters."
    )
