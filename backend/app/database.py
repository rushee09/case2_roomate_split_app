import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Resolve the Prisma DB path absolutely from this file's location
# backend/app/database.py → go up 3 levels to project root → prisma/dev.db
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_DB_PATH = _PROJECT_ROOT / "prisma" / "dev.db"

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("file:"):
    # Convert Prisma "file:./dev.db" or "file:../prisma/dev.db" to absolute path
    raw = DATABASE_URL[5:]
    resolved = (_PROJECT_ROOT / "prisma" / Path(raw).name).resolve()
    DATABASE_URL = f"sqlite:///{resolved}"
else:
    DATABASE_URL = f"sqlite:///{_DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
