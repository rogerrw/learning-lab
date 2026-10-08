from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.models import OrgMembership, User, UserSession
from app.schemas import LoginRequest, MeOut, MembershipOut
from app.security import hash_token, new_session_token, verify_password

settings = get_settings()
app = FastAPI(title="Learning Lab")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def to_me(user: User) -> MeOut:
    memberships = sorted(user.memberships, key=lambda membership: membership.organization.name)
    return MeOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        memberships=[
            MembershipOut(
                organization_id=membership.organization.id,
                organization_name=membership.organization.name,
                organization_slug=membership.organization.slug,
                role=membership.role,
            )
            for membership in memberships
        ],
    )


def load_user(db: Session, user_id: UUID) -> User:
    user = db.scalar(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.memberships).selectinload(OrgMembership.organization))
    )
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required.")
    return user


def set_session_cookie(response: Response, raw_token: str) -> None:
    max_age = settings.session_ttl_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=max_age,
        path="/",
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/sessions", response_model=MeOut)
def create_session(body: LoginRequest, response: Response, db: Session = Depends(get_db)) -> MeOut:
    email = body.email.strip()
    user = db.scalar(select(User).where(User.email == email))
    password_ok = verify_password(body.password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="This account is disabled.")

    raw_token = new_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.session_ttl_days)
    db.add(
        UserSession(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            expires_at=expires_at,
        )
    )
    db.commit()
    set_session_cookie(response, raw_token)
    return to_me(load_user(db, user.id))


@app.get("/api/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> MeOut:
    return to_me(user)


@app.delete("/api/sessions", status_code=204)
def delete_session(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        session = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(raw_token)))
        if session is not None and session.user_id == user.id and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    response.delete_cookie(settings.session_cookie_name, path="/")
