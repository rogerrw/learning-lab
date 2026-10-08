import os

os.environ["DATABASE_URL"] = "postgresql+psycopg://learning_lab:learning_lab@localhost:5434/learning_lab_test"
os.environ["PASSWORD_BCRYPT_ROUNDS"] = "4"

from collections.abc import Iterator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal, engine
from app.main import app

get_settings.cache_clear()


@pytest.fixture(scope="session", autouse=True)
def migrated() -> None:
    get_settings.cache_clear()
    command.upgrade(Config("alembic.ini"), "head")


@pytest.fixture(autouse=True)
def clean_tables() -> Iterator[None]:
    yield
    with engine.begin() as connection:
        connection.execute(text("TRUNCATE sessions, org_memberships, users, organizations CASCADE"))


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
