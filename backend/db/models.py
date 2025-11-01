"""SQLAlchemy models for the Plantit domain."""
from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import JSON, Date, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utcnow() -> datetime:
    """Return a timezone-aware ``datetime`` in UTC."""

    return datetime.now(timezone.utc)


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

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
    image_url: Mapped[str | None] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(String)
    plant_origin: Mapped[str | None] = mapped_column(String)
    natural_habitat: Mapped[str | None] = mapped_column(String)
    room: Mapped[str | None] = mapped_column(String)
    sunlight: Mapped[str | None] = mapped_column(String)
    pot_size: Mapped[str | None] = mapped_column(String)
    purchased_on: Mapped[date | None] = mapped_column(Date)
    last_watered: Mapped[date | None] = mapped_column(Date)
    last_repotted: Mapped[date | None] = mapped_column(Date)
    dormancy: Mapped[str | None] = mapped_column(String)
    water_average: Mapped[str | None] = mapped_column(String)
    amount: Mapped[str | None] = mapped_column(String)
    activity_log: Mapped[list[dict[str, object]] | None] = mapped_column(JSON)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    village: Mapped[Village] = relationship("Village", back_populates="plants")
    tasks: Mapped[list["Task"]] = relationship(
        "Task", back_populates="plant", cascade="all, delete-orphan"
    )
    waterings: Mapped[list["PlantWateringEvent"]] = relationship(
        "PlantWateringEvent",
        back_populates="plant",
        cascade="all, delete-orphan",
        order_by="PlantWateringEvent.watered_at",
    )


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


class PlantWateringEvent(Base):
    """Recorded watering event for a plant."""

    __tablename__ = "plant_watering_events"
    __table_args__ = (UniqueConstraint("plant_id", "watered_at"),)

    id: Mapped[str] = mapped_column(String, primary_key=True)
    plant_id: Mapped[str] = mapped_column(ForeignKey("plants.id"), nullable=False, index=True)
    watered_at: Mapped[date] = mapped_column(Date, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )

    plant: Mapped[Plant] = relationship("Plant", back_populates="waterings")
