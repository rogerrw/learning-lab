from sqlalchemy import select

from app.config import get_settings
from app.database import SessionLocal
from app.models import Organization, OrgMembership, User
from app.security import hash_password


def seed() -> None:
    settings = get_settings()
    with SessionLocal() as db:
        org = db.scalar(
            select(Organization).where(Organization.slug == settings.seed_org_slug)
        )
        if org is None:
            org = Organization(name=settings.seed_org_name, slug=settings.seed_org_slug)
            db.add(org)
            db.flush()

        user = db.scalar(select(User).where(User.email == settings.seed_admin_email))
        if user is None:
            user = User(
                email=settings.seed_admin_email,
                display_name=settings.seed_admin_name,
                password_hash=hash_password(settings.seed_admin_password),
                status="active",
            )
            db.add(user)
            db.flush()

        membership = db.scalar(
            select(OrgMembership).where(
                OrgMembership.org_id == org.id,
                OrgMembership.user_id == user.id,
            )
        )
        if membership is None:
            db.add(OrgMembership(org_id=org.id, user_id=user.id, role="org_admin"))

        db.commit()
        print(f"Seeded {user.email} as org_admin of {org.slug}")


if __name__ == "__main__":
    seed()
