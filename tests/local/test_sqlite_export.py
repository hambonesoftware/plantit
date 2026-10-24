import importlib.util
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'export_sqlite_backup.py'
spec = importlib.util.spec_from_file_location('sqlite_export', SCRIPT)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.database = self.root / 'legacy.db'
        with sqlite3.connect(self.database) as connection:
            connection.executescript('''
                CREATE TABLE villages (id TEXT, name TEXT, climate TEXT, health_score REAL);
                CREATE TABLE plants (id TEXT, village_id TEXT, display_name TEXT, species TEXT,
                    health_score REAL, stage TEXT, image_url TEXT, activity_log TEXT);
                CREATE TABLE plant_watering_events (plant_id TEXT, watered_at TEXT);
                INSERT INTO villages VALUES ('v1', 'Kitchen', 'Indoor', 0.5);
                INSERT INTO plants VALUES ('p1', 'v1', 'Fern', 'Fern', 0.7, 'mature', NULL, '[]');
                INSERT INTO plant_watering_events VALUES ('p1', '2026-01-01');
                INSERT INTO plant_watering_events VALUES ('p1', '2026-01-08');
            ''')

    def test_export_preserves_data_and_does_not_change_database(self):
        before = self.database.read_bytes()
        output = self.root / 'backup.json'
        self.assertEqual(exporter.export_database(self.database, output), (1, 1, 0))
        backup = json.loads(output.read_text())
        self.assertEqual(backup['schemaVersion'], 2)
        self.assertEqual(backup['payload']['plants'][0]['wateringHistory'], ['2026-01-01', '2026-01-08'])
        self.assertEqual(self.database.read_bytes(), before)
        with self.assertRaises(ValueError):
            exporter.export_database(self.database, output)

    def test_external_photo_requires_explicit_omission(self):
        with sqlite3.connect(self.database) as connection:
            connection.execute("UPDATE plants SET image_url = 'https://external.invalid/photo.jpg'")
        output = self.root / 'backup.json'
        with self.assertRaises(ValueError):
            exporter.export_database(self.database, output)
        self.assertFalse(output.exists())
        self.assertEqual(exporter.export_database(self.database, output, True), (1, 1, 1))
        self.assertIsNone(json.loads(output.read_text())['payload']['plants'][0]['imageUrl'])


if __name__ == '__main__':
    unittest.main()
