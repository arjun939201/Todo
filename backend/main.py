import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Integer, String, create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

# Loads local .env during development. Render supplies environment variables directly.
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required.")

# Some PostgreSQL providers use the legacy postgres:// scheme.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy ORM models."""


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


class TodoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    completed: bool | None = None


class TodoResponse(BaseModel):
    id: int
    title: str
    completed: bool

    model_config = {"from_attributes": True}


@asynccontextmanager
async def lifespan(_: FastAPI):
    # For this small application, create the table automatically on startup.
    # A larger application can use Alembic migrations as the schema grows.
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Todo API",
    version="1.0.0",
    lifespan=lifespan,
)

# Render injects the deployed frontend hostname through FRONTEND_URL.
# Local development is also allowed for convenient testing.
allowed_origins = {
    FRONTEND_URL.rstrip("/"),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type"],
)


def clean_title(title: str) -> str:
    """Trim whitespace and reject titles that are empty after trimming."""
    cleaned = title.strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Todo title cannot be empty.",
        )
    return cleaned


@app.get("/")
def root():
    return {"message": "Todo API is running", "docs": "/docs"}


@app.get("/health")
def health():
    try:
        with Session(engine) as db:
            db.execute(select(1))
        return {"status": "ok", "database": "connected"}
    except SQLAlchemyError as exc:
        # Do not expose database credentials/details to the client.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is unavailable.",
        ) from exc


@app.get("/todos", response_model=list[TodoResponse])
def get_todos():
    try:
        with Session(engine) as db:
            return list(db.scalars(select(Todo).order_by(Todo.id.desc())).all())
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to load todos from the database.",
        ) from exc


@app.post("/todos", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(todo: TodoCreate):
    title = clean_title(todo.title)
    try:
        with Session(engine) as db:
            new_todo = Todo(title=title, completed=False)
            db.add(new_todo)
            db.commit()
            db.refresh(new_todo)
            return new_todo
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to create the todo.",
        ) from exc


@app.put("/todos/{todo_id}", response_model=TodoResponse)
def update_todo(todo_id: int, todo: TodoUpdate):
    if todo.title is None and todo.completed is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide a title or completed value to update.",
        )

    try:
        with Session(engine) as db:
            existing = db.get(Todo, todo_id)
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Todo not found.",
                )

            if todo.title is not None:
                existing.title = clean_title(todo.title)
            if todo.completed is not None:
                existing.completed = todo.completed

            db.commit()
            db.refresh(existing)
            return existing
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to update the todo.",
        ) from exc


@app.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(todo_id: int):
    try:
        with Session(engine) as db:
            existing = db.get(Todo, todo_id)
            if existing is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Todo not found.",
                )

            db.delete(existing)
            db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to delete the todo.",
        ) from exc
