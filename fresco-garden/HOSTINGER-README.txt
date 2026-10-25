PLANTIT — FRESCO GARDEN 3.0.0

Leafy Italian botanical fresco backgrounds with a brief gold sparkle when
changing rooms. There is no 3D renderer, scene model, camera movement, GPU
setup, canvas animation or persistent particle animation in this edition.

INSTALL OR UPDATE
Upload and extract these files into the SAME Hostinger folder that currently
serves your PlantIt design. index.html, app.js, style.css, local-media.js,
service-worker.js and assets/ must be directly in that folder. No build step,
API key, database, CDN, WebGL or Python installation is needed.

Refresh Safari after uploading. For a Home Screen app, close and reopen it.
Keep the same URL to retain your browser-local notes and room photographs.
Do not clear website data. The new service worker removes this app's old
model cache automatically without deleting notes or photographs.

The earlier gaussian-world.js, splat-math.js, splat-sort-worker.js,
splat-decode-worker.js and assets/scenes/ can be deleted from the hosting
folder after uploading if they are still present. Nothing in this edition
loads them. They are omitted from this ZIP.

BEHAVIOR
Choose Sunroom, Vine House or Fern Alcove to change the painted background.
A brief sparkle accompanies the background fade, then all motion stops.
Reduced-motion preferences or the sun-icon motion setting disable it.
Plant records open immediately. Room photographs use ordinary previous/next
controls with no special effect. Notes, care records, and photographs remain
local to your browser. Uploaded photos never become decorative backgrounds.

This is the standalone design edition with three sample plant records. It
does not migrate your existing PlantIt backend, accounts or Notion imports.
The included species references and starting care dates/counts are examples.
All required assets are bundled. See CREDITS.txt for photograph attribution.

VERSION 3.1.0 — FUNCTIONAL COLLECTION
Upload the contents of this ZIP to public_html, with index.html directly inside it.
Open Import plants (also available in Garden settings). Import Notion ZIP exports,
Markdown/TXT, CSV, or PlantIt JSON. Review dates before confirming. On iPhone,
choose files from Browse; the file picker does not restrict Markdown/TXT types.
ZIP imports read text records; embedded Notion photos are not imported. Add your
own plant photos using Edit care & photo. Exported JSON contains plant records,
watering history and notes, but uploaded images remain in browser storage.

Next water date = latest recorded watering + interval in calendar days.
A manual next-date override is supported; logging watering clears the override.
Missing intervals are estimated from median gaps in dated history and labeled.
Dates are reminders: check the soil before watering. Edit care to correct the
most recent watering date, choose an interval or set a manual next date.

Wikipedia lookup requires internet. Only the species/article query is sent to
Wikipedia, without cookies. Your personal notes and dates stay in your browser.
Your own photo takes priority; otherwise the Wikipedia reference image is used.
If no suitable article/photo is available, a neutral plant illustration remains.
Use Find on Wikipedia / Change Wikipedia article to select a better match.
All notes/dates/photos are local to the current browser and domain; they do not
sync across devices. Export before moving hosts. No Flask server is required.

Verification: node tests/care-import.cjs
