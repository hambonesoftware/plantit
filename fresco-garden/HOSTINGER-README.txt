PLANTIT — FRESCO GARDEN 3.2.0

INSTALL / UPDATE
Upload and extract the full ZIP contents to your existing PlantIt folder in
public_html. index.html must be directly in that folder. Include the hidden
.htaccess file. No build step, database, API key or account is required.
Enable a valid SSL certificate and open the site using HTTPS. The encrypted
backup feature deliberately refuses to run on an insecure HTTP page.
Keep the same address to retain the working browser data. Refresh the browser
or close and reopen your Home Screen app after replacing the application files.
Do not clear website data until you have saved and checked your local backup.

LOCAL BACKUP & RESTORE
Choose Save local backup in the footer, or Settings → Local backup & restore.
Enter and confirm a strong passphrase, create the backup, then use Share / Save
to Files or Download backup. Choose On My iPhone / On My iPad for device-only
storage. The .plantit file contains records, journal and all uploaded plant and
room photos. Save a fresh copy after important changes; this is not automatic.
To restore, choose that file, enter its passphrase, review the verified summary,
then confirm replacement. Keep your passphrase safely; it cannot be recovered.
See PRIVACY-AND-BACKUPS.txt for the complete privacy/security details and limits.

IMPORT
Choose Import plants. Notion ZIP exports, Markdown, TXT, CSV and older PlantIt
record-only JSON are supported. Review the plant names, rooms, history and next
watering dates before importing. The file picker leaves Markdown/TXT selectable
on iPhone. Notion ZIP imports read the text records; embedded Notion photos are
not imported. New encrypted backups use the separate restore screen above.

CARE
Next watering = latest recorded watering + your chosen interval in calendar days.
Edit care & photo lets you change the interval, correct the latest date, set a
next-date override and add your own photo. Logging watering clears the override.
Missing intervals may be estimated from dated history; those are labeled.
Dates are reminders: check the soil before watering.

WIKIPEDIA
Automatic lookups are off by default. Use Find on Wikipedia in a plant’s details,
or enable automatic lookup in settings. Only the species/article query is sent.
Reference images load from Wikimedia; uploaded photos take priority. Your own
notes, dates and photos are never uploaded by the application.

DESIGN
Leafy Italian fresco backgrounds with a brief sparkle when changing rooms.
No Gaussian splats, 3D renderer or continuous background animation is used.
Existing old Gaussian files can be removed after updating; none are required.

CHECKS
node tests/care-import.cjs
node tests/backup.cjs

Records and photos are local to this browser and address. There is no automatic
cross-device synchronization. A separately saved backup survives clearing Safari
website data; the working browser garden does not.
