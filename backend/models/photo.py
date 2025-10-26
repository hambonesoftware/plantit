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
    file_path: str = Field(max_length=500)
    thumbnail_path: str = Field(max_length=500)
    content_type: str = Field(max_length=100)
    size_bytes: int = Field(default=0)
    width: int = Field(default=0)
    height: int = Field(default=0)
    caption: str | None = Field(default=None, max_length=300)
    captured_at: datetime = Field(default_factory=utcnow, index=True)
    uploaded_at: datetime = Field(default_factory=utcnow, index=True)

    plant: "Plant" = Relationship(back_populates="photos")
