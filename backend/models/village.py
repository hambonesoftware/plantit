"""Village domain model."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

from backend.services.timeutils import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from backend.models.plant import Plant


class Village(SQLModel, table=True):
    """A collection of plants managed together."""

    __tablename__ = "villages"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    plants: list["Plant"] = Relationship(back_populates="village")
