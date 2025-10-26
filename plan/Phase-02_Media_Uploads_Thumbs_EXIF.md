# Phase 02 — Media Pipeline (Uploads, EXIF, Thumbnails)
## Objective
Enable image uploads with validation, EXIF extraction, and thumbnail generation; serve media safely.

## Prerequisites
- Phases 00–01 complete.

## Detailed Work Items
1. Add multipart upload endpoint `POST /api/v1/plants/{id}/photos`.
2. Validate MIME types and file size; generate UUID file names.
3. Extract EXIF (orientation, taken_at); auto-rotate thumbnails.
4. Store originals and `thumb_*.jpg`; update Photo table with paths/metadata.
5. Serve `/media/*` from `backend/data/media` with strict path rules.
6. Deletion endpoint removes both DB row and files.

## File Tree Changes
```
backend/services/images.py
backend/api/photos.py
backend/tests/test_photos.py
backend/data/media/.gitignore
```

## API Contract
- `POST /api/v1/plants/{id}/photos` (multipart): returns photo id, file_path, thumb_path, taken_at, caption.
- `DELETE /api/v1/photos/{id}`.

## Tests
- Upload 5–10MB JPEG; invalid type; oversize; EXIF extraction; path traversal protection.

## Manual QA
- Upload images, see thumbnails; delete and confirm disk cleanup.

## Definition of Done
- Uploads and deletes are reliable; thumbnails accurate; tests pass.
