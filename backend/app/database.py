import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Docker servis adı 'db' olduğu için host olarak 'db' kullanıyoruz
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@db:5432/parsec_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
