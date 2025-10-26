"""Photo API schemas."""

from datetime import datetime

from pydantic import BaseModel, Field


class PhotoRead(BaseModel):
    """Serialized photo metadata."""

    id: int
    plant_id: int
    filename: str
    file_path: str
    thumbnail_path: str
    content_type: str
    size_bytes: int
    width: int
    height: int
    caption: str | None = Field(default=None)
    captured_at: datetime
    uploaded_at: datetime

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 1,
                "plant_id": 2,
                "filename": "abc.jpg",
                "file_path": "2025/05/abc.jpg",
                "thumbnail_path": "2025/05/thumb_abc.jpg",
                "content_type": "image/jpeg",
                "size_bytes": 345678,
                "width": 1600,
                "height": 1200,
                "caption": "Blooming!",
                "captured_at": "2025-05-01T08:00:00Z",
                "uploaded_at": "2025-05-02T09:00:00Z",
            }
        }
    }
