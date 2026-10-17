"""Export a legacy database read-only into a complete local-PWA backup."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3

VILLAGE_FIELDS = {
    'name': 'name', 'climate': 'climate', 'description': 'description',
    'establishedAt': 'established_at', 'irrigationType': 'irrigation_type', 'healthScore': 'health_score',
}
PLANT_FIELDS = {
    'villageId': 'village_id', 'displayName': 'display_name', 'species': 'species', 'stage': 'stage',
    'lastWateredAt': 'last_watered_at', 'healthScore': 'health_score', 'notes': 'notes',
    'imageUrl': 'image_url', 'family': 'family', 'plantOrigin': 'plant_origin',
    'naturalHabitat': 'natural_habitat', 'room': 'room', 'sunlight': 'sunlight',
    'potSize': 'pot_size', 'purchasedOn': 'purchased_on', 'lastWatered': 'last_watered',
    'lastRepotted': 'last_repotted', 'dormancy': 'dormancy', 'waterAverage': 'water_average', 'amount': 'amount',
}


def export_database(database, output, omit_remote_photos=False):
    database = Path(database).resolve(strict=True)
    output = Path(output).resolve()
    if output.exists():
        raise ValueError('Output already exists. Choose a new filename to preserve that backup.')
    generated = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(database.as_uri() + '?mode=ro', uri=True) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute('BEGIN')  # A consistent read snapshot even if the old app is still running.
        tables = {row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {'villages', 'plants'}.issubset(tables):
            raise ValueError('This is not a PlantIt database with villages and plants.')
        def record(row, fields):
            source = dict(row)
            return {'id': source['id'], 'updatedAt': source.get('updated_at') or generated,
                    **{target: source.get(column) for target, column in fields.items()}}
        villages = [record(row, VILLAGE_FIELDS) for row in connection.execute('SELECT * FROM villages')]
        plants = []
        omitted = 0
        for row in connection.execute('SELECT * FROM plants'):
            plant = record(row, PLANT_FIELDS)
            photo = plant.get('imageUrl')
            if photo and not photo.lower().startswith(('data:image/png;base64,', 'data:image/jpeg;base64,', 'data:image/webp;base64,', 'data:image/gif;base64,')):
                if not omit_remote_photos:
                    raise ValueError('A photo uses an external or unsupported URL. Re-run with --omit-remote-photos to leave those photos out.')
                plant['imageUrl'] = None
                omitted += 1
            activity = dict(row).get('activity_log')
            plant['activityLog'] = json.loads(activity) if activity else []
            plant['wateringHistory'] = [event[0] for event in connection.execute(
                'SELECT watered_at FROM plant_watering_events WHERE plant_id = ? ORDER BY watered_at', (plant['id'],)
            )] if 'plant_watering_events' in tables else []
            plants.append(plant)
    bundle = {'schemaVersion': 2, 'generatedAt': generated,
              'metadata': {'application': 'PlantIt', 'source': 'legacy-sqlite', 'omittedPhotos': omitted},
              'payload': {'villages': villages, 'plants': plants, 'dismissals': []}}
    serialized = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))
    if len(serialized.encode()) > 100 * 1024 * 1024:
        raise ValueError('This backup exceeds the PWA 100 MB restore limit. Reduce photo sizes before migration.')
    with output.open('x', encoding='utf-8') as destination:
        destination.write(serialized)
    return len(villages), len(plants), omitted


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--omit-remote-photos', action='store_true')
    args = parser.parse_args()
    try:
        villages, plants, omitted = export_database(args.database, args.output, args.omit_remote_photos)
    except (OSError, ValueError, sqlite3.Error) as error:
        parser.exit(1, f'Export failed: {error}\n')
    print(f'Exported {villages} villages and {plants} plants; omitted {omitted} photos.')


if __name__ == '__main__':
    main()
