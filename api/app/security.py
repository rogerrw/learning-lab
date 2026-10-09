import hashlib
import secrets

import bcrypt

from app.config import get_settings

_DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    b"not-a-real-password", bcrypt.gensalt(rounds=4)
).decode()


def hash_password(password: str) -> str:
    rounds = get_settings().password_bcrypt_rounds
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=rounds)).decode()


def verify_password(password: str, password_hash: str | None) -> bool:
    candidate = password_hash if password_hash else _DUMMY_PASSWORD_HASH
    try:
        matched = bcrypt.checkpw(password.encode(), candidate.encode())
    except ValueError:
        return False
    return matched if password_hash else False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
