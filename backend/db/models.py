"""SQLAlchemy models for the Plantit domain."""
from __future__ import annotations

from datetime import datetime, date

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    """Base declarative class used by all models."""


class Village(Base):
    """Persistent representation of a plant village."""

    __tablename__ = "villages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    climate: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    established_at: Mapped[date | None] = mapped_column(Date)
    irrigation_type: Mapped[str | None] = mapped_column(String)
    health_score: Mapped[float] = mapped_column(Float, nullable=False)

    plants: Mapped[list["Plant"]] = relationship(
        "Plant", back_populates="village", cascade="all, delete-orphan"
    )


class Plant(Base):
    """Persistent representation of a plant."""

    __tablename__ = "plants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    village_id: Mapped[str] = mapped_column(ForeignKey("villages.id"), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    species: Mapped[str] = mapped_column(String, nullable=False)
    stage: Mapped[str] = mapped_column(String, nullable=False)
    last_watered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    health_score: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    village: Mapped[Village] = relationship("Village", back_populates="plants")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="plant")


class Task(Base):
    """Task scheduled for the current day."""

    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_type: Mapped[str] = mapped_column("type", String, nullable=False)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), nullable=False, index=True)
    plant_name: Mapped[str] = mapped_column(String, nullable=False)
    village_name: Mapped[str] = mapped_column(String, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    priority: Mapped[str] = mapped_column(String, nullable=False)

    plant: Mapped[Plant] = relationship("Plant", back_populates="tasks")
