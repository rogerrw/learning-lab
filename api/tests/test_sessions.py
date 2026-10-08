from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import OrgMembership, Organization, User
from app.security import hash_password


def add_user(
    db: Session,
    *,
    email: str,
    password: str = "correct-password",
    status: str = "active",
    role: str = "org_admin",
) -> User:
    org = Organization(name="North High", slug="north-high")
    user = User(
        email=email,
        display_name="School admin",
        password_hash=hash_password(password),
        status=status,
    )
    db.add_all([org, user])
    db.flush()
    db.add(OrgMembership(org_id=org.id, user_id=user.id, role=role))
    db.commit()
    return user


def test_sign_in_returns_membership_and_cookie(client: TestClient, db: Session) -> None:
    add_user(db, email="admin@school.test")

    response = client.post("/api/sessions", json={"email": "Admin@school.test", "password": "correct-password"})

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "admin@school.test"
    assert body["display_name"] == "School admin"
    assert body["memberships"] == [
        {
            "organization_id": body["memberships"][0]["organization_id"],
            "organization_name": "North High",
            "organization_slug": "north-high",
            "role": "org_admin",
        }
    ]
    assert "learning_lab_session" in response.cookies

    me = client.get("/api/me")
    assert me.status_code == 200
    assert me.json()["email"] == "admin@school.test"


def test_wrong_password_does_not_open_a_session(client: TestClient, db: Session) -> None:
    add_user(db, email="admin@school.test")

    response = client.post("/api/sessions", json={"email": "admin@school.test", "password": "nope"})

    assert response.status_code == 401
    assert response.json()["detail"] == "Email or password is incorrect."
    me = client.get("/api/me")
    assert me.status_code == 401


def test_disabled_account_cannot_sign_in(client: TestClient, db: Session) -> None:
    add_user(db, email="admin@school.test", status="disabled")

    response = client.post("/api/sessions", json={"email": "admin@school.test", "password": "correct-password"})

    assert response.status_code == 403
    assert response.json()["detail"] == "This account is disabled."


def test_sign_out_revokes_the_session(client: TestClient, db: Session) -> None:
    add_user(db, email="admin@school.test")
    client.post("/api/sessions", json={"email": "admin@school.test", "password": "correct-password"})

    deleted = client.delete("/api/sessions")
    assert deleted.status_code == 204

    me = client.get("/api/me")
    assert me.status_code == 401
