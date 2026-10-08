from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import get_db
from app.models import OrgMembership, User, UserSession
from app.security import hash_token


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if not raw_token:
        raise HTTPException(status_code=401, detail="Sign in required.")

    now = datetime.now(timezone.utc)
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_token(raw_token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
    )
    if session is None:
        raise HTTPException(status_code=401, detail="Sign in required.")

    user = db.scalar(
        select(User)
        .where(User.id == session.user_id)
        .options(selectinload(User.memberships).selectinload(OrgMembership.organization))
    )
    if user is None or user.status != "active":
        raise HTTPException(status_code=401, detail="Sign in required.")
    return user
