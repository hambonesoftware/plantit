"""Photo domain model."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

from backend.services.timeutils import utcnow

if TYPE_CHECKING:  # pragma: no cover
    from backend.models.plant import Plant


class Photo(SQLModel, table=True):
    """A reference to a photo stored on disk."""

    __tablename__ = "photos"

    id: int | None = Field(default=None, primary_key=True)
    plant_id: int = Field(foreign_key="plants.id", index=True)
    filename: str = Field(max_length=255)
    caption: str | None = Field(default=None, max_length=300)
    captured_at: datetime = Field(default_factory=utcnow, index=True)

    plant: "Plant" = Relationship(back_populates="photos")
