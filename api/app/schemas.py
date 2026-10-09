from uuid import UUID

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, Field, field_validator


def _normalize_email(value: str) -> str:
    cleaned = value.strip()
    # .test is the reserved domain used by the local seed account.
    allow_reserved = cleaned.lower().rsplit("@", 1)[-1].endswith(".test")
    try:
        return (
            validate_email(
                cleaned,
                check_deliverability=False,
                test_environment=allow_reserved,
            )
            .normalized.lower()
        )
    except EmailNotValidError as exc:
        raise ValueError("Enter a valid email address.") from exc


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=200)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)


class SignupRequest(BaseModel):
    display_name: str = Field(max_length=80)
    email: str
    password: str = Field(max_length=200)

    @field_validator("display_name")
    @classmethod
    def normalize_display_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("Enter your name.")
        return cleaned

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return _normalize_email(value)

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Use at least 8 characters.")
        return value


class MembershipOut(BaseModel):
    organization_id: UUID
    organization_name: str
    organization_slug: str
    role: str


class MeOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    memberships: list[MembershipOut]
