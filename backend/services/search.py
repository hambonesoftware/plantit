"""Search and tagging services backed by SQLite FTS5."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlmodel import Session


@dataclass
class SearchResult:
    type: str
    id: int
    title: str
    snippet: str


def ensure_indexes(session: Session) -> None:
    """Ensure FTS5 tables and triggers exist and are populated."""

    session.exec(
        text(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS plant_search USING fts5(
                name, species, variety, notes, tags
            );
            """
        )
    )
    session.exec(
        text(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS log_search USING fts5(
                action, notes, plant_name
            );
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS plants_ai AFTER INSERT ON plants BEGIN
                INSERT INTO plant_search(rowid, name, species, variety, notes, tags)
                VALUES (
                    new.id,
                    new.name,
                    new.species,
                    IFNULL(new.variety, ''),
                    IFNULL(new.notes, ''),
                    COALESCE((SELECT trim(group_concat(value, ' ')) FROM json_each(new.tags)), '')
                );
            END;
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS plants_au AFTER UPDATE ON plants BEGIN
                DELETE FROM plant_search WHERE rowid = old.id;
                INSERT INTO plant_search(rowid, name, species, variety, notes, tags)
                VALUES (
                    new.id,
                    new.name,
                    new.species,
                    IFNULL(new.variety, ''),
                    IFNULL(new.notes, ''),
                    COALESCE((SELECT trim(group_concat(value, ' ')) FROM json_each(new.tags)), '')
                );
            END;
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS plants_ad AFTER DELETE ON plants BEGIN
                DELETE FROM plant_search WHERE rowid = old.id;
            END;
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS logs_ai AFTER INSERT ON logs BEGIN
                INSERT INTO log_search(rowid, action, notes, plant_name)
                VALUES (
                    new.id,
                    new.action,
                    IFNULL(new.notes, ''),
                    COALESCE((SELECT name FROM plants WHERE id = new.plant_id), '')
                );
            END;
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS logs_au AFTER UPDATE ON logs BEGIN
                DELETE FROM log_search WHERE rowid = old.id;
                INSERT INTO log_search(rowid, action, notes, plant_name)
                VALUES (
                    new.id,
                    new.action,
                    IFNULL(new.notes, ''),
                    COALESCE((SELECT name FROM plants WHERE id = new.plant_id), '')
                );
            END;
            """
        )
    )
    session.exec(
        text(
            """
            CREATE TRIGGER IF NOT EXISTS logs_ad AFTER DELETE ON logs BEGIN
                DELETE FROM log_search WHERE rowid = old.id;
            END;
            """
        )
    )
    session.commit()
    rebuild_indexes(session)


def rebuild_indexes(session: Session) -> None:
    """Re-populate the FTS tables from base tables."""

    session.exec(text("DELETE FROM plant_search"))
    session.exec(
        text(
            """
            INSERT INTO plant_search(rowid, name, species, variety, notes, tags)
            SELECT
                plants.id,
                plants.name,
                plants.species,
                IFNULL(plants.variety, ''),
                IFNULL(plants.notes, ''),
                COALESCE(
                    (
                        SELECT trim(group_concat(value, ' '))
                        FROM json_each(plants.tags)
                    ),
                    ''
                )
            FROM plants;
            """
        )
    )
    session.exec(text("DELETE FROM log_search"))
    session.exec(
        text(
            """
            INSERT INTO log_search(rowid, action, notes, plant_name)
            SELECT
                logs.id,
                logs.action,
                IFNULL(logs.notes, ''),
                COALESCE(plants.name, '')
            FROM logs
            LEFT JOIN plants ON plants.id = logs.plant_id;
            """
        )
    )
    session.commit()


def search(session: Session, query: str, limit: int = 20) -> list[SearchResult]:
    """Perform a full-text search across plants and logs."""

    normalized = query.strip()
    if not normalized:
        return []
    ensure_indexes(session)
    match = f"{normalized}*"
    statement = text(
        """
        SELECT type, id, title, snippet FROM (
            SELECT
                'plant' AS type,
                plants.id AS id,
                plants.name AS title,
                snippet(plant_search, 0, '<mark>', '</mark>', '…', 10) AS snippet,
                bm25(plant_search) AS rank
            FROM plant_search
            JOIN plants ON plants.id = plant_search.rowid
            WHERE plant_search MATCH :match
            UNION ALL
            SELECT
                'log' AS type,
                logs.id AS id,
                (logs.action || ' · ' || COALESCE(plants.name, '')) AS title,
                snippet(log_search, 0, '<mark>', '</mark>', '…', 10) AS snippet,
                bm25(log_search) AS rank
            FROM log_search
            JOIN logs ON logs.id = log_search.rowid
            LEFT JOIN plants ON plants.id = logs.plant_id
            WHERE log_search MATCH :match
        )
        ORDER BY rank, title
        LIMIT :limit;
        """
    ).bindparams(match=match, limit=limit)
    rows = session.exec(statement).fetchall()
    return [SearchResult(type=row[0], id=row[1], title=row[2], snippet=row[3]) for row in rows]


def list_tags(session: Session) -> list[tuple[str, int]]:
    """Return tag counts ordered by frequency."""

    rows = session.exec(
        text(
            """
            SELECT value AS tag, COUNT(*) AS count
            FROM plants, json_each(plants.tags)
            GROUP BY tag
            ORDER BY count DESC, tag ASC;
            """
        )
    ).fetchall()
    return [(row[0], row[1]) for row in rows]
