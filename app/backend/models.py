from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base
from .utils import utc_now

class Village(Base):
    __tablename__ = "villages"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    plants: Mapped[list["Plant"]] = relationship("Plant", back_populates="village", cascade="all, delete-orphan")

class Plant(Base):
    __tablename__ = "plants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    village_id: Mapped[int] = mapped_column(ForeignKey("villages.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    species: Mapped[str | None] = mapped_column(String, nullable=True)
    last_watered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    frequency_days: Mapped[int] = mapped_column(Integer, default=3)
    photo_path: Mapped[str | None] = mapped_column(String, nullable=True)

    village: Mapped["Village"] = relationship("Village", back_populates="plants")
    logs: Mapped[list["Log"]] = relationship("Log", back_populates="plant", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship("Task", back_populates="plant", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # 'water' | 'fertilize' | 'repot'
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    plant: Mapped["Plant"] = relationship("Plant", back_populates="tasks")

    __table_args__ = (CheckConstraint("kind in ('water','fertilize','repot')", name="chk_task_kind"),)

class Log(Base):
    __tablename__ = "logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(String, nullable=True)

    plant: Mapped["Plant"] = relationship("Plant", back_populates="logs")
